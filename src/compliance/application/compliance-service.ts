import {
    projectDocumentCanonicalActivityDays,
    projectDocumentCanonicalEventFaultRecords,
    type OpenedTachographDocument,
} from '#viewer-application';
import type { ActivityInterval } from '#tachograph-domain';
import type { EvaluationInterval } from '../domain/unrecorded-time.js';

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
    // The merged intervals the evaluators saw, with unrecorded time already read as rest. Anything that presents a
    // rule's progress (the continuous-driving notice, for example) must use these rather than the raw day records,
    // so a screen cannot disagree with the findings beside it.
    readonly evaluationIntervals: readonly EvaluationInterval[];
    readonly infringements: readonly IInfringement[];
    readonly profile: IRuleProfile;
    readonly totalCount: number;
    readonly verySeriousCount: number;
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
    const activityDays = projectDocumentCanonicalActivityDays(document);
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
    const eventFaults = projectDocumentCanonicalEventFaultRecords(document);
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
        evaluationIntervals: mergedIntervals,
        infringements: infringements,
        profile,
        totalCount: infringements.length,
        verySeriousCount,
    };
}
