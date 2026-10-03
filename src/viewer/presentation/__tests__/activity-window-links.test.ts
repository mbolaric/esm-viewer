import { isUtcTimestamp, type UtcTimestamp } from '#viewer-domain';
import { MILLISECONDS_PER_DAY } from '#time';
import { describe, expect, it } from 'vitest';

import { recordOverlapsActivityDay } from '../view-models/activity-window-links.js';

function timestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The activity-window test timestamp fixture must be valid.');
    }
    return value;
}

describe('recordOverlapsActivityDay', () => {
    const dayStart = timestamp(Date.UTC(2026, 6, 27));

    it('matches a point record inside the day window', () => {
        const point = timestamp(Date.UTC(2026, 6, 27, 12, 0));
        expect(recordOverlapsActivityDay(point, point, dayStart)).toBe(true);
    });

    it('matches a period that starts inside the day window', () => {
        const start = timestamp(Date.UTC(2026, 6, 27, 8, 0));
        expect(recordOverlapsActivityDay(start, null, dayStart)).toBe(true);
    });

    it('matches a period that ends inside the day window', () => {
        const end = timestamp(Date.UTC(2026, 6, 27, 20, 0));
        const start = timestamp(Date.UTC(2026, 6, 26, 22, 0));
        expect(recordOverlapsActivityDay(start, end, dayStart)).toBe(true);
    });

    it('matches a period that spans the whole day window', () => {
        const start = timestamp(Date.UTC(2026, 6, 26, 10, 0));
        const end = timestamp(Date.UTC(2026, 6, 28, 10, 0));
        expect(recordOverlapsActivityDay(start, end, dayStart)).toBe(true);
    });

    it('rejects a period that ends exactly at the day start boundary', () => {
        const end = dayStart;
        const start = timestamp(Date.UTC(2026, 6, 26, 10, 0));
        expect(recordOverlapsActivityDay(start, end, dayStart)).toBe(false);
    });

    it('attributes a point record exactly at midnight to the day it starts, not the previous day', () => {
        const previousDayStart = timestamp(dayStart - MILLISECONDS_PER_DAY);

        expect(recordOverlapsActivityDay(dayStart, dayStart, dayStart)).toBe(true);
        expect(recordOverlapsActivityDay(dayStart, dayStart, previousDayStart)).toBe(false);
    });

    it('rejects a record that starts exactly at the next day boundary', () => {
        const nextDayStart = timestamp(dayStart + MILLISECONDS_PER_DAY);
        expect(recordOverlapsActivityDay(nextDayStart, null, dayStart)).toBe(false);
    });

    it('rejects a record fully before the day window', () => {
        const start = timestamp(Date.UTC(2026, 6, 26, 8, 0));
        const end = timestamp(Date.UTC(2026, 6, 26, 18, 0));
        expect(recordOverlapsActivityDay(start, end, dayStart)).toBe(false);
    });

    it('rejects a record fully after the day window', () => {
        const start = timestamp(Date.UTC(2026, 6, 28, 8, 0));
        const end = timestamp(Date.UTC(2026, 6, 28, 18, 0));
        expect(recordOverlapsActivityDay(start, end, dayStart)).toBe(false);
    });
});
