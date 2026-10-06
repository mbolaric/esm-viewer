import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_MINUTE, startOfUtcDay } from '#time';

import type { IRecordedActivityInterval } from '#tachograph-domain';

import { createAvailabilityBreakCredit, createDailyCyclePolicy } from './multi-manning.js';
import type { IRuleProfile } from './rule-profile.js';
import type { EvaluationInterval } from './unrecorded-time.js';

// The one continuous-driving rule machine. The break evaluator and any screen that presents the stint walk the same
// updates, so a notice cannot apply different reset rules from the findings it is drawn beside.

export type ContinuousDrivingUpdate =
    | {
          readonly accumulatedBeforeMs: number;
          readonly accumulatedMs: number;
          // Instant this piece of driving ends at; driving is split at each UTC midnight so a day's share can be read
          // without ending the stint.
          readonly at: number;
          // Only a recorded interval can carry driving.
          readonly interval: IRecordedActivityInterval;
          readonly kind: 'driving';
          readonly pieceStart: number;
      }
    | {
          readonly accumulatedMs: number;
          readonly at: number;
          readonly interval: EvaluationInterval;
          // 'neutral' is an interval that neither accumulates driving nor ends the stint (unknown time that the
          // resolution did not turn into rest, or availability the evaluation did not credit).
          readonly kind: 'neutral' | 'reset';
      };

// Applies Directive 2002/15/EC Art. 5(2) and Regulation (EC) 561/2006 Art. 7 resets: a break of at least the rule
// profile's full duration, a 15 + 30 minute split break in that order, or a credited co-driver availability break.
export function walkContinuousDriving(
    intervals: readonly EvaluationInterval[],
    profile: IRuleProfile,
    onUpdate: (update: ContinuousDrivingUpdate) => void,
): void {
    const minBreakMs = profile.breakRules.minTotalBreakMinutes * MILLISECONDS_PER_MINUTE;
    const splitRule = profile.breakRules.splitBreaks[0];
    const isCreditedAvailabilityBreak = createAvailabilityBreakCredit(
        intervals,
        profile,
        createDailyCyclePolicy(intervals, profile),
    );
    let accumulatedMs = 0;
    let firstSplitBreakMs = 0;

    for (const interval of intervals) {
        if (interval.activity === 'driving') {
            let pieceStart: number = interval.start;
            while (pieceStart < interval.end) {
                const pieceEnd = Math.min(interval.end, startOfUtcDay(pieceStart) + MILLISECONDS_PER_DAY);
                const accumulatedBeforeMs = accumulatedMs;
                accumulatedMs += pieceEnd - pieceStart;
                onUpdate({
                    accumulatedBeforeMs,
                    accumulatedMs,
                    at: pieceEnd,
                    interval,
                    kind: 'driving',
                    pieceStart,
                });
                pieceStart = pieceEnd;
            }
            continue;
        }

        const durationMs = Math.max(0, interval.end - interval.start);
        if (isCreditedAvailabilityBreak(interval)) {
            // Art. 7, third paragraph: counts as one continuous break, never as a split part.
            accumulatedMs = 0;
            firstSplitBreakMs = 0;
            onUpdate({ accumulatedMs, at: interval.end, interval, kind: 'reset' });
            continue;
        }

        if (interval.activity === 'breakOrRest') {
            const isFullBreak = durationMs >= minBreakMs;
            const completesSplit =
                splitRule !== undefined &&
                firstSplitBreakMs >= splitRule.firstBreakMinutes * MILLISECONDS_PER_MINUTE &&
                durationMs >= splitRule.secondBreakMinutes * MILLISECONDS_PER_MINUTE;
            if (isFullBreak || completesSplit) {
                accumulatedMs = 0;
                firstSplitBreakMs = 0;
                onUpdate({ accumulatedMs, at: interval.end, interval, kind: 'reset' });
                continue;
            }
            if (
                splitRule !== undefined &&
                firstSplitBreakMs === 0 &&
                durationMs >= splitRule.firstBreakMinutes * MILLISECONDS_PER_MINUTE
            ) {
                // A qualifying break of at least 15 minutes acts as the candidate first split break.
                firstSplitBreakMs = durationMs;
            }
        }

        onUpdate({ accumulatedMs, at: interval.end, interval, kind: 'neutral' });
    }
}

export interface IContinuousDrivingDaySample {
    readonly midnightUtc: number;
    // Highest value the stint reached inside the day, including the value carried into it.
    readonly peakMs: number;
    // Value at the end of the day.
    readonly valueMs: number;
}

// Samples the stint at each UTC day's end. Midnight never resets it, a qualifying break does, and a break's reset
// takes effect at its end, so a break that only crosses a day boundary leaves that day's closing value intact.
export function sampleContinuousDrivingByDay(
    midnights: readonly number[],
    intervals: readonly EvaluationInterval[],
    profile: IRuleProfile,
): readonly IContinuousDrivingDaySample[] {
    const observations: { readonly at: number; readonly valueMs: number }[] = [];
    walkContinuousDriving(intervals, profile, (update) => {
        observations.push({ at: update.at, valueMs: update.accumulatedMs });
    });

    let observationIndex = 0;
    let valueMs = 0;
    return midnights.map((midnightUtc) => {
        const dayEnd = midnightUtc + MILLISECONDS_PER_DAY;
        let peakMs = valueMs;
        for (;;) {
            const observation = observations[observationIndex];
            if (observation === undefined || observation.at > dayEnd) {
                break;
            }
            valueMs = observation.valueMs;
            peakMs = Math.max(peakMs, observation.valueMs);
            observationIndex += 1;
        }
        return { midnightUtc, peakMs, valueMs };
    });
}
