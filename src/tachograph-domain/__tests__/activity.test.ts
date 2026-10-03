import { describe, expect, it } from 'vitest';

import {
    calculateActivityTotals,
    classifyActivityIntervalRelation,
    createRecordedActivityInterval,
    createUnknownActivityGap,
    type ActivityInterval,
    type ActivityIntervalRelation,
    type ActivityKind,
    type ISourceReference,
    isJsonPointer,
    isUtcTimestamp,
    orderActivityIntervals,
    type UtcTimestamp,
} from '../index.js';
import { fixtureSingleDriverCrew } from '#testing';

function createTestTimestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The test timestamp must be an exact UTC epoch-millisecond value.');
    }

    return value;
}

function createTestSource(pathValue: string): ISourceReference<'g2', 'driverCard'> {
    if (!isJsonPointer(pathValue)) {
        throw new TypeError('The test source path must be a canonical JSON Pointer.');
    }

    return {
        documentKind: 'driverCard',
        generation: 'g2',
        path: pathValue,
    };
}

function createTestInterval(activity: ActivityKind, start: number, end: number, pathValue: string): ActivityInterval {
    const interval = createRecordedActivityInterval(
        activity,
        createTestTimestamp(start),
        createTestTimestamp(end),
        createTestSource(pathValue),
        fixtureSingleDriverCrew,
    );

    if (interval === null) {
        throw new TypeError('The test activity interval must have increasing boundaries.');
    }

    return interval;
}

describe('createRecordedActivityInterval', () => {
    it('supports every normalized activity kind', () => {
        const kinds = ['availability', 'breakOrRest', 'driving', 'unknown', 'work'] satisfies readonly ActivityKind[];

        expect(
            kinds.map((kind, index) =>
                createRecordedActivityInterval(
                    kind,
                    createTestTimestamp(index * 10),
                    createTestTimestamp(index * 10 + 10),
                    createTestSource(`/activities/${String(index)}`),
                    fixtureSingleDriverCrew,
                ),
            ),
        ).toHaveLength(5);
    });

    it('preserves a half-open UTC interval across a midnight boundary', () => {
        const interval = createTestInterval('driving', 86_399_999, 86_400_001, '/activities/0');

        expect(interval).toEqual({
            activity: 'driving',
            crewPresence: 'single',
            end: 86_400_001,
            origin: 'recorded',
            slot: 'Driver',
            source: createTestSource('/activities/0'),
            start: 86_399_999,
        });
    });

    it.each([
        [10, 10],
        [11, 10],
    ])('rejects empty and reversed boundaries', (start: number, end: number) => {
        expect(
            createRecordedActivityInterval(
                'work',
                createTestTimestamp(start),
                createTestTimestamp(end),
                createTestSource('/activities/0'),
                fixtureSingleDriverCrew,
            ),
        ).toBeNull();
    });
});

describe('activity interval ordering', () => {
    it('orders a frozen snapshot by start and then end without mutating the input', () => {
        const later = createTestInterval('work', 30, 40, '/activities/2');
        const longer = createTestInterval('availability', 10, 30, '/activities/1');
        const earlier = createTestInterval('driving', 10, 20, '/activities/0');
        const intervals = [later, longer, earlier];

        const ordered = orderActivityIntervals(intervals);

        expect(ordered).toEqual([earlier, longer, later]);
        expect(intervals).toEqual([later, longer, earlier]);
    });
});

describe('activity interval relations', () => {
    const current = createTestInterval('driving', 10, 20, '/activities/0');

    it.each([
        ['contiguous', 20, 30],
        ['gap', 21, 30],
        ['overlap', 19, 30],
        ['outOfOrder', 9, 30],
    ] satisfies readonly [ActivityIntervalRelation, number, number][])(
        'classifies a %s candidate',
        (expected: ActivityIntervalRelation, start: number, end: number) => {
            const candidate = createTestInterval('work', start, end, '/activities/1');

            expect(classifyActivityIntervalRelation(current, candidate)).toBe(expected);
        },
    );

    it('creates a source-free Unknown interval for a real gap', () => {
        const candidate = createTestInterval('work', 25, 30, '/activities/1');

        expect(createUnknownActivityGap(current, candidate)).toEqual({
            activity: 'unknown',
            crewPresence: 'unknown',
            end: 25,
            origin: 'inferredGap',
            slot: 'Unknown',
            source: null,
            start: 20,
        });
    });

    it.each([
        [20, 30],
        [19, 30],
        [9, 30],
    ])('does not invent a gap for touching, overlapping, or unordered intervals', (start, end) => {
        const candidate = createTestInterval('work', start, end, '/activities/1');

        expect(createUnknownActivityGap(current, candidate)).toBeNull();
    });
});

describe('calculateActivityTotals', () => {
    it('returns exact zero totals for an empty interval collection', () => {
        expect(calculateActivityTotals([])).toEqual({
            status: 'calculated',
            totals: {
                availability: 0,
                breakOrRest: 0,
                driving: 0,
                unknown: 0,
                work: 0,
            },
        });
    });

    it('calculates exact per-kind durations from unordered non-overlapping intervals', () => {
        const breakOrRest = createTestInterval('breakOrRest', 15, 20, '/activities/2');
        const driving = createTestInterval('driving', 0, 10, '/activities/0');
        const availability = createTestInterval('availability', 10, 15, '/activities/1');
        const recordedUnknown = createTestInterval('unknown', 30, 32, '/activities/4');
        const work = createTestInterval('work', 20, 30, '/activities/3');
        const laterWork = createTestInterval('work', 35, 40, '/activities/5');
        const inferredUnknown = createUnknownActivityGap(recordedUnknown, laterWork);

        if (inferredUnknown === null) {
            throw new TypeError('The test timeline must contain an inferred Unknown gap.');
        }

        const intervals = [laterWork, inferredUnknown, work, recordedUnknown, availability, driving, breakOrRest];

        const calculation = calculateActivityTotals(intervals);

        expect(calculation).toEqual({
            status: 'calculated',
            totals: {
                availability: 5,
                breakOrRest: 5,
                driving: 10,
                unknown: 5,
                work: 15,
            },
        });
        expect(intervals).toEqual([laterWork, inferredUnknown, work, recordedUnknown, availability, driving, breakOrRest]);
        expect(calculation.status).toBe('calculated');
    });

    it('does not silently count an unrepresented gap as Unknown', () => {
        const calculation = calculateActivityTotals([
            createTestInterval('driving', 0, 10, '/activities/0'),
            createTestInterval('work', 20, 30, '/activities/1'),
        ]);

        expect(calculation).toEqual({
            status: 'calculated',
            totals: {
                availability: 0,
                breakOrRest: 0,
                driving: 10,
                unknown: 0,
                work: 10,
            },
        });
    });

    it('reports overlapping intervals instead of double-counting them', () => {
        const current = createTestInterval('driving', 0, 20, '/activities/0');
        const candidate = createTestInterval('work', 10, 30, '/activities/1');

        expect(calculateActivityTotals([candidate, current])).toEqual({
            candidate,
            current,
            status: 'overlap',
        });
    });

    it('rejects a structurally invalid interval', () => {
        const timestamp = createTestTimestamp(10);
        const invalidInterval: ActivityInterval = {
            activity: 'work',
            crewPresence: 'single',
            end: timestamp,
            origin: 'recorded',
            slot: 'Driver',
            source: createTestSource('/activities/0'),
            start: timestamp,
        };

        expect(calculateActivityTotals([invalidInterval])).toEqual({
            interval: invalidInterval,
            status: 'invalidInterval',
        });
    });

    it('reports a per-kind total that exceeds exact integer precision', () => {
        const first = createTestInterval('driving', -8_000_000_000_000_000, -3_000_000_000_000_000, '/activities/0');
        const second = createTestInterval('driving', 0, 5_000_000_000_000_000, '/activities/1');

        expect(calculateActivityTotals([first, second])).toEqual({
            activity: 'driving',
            status: 'durationOverflow',
        });
    });
});
