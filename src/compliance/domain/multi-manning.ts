import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_MINUTE } from '#time';

import type { IComplianceAssessment } from './compliance-assessment.js';
import { isQualifyingDailyRest, resolveDailyCycleWindow, type IDailyCyclePolicy } from './daily-cycle.js';
import { EU_561_2006_CONSOLIDATED_URL } from './legal-references.js';
import type { IMultiManningRuleConfig, IRuleProfile } from './rule-profile.js';
import type { EvaluationInterval } from './unrecorded-time.js';

// 'crew': Art. 4(o) holds, so Art. 8(5) applies. 'crewFailed': crew driving was recorded, but after the first hour some
// driving had only one card. 'unknown': crew driving was recorded, but later driving has no known crew status.
// 'single': no crew driving at all. Only 'crew' earns the 30-hour window.
export type CrewQualificationStatus = 'crew' | 'crewFailed' | 'single' | 'unknown';

export interface ICrewQualification {
    // First driving after the first hour that breaks Art. 4(o); null unless the status is crewFailed or unknown.
    readonly failedAt: number | null;
    readonly status: CrewQualificationStatus;
}

export interface IMultiManningCyclePolicy extends IDailyCyclePolicy {
    qualify(windowStart: number): ICrewQualification;
}

const SINGLE_QUALIFICATION: ICrewQualification = { failedAt: null, status: 'single' };

// Intervals are sorted and do not overlap, so their ends are sorted too.
function firstIndexEndingAfter(intervals: readonly EvaluationInterval[], instant: number): number {
    let low = 0;
    let high = intervals.length;
    while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if ((intervals[middle]?.end ?? Number.POSITIVE_INFINITY) > instant) {
            high = middle;
        } else {
            low = middle + 1;
        }
    }
    return low;
}

// Minute-resolution card records can show a one-minute single-card drive while cards are swapped between slots.
function isCardChangeNoise(intervals: readonly EvaluationInterval[], index: number, toleranceMs: number): boolean {
    const interval = intervals[index];
    if (interval === undefined || interval.end - interval.start > toleranceMs) {
        return false;
    }
    return [intervals[index - 1], intervals[index + 1]].some(
        (neighbour) =>
            neighbour !== undefined &&
            (neighbour.end === interval.start || neighbour.start === interval.end) &&
            (neighbour.slot !== interval.slot || neighbour.crewPresence !== interval.crewPresence),
    );
}

// Art. 4(o) over the duty period that starts at `windowStart` and ends at the first rest long enough to be the
// multi-manning daily rest, or at the end of the 30-hour window. Only driving is tested: the article requires a
// second driver "to do the driving", and the second driver may change during the period.
function qualifyDutyPeriod(
    intervals: readonly EvaluationInterval[],
    windowStart: number,
    rules: IMultiManningRuleConfig,
): ICrewQualification {
    const windowLimit = windowStart + rules.dailyRestWindowMinutes * MILLISECONDS_PER_MINUTE;
    const minDailyRestMs = rules.minDailyRestMinutes * MILLISECONDS_PER_MINUTE;
    const toleranceMs = rules.cardChangeToleranceMinutes * MILLISECONDS_PER_MINUTE;
    let firstHourEnd: number | null = null;
    let sawCrewDriving = false;
    let firstFailure: ICrewQualification | null = null;

    for (let index = firstIndexEndingAfter(intervals, windowStart); index < intervals.length; index++) {
        const interval = intervals[index];
        if (interval === undefined || interval.start >= windowLimit) {
            break;
        }
        if (firstHourEnd === null) {
            if (interval.activity !== 'driving' && interval.activity !== 'work') {
                continue;
            }
            firstHourEnd = Math.max(interval.start, windowStart) + rules.firstHourMinutes * MILLISECONDS_PER_MINUTE;
        }
        if (interval.activity === 'breakOrRest' && interval.end - interval.start >= minDailyRestMs) {
            break;
        }
        if (interval.activity !== 'driving') {
            continue;
        }
        if (interval.crewPresence === 'crew') {
            sawCrewDriving = true;
            continue;
        }
        if (
            firstFailure !== null ||
            interval.end <= firstHourEnd ||
            (interval.crewPresence === 'single' && isCardChangeNoise(intervals, index, toleranceMs))
        ) {
            continue;
        }
        firstFailure = {
            failedAt: Math.max(interval.start, firstHourEnd),
            status: interval.crewPresence === 'single' ? 'crewFailed' : 'unknown',
        };
    }

    if (!sawCrewDriving) {
        return SINGLE_QUALIFICATION;
    }
    return firstFailure ?? { failedAt: null, status: 'crew' };
}

// One policy per interval list: driving and daily-rest evaluation must agree on where each duty period ends.
export function createDailyCyclePolicy(
    intervals: readonly EvaluationInterval[],
    profile: IRuleProfile,
): IMultiManningCyclePolicy {
    const rules = profile.multiManningRules;
    const qualifications = new Map<number, ICrewQualification>();

    function qualify(windowStart: number): ICrewQualification {
        if (rules === null) {
            return SINGLE_QUALIFICATION;
        }
        let qualification = qualifications.get(windowStart);
        if (qualification === undefined) {
            qualification = qualifyDutyPeriod(intervals, windowStart, rules);
            qualifications.set(windowStart, qualification);
        }
        return qualification;
    }

    return {
        qualify,
        windowLengthMs: (windowStart) =>
            rules !== null && qualify(windowStart).status === 'crew'
                ? rules.dailyRestWindowMinutes * MILLISECONDS_PER_MINUTE
                : MILLISECONDS_PER_DAY,
    };
}

// Art. 7, third paragraph (from 20 August 2020) and the Commission's Mobility Package Q&A: tachographs force
// AVAILABILITY on the co-driver while the vehicle moves, so enforcers count 45 consecutive minutes of it in a
// multi-manning duty period as the break. Only a single consecutive period counts, never a split part.
export function createAvailabilityBreakCredit(
    intervals: readonly EvaluationInterval[],
    profile: IRuleProfile,
    policy: IMultiManningCyclePolicy,
): (interval: EvaluationInterval) => boolean {
    const creditFrom = profile.multiManningRules?.availabilityBreakFrom ?? null;
    if (creditFrom === null) {
        return () => false;
    }
    const creditFromMs = Date.parse(`${creditFrom}T00:00:00Z`);
    const minBreakMs = profile.breakRules.minTotalBreakMinutes * MILLISECONDS_PER_MINUTE;
    // Duty periods start where the daily-rest evaluator's cycles start: at the end of a qualifying daily rest.
    const anchors = intervals.filter((interval) => isQualifyingDailyRest(interval, profile)).map((interval) => interval.end);
    const firstStart = intervals[0]?.start ?? 0;

    return (interval) => {
        if (
            interval.activity !== 'availability' ||
            interval.crewPresence !== 'crew' ||
            interval.start < creditFromMs ||
            interval.end - interval.start < minBreakMs
        ) {
            return false;
        }
        const windowStart = anchors.findLast((anchor) => anchor <= interval.start) ?? firstStart;
        return interval.start < windowStart + policy.windowLengthMs(windowStart) && policy.qualify(windowStart).status === 'crew';
    };
}

export interface ICreditedAvailabilityBreak {
    // Only the first 45 minutes are the break; the rest of the availability period stays availability.
    readonly end: number;
    readonly start: number;
}

export function resolveCreditedAvailabilityBreaks(
    intervals: readonly EvaluationInterval[],
    profile: IRuleProfile,
): readonly ICreditedAvailabilityBreak[] {
    const isCreditedBreak = createAvailabilityBreakCredit(intervals, profile, createDailyCyclePolicy(intervals, profile));
    const breakMs = profile.breakRules.minTotalBreakMinutes * MILLISECONDS_PER_MINUTE;
    return intervals.filter(isCreditedBreak).map((interval) => ({ end: interval.start + breakMs, start: interval.start }));
}

// Lists every credited availability period so the reader sees which breaks rest on enforcement practice rather than
// on recorded breaks; the data cannot show that the co-driver was not assisting the driver.
export function evaluateAvailabilityBreakAssessments(
    intervals: readonly EvaluationInterval[],
    profile: IRuleProfile,
): readonly IComplianceAssessment[] {
    const isCreditedBreak = createAvailabilityBreakCredit(intervals, profile, createDailyCyclePolicy(intervals, profile));

    return intervals.filter(isCreditedBreak).map((interval) => ({
        category: 'break',
        id: `multi-manning-availability-break-${String(interval.start)}`,
        legalReference: {
            article: 'Art. 7, third paragraph',
            description:
                'Co-driver availability of at least 45 consecutive minutes during multi-manning counted as a break, as enforcers do; tachograph data cannot show that the co-driver was not assisting the driver',
            regulation: profile.regulationName,
            sourceUrl: EU_561_2006_CONSOLIDATED_URL,
        },
        profileId: profile.profileId,
        recordedAt: interval.start,
        ruleId: 'MULTI_MANNING_AVAILABILITY_BREAK_REVIEW',
        source: interval.source,
        status: 'externalEvidenceRequired',
    }));
}

export interface ICrewDutyPeriod {
    readonly qualification: ICrewQualification;
    // The daily-rest window the evaluators applied: 30 hours for a qualifying period, otherwise 24.
    readonly windowEnd: number;
    readonly windowStart: number;
}

// The duty periods the daily-rest evaluator measures, cut at the same boundaries, so screens can show which rule
// applied to each one.
export function resolveCrewDutyPeriods(
    intervals: readonly EvaluationInterval[],
    profile: IRuleProfile,
): readonly ICrewDutyPeriod[] {
    const policy = createDailyCyclePolicy(intervals, profile);
    const periods: ICrewDutyPeriod[] = [];
    let anchor: number | null = null;
    let index = 0;

    while (index < intervals.length) {
        const duty = intervals[index];
        if (duty === undefined) {
            break;
        }
        if (duty.activity !== 'driving' && duty.activity !== 'work') {
            index++;
            continue;
        }

        const window = resolveDailyCycleWindow(anchor, duty.start, policy);
        periods.push({ qualification: policy.qualify(window.start), windowEnd: window.end, windowStart: window.start });

        let nextAnchor = window.end;
        index++;
        while (index < intervals.length) {
            const candidate = intervals[index];
            if (candidate === undefined || candidate.start >= window.end) {
                break;
            }
            index++;
            if (isQualifyingDailyRest(candidate, profile)) {
                nextAnchor = candidate.end;
                break;
            }
        }
        anchor = nextAnchor;
    }

    return periods;
}
