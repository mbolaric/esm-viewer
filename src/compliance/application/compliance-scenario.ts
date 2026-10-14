import { isNonNegativeSafeInteger, isSha256Digest, isUnknownRecord, type Sha256Digest } from '#contracts';
import { isJsonPointer, isUtcTimestamp, type JsonPointer, type UtcTimestamp } from '#tachograph-domain';
import { MILLISECONDS_PER_MINUTE } from '#time';
import { projectDocumentCanonicalActivityDays, type OpenedTachographDocument } from '#viewer-application';
import {
    evaluateComplianceIntervals,
    evaluateDocumentCompliance,
    type IComplianceEvaluationResult,
} from './compliance-service.js';
import { EU_561_2006_STANDARD, EU_MOBILITY_PACKAGE_2020, type IRuleProfile } from '../domain/rule-profile.js';
import { mergeContiguousActivityIntervals } from '../domain/interval-merge.js';
import { resolveUnrecordedTime, type EvaluationInterval } from '../domain/unrecorded-time.js';
import type { IArticle12CycleExtension, IConfirmedFerryRest } from '../domain/scenario-evidence.js';
import type { INightWindow } from '../domain/evaluators/working-time-evaluator.js';

export const COMPLIANCE_SCENARIO_VERSION = '1';
export const MAX_COMPLIANCE_SCENARIO_ASSUMPTIONS = 100;

interface IScenarioEvidenceRange {
    readonly basisId: string;
    readonly sourcePointer: JsonPointer;
    readonly start: UtcTimestamp;
    readonly end: UtcTimestamp;
}

export type ComplianceScenarioAssumption =
    | (IScenarioEvidenceRange & { readonly kind: 'unrecordedActivity'; readonly activity: 'work' | 'breakOrRest' })
    | (IScenarioEvidenceRange & { readonly kind: 'crewPresence' })
    | (IScenarioEvidenceRange & { readonly kind: 'outOfScope'; readonly outsideRegulation561: true })
    | (IScenarioEvidenceRange & {
          readonly kind: 'ferryRest';
          readonly restKind: 'regularDaily' | 'reducedWeekly' | 'regularWeekly';
          readonly accompaniedVehicle: true;
          readonly sleepingAccommodation: 'bunkOrCouchette' | 'cabin';
          readonly scheduledCrossingMinutes: number;
      })
    | (IScenarioEvidenceRange & {
          readonly kind: 'article12Return';
          readonly dutyStart: UtcTimestamp;
          readonly maximumExtensionMinutes: 60 | 120;
          readonly weeklyRestKind: 'reduced' | 'regular';
          readonly destination: 'residence' | 'operationalCentre';
          readonly exceptionalCircumstances: true;
          readonly roadSafetyMaintained: true;
          readonly writtenReason: true;
          readonly compensatedByDeadline: true;
      });

export interface IComplianceScenarioRequest {
    readonly contentSha256: Sha256Digest;
    readonly assumptions: readonly ComplianceScenarioAssumption[];
}

export type ComplianceScenarioUnavailableReason =
    | 'invalidRequest'
    | 'contentChanged'
    | 'driverActivitiesRequired'
    | 'unsupportedProfile'
    | 'conflictingAssumptions'
    | 'sourceRangeUnavailable'
    | 'unrecordedTimeRequired'
    | 'drivingRequired'
    | 'ferryConditionsUnavailable'
    | 'article12ConditionsUnavailable';

export type ComplianceScenarioResult =
    | {
          readonly status: 'unavailable';
          readonly reason: ComplianceScenarioUnavailableReason;
          readonly basisId: string | null;
          readonly baseline: IComplianceEvaluationResult | null;
      }
    | {
          readonly status: 'available';
          readonly baseline: IComplianceEvaluationResult;
          readonly reviewed: Omit<IComplianceEvaluationResult, 'evaluationIntervals'>;
          readonly basis: IComplianceScenarioRequest & { readonly calculationVersion: typeof COMPLIANCE_SCENARIO_VERSION };
      };

function isAssumption(value: unknown): value is ComplianceScenarioAssumption {
    if (
        !isUnknownRecord(value) ||
        typeof value['basisId'] !== 'string' ||
        value['basisId'].trim().length === 0 ||
        new TextEncoder().encode(value['basisId']).byteLength > 256 ||
        value['basisId'].includes('\0') ||
        !isJsonPointer(value['sourcePointer']) ||
        !isUtcTimestamp(value['start']) ||
        !isUtcTimestamp(value['end']) ||
        value['start'] >= value['end']
    ) {
        return false;
    }
    switch (value['kind']) {
        case 'unrecordedActivity':
            return value['activity'] === 'work' || value['activity'] === 'breakOrRest';
        case 'crewPresence':
            return true;
        case 'outOfScope':
            return value['outsideRegulation561'] === true;
        case 'ferryRest':
            return (
                (value['restKind'] === 'regularDaily' ||
                    value['restKind'] === 'reducedWeekly' ||
                    value['restKind'] === 'regularWeekly') &&
                value['accompaniedVehicle'] === true &&
                (value['sleepingAccommodation'] === 'bunkOrCouchette' || value['sleepingAccommodation'] === 'cabin') &&
                isNonNegativeSafeInteger(value['scheduledCrossingMinutes']) &&
                value['scheduledCrossingMinutes'] > 0
            );
        case 'article12Return':
            return (
                isUtcTimestamp(value['dutyStart']) &&
                (value['maximumExtensionMinutes'] === 60 || value['maximumExtensionMinutes'] === 120) &&
                (value['weeklyRestKind'] === 'reduced' || value['weeklyRestKind'] === 'regular') &&
                (value['destination'] === 'residence' || value['destination'] === 'operationalCentre') &&
                ['exceptionalCircumstances', 'roadSafetyMaintained', 'writtenReason', 'compensatedByDeadline'].every(
                    (key) => value[key] === true,
                )
            );
        default:
            return false;
    }
}

function isRequest(value: unknown): value is IComplianceScenarioRequest {
    if (!isUnknownRecord(value) || !isSha256Digest(value['contentSha256']) || !Array.isArray(value['assumptions'])) {
        return false;
    }
    const assumptions: readonly unknown[] = value['assumptions'];
    return assumptions.length <= MAX_COMPLIANCE_SCENARIO_ASSUMPTIONS && assumptions.every(isAssumption);
}

function coveredIntervals(
    intervals: readonly EvaluationInterval[],
    assumption: ComplianceScenarioAssumption,
): readonly EvaluationInterval[] | null {
    const selected = intervals.filter((interval) => interval.start < assumption.end && interval.end > assumption.start);
    let cursor: number = assumption.start;
    for (const interval of selected) {
        if (interval.start > cursor) {
            return null;
        }
        cursor = Math.max(cursor, interval.end);
    }
    return cursor >= assumption.end && selected.some((interval) => interval.source?.path === assumption.sourcePointer)
        ? selected
        : null;
}

function interpretedIntervals(
    intervals: readonly EvaluationInterval[],
    assumptions: readonly ComplianceScenarioAssumption[],
): readonly EvaluationInterval[] {
    const result: EvaluationInterval[] = [];
    for (const interval of intervals) {
        const selected = assumptions.filter(
            (candidate) =>
                (candidate.kind === 'unrecordedActivity' ||
                    ((candidate.kind === 'crewPresence' || candidate.kind === 'outOfScope') &&
                        interval.activity === 'driving')) &&
                interval.start < candidate.end &&
                interval.end > candidate.start,
        );
        if (selected.length === 0 || interval.source === null) {
            result.push(interval);
            continue;
        }
        let cursor = interval.start;
        for (const assumption of selected) {
            const start = Math.max(cursor, assumption.start);
            const end = Math.min(interval.end, assumption.end);
            if (!isUtcTimestamp(start) || !isUtcTimestamp(end)) {
                throw new Error('Validated scenario interval is not representable');
            }
            if (cursor < start) {
                result.push({ ...interval, start: cursor, end: start });
            }
            // The public result keeps numerical outputs and assumptions, never these copies as recorded facts.
            result.push({
                ...interval,
                origin: 'recorded',
                start,
                end,
                activity:
                    assumption.kind === 'unrecordedActivity'
                        ? assumption.activity
                        : assumption.kind === 'outOfScope'
                          ? 'work'
                          : interval.activity,
                crewPresence: assumption.kind === 'crewPresence' ? 'crew' : interval.crewPresence,
            });
            cursor = end;
        }
        if (cursor < interval.end) {
            result.push({ ...interval, start: cursor });
        }
    }
    return result;
}

function confirmedFerryRest(
    intervals: readonly EvaluationInterval[],
    assumption: Extract<ComplianceScenarioAssumption, { kind: 'ferryRest' }>,
    profile: IRuleProfile,
): IConfirmedFerryRest | null {
    const rules = profile.ferryRules;
    if (rules === undefined || (assumption.restKind !== 'regularDaily' && assumption.start < Date.UTC(2020, 7, 20))) {
        return null;
    }
    const fragments = intervals.filter(
        (interval) => interval.activity === 'breakOrRest' && interval.start >= assumption.start && interval.end <= assumption.end,
    );
    if (
        fragments.length < 2 ||
        fragments[0]?.start !== assumption.start ||
        fragments.at(-1)?.end !== assumption.end ||
        fragments.length - 1 > rules.maxInterruptions
    ) {
        return null;
    }
    const restDurationMs = fragments.reduce((total, fragment) => total + fragment.end - fragment.start, 0);
    const interruptionMs = assumption.end - assumption.start - restDurationMs;
    const minimumMinutes =
        assumption.restKind === 'regularDaily'
            ? profile.dailyRestRules.regularRestMinutes
            : assumption.restKind === 'reducedWeekly'
              ? profile.weeklyRestRules.reducedRestMinutes
              : profile.weeklyRestRules.regularRestMinutes;
    if (
        interruptionMs > rules.maxInterruptionDurationMinutes * MILLISECONDS_PER_MINUTE ||
        restDurationMs < minimumMinutes * MILLISECONDS_PER_MINUTE ||
        (assumption.restKind === 'regularDaily' &&
            restDurationMs >= profile.weeklyRestRules.reducedRestMinutes * MILLISECONDS_PER_MINUTE) ||
        (assumption.restKind === 'reducedWeekly' &&
            restDurationMs >= profile.weeklyRestRules.regularRestMinutes * MILLISECONDS_PER_MINUTE) ||
        (assumption.restKind === 'regularWeekly' &&
            (assumption.sleepingAccommodation !== 'cabin' || assumption.scheduledCrossingMinutes < 480))
    ) {
        return null;
    }
    return { start: assumption.start, end: assumption.end, restKind: assumption.restKind, restDurationMs };
}

function drivingMs(intervals: readonly EvaluationInterval[], start: number, end: number): number {
    return intervals.reduce(
        (total, interval) =>
            interval.activity === 'driving'
                ? total + Math.max(0, Math.min(interval.end, end) - Math.max(interval.start, start))
                : total,
        0,
    );
}

function article12Extension(
    intervals: readonly EvaluationInterval[],
    assumption: Extract<ComplianceScenarioAssumption, { kind: 'article12Return' }>,
    baseline: IComplianceEvaluationResult,
    profile: IRuleProfile,
): IArticle12CycleExtension | null {
    const duty = baseline.crewDutyPeriods.find((period) => period.windowStart === assumption.dutyStart);
    const rest = intervals.find((interval) => interval.start === assumption.end && interval.activity === 'breakOrRest');
    const restMinutes =
        assumption.weeklyRestKind === 'regular'
            ? profile.weeklyRestRules.regularRestMinutes
            : profile.weeklyRestRules.reducedRestMinutes;
    const extraMs = drivingMs(intervals, assumption.start, assumption.end);
    if (
        assumption.start < Date.UTC(2020, 7, 20) ||
        duty === undefined ||
        duty.qualification.status === 'crew' ||
        rest === undefined ||
        rest.end - rest.start < restMinutes * MILLISECONDS_PER_MINUTE ||
        extraMs === 0 ||
        extraMs > assumption.maximumExtensionMinutes * MILLISECONDS_PER_MINUTE ||
        assumption.start < duty.windowStart ||
        assumption.end > duty.windowEnd ||
        !intervals.some(
            (interval) =>
                interval.activity === 'breakOrRest' &&
                interval.end === duty.windowStart &&
                interval.end - interval.start >= profile.dailyRestRules.reducedRestMinutes * MILLISECONDS_PER_MINUTE,
        ) ||
        (assumption.maximumExtensionMinutes === 120 &&
            (assumption.weeklyRestKind !== 'regular' ||
                !intervals.some(
                    (interval) =>
                        interval.activity === 'breakOrRest' &&
                        interval.end === assumption.start &&
                        interval.end - interval.start >= 30 * MILLISECONDS_PER_MINUTE,
                )))
    ) {
        return null;
    }
    return {
        windowStart: assumption.dutyStart,
        extensionMs: extraMs,
        drivingStart: assumption.start,
        drivingEnd: assumption.end,
    };
}

export function evaluateDocumentComplianceScenario(
    document: OpenedTachographDocument,
    request: unknown,
    profile: IRuleProfile = EU_561_2006_STANDARD,
    nightWindow?: INightWindow,
): ComplianceScenarioResult {
    const unavailable = (
        reason: ComplianceScenarioUnavailableReason,
        basisId: string | null = null,
        baseline: IComplianceEvaluationResult | null = null,
    ): ComplianceScenarioResult => ({ status: 'unavailable', reason, basisId, baseline });
    if (!isRequest(request)) {
        return unavailable('invalidRequest');
    }
    if (document.source.sha256 !== request.contentSha256) {
        return unavailable('contentChanged');
    }
    if (document.content.documentKind !== 'driverCard') {
        return unavailable('driverActivitiesRequired');
    }
    const baseline = evaluateDocumentCompliance(document, profile, nightWindow);
    if (!baseline.evaluationIntervals.some((interval) => interval.origin === 'recorded')) {
        return unavailable('driverActivitiesRequired', null, baseline);
    }
    if (![EU_561_2006_STANDARD.profileId, EU_MOBILITY_PACKAGE_2020.profileId].includes(profile.profileId)) {
        return unavailable('unsupportedProfile', null, baseline);
    }
    const assumptions = [...request.assumptions].sort((left, right) => left.start - right.start);
    if (
        new Set(assumptions.map((assumption) => assumption.basisId)).size !== assumptions.length ||
        assumptions.some((assumption, index) => index > 0 && assumption.start < (assumptions[index - 1]?.end ?? 0))
    ) {
        return unavailable('conflictingAssumptions', null, baseline);
    }
    const recorded = projectDocumentCanonicalActivityDays(document)
        .flatMap((day) => day.day.intervals)
        .sort((left, right) => left.start - right.start);
    const resolved = resolveUnrecordedTime(recorded);
    const intervals = mergeContiguousActivityIntervals(resolved.evaluationIntervals);
    const ferryRests: IConfirmedFerryRest[] = [];
    const cycleExtensions: IArticle12CycleExtension[] = [];
    for (const assumption of assumptions) {
        const selected = coveredIntervals(resolved.evaluationIntervals, assumption);
        if (selected === null) {
            return unavailable('sourceRangeUnavailable', assumption.basisId, baseline);
        }
        if (assumption.kind === 'unrecordedActivity' && selected.some((interval) => interval.origin !== 'unrecordedTime')) {
            return unavailable('unrecordedTimeRequired', assumption.basisId, baseline);
        }
        if (
            (assumption.kind === 'crewPresence' || assumption.kind === 'outOfScope') &&
            !selected.some((interval) => interval.activity === 'driving')
        ) {
            return unavailable('drivingRequired', assumption.basisId, baseline);
        }
        if (assumption.kind === 'ferryRest') {
            const rest = confirmedFerryRest(intervals, assumption, profile);
            if (rest === null) {
                return unavailable('ferryConditionsUnavailable', assumption.basisId, baseline);
            }
            ferryRests.push(rest);
        }
        if (assumption.kind === 'article12Return') {
            const extension = article12Extension(intervals, assumption, baseline, profile);
            if (extension === null || cycleExtensions.some((existing) => existing.windowStart === extension.windowStart)) {
                return unavailable('article12ConditionsUnavailable', assumption.basisId, baseline);
            }
            cycleExtensions.push(extension);
        }
    }
    const scenarioIntervals = interpretedIntervals(resolved.evaluationIntervals, assumptions);
    const result = evaluateComplianceIntervals(
        scenarioIntervals,
        resolved.unrecordedPeriods,
        baseline.infringements.filter((finding) => finding.category === 'anomaly'),
        profile,
        nightWindow,
        { ferryRests, cycleExtensions },
    );
    const { evaluationIntervals: _evaluationIntervals, ...reviewed } = result;
    return {
        status: 'available',
        baseline,
        reviewed,
        basis: { contentSha256: request.contentSha256, assumptions, calculationVersion: COMPLIANCE_SCENARIO_VERSION },
    };
}
