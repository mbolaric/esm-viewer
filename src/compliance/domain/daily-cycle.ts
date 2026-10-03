import type { EvaluationInterval } from './unrecorded-time.js';
import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_MINUTE } from '#time';

import type { IRuleProfile } from './rule-profile.js';

// Reg. 561/2006 Art. 8(2) & Guidance Note 7: 24h cycles start at prior qualifying rest end; Art. 8(5) replaces the 24h
// with 30h for a multi-manning duty period. Shared by driving and daily-rest evaluators to synchronize cycle measurement.

export interface IDailyCycleWindow {
    readonly end: number;
    readonly start: number;
}

// Decides the window length of the cycle that starts at a given instant, so every evaluator sharing the policy cuts
// the same duty period at the same boundary.
export interface IDailyCyclePolicy {
    windowLengthMs(windowStart: number): number;
}

export const STANDARD_DAILY_CYCLE_POLICY: IDailyCyclePolicy = {
    windowLengthMs: () => MILLISECONDS_PER_DAY,
};

// Checks if an interval meets the minimum duration for reduced or regular daily rest.
export function isQualifyingDailyRest(interval: EvaluationInterval, profile: IRuleProfile): boolean {
    return (
        interval.activity === 'breakOrRest' &&
        interval.end - interval.start >= profile.dailyRestRules.reducedRestMinutes * MILLISECONDS_PER_MINUTE
    );
}

// Resolves the cycle window from anchor or falls back to dutyStart when anchor is null or its window has lapsed.
export function resolveDailyCycleWindow(anchor: number | null, dutyStart: number, policy: IDailyCyclePolicy): IDailyCycleWindow {
    const start = anchor !== null && dutyStart < anchor + policy.windowLengthMs(anchor) ? anchor : dutyStart;
    return { end: start + policy.windowLengthMs(start), start };
}

// Calculates next cycle anchor from qualifying rest end or window expiration.
export function nextDailyCycleAnchor(window: IDailyCycleWindow, qualifyingRestEnd: number | null): number {
    return qualifyingRestEnd ?? window.end;
}
