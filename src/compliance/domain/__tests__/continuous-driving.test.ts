import {
    createSourceReference,
    isJsonPointer,
    isUtcTimestamp,
    type IRecordedActivityInterval,
    type ISourceReference,
    type UtcTimestamp,
} from '#tachograph-domain';
import { describe, expect, it } from 'vitest';

import { sampleContinuousDrivingByDay, type IContinuousDrivingDaySample } from '../continuous-driving.js';
import { evaluateBreakInfringements } from '../evaluators/break-evaluator.js';
import { EU_561_2006_STANDARD } from '../rule-profile.js';

const hour = 3_600_000;
const minute = 60_000;
const day1Midnight = Date.UTC(2026, 0, 5);
const day2Midnight = day1Midnight + 24 * hour;

function timestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The continuous-driving fixture timestamp must be valid.');
    }
    return value;
}

function source(path: string): ISourceReference<'g2', 'driverCard'> {
    if (!isJsonPointer(path)) {
        throw new TypeError('The continuous-driving fixture pointer must be valid.');
    }
    return createSourceReference('driverCard', 'g2', path);
}

function interval(
    activity: 'availability' | 'breakOrRest' | 'driving' | 'work',
    startMs: number,
    endMs: number,
): IRecordedActivityInterval {
    return {
        activity,
        crewPresence: 'single',
        end: timestamp(endMs),
        origin: 'recorded',
        slot: 'Driver',
        source: source('/card/activities/0'),
        start: timestamp(startMs),
    };
}

function sample(intervals: readonly IRecordedActivityInterval[]): readonly IContinuousDrivingDaySample[] {
    return sampleContinuousDrivingByDay([day1Midnight, day2Midnight], intervals, EU_561_2006_STANDARD);
}

describe('sampleContinuousDrivingByDay', () => {
    it('keeps one stint across midnight and reports each day its own share', () => {
        const days = sample([interval('driving', day1Midnight + 22 * hour, day2Midnight + 3 * hour)]);

        expect(days).toEqual([
            { midnightUtc: day1Midnight, peakMs: 2 * hour, valueMs: 2 * hour },
            { midnightUtc: day2Midnight, peakMs: 5 * hour, valueMs: 5 * hour },
        ]);
        // The evaluator reads the same stint: the breach is reported once, at the instant the limit was crossed.
        const findings = evaluateBreakInfringements(
            [interval('driving', day1Midnight + 22 * hour, day2Midnight + 3 * hour)],
            EU_561_2006_STANDARD,
        );
        expect(findings).toHaveLength(1);
        // The limit is crossed 4h30m after the stint began, at 02:30 on the second day.
        expect(findings[0]?.recordedAt).toBe(day2Midnight + 2 * hour + 30 * minute);
    });

    it('applies a break that crosses midnight only once it has ended', () => {
        const days = sample([
            interval('driving', day1Midnight + 19 * hour, day1Midnight + 23 * hour),
            interval('breakOrRest', day1Midnight + 23 * hour, day2Midnight + 30 * minute),
            interval('driving', day2Midnight + 3 * hour, day2Midnight + 4 * hour),
        ]);

        expect(days[0]?.valueMs).toBe(4 * hour);
        expect(days[1]?.valueMs).toBe(hour);
    });

    it('does not reset on a break shorter than the profile requires', () => {
        const days = sample([
            interval('driving', day1Midnight + 8 * hour, day1Midnight + 10 * hour),
            interval('breakOrRest', day1Midnight + 10 * hour, day1Midnight + 10 * hour + 30 * minute),
            interval('driving', day1Midnight + 11 * hour, day1Midnight + 13 * hour),
        ]);

        expect(days[0]?.valueMs).toBe(4 * hour);
    });

    it('resets on a 15 + 30 minute split break but not on the same breaks in reverse order', () => {
        const inOrder = sample([
            interval('driving', day1Midnight + 6 * hour, day1Midnight + 8 * hour),
            interval('breakOrRest', day1Midnight + 8 * hour, day1Midnight + 8 * hour + 15 * minute),
            interval('driving', day1Midnight + 9 * hour, day1Midnight + 10 * hour),
            interval('breakOrRest', day1Midnight + 10 * hour, day1Midnight + 10 * hour + 30 * minute),
            interval('driving', day1Midnight + 11 * hour, day1Midnight + 12 * hour),
        ]);
        expect(inOrder[0]?.valueMs).toBe(hour);

        const reversed = sample([
            interval('driving', day1Midnight + 6 * hour, day1Midnight + 8 * hour),
            interval('breakOrRest', day1Midnight + 8 * hour, day1Midnight + 8 * hour + 30 * minute),
            interval('driving', day1Midnight + 9 * hour, day1Midnight + 10 * hour),
            interval('breakOrRest', day1Midnight + 10 * hour, day1Midnight + 10 * hour + 15 * minute),
            interval('driving', day1Midnight + 11 * hour, day1Midnight + 12 * hour),
        ]);
        // 30 then 15 is not the described sequence, so the clock keeps running over all four hours of driving.
        expect(reversed[0]?.valueMs).toBe(4 * hour);
    });
});
