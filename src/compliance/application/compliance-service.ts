import {
    projectDocumentActivityDays,
    projectDocumentEventFaultRecords,
    type IDocumentActivityDayProjection,
    type OpenedTachographDocument,
} from '#viewer-application';
import type { ActivityInterval, TachographEventFault, TachographGeneration } from '#tachograph-domain';

import { evaluateAnomalyInfringements } from '../domain/evaluators/anomaly-evaluator.js';
import { evaluateBreakInfringements } from '../domain/evaluators/break-evaluator.js';
import { evaluateDrivingInfringements } from '../domain/evaluators/driving-evaluator.js';
import { evaluateDailyRestCompliance } from '../domain/evaluators/rest-evaluator.js';
import { evaluateUnrecordedPeriodAssessments } from '../domain/evaluators/unrecorded-period-evaluator.js';
import { evaluateWeeklyRestCompliance } from '../domain/evaluators/weekly-rest-evaluator.js';
import { evaluateWorkingTimeInfringements, type INightWindow } from '../domain/evaluators/working-time-evaluator.js';
import type { IInfringement } from '../domain/infringement.js';
import type { IComplianceAssessment } from '../domain/compliance-assessment.js';
import { mergeContiguousActivityIntervals } from '../domain/interval-merge.js';
import {
    evaluateAvailabilityBreakAssessments,
    resolveCreditedAvailabilityBreaks,
    resolveCrewDutyPeriods,
    type ICreditedAvailabilityBreak,
    type ICrewDutyPeriod,
} from '../domain/multi-manning.js';
import { EU_561_2006_STANDARD, type IRuleProfile } from '../domain/rule-profile.js';
import { resolveUnrecordedTime } from '../domain/unrecorded-time.js';

export interface IComplianceEvaluationResult {
    readonly assessments: readonly IComplianceAssessment[];
    readonly creditedAvailabilityBreaks: readonly ICreditedAvailabilityBreak[];
    readonly crewDutyPeriods: readonly ICrewDutyPeriod[];
    readonly infringements: readonly IInfringement[];
    readonly profile: IRuleProfile;
    readonly totalCount: number;
    readonly verySeriousCount: number;
}

const complianceGenerationRank: Readonly<Record<TachographGeneration, number>> = {
    g1: 0,
    g2: 1,
    g2v2: 2,
};

// Canonicalizes mirrored dual-generation card evidence to the highest generation (Gen2v2 > Gen2 > Gen1).
function canonicalizeActivityDays(days: readonly IDocumentActivityDayProjection[]): readonly IDocumentActivityDayProjection[] {
    const canonicalByMidnight = new Map<number, IDocumentActivityDayProjection>();
    for (const day of days) {
        const current = canonicalByMidnight.get(day.day.midnightUtc);
        if (current === undefined || complianceGenerationRank[day.generation] > complianceGenerationRank[current.generation]) {
            canonicalByMidnight.set(day.day.midnightUtc, day);
        }
    }

    return days.filter((day) => canonicalByMidnight.get(day.day.midnightUtc) === day);
}

function canonicalizeEventFaults(records: readonly TachographEventFault[]): readonly TachographEventFault[] {
    const canonicalByKey = new Map<string, TachographEventFault>();
    for (const record of records) {
        const key = `${record.recordKind}:${record.code}:${String(record.start)}`;
        const current = canonicalByKey.get(key);
        if (
            current === undefined ||
            complianceGenerationRank[record.source.generation] > complianceGenerationRank[current.source.generation]
        ) {
            canonicalByKey.set(key, record);
        }
    }

    return records.filter(
        (record) => canonicalByKey.get(`${record.recordKind}:${record.code}:${String(record.start)}`) === record,
    );
}

// Structurally matches the night-work fields of the viewer preferences.
export interface INightWorkPreferences {
    readonly nightWorkEndHour: number;
    readonly nightWorkStartHour: number;
    readonly nightWorkTimeZone: string;
}

export function nightWindowFromPreferences(preferences: INightWorkPreferences): INightWindow {
    return {
        endHour: preferences.nightWorkEndHour,
        startHour: preferences.nightWorkStartHour,
        timeZone: preferences.nightWorkTimeZone,
    };
}

export function evaluateDocumentCompliance(
    document: OpenedTachographDocument,
    profile: IRuleProfile = EU_561_2006_STANDARD,
    nightWindow?: INightWindow,
): IComplianceEvaluationResult {
    const activityDays = canonicalizeActivityDays(projectDocumentActivityDays(document));
    const intervals: ActivityInterval[] = [];

    for (const dayProjection of activityDays) {
        intervals.push(...dayProjection.day.intervals);
    }

    intervals.sort((left, right) => left.start - right.start);

    // Unrecorded time is evaluated as rest and each period is listed for review, so a missing manual entry is never
    // reported as missing rest.
    const { evaluationIntervals, unrecordedPeriods } = resolveUnrecordedTime(intervals);
    // Merge contiguous intervals across midnight splits before evaluation to restore true durations.
    const mergedIntervals = mergeContiguousActivityIntervals(evaluationIntervals);

    const breakInfringements = evaluateBreakInfringements(mergedIntervals, profile);
    const drivingInfringements = evaluateDrivingInfringements(mergedIntervals, profile);
    const dailyRestResult = evaluateDailyRestCompliance(mergedIntervals, profile);
    const weeklyRestResult = evaluateWeeklyRestCompliance(mergedIntervals, profile);
    const eventFaults = canonicalizeEventFaults(projectDocumentEventFaultRecords(document));
    const anomalyInfringements = evaluateAnomalyInfringements(eventFaults, profile);
    const workingTimeInfringements = evaluateWorkingTimeInfringements(mergedIntervals, profile, nightWindow);

    const infringements = [
        ...breakInfringements,
        ...drivingInfringements,
        ...dailyRestResult.infringements,
        ...weeklyRestResult.infringements,
        ...anomalyInfringements,
        ...workingTimeInfringements,
    ].sort((left, right) => (left.recordedAt ?? 0) - (right.recordedAt ?? 0));

    const verySeriousCount = infringements.filter((infringement) => infringement.severity === 'verySerious').length;

    return {
        assessments: [
            ...dailyRestResult.assessments,
            ...weeklyRestResult.assessments,
            ...evaluateAvailabilityBreakAssessments(mergedIntervals, profile),
            ...evaluateUnrecordedPeriodAssessments(unrecordedPeriods, profile),
        ],
        creditedAvailabilityBreaks: resolveCreditedAvailabilityBreaks(mergedIntervals, profile),
        crewDutyPeriods: resolveCrewDutyPeriods(mergedIntervals, profile),
        infringements: infringements,
        profile,
        totalCount: infringements.length,
        verySeriousCount,
    };
}
