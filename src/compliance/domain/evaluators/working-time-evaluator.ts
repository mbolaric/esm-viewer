import type { ISourceReference } from '#tachograph-domain';
import {
    contiguousCalendarWeekKeys,
    MILLISECONDS_PER_DAY,
    MILLISECONDS_PER_MINUTE,
    splitByCalendarWeek,
    zonedDateParts,
    zonedWallClockToUtc,
} from '#time';

import {
    isQualifyingDailyRest,
    nextDailyCycleAnchor,
    resolveDailyCycleWindow,
    STANDARD_DAILY_CYCLE_POLICY,
    type IDailyCycleWindow,
} from '../daily-cycle.js';
import type { IInfringement } from '../infringement.js';
import {
    calculateSeverity,
    measureDeficitMinutes,
    measureExcessMinutes,
    type IRuleProfile,
    type IWorkingTimeRuleConfig,
} from '../rule-profile.js';
import type { EvaluationInterval } from '../unrecorded-time.js';

const NIGHT_WORK_DAILY_LIMIT_RULE_ID = 'NIGHT_WORK_DAILY_LIMIT_10H';
const WORKING_TIME_AVERAGE_RULE_ID = 'WORKING_TIME_WEEKLY_AVERAGE_48H';
const WORKING_TIME_BREAK_RULE_ID = 'WORKING_TIME_BREAK_6H';
const WORKING_TIME_LONG_DAY_BREAK_RULE_ID = 'WORKING_TIME_BREAK_9H';
const WORKING_TIME_WEEKLY_LIMIT_RULE_ID = 'WORKING_TIME_WEEKLY_LIMIT_60H';

// Directive 2002/15/EC Art. 3(h) night window (>=4h between 00:00 and 07:00 defined by national law).
// Sourced from preferences; startHour/endHour are local civil hours (0-23) in IANA timeZone.
export interface INightWindow {
    readonly endHour: number;
    readonly startHour: number;
    readonly timeZone: string;
}

interface INightWindowSpan {
    readonly end: number;
    readonly start: number;
}

// Returns a DST-aware test for whether [intervalStart, intervalEnd) overlaps the night window of any civil day it
// touches in window.timeZone. Each civil day's window is resolved once per evaluation.
function createNightWindowOverlapTest(window: INightWindow): (intervalStart: number, intervalEnd: number) => boolean {
    const spansByCivilDate = new Map<number, INightWindowSpan>();
    const spanForCivilDate = (civilDate: number): INightWindowSpan => {
        const cached = spansByCivilDate.get(civilDate);
        if (cached !== undefined) {
            return cached;
        }
        const date = new Date(civilDate);
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth() + 1;
        const day = date.getUTCDate();
        const span = {
            end: zonedWallClockToUtc(year, month, day, window.endHour, window.timeZone),
            start: zonedWallClockToUtc(year, month, day, window.startHour, window.timeZone),
        };
        spansByCivilDate.set(civilDate, span);
        return span;
    };

    return (intervalStart, intervalEnd) => {
        const startParts = zonedDateParts(intervalStart, window.timeZone);
        const endParts = zonedDateParts(intervalEnd, window.timeZone);
        // Civil dates are stepped as UTC-midnight markers and never converted back through the zone: a zone behind
        // UTC would read a UTC midnight as the previous evening and test the wrong day.
        const lastCivilDate = Date.UTC(endParts.year, endParts.month - 1, endParts.day);
        for (
            let civilDate = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
            civilDate <= lastCivilDate;
            civilDate += MILLISECONDS_PER_DAY
        ) {
            const span = spanForCivilDate(civilDate);
            if (intervalStart < span.end && intervalEnd > span.start) {
                return true;
            }
        }
        return false;
    };
}

function resolveIntervalSource(interval: EvaluationInterval): ISourceReference | null {
    return interval.origin === 'recorded' ? interval.source : null;
}

function isWorkingTimeInterval(interval: EvaluationInterval): boolean {
    // Directive 2002/15/EC Art. 3(a): working time is driving and other work; excludes availability.
    return interval.activity === 'driving' || interval.activity === 'work';
}

// Weekly working time entry tracking accumulated duration and latest interval.
interface IWeeklyWorkingTimeEntry {
    durationMs: number;
    lastInterval: EvaluationInterval;
}

// Groups working time by calendar week. Shared by Art. 4(a) weekly max and rolling average rules.
function buildWeeklyWorkingTimeMap(intervals: readonly EvaluationInterval[]): Map<string, IWeeklyWorkingTimeEntry> {
    const weeklyWorkingMs = new Map<string, IWeeklyWorkingTimeEntry>();

    for (const interval of intervals) {
        if (isWorkingTimeInterval(interval)) {
            // Working time crossing Sunday midnight is counted in each week it spans.
            for (const segment of splitByCalendarWeek(interval.start, interval.end)) {
                const existing = weeklyWorkingMs.get(segment.weekKey);

                if (existing === undefined) {
                    weeklyWorkingMs.set(segment.weekKey, { durationMs: segment.durationMs, lastInterval: interval });
                } else {
                    existing.durationMs += segment.durationMs;
                    existing.lastInterval = interval;
                }
            }
        }
    }

    return weeklyWorkingMs;
}

// Directive 2002/15/EC Art. 5: working-time breaks.
// Evaluates consecutive work (>=6h without >=15m break) chronologically.
// Aggregate 30m/45m requirements are finalized per duty period bounded by qualifying rest or 24h.
function evaluateWorkingTimeBreakRules(
    intervals: readonly EvaluationInterval[],
    profile: IRuleProfile,
    config: IWorkingTimeRuleConfig,
): IInfringement[] {
    const infringements: IInfringement[] = [];
    const minBreakSegmentMs = config.minBreakSegmentMinutes * MILLISECONDS_PER_MINUTE;
    const sixHourMs = config.continuousWorkLimitMinutes * MILLISECONDS_PER_MINUTE;
    const longWorkdayThresholdMs = config.longWorkdayThresholdMinutes * MILLISECONDS_PER_MINUTE;
    let consecutiveWorkMs = 0;
    let consecutiveSessionStart: number | null = null;

    let periodWindow: IDailyCycleWindow | null = null;
    let cycleAnchor: number | null = null;
    let periodWorkMs = 0;
    let periodBreakMs = 0;
    let periodLastInterval: EvaluationInterval | null = null;
    let periodFlaggedByConsecutiveRule = false;

    // Finalizes period totals. The 45m (>9h) requirement supersedes the 30m (6-9h) band.
    // Consecutive-hours and >9h deficit are distinct rules; 6-9h is skipped if consecutive rule already flagged.
    const finalizePeriod = (): void => {
        const lastInterval = periodLastInterval;
        const periodTotalWorkMs = periodWorkMs;
        const periodTotalBreakMs = periodBreakMs;
        const flaggedByConsecutiveRule = periodFlaggedByConsecutiveRule;

        periodWindow = null;
        periodWorkMs = 0;
        periodBreakMs = 0;
        periodLastInterval = null;
        periodFlaggedByConsecutiveRule = false;

        if (lastInterval === null) {
            return;
        }
        const source = resolveIntervalSource(lastInterval);
        if (source === null) {
            return;
        }

        if (
            periodTotalWorkMs > longWorkdayThresholdMs &&
            periodTotalBreakMs < config.breakRequirementOver9hMinutes * MILLISECONDS_PER_MINUTE
        ) {
            const { deficitMinutes, measuredMinutes } = measureDeficitMinutes(
                periodTotalBreakMs,
                config.breakRequirementOver9hMinutes,
            );
            infringements.push({
                allowedValueMinutes: config.breakRequirementOver9hMinutes,
                category: 'workingTime',
                excessOrDeficitMinutes: deficitMinutes,
                id: `wt-break-9h-day-${String(lastInterval.start)}`,
                legalReference: {
                    article: 'Art. 5(1)',
                    description: 'Working time exceeding 9 hours without a 45-minute break',
                    regulation: 'Directive 2002/15/EC',
                },
                measuredValueMinutes: measuredMinutes,
                profileId: profile.profileId,
                recordedAt: lastInterval.start,
                ruleId: WORKING_TIME_LONG_DAY_BREAK_RULE_ID,
                severity: calculateSeverity(deficitMinutes, profile, WORKING_TIME_LONG_DAY_BREAK_RULE_ID),
                source,
                title: 'Working Time Break (9h) Exceeded',
            });
        } else if (
            !flaggedByConsecutiveRule &&
            periodTotalWorkMs > sixHourMs &&
            periodTotalBreakMs < config.breakRequirement6to9hMinutes * MILLISECONDS_PER_MINUTE
        ) {
            const { deficitMinutes, measuredMinutes } = measureDeficitMinutes(
                periodTotalBreakMs,
                config.breakRequirement6to9hMinutes,
            );
            infringements.push({
                allowedValueMinutes: config.breakRequirement6to9hMinutes,
                category: 'workingTime',
                excessOrDeficitMinutes: deficitMinutes,
                id: `wt-break-6h-day-${String(lastInterval.start)}`,
                legalReference: {
                    article: 'Art. 5(1)',
                    description: 'Working time exceeding 6 hours without a 30-minute break',
                    regulation: 'Directive 2002/15/EC',
                },
                measuredValueMinutes: measuredMinutes,
                profileId: profile.profileId,
                recordedAt: lastInterval.start,
                ruleId: WORKING_TIME_BREAK_RULE_ID,
                severity: calculateSeverity(deficitMinutes, profile, WORKING_TIME_BREAK_RULE_ID),
                source,
                title: 'Working Time Break (6h) Exceeded',
            });
        }
    };

    for (const interval of intervals) {
        const durationMs = Math.max(0, interval.end - interval.start);

        // Close period when 24h window expires without a qualifying rest.
        if (periodWindow !== null && interval.start >= periodWindow.end) {
            cycleAnchor = nextDailyCycleAnchor(periodWindow, null);
            finalizePeriod();
        }

        if (isWorkingTimeInterval(interval)) {
            // Directive 2002/15/EC counts its own 24-hour periods; the Art. 8(5) multi-manning window does not apply.
            periodWindow ??= resolveDailyCycleWindow(cycleAnchor, interval.start, STANDARD_DAILY_CYCLE_POLICY);
            periodWorkMs += durationMs;
            periodLastInterval = interval;

            consecutiveSessionStart ??= interval.start;
            consecutiveWorkMs += durationMs;

            // Consecutive work exceeding 6 hours without a qualifying break (>= 15 min).
            if (consecutiveWorkMs > sixHourMs) {
                const source = resolveIntervalSource(interval);
                if (source !== null) {
                    const { excessMinutes, measuredMinutes } = measureExcessMinutes(
                        consecutiveWorkMs,
                        config.continuousWorkLimitMinutes,
                    );
                    infringements.push({
                        allowedValueMinutes: config.continuousWorkLimitMinutes,
                        category: 'workingTime',
                        excessOrDeficitMinutes: excessMinutes,
                        id: `wt-break-6h-consecutive-${String(interval.start)}-${String(consecutiveSessionStart)}`,
                        legalReference: {
                            article: 'Art. 5(1)',
                            description: 'Working more than 6 consecutive hours without a break',
                            regulation: 'Directive 2002/15/EC',
                        },
                        measuredValueMinutes: measuredMinutes,
                        profileId: profile.profileId,
                        recordedAt: interval.start,
                        ruleId: WORKING_TIME_BREAK_RULE_ID,
                        severity: calculateSeverity(excessMinutes, profile, WORKING_TIME_BREAK_RULE_ID),
                        source,
                        title: 'Working Time Break (6h) Exceeded',
                    });
                }
                consecutiveWorkMs = 0;
                consecutiveSessionStart = null;
                periodFlaggedByConsecutiveRule = true;
            }
        } else if (interval.activity === 'breakOrRest') {
            if (isQualifyingDailyRest(interval, profile)) {
                // Qualifying daily rest closes the current working-day period.
                cycleAnchor = interval.end;
                finalizePeriod();
                consecutiveWorkMs = 0;
                consecutiveSessionStart = null;
            } else if (durationMs >= minBreakSegmentMs) {
                // Qualifying break segment (>= 15 min) interrupts consecutive work (Art. 5(2)).
                consecutiveWorkMs = 0;
                consecutiveSessionStart = null;
                periodBreakMs += durationMs;
            }
        }
    }
    finalizePeriod();

    return infringements;
}

// Directive 2002/15/EC Art. 4: maximum weekly working time (60h).
function evaluateMaxWeeklyWorkingTimeRule(
    weeklyWorkingMs: ReadonlyMap<string, IWeeklyWorkingTimeEntry>,
    profile: IRuleProfile,
    config: IWorkingTimeRuleConfig,
): IInfringement[] {
    const infringements: IInfringement[] = [];
    const maxWeeklyWorkingMs = config.maxWeeklyWorkingMinutes * MILLISECONDS_PER_MINUTE;

    for (const [weekKey, { durationMs, lastInterval }] of weeklyWorkingMs) {
        if (durationMs > maxWeeklyWorkingMs) {
            const { excessMinutes, measuredMinutes } = measureExcessMinutes(durationMs, config.maxWeeklyWorkingMinutes);
            const severity = calculateSeverity(excessMinutes, profile, WORKING_TIME_WEEKLY_LIMIT_RULE_ID);
            const source = resolveIntervalSource(lastInterval);

            if (source !== null) {
                infringements.push({
                    allowedValueMinutes: config.maxWeeklyWorkingMinutes,
                    category: 'workingTime',
                    excessOrDeficitMinutes: excessMinutes,
                    id: `wt-weekly-60h-${weekKey}`,
                    legalReference: {
                        article: 'Art. 4(a)',
                        description: 'Maximum weekly working time exceeding 60 hours in a single week',
                        regulation: 'Directive 2002/15/EC',
                    },
                    measuredValueMinutes: measuredMinutes,
                    profileId: profile.profileId,
                    recordedAt: lastInterval.start,
                    ruleId: WORKING_TIME_WEEKLY_LIMIT_RULE_ID,
                    severity,
                    source,
                    title: 'Maximum Weekly Working Time (60h) Exceeded',
                });
            }
        }
    }

    return infringements;
}

// Directive 2002/15/EC Art. 4(a): average weekly working time over reference period.
// Averaged over contiguous calendar weeks, including zero-work weeks, once the reference period has elapsed.
function evaluateAverageWeeklyWorkingTimeRule(
    weeklyWorkingMs: ReadonlyMap<string, IWeeklyWorkingTimeEntry>,
    profile: IRuleProfile,
    config: IWorkingTimeRuleConfig,
): IInfringement[] {
    const infringements: IInfringement[] = [];
    const referenceWeeks = config.averageReferencePeriodWeeks;
    if (referenceWeeks <= 0 || weeklyWorkingMs.size === 0) {
        return infringements;
    }
    const maxAverageWeeklyWorkingMs = config.maxAverageWeeklyWorkingMinutes * MILLISECONDS_PER_MINUTE;
    const observedWeekKeys = [...weeklyWorkingMs.keys()].sort();
    const firstWeekKey = observedWeekKeys[0];
    const lastWeekKey = observedWeekKeys[observedWeekKeys.length - 1];

    if (firstWeekKey === undefined || lastWeekKey === undefined) {
        return infringements;
    }

    const contiguousWeekKeys = contiguousCalendarWeekKeys(firstWeekKey, lastWeekKey);

    for (let index = 0; index < contiguousWeekKeys.length; index++) {
        const windowStartIndex = index - referenceWeeks + 1;
        if (windowStartIndex < 0) {
            continue;
        }
        const windowKeys = contiguousWeekKeys.slice(windowStartIndex, index + 1);

        let windowTotalMs = 0;
        let evidenceInterval: EvaluationInterval | undefined;
        for (const windowKey of windowKeys) {
            const entry = weeklyWorkingMs.get(windowKey);
            if (entry !== undefined) {
                windowTotalMs += entry.durationMs;
                evidenceInterval = entry.lastInterval;
            }
        }
        // Skip windows with no recorded activity across the reference period.
        if (evidenceInterval === undefined) {
            continue;
        }

        const averageMs = windowTotalMs / referenceWeeks;

        if (averageMs > maxAverageWeeklyWorkingMs) {
            const { excessMinutes, measuredMinutes } = measureExcessMinutes(averageMs, config.maxAverageWeeklyWorkingMinutes);
            const severity = calculateSeverity(excessMinutes, profile, WORKING_TIME_AVERAGE_RULE_ID);
            const source = resolveIntervalSource(evidenceInterval);

            if (source !== null) {
                const weekKey = contiguousWeekKeys[index];
                infringements.push({
                    allowedValueMinutes: config.maxAverageWeeklyWorkingMinutes,
                    category: 'workingTime',
                    excessOrDeficitMinutes: excessMinutes,
                    id: `wt-weekly-average-48h-${String(weekKey)}`,
                    legalReference: {
                        article: 'Art. 4(a)',
                        description: 'Average weekly working time exceeding 48 hours over the reference period',
                        regulation: 'Directive 2002/15/EC',
                    },
                    measuredValueMinutes: measuredMinutes,
                    profileId: profile.profileId,
                    recordedAt: evidenceInterval.start,
                    ruleId: WORKING_TIME_AVERAGE_RULE_ID,
                    severity,
                    source,
                    title: 'Average Weekly Working Time (48h) Exceeded',
                });
            }
        }
    }

    return infringements;
}

// Directive 2002/15/EC Art. 7: night work limit (10h per 24-hour period).
function evaluateNightWorkLimitRule(
    intervals: readonly EvaluationInterval[],
    profile: IRuleProfile,
    config: IWorkingTimeRuleConfig,
    effectiveNightWindow: INightWindow,
): IInfringement[] {
    const infringements: IInfringement[] = [];
    const windowMs = MILLISECONDS_PER_DAY;
    const maxNightWorkDailyMs = config.nightWorkMaxDailyMinutes * MILLISECONDS_PER_MINUTE;
    const overlapsNightWindow = createNightWindowOverlapTest(effectiveNightWindow);
    // Art. 7(1) rolling 24-hour check anchored at every working interval.
    // Collapses overlapping violations in the same continuous run into a single finding.
    let previousWindowWasViolation = false;
    let currentRunReported = false;

    for (let i = 0; i < intervals.length; i++) {
        const current = intervals[i];
        if (current === undefined || !isWorkingTimeInterval(current)) {
            continue;
        }

        const shiftStart = current.start;
        const windowEnd = shiftStart + windowMs;

        let workingTimeInWindowMs = 0;
        let hasNightWork = false;
        let lastShiftInterval = current;

        for (let j = i; j < intervals.length; j++) {
            const candidate = intervals[j];
            if (candidate === undefined || candidate.start >= windowEnd) {
                break;
            }

            if (isWorkingTimeInterval(candidate)) {
                const effectiveStart = Math.max(candidate.start, shiftStart);
                const effectiveEnd = Math.min(candidate.end, windowEnd);
                const effectiveDuration = Math.max(0, effectiveEnd - effectiveStart);

                workingTimeInWindowMs += effectiveDuration;
                lastShiftInterval = candidate;

                if (overlapsNightWindow(effectiveStart, effectiveEnd)) {
                    hasNightWork = true;
                }
            }
        }

        const isViolation = hasNightWork && workingTimeInWindowMs > maxNightWorkDailyMs;
        if (!isViolation) {
            previousWindowWasViolation = false;
            currentRunReported = false;
            continue;
        }
        if (!previousWindowWasViolation) {
            currentRunReported = false;
        }
        previousWindowWasViolation = true;
        if (currentRunReported) {
            continue;
        }

        const source = resolveIntervalSource(lastShiftInterval);
        if (source === null) {
            continue;
        }

        const { excessMinutes, measuredMinutes } = measureExcessMinutes(workingTimeInWindowMs, config.nightWorkMaxDailyMinutes);
        infringements.push({
            allowedValueMinutes: config.nightWorkMaxDailyMinutes,
            category: 'nightWork',
            excessOrDeficitMinutes: excessMinutes,
            id: `wt-night-10h-${String(shiftStart)}`,
            legalReference: {
                article: 'Art. 7(1)',
                description: 'Daily working time exceeding 10 hours during a 24-hour period with night work',
                regulation: 'Directive 2002/15/EC',
            },
            measuredValueMinutes: measuredMinutes,
            profileId: profile.profileId,
            recordedAt: shiftStart,
            ruleId: NIGHT_WORK_DAILY_LIMIT_RULE_ID,
            severity: calculateSeverity(excessMinutes, profile, NIGHT_WORK_DAILY_LIMIT_RULE_ID),
            source,
            title: 'Night Work Daily Limit (10h) Exceeded',
        });
        currentRunReported = true;
    }

    return infringements;
}

// Evaluates Directive 2002/15/EC working-time rules.
// Requires pre-merged contiguous activity intervals so midnight splits do not distort break durations.
export function evaluateWorkingTimeInfringements(
    intervals: readonly EvaluationInterval[],
    profile: IRuleProfile,
    nightWindow?: INightWindow,
): readonly IInfringement[] {
    const config = profile.workingTimeRules;
    if (config === undefined || intervals.length === 0) {
        return [];
    }
    // Falls back to profile default when custom night window is omitted.
    const effectiveNightWindow: INightWindow = nightWindow ?? {
        endHour: config.nightWindowEndHourUtc,
        startHour: config.nightWindowStartHourUtc,
        timeZone: 'UTC',
    };

    const weeklyWorkingMs = buildWeeklyWorkingTimeMap(intervals);

    return [
        ...evaluateWorkingTimeBreakRules(intervals, profile, config),
        ...evaluateMaxWeeklyWorkingTimeRule(weeklyWorkingMs, profile, config),
        ...evaluateAverageWeeklyWorkingTimeRule(weeklyWorkingMs, profile, config),
        ...evaluateNightWorkLimitRule(intervals, profile, config, effectiveNightWindow),
    ];
}
