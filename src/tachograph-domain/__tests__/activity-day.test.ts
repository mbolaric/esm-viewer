import { describe, expect, it } from 'vitest';

import {
    createRecordedActivityInterval,
    groupActivityDays,
    normalizeActivityDay,
    type ActivityInterval,
    type ActivityKind,
    type ISourceReference,
    isJsonPointer,
    isUtcTimestamp,
    type UtcTimestamp,
} from '../index.js';
import { fixtureSingleDriverCrew } from '#testing';

function ts(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('Not a valid test timestamp.');
    }

    return value;
}

function source(pathValue: string): ISourceReference<'g2', 'driverCard'> {
    if (!isJsonPointer(pathValue)) {
        throw new TypeError('Not a valid test JSON Pointer.');
    }

    return {
        documentKind: 'driverCard',
        generation: 'g2',
        path: pathValue,
    };
}

function interval(activity: ActivityKind, start: number, end: number, pathValue: string): ActivityInterval {
    const result = createRecordedActivityInterval(activity, ts(start), ts(end), source(pathValue), fixtureSingleDriverCrew);

    if (result === null) {
        throw new TypeError('Test interval must be valid.');
    }

    return result;
}

const dayMidnight = 0; // 1970-01-01 00:00:00 UTC

describe('normalizeActivityDay', () => {
    it('normalizes a day with ordered non-overlapping intervals and inferred gaps', () => {
        const result = normalizeActivityDay(
            [
                interval('driving', 0, 36_000_000, '/activities/0'),
                interval('work', 39_600_000, 54_000_000, '/activities/1'),
                interval('breakOrRest', 57_600_000, 72_000_000, '/activities/2'),
            ],
            ts(dayMidnight),
        );

        expect(result).toEqual({
            day: {
                intervals: [
                    interval('driving', 0, 36_000_000, '/activities/0'),
                    {
                        activity: 'unknown',
                        crewPresence: 'unknown',
                        end: 39_600_000,
                        origin: 'inferredGap',
                        slot: 'Unknown',
                        source: null,
                        start: 36_000_000,
                    },
                    interval('work', 39_600_000, 54_000_000, '/activities/1'),
                    {
                        activity: 'unknown',
                        crewPresence: 'unknown',
                        end: 57_600_000,
                        origin: 'inferredGap',
                        slot: 'Unknown',
                        source: null,
                        start: 54_000_000,
                    },
                    interval('breakOrRest', 57_600_000, 72_000_000, '/activities/2'),
                    {
                        activity: 'unknown',
                        crewPresence: 'unknown',
                        end: 86_400_000,
                        origin: 'inferredGap',
                        slot: 'Unknown',
                        source: null,
                        start: 72_000_000,
                    },
                ],
                midnightUtc: 0,
                totals: {
                    availability: 0,
                    breakOrRest: 14_400_000,
                    driving: 36_000_000,
                    unknown: 21_600_000,
                    work: 14_400_000,
                },
            },
            status: 'normalized',
        });
    });

    it('produces an empty-data day when no intervals fall within the UTC-midnight window', () => {
        expect(normalizeActivityDay([], ts(dayMidnight))).toEqual({
            midnightUtc: 0,
            status: 'emptyData',
        });
    });

    it('rejects a UTC midnight that is not aligned to a day start', () => {
        expect(normalizeActivityDay([], ts(1))).toEqual({
            midnightUtc: 1,
            status: 'invalidMidnight',
        });
    });

    it('rejects an interval that crosses the UTC midnight boundary', () => {
        const crossingInterval = interval('driving', 72_000_000, 108_000_000, '/activities/0');

        expect(normalizeActivityDay([crossingInterval], ts(dayMidnight))).toEqual({
            interval: crossingInterval,
            midnightUtc: 0,
            status: 'midnightBoundary',
        });
    });

    it('rejects a structurally invalid interval before inferring gaps', () => {
        const valid = interval('driving', 1, 2, '/activities/0');
        const invalid: ActivityInterval = {
            ...valid,
            end: ts(1),
            start: ts(2),
        };

        expect(normalizeActivityDay([invalid], ts(dayMidnight))).toEqual({
            interval: invalid,
            midnightUtc: 0,
            status: 'invalidInterval',
        });
    });

    it('reports overlapping intervals within a day', () => {
        const current = interval('driving', 0, 36_000_000, '/activities/0');
        const overlapping = interval('work', 18_000_000, 54_000_000, '/activities/1');

        expect(normalizeActivityDay([overlapping, current], ts(dayMidnight))).toEqual({
            current,
            overlapping,
            status: 'overlap',
        });
    });

    it('accepts a full-day contiguous timeline without gaps', () => {
        const fullDay = interval('driving', 0, 86_400_000, '/activities/0');

        expect(normalizeActivityDay([fullDay], ts(dayMidnight))).toEqual({
            day: {
                intervals: [fullDay],
                midnightUtc: 0,
                totals: {
                    availability: 0,
                    breakOrRest: 0,
                    driving: 86_400_000,
                    unknown: 0,
                    work: 0,
                },
            },
            status: 'normalized',
        });
    });
});

describe('groupActivityDays', () => {
    it('returns an empty array for an empty interval collection', () => {
        const days = groupActivityDays([]);

        expect(days).toEqual([]);
    });

    it('groups intervals across multiple UTC-midnight-aligned days', () => {
        const day1Morning = interval('driving', 0, 36_000_000, '/activities/0');
        const day1Afternoon = interval('work', 39_600_000, 72_000_000, '/activities/1');
        const day2Morning = interval('driving', 86_400_000, 108_000_000, '/activities/2');
        const day2Evening = interval('breakOrRest', 118_800_000, 144_000_000, '/activities/3');

        const days = groupActivityDays([day2Evening, day1Morning, day2Morning, day1Afternoon]);

        expect(days).toHaveLength(2);

        const day1 = days[0];
        const day2 = days[1];

        if (day1 === undefined || day2 === undefined) {
            throw new TypeError('Test must produce two days.');
        }

        expect(day1.status).toBe('normalized');
        expect(day2.status).toBe('normalized');

        if (day1.status === 'normalized' && day2.status === 'normalized') {
            expect(day1.day.midnightUtc).toBe(0);
            expect(day1.day.totals.driving).toBe(36_000_000);
            expect(day1.day.totals.work).toBe(32_400_000);

            expect(day2.day.midnightUtc).toBe(86_400_000);
            expect(day2.day.totals.driving).toBe(21_600_000);
            expect(day2.day.totals.breakOrRest).toBe(25_200_000);
        }
    });

    it('reports a midnight-boundary error from any day derivation', () => {
        const crossing = interval('driving', 72_000_000, 108_000_000, '/activities/0');

        const days = groupActivityDays([crossing]);

        expect(days).toHaveLength(1);
        expect(days[0]?.status).toBe('midnightBoundary');
    });

    it('produces normalized days in chronological order', () => {
        const day3 = interval('driving', 172_800_000, 180_000_000, '/activities/2');
        const day1 = interval('driving', 0, 10_000, '/activities/0');
        const day2 = interval('driving', 86_400_000, 86_500_000, '/activities/1');

        const days = groupActivityDays([day3, day1, day2]);

        expect(days).toHaveLength(3);

        const midnights = days.map((d) => (d.status === 'normalized' ? d.day.midnightUtc : null));

        expect(midnights).toEqual([0, 86_400_000, 172_800_000]);
    });
});
