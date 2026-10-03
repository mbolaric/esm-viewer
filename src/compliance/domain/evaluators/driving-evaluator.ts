import type { EvaluationInterval } from '../unrecorded-time.js';
import { contiguousCalendarWeekKeys, getCalendarWeekKey, MILLISECONDS_PER_MINUTE, splitByCalendarWeek } from '#time';

import { isQualifyingDailyRest, nextDailyCycleAnchor, resolveDailyCycleWindow, type IDailyCycleWindow } from '../daily-cycle.js';
import type { IInfringement } from '../infringement.js';
import { createDailyCyclePolicy } from '../multi-manning.js';
import { calculateSeverity, measureExcessMinutes, type IRuleProfile } from '../rule-profile.js';

interface IDailyDrivingPeriod {
    readonly cycleWindow: IDailyCycleWindow;
    durationMs: number;
    lastInterval: EvaluationInterval;
    // Driving start offset within period (can be later than interval start when drive is cut at window end).
    readonly startedAt: number;
}

// The first driving interval that lies, even partly, in the week.
function findFirstDrivingInWeek(intervals: readonly EvaluationInterval[], weekKey: string): EvaluationInterval | undefined {
    for (const interval of intervals) {
        if (interval.activity !== 'driving') {
            continue;
        }
        const segment = splitByCalendarWeek(interval.start, interval.end).find((candidate) => candidate.weekKey === weekKey);
        if (segment !== undefined) {
            return interval;
        }
    }
    return undefined;
}

// Assumes contiguous intervals are pre-merged to prevent midnight normalization splits from falsifying cycle boundaries.
export function evaluateDrivingInfringements(
    intervals: readonly EvaluationInterval[],
    profile: IRuleProfile,
): readonly IInfringement[] {
    const infringements: IInfringement[] = [];
    const dailyPeriods: IDailyDrivingPeriod[] = [];
    const weeklyDrivingMs = new Map<string, number>();

    let currentPeriod: IDailyDrivingPeriod | null = null;
    let cycleAnchor: number | null = null;
    // Art. 8(5): a multi-manning duty period runs 30 hours, so its driving is not cut at 24 hours.
    const cyclePolicy = createDailyCyclePolicy(intervals, profile);

    for (const interval of intervals) {
        // Art. 8(2) & 4(k): Close an expired cycle's driving period to prevent compounding driving across subsequent days.
        if (currentPeriod !== null && interval.start >= currentPeriod.cycleWindow.end) {
            dailyPeriods.push(currentPeriod);
            cycleAnchor = nextDailyCycleAnchor(currentPeriod.cycleWindow, null);
            currentPeriod = null;
        }

        if (interval.activity === 'driving') {
            // Guidance Note 7: split drives crossing the cycle window boundary across respective windows.
            const drivingEnd = Math.max(interval.start, interval.end);
            let cursor: number = interval.start;
            do {
                if (currentPeriod !== null && cursor >= currentPeriod.cycleWindow.end) {
                    dailyPeriods.push(currentPeriod);
                    cycleAnchor = nextDailyCycleAnchor(currentPeriod.cycleWindow, null);
                    currentPeriod = null;
                }
                currentPeriod ??= {
                    cycleWindow: resolveDailyCycleWindow(cycleAnchor, cursor, cyclePolicy),
                    durationMs: 0,
                    lastInterval: interval,
                    startedAt: cursor,
                };
                const segmentEnd = Math.min(drivingEnd, currentPeriod.cycleWindow.end);
                currentPeriod.durationMs += segmentEnd - cursor;
                currentPeriod.lastInterval = interval;
                cursor = segmentEnd;
            } while (cursor < drivingEnd);

            for (const segment of splitByCalendarWeek(interval.start, interval.end)) {
                weeklyDrivingMs.set(segment.weekKey, (weeklyDrivingMs.get(segment.weekKey) ?? 0) + segment.durationMs);
            }
        } else if (isQualifyingDailyRest(interval, profile)) {
            // A qualifying daily rest period ends the current daily driving cycle
            if (currentPeriod !== null) {
                dailyPeriods.push(currentPeriod);
                currentPeriod = null;
            }
            cycleAnchor = interval.end;
        }
    }

    if (currentPeriod !== null) {
        dailyPeriods.push(currentPeriod);
    }

    const weeklyExtensions = new Map<string, number>();

    for (const period of dailyPeriods) {
        const standardLimitMinutes = profile.dailyDrivingRules.standardDailyDrivingMinutes;
        const extendedLimitMinutes = profile.dailyDrivingRules.extendedDailyDrivingMinutes;
        const standardLimitMs = standardLimitMinutes * MILLISECONDS_PER_MINUTE;
        const weekKey = getCalendarWeekKey(period.startedAt);

        const extensionsThisWeek = weeklyExtensions.get(weekKey) ?? 0;

        if (period.durationMs > standardLimitMs) {
            // Art. 6(1): driving >9h consumes weekly extension quota; once exhausted, days are evaluated against 9h standard limit.
            const extensionAvailable = extensionsThisWeek < profile.dailyDrivingRules.maxExtensionsPerCalendarWeek;

            if (extensionAvailable) {
                weeklyExtensions.set(weekKey, extensionsThisWeek + 1);
            }

            const allowedMinutes = extensionAvailable ? extendedLimitMinutes : standardLimitMinutes;

            if (period.durationMs > allowedMinutes * MILLISECONDS_PER_MINUTE) {
                const { excessMinutes, measuredMinutes } = measureExcessMinutes(period.durationMs, allowedMinutes);
                const severity = calculateSeverity(excessMinutes, profile, 'DAILY_DRIVING_LIMIT');

                const source = period.lastInterval.origin === 'recorded' ? period.lastInterval.source : null;
                if (source !== null) {
                    infringements.push({
                        allowedValueMinutes: allowedMinutes,
                        category: 'dailyDriving',
                        excessOrDeficitMinutes: excessMinutes,
                        id: `daily-driving-${String(period.startedAt)}`,
                        legalReference: {
                            article: 'Art. 6(1)',
                            description: 'Daily driving time limit exceeded',
                            regulation: profile.regulationName,
                        },
                        measuredValueMinutes: measuredMinutes,
                        profileId: profile.profileId,
                        recordedAt: period.lastInterval.start,
                        ruleId: 'DAILY_DRIVING_LIMIT',
                        severity,
                        source,
                        title: 'Daily Driving Limit Exceeded',
                    });
                }
            }
        }
    }

    for (const [weekKey, totalDurationMs] of weeklyDrivingMs) {
        const maxWeeklyMinutes = profile.weeklyDrivingRules.maxWeeklyDrivingMinutes;
        const maxWeeklyMs = maxWeeklyMinutes * MILLISECONDS_PER_MINUTE;

        // A limit of 0 disables weekly driving checks (e.g. GB domestic rules).
        if (maxWeeklyMinutes > 0 && totalDurationMs > maxWeeklyMs) {
            const { excessMinutes, measuredMinutes } = measureExcessMinutes(totalDurationMs, maxWeeklyMinutes);
            const severity = calculateSeverity(excessMinutes, profile, 'WEEKLY_DRIVING_LIMIT');
            const firstIntervalInWeek = findFirstDrivingInWeek(intervals, weekKey);

            const source = firstIntervalInWeek?.origin === 'recorded' ? firstIntervalInWeek.source : null;

            if (source !== null && firstIntervalInWeek !== undefined) {
                infringements.push({
                    allowedValueMinutes: maxWeeklyMinutes,
                    category: 'weeklyDriving',
                    excessOrDeficitMinutes: excessMinutes,
                    id: `weekly-driving-${weekKey}`,
                    legalReference: {
                        article: 'Art. 6(2)',
                        description: 'Weekly driving limit exceeded',
                        regulation: profile.regulationName,
                    },
                    measuredValueMinutes: measuredMinutes,
                    profileId: profile.profileId,
                    recordedAt: firstIntervalInWeek.start,
                    ruleId: 'WEEKLY_DRIVING_LIMIT',
                    severity,
                    source,
                    title: 'Weekly Driving Limit Exceeded',
                });
            }
        }
    }

    // Art. 6(3): fortnightly driving limit (90h). Walks calendar weeks contiguously to prevent skipping zero-driving weeks.
    const maxBiWeeklyMinutes = profile.weeklyDrivingRules.maxBiWeeklyDrivingMinutes;
    if (maxBiWeeklyMinutes > 0 && weeklyDrivingMs.size > 0) {
        const drivingWeekKeys = [...weeklyDrivingMs.keys()].sort();
        const firstDrivingWeekKey = drivingWeekKeys[0];
        const lastDrivingWeekKey = drivingWeekKeys.at(-1);
        const weeks =
            firstDrivingWeekKey !== undefined && lastDrivingWeekKey !== undefined
                ? contiguousCalendarWeekKeys(firstDrivingWeekKey, lastDrivingWeekKey)
                : [];

        for (let index = 0; index < weeks.length - 1; index++) {
            const firstWeekKey = weeks[index];
            const secondWeekKey = weeks[index + 1];
            if (firstWeekKey === undefined || secondWeekKey === undefined) {
                continue;
            }
            const biWeeklyDurationMs = (weeklyDrivingMs.get(firstWeekKey) ?? 0) + (weeklyDrivingMs.get(secondWeekKey) ?? 0);
            const maxBiWeeklyMs = maxBiWeeklyMinutes * MILLISECONDS_PER_MINUTE;

            if (biWeeklyDurationMs > maxBiWeeklyMs) {
                const { excessMinutes, measuredMinutes: biWeeklyMinutes } = measureExcessMinutes(
                    biWeeklyDurationMs,
                    maxBiWeeklyMinutes,
                );
                const firstIntervalInSecondWeek = findFirstDrivingInWeek(intervals, secondWeekKey);
                const source = firstIntervalInSecondWeek?.origin === 'recorded' ? firstIntervalInSecondWeek.source : null;

                if (source !== null && firstIntervalInSecondWeek !== undefined) {
                    infringements.push({
                        allowedValueMinutes: maxBiWeeklyMinutes,
                        category: 'weeklyDriving',
                        excessOrDeficitMinutes: excessMinutes,
                        id: `weekly-driving-biweekly-${firstWeekKey}`,
                        legalReference: {
                            article: 'Art. 6(3)',
                            description: 'Driving limit exceeded in two consecutive weeks',
                            regulation: profile.regulationName,
                        },
                        measuredValueMinutes: biWeeklyMinutes,
                        profileId: profile.profileId,
                        recordedAt: firstIntervalInSecondWeek.start,
                        ruleId: 'WEEKLY_DRIVING_BIWEEKLY_LIMIT',
                        severity: calculateSeverity(excessMinutes, profile, 'WEEKLY_DRIVING_BIWEEKLY_LIMIT'),
                        source,
                        title: 'Bi-Weekly Driving Limit Exceeded',
                    });
                }
            }
        }
    }

    return infringements;
}
