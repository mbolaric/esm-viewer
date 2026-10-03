import { describe, expect, it } from 'vitest';

import {
    addUtcDays,
    addUtcMonths,
    datePickerMillisecondsPerDay,
    daysInUtcMonth,
    isSameUtcDay,
    mondayBasedUtcWeekday,
    utcDateInputValue,
    utcDayStart,
} from '../date-picker-math.js';

describe('date-picker math', () => {
    it('starts a day at its UTC midnight', () => {
        expect(utcDayStart(Date.UTC(2026, 6, 27, 14, 30))).toBe(Date.UTC(2026, 6, 27));
    });

    it('adds months and clamps the day of month', () => {
        expect(addUtcMonths(Date.UTC(2026, 6, 27), 1)).toBe(Date.UTC(2026, 7, 27));
        expect(addUtcMonths(Date.UTC(2026, 6, 27), -1)).toBe(Date.UTC(2026, 5, 27));
        expect(addUtcMonths(Date.UTC(2026, 0, 31), 1)).toBe(Date.UTC(2026, 1, 28));
        expect(addUtcMonths(Date.UTC(2026, 11, 15), 1)).toBe(Date.UTC(2027, 0, 15));
    });

    it('shifts days across month boundaries', () => {
        expect(addUtcDays(Date.UTC(2026, 6, 31), 1)).toBe(Date.UTC(2026, 7, 1));
        expect(addUtcDays(Date.UTC(2026, 7, 1), -1)).toBe(Date.UTC(2026, 6, 31));
    });

    it('counts the days in a UTC month', () => {
        expect(daysInUtcMonth(2026, 1)).toBe(28);
        expect(daysInUtcMonth(2024, 1)).toBe(29);
        expect(daysInUtcMonth(2026, 6)).toBe(31);
    });

    it('computes Monday-based weekday indexes', () => {
        expect(mondayBasedUtcWeekday(Date.UTC(2026, 6, 27))).toBe(0);
        expect(mondayBasedUtcWeekday(Date.UTC(2026, 6, 26))).toBe(6);
    });

    it('compares calendar days and formats ISO keys', () => {
        expect(isSameUtcDay(Date.UTC(2026, 6, 27, 9), Date.UTC(2026, 6, 27))).toBe(true);
        expect(isSameUtcDay(Date.UTC(2026, 6, 27), Date.UTC(2026, 6, 28))).toBe(false);
        expect(utcDateInputValue(Date.UTC(2026, 6, 27))).toBe('2026-07-27');
        expect(datePickerMillisecondsPerDay).toBe(24 * 60 * 60 * 1_000);
    });
});
