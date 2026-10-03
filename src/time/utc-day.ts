import { MILLISECONDS_PER_DAY } from './duration-constants.js';

// Date.parse normalizes impossible days, so accept only dates that round-trip unchanged.
export function parseIsoUtcDay(value: string): number | null {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
        return null;
    }
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : null;
}

// Returns UTC midnight starting the calendar day for timestamp.
export function startOfUtcDay(timestamp: number): number {
    return Math.floor(timestamp / MILLISECONDS_PER_DAY) * MILLISECONDS_PER_DAY;
}

// Returns the inclusive last millisecond of the UTC calendar day for timestamp.
export function endOfUtcDay(timestamp: number): number {
    return startOfUtcDay(timestamp) + MILLISECONDS_PER_DAY - 1;
}
