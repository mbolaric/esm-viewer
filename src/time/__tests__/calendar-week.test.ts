import { describe, expect, it } from 'vitest';

import { calendarWeekStart, contiguousCalendarWeekKeys, getCalendarWeekKey, splitByCalendarWeek } from '../index.js';

// Monday 2024-01-08 00:00 UTC.
const MONDAY = Date.UTC(2024, 0, 8);

describe('calendar weeks', () => {
    it('keys every timestamp of a Monday-to-Sunday week by its Monday', () => {
        expect(getCalendarWeekKey(MONDAY)).toBe('2024-01-08');
        expect(getCalendarWeekKey(Date.UTC(2024, 0, 14, 23, 59, 59))).toBe('2024-01-08');
        expect(getCalendarWeekKey(Date.UTC(2024, 0, 15))).toBe('2024-01-15');
    });

    it('lists every week key between two keys, including a week with no activity', () => {
        expect(contiguousCalendarWeekKeys('2024-01-08', '2024-01-22')).toEqual(['2024-01-08', '2024-01-15', '2024-01-22']);
    });

    it('returns nothing for a malformed key and converts a key to its Monday start', () => {
        expect(contiguousCalendarWeekKeys('not-a-date', '2024-01-22')).toEqual([]);
        expect(contiguousCalendarWeekKeys('2024-02-31', '2024-03-11')).toEqual([]);
        expect(contiguousCalendarWeekKeys('2024-01-09', '2024-01-22')).toEqual([]);
        expect(calendarWeekStart('2024-01-08')).toBe(MONDAY);
    });

    describe('splitByCalendarWeek', () => {
        const hour = 60 * 60 * 1000;

        it('keeps a range inside one week as a single segment', () => {
            expect(splitByCalendarWeek(MONDAY + 2 * hour, MONDAY + 5 * hour)).toEqual([
                { durationMs: 3 * hour, end: MONDAY + 5 * hour, start: MONDAY + 2 * hour, weekKey: '2024-01-08' },
            ]);
        });

        it('splits a range at Sunday midnight into the two weeks it lies in', () => {
            const nextMonday = Date.UTC(2024, 0, 15);
            expect(splitByCalendarWeek(nextMonday - 2 * hour, nextMonday + 2 * hour)).toEqual([
                { durationMs: 2 * hour, end: nextMonday, start: nextMonday - 2 * hour, weekKey: '2024-01-08' },
                { durationMs: 2 * hour, end: nextMonday + 2 * hour, start: nextMonday, weekKey: '2024-01-15' },
            ]);
        });

        it('splits a range that spans more than two weeks into every week it touches', () => {
            const segments = splitByCalendarWeek(MONDAY + 12 * hour, Date.UTC(2024, 0, 22, 6));
            expect(segments.map((segment) => segment.weekKey)).toEqual(['2024-01-08', '2024-01-15', '2024-01-22']);
            expect(segments.reduce((sum, segment) => sum + segment.durationMs, 0)).toBe(
                Date.UTC(2024, 0, 22, 6) - (MONDAY + 12 * hour),
            );
        });

        it('returns one zero-length segment for an empty or inverted range', () => {
            expect(splitByCalendarWeek(MONDAY, MONDAY)).toEqual([
                { durationMs: 0, end: MONDAY, start: MONDAY, weekKey: '2024-01-08' },
            ]);
            expect(splitByCalendarWeek(MONDAY + hour, MONDAY)).toEqual([
                { durationMs: 0, end: MONDAY + hour, start: MONDAY + hour, weekKey: '2024-01-08' },
            ]);
        });
    });
});
