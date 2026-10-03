import { describe, expect, it } from 'vitest';

import { endOfUtcDay, MILLISECONDS_PER_DAY, MILLISECONDS_PER_HOUR, parseIsoUtcDay, startOfUtcDay } from '../index.js';

// An arbitrary exact UTC midnight.
const DAY_START = 17_000 * MILLISECONDS_PER_DAY;

describe('parseIsoUtcDay', () => {
    it('accepts exact UTC calendar dates including leap days', () => {
        expect(parseIsoUtcDay('2024-02-29')).toBe(Date.UTC(2024, 1, 29));
        expect(parseIsoUtcDay('0099-01-01')).toBe(Date.parse('0099-01-01T00:00:00Z'));
    });

    it('rejects normalized, malformed, and non-calendar dates', () => {
        expect(parseIsoUtcDay('2026-02-31')).toBeNull();
        expect(parseIsoUtcDay('2026-04-31')).toBeNull();
        expect(parseIsoUtcDay('2026-13-01')).toBeNull();
        expect(parseIsoUtcDay('2026-2-01')).toBeNull();
    });
});

describe('startOfUtcDay', () => {
    it('returns the UTC midnight for any timestamp within the same calendar day', () => {
        expect(startOfUtcDay(DAY_START)).toBe(DAY_START);
        expect(startOfUtcDay(DAY_START + 12 * MILLISECONDS_PER_HOUR)).toBe(DAY_START);
        expect(startOfUtcDay(DAY_START + MILLISECONDS_PER_DAY - 1)).toBe(DAY_START);
    });

    it('rounds a timestamp before 1970 down to its own midnight', () => {
        expect(startOfUtcDay(-1)).toBe(-MILLISECONDS_PER_DAY);
    });
});

describe('endOfUtcDay', () => {
    it('returns the last millisecond of the calendar day for a day-start input', () => {
        expect(endOfUtcDay(DAY_START)).toBe(DAY_START + MILLISECONDS_PER_DAY - 1);
    });

    it('returns the same result for any timestamp within the same calendar day', () => {
        const midDay = DAY_START + 12 * MILLISECONDS_PER_HOUR;
        const lastInstant = DAY_START + MILLISECONDS_PER_DAY - 1;

        expect(endOfUtcDay(midDay)).toBe(DAY_START + MILLISECONDS_PER_DAY - 1);
        expect(endOfUtcDay(lastInstant)).toBe(DAY_START + MILLISECONDS_PER_DAY - 1);
    });
});
