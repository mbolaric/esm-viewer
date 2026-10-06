import { isUtcTimestamp } from '#tachograph-domain';
import { MILLISECONDS_PER_MINUTE } from '#time';

import { walkContinuousDriving } from '../continuous-driving.js';
import type { IInfringement } from '../infringement.js';
import { calculateSeverity, measureExcessMinutes, type IRuleProfile } from '../rule-profile.js';
import type { EvaluationInterval } from '../unrecorded-time.js';

// Reg. 561/2006 Art. 7 & Reg. 2016/403 Annex I: reports uninterrupted stints as one evolving infringement. The reset
// rules live in one place, `walkContinuousDriving`, which the Activities notice also reads.
// Assumes intervals are pre-merged across UTC midnights.
export function evaluateBreakInfringements(
    intervals: readonly EvaluationInterval[],
    profile: IRuleProfile,
): readonly IInfringement[] {
    const infringements: IInfringement[] = [];
    const maxDrivingMs = profile.breakRules.maxContinuousDrivingMinutes * MILLISECONDS_PER_MINUTE;
    let drivingStartTimestamp: number | null = null;
    // Index of existing infringement for current stint, or null if not yet breached.
    let openStintInfringementIndex: number | null = null;

    walkContinuousDriving(intervals, profile, (update) => {
        if (update.kind !== 'driving') {
            if (update.kind === 'reset') {
                drivingStartTimestamp = null;
                openStintInfringementIndex = null;
            }
            return;
        }

        drivingStartTimestamp ??= update.pieceStart;
        if (update.accumulatedMs <= maxDrivingMs) {
            return;
        }

        const { excessMinutes, measuredMinutes: measuredDrivingMinutes } = measureExcessMinutes(
            update.accumulatedMs,
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
            return;
        }

        // Record infringement at the exact timestamp the limit was exceeded within the driving interval.
        const remainingAllowedMs = Math.max(0, maxDrivingMs - update.accumulatedBeforeMs);
        const crossingTimestamp = update.pieceStart + remainingAllowedMs;
        const recordedAt = isUtcTimestamp(crossingTimestamp) ? crossingTimestamp : update.interval.start;
        openStintInfringementIndex = infringements.length;
        infringements.push({
            allowedValueMinutes: profile.breakRules.maxContinuousDrivingMinutes,
            category: 'break',
            excessOrDeficitMinutes: excessMinutes,
            id: `break-${String(update.interval.start)}-${String(drivingStartTimestamp)}`,
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
            source: update.interval.source,
            title: 'Break Requirement Exceeded',
        });
        // A 15-minute first split taken before the breach is kept: its 30-minute completion, though late, still ends
        // this stint rather than letting later driving compound into the same finding.
    });

    return infringements;
}
