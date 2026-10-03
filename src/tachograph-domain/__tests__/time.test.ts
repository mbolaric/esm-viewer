import { describe, expect, it } from 'vitest';

import { getUtcDuration, isDurationMilliseconds, isUtcTimestamp, utcIntervalsOverlap, type UtcTimestamp } from '../time.js';

function createTestTimestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The test timestamp must be an exact UTC epoch-millisecond value.');
    }

    return value;
}

describe('isDurationMilliseconds', () => {
    it.each([0, 1, 86_400_000, Number.MAX_SAFE_INTEGER])(
        'accepts an exact non-negative millisecond duration',
        (value: number) => {
            expect(isDurationMilliseconds(value)).toBe(true);
        },
    );

    it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY, '86400000', null])(
        'rejects an invalid millisecond duration',
        (value: unknown) => {
            expect(isDurationMilliseconds(value)).toBe(false);
        },
    );
});

describe('getUtcDuration', () => {
    it('calculates an exact duration across a UTC midnight boundary', () => {
        expect(getUtcDuration(createTestTimestamp(86_399_999), createTestTimestamp(86_400_001))).toBe(2);
    });

    it('accepts an empty duration but rejects reversed or unsafe differences', () => {
        expect(getUtcDuration(createTestTimestamp(10), createTestTimestamp(10))).toBe(0);
        expect(getUtcDuration(createTestTimestamp(11), createTestTimestamp(10))).toBeNull();
        expect(
            getUtcDuration(createTestTimestamp(-8_640_000_000_000_000), createTestTimestamp(8_640_000_000_000_000)),
        ).toBeNull();
    });
});

describe('isUtcTimestamp', () => {
    it.each([0, -1, 1_722_470_400_000, 8_640_000_000_000_000])(
        'accepts an exact UTC epoch-millisecond value',
        (value: number) => {
            expect(isUtcTimestamp(value)).toBe(true);
        },
    );

    it.each([Number.NaN, Number.POSITIVE_INFINITY, 1.5, 8_640_000_000_000_001, '1722470400000', null])(
        'rejects an invalid UTC epoch-millisecond value',
        (value: unknown) => {
            expect(isUtcTimestamp(value)).toBe(false);
        },
    );
});

describe('utcIntervalsOverlap', () => {
    it('detects overlapping and nested intervals', () => {
        expect(utcIntervalsOverlap({ end: 10, start: 0 }, { end: 15, start: 5 })).toBe(true);
        expect(utcIntervalsOverlap({ end: 10, start: 0 }, { end: 8, start: 2 })).toBe(true);
        expect(utcIntervalsOverlap({ end: 8, start: 2 }, { end: 10, start: 0 })).toBe(true);
    });

    it('treats intervals that only share an endpoint as not overlapping', () => {
        expect(utcIntervalsOverlap({ end: 10, start: 0 }, { end: 20, start: 10 })).toBe(false);
        expect(utcIntervalsOverlap({ end: 20, start: 10 }, { end: 10, start: 0 })).toBe(false);
    });

    it('rejects disjoint intervals', () => {
        expect(utcIntervalsOverlap({ end: 5, start: 0 }, { end: 20, start: 10 })).toBe(false);
    });

    it('treats an interval with equal start and end as an instant inside [start, end)', () => {
        const interval = { end: 10, start: 0 };

        expect(utcIntervalsOverlap({ end: 0, start: 0 }, interval)).toBe(true);
        expect(utcIntervalsOverlap({ end: 5, start: 5 }, interval)).toBe(true);
        expect(utcIntervalsOverlap(interval, { end: 5, start: 5 })).toBe(true);
        expect(utcIntervalsOverlap({ end: 10, start: 10 }, interval)).toBe(false);
        expect(utcIntervalsOverlap({ end: -1, start: -1 }, interval)).toBe(false);
    });

    it('compares two instants by equality', () => {
        expect(utcIntervalsOverlap({ end: 4, start: 4 }, { end: 4, start: 4 })).toBe(true);
        expect(utcIntervalsOverlap({ end: 4, start: 4 }, { end: 5, start: 5 })).toBe(false);
    });

    it('supports an open-ended interval by using an infinite end', () => {
        expect(utcIntervalsOverlap({ end: Number.POSITIVE_INFINITY, start: 100 }, { end: 200, start: 150 })).toBe(true);
        expect(utcIntervalsOverlap({ end: Number.POSITIVE_INFINITY, start: 300 }, { end: 200, start: 150 })).toBe(false);
    });
});
