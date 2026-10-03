import { describe, expect, it } from 'vitest';

import { zonedDateParts, zonedWallClockToUtc } from '../index.js';

describe('zonedDateParts', () => {
    it('reads the correct local calendar date and hour in a non-UTC zone', () => {
        // 2026-06-15T22:30:00Z is 2026-06-16 00:30 in Europe/Berlin (CEST, UTC+2).
        const parts = zonedDateParts(Date.UTC(2026, 5, 15, 22, 30), 'Europe/Berlin');
        expect(parts).toEqual({ day: 16, hour: 0, month: 6, year: 2026 });
    });

    it('reads the correct local calendar date and hour in UTC', () => {
        const parts = zonedDateParts(Date.UTC(2026, 5, 15, 22, 30), 'UTC');
        expect(parts).toEqual({ day: 15, hour: 22, month: 6, year: 2026 });
    });

    // Regression test: ensures zonedDateParts stays fast via formatter caching.
    it('stays fast across many repeated calls (formatter caching)', () => {
        const start = Date.now();
        for (let i = 0; i < 20_000; i++) {
            zonedDateParts(Date.UTC(2026, 5, 15, 0, 0) + i * 60_000, 'Europe/Berlin');
        }
        // 300ms threshold safely catches un-cached formatter construction.
        expect(Date.now() - start).toBeLessThan(300);
    });
});

describe('zonedWallClockToUtc', () => {
    it('converts a local wall-clock time back to the correct UTC instant', () => {
        // 2026-06-16 00:30 in Europe/Berlin (CEST, UTC+2) is 2026-06-15T22:30:00Z.
        const utcMs = zonedWallClockToUtc(2026, 6, 16, 0, 'Europe/Berlin');
        expect(utcMs).toBe(Date.UTC(2026, 5, 15, 22, 0));
    });

    it('round-trips through zonedDateParts for a UTC zone', () => {
        const original = Date.UTC(2026, 5, 15, 14, 0);
        const parts = zonedDateParts(original, 'UTC');
        const roundTripped = zonedWallClockToUtc(parts.year, parts.month, parts.day, parts.hour, 'UTC');
        expect(roundTripped).toBe(original);
    });

    it('resolves local midnight exactly in zones whose offset is not a whole hour', () => {
        expect(zonedWallClockToUtc(2026, 6, 1, 0, 'Asia/Kolkata')).toBe(Date.UTC(2026, 4, 31, 18, 30));
        expect(zonedWallClockToUtc(2026, 6, 1, 0, 'Asia/Kathmandu')).toBe(Date.UTC(2026, 4, 31, 18, 15));
        expect(zonedWallClockToUtc(2026, 6, 1, 0, 'Australia/Adelaide')).toBe(Date.UTC(2026, 4, 31, 14, 30));
        expect(zonedWallClockToUtc(2026, 6, 1, 0, 'America/St_Johns')).toBe(Date.UTC(2026, 5, 1, 2, 30));
    });

    it('resolves a midnight skipped by a forward clock change to the first instant of the day', () => {
        // Santiago springs from 00:00 to 01:00 on 2026-09-06; Havana from 00:00 to 01:00 on 2026-03-08.
        const santiago = zonedWallClockToUtc(2026, 9, 6, 0, 'America/Santiago');
        expect(santiago).toBe(Date.UTC(2026, 8, 6, 4, 0));
        expect(zonedDateParts(santiago, 'America/Santiago')).toEqual({ day: 6, hour: 1, month: 9, year: 2026 });
        const havana = zonedWallClockToUtc(2026, 3, 8, 0, 'America/Havana');
        expect(zonedDateParts(havana, 'America/Havana')).toEqual({ day: 8, hour: 1, month: 3, year: 2026 });
        expect(zonedDateParts(havana - 1, 'America/Havana').day).toBe(7);
    });

    it('resolves an hour skipped by a forward clock change to the first instant after the gap', () => {
        // Berlin skips 02:00-03:00 on 2026-03-29; the change happens at 01:00 UTC.
        expect(zonedWallClockToUtc(2026, 3, 29, 2, 'Europe/Berlin')).toBe(Date.UTC(2026, 2, 29, 1, 0));
    });

    it('resolves an hour repeated by a backward clock change to its first occurrence', () => {
        // Berlin repeats 02:00-03:00 on 2026-10-25; the first 02:00 is 00:00 UTC (CEST).
        expect(zonedWallClockToUtc(2026, 10, 25, 2, 'Europe/Berlin')).toBe(Date.UTC(2026, 9, 25, 0, 0));
    });
});
