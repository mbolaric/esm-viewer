import { isUtcTimestamp } from '#tachograph-domain';
import { MILLISECONDS_PER_MINUTE } from '#time';

import type { IInfringement } from '../infringement.js';
import { createAvailabilityBreakCredit, createDailyCyclePolicy } from '../multi-manning.js';
import { calculateSeverity, measureExcessMinutes, type IRuleProfile } from '../rule-profile.js';
import type { EvaluationInterval } from '../unrecorded-time.js';

// Reg. 561/2006 Art. 7 & Reg. 2016/403 Annex I: tracks continuous driving until reset by a 45m or 15m+30m split break.
// Reports uninterrupted stints as one evolving infringement; assumes intervals are pre-merged across UTC midnights.
export function evaluateBreakInfringements(
    intervals: readonly EvaluationInterval[],
    profile: IRuleProfile,
): readonly IInfringement[] {
    const infringements: IInfringement[] = [];
    const maxDrivingMs = profile.breakRules.maxContinuousDrivingMinutes * MILLISECONDS_PER_MINUTE;
    const minBreakMs = profile.breakRules.minTotalBreakMinutes * MILLISECONDS_PER_MINUTE;

    let accumulatedDrivingMs = 0;
    let firstBreakMs = 0;
    let drivingStartTimestamp: number | null = null;
    // Index of existing infringement for current stint, or null if not yet breached.
    let openStintInfringementIndex: number | null = null;
    const isCreditedAvailabilityBreak = createAvailabilityBreakCredit(
        intervals,
        profile,
        createDailyCyclePolicy(intervals, profile),
    );

    for (const interval of intervals) {
        const durationMs = Math.max(0, interval.end - interval.start);

        if (interval.activity === 'driving') {
            drivingStartTimestamp ??= interval.start;
            const accumulatedBeforeIntervalMs = accumulatedDrivingMs;
            accumulatedDrivingMs += durationMs;

            if (accumulatedDrivingMs > maxDrivingMs) {
                const { excessMinutes, measuredMinutes: measuredDrivingMinutes } = measureExcessMinutes(
                    accumulatedDrivingMs,
                    profile.breakRules.maxContinuousDrivingMinutes,
                );
                const severity = calculateSeverity(excessMinutes, profile, 'BREAK_CONTINUOUS_DRIVING');

                const openIndex = openStintInfringementIndex;
                const openInfringement = openIndex === null ? undefined : infringements[openIndex];

                if (openIndex !== null && openInfringement !== undefined) {
                    // Stint already breached: update measurement in place with expanded driving duration.
                    infringements[openIndex] = {
                        ...openInfringement,
                        excessOrDeficitMinutes: excessMinutes,
                        measuredValueMinutes: measuredDrivingMinutes,
                        severity,
                    };
                } else {
                    // Record infringement at the exact timestamp the limit was exceeded within the driving interval.
                    const remainingAllowedMs = Math.max(0, maxDrivingMs - accumulatedBeforeIntervalMs);
                    const crossingTimestamp = interval.start + remainingAllowedMs;
                    const recordedAt = isUtcTimestamp(crossingTimestamp) ? crossingTimestamp : interval.start;
                    openStintInfringementIndex = infringements.length;
                    infringements.push({
                        allowedValueMinutes: profile.breakRules.maxContinuousDrivingMinutes,
                        category: 'break',
                        excessOrDeficitMinutes: excessMinutes,
                        id: `break-${String(interval.start)}-${String(drivingStartTimestamp)}`,
                        legalReference: {
                            article: 'Art. 7',
                            description: 'Continuous driving without a 45-minute break',
                            regulation: profile.regulationName,
                        },
                        measuredValueMinutes: measuredDrivingMinutes,
                        profileId: profile.profileId,
                        recordedAt,
                        ruleId: 'BREAK_CONTINUOUS_DRIVING',
                        severity,
                        source: interval.source,
                        title: 'Break Requirement Exceeded',
                    });
                    // A 15-minute first split taken before the breach is kept: its 30-minute completion, though late,
                    // still ends this stint rather than letting later driving compound into the same finding.
                }
            }
        } else if (isCreditedAvailabilityBreak(interval)) {
            // Art. 7, third paragraph: counts as one continuous 45-minute break, never as a split part.
            accumulatedDrivingMs = 0;
            firstBreakMs = 0;
            drivingStartTimestamp = null;
            openStintInfringementIndex = null;
        } else if (interval.activity === 'breakOrRest') {
            const splitRules = profile.breakRules.splitBreaks;
            const firstSplitRule = splitRules[0];

            if (durationMs >= minBreakMs) {
                // A continuous break of at least 45 minutes resets accumulated driving
                accumulatedDrivingMs = 0;
                firstBreakMs = 0;
                drivingStartTimestamp = null;
                openStintInfringementIndex = null;
            } else if (
                firstSplitRule !== undefined &&
                firstBreakMs >= firstSplitRule.firstBreakMinutes * MILLISECONDS_PER_MINUTE &&
                durationMs >= firstSplitRule.secondBreakMinutes * MILLISECONDS_PER_MINUTE
            ) {
                // Valid split break: >= 15 min followed by >= 30 min
                accumulatedDrivingMs = 0;
                firstBreakMs = 0;
                drivingStartTimestamp = null;
                openStintInfringementIndex = null;
            } else if (firstSplitRule !== undefined && durationMs >= firstSplitRule.firstBreakMinutes * MILLISECONDS_PER_MINUTE) {
                // A qualifying break of at least 15 min acts as the candidate first split break
                firstBreakMs = durationMs;
            }
        }
    }

    return infringements;
}
