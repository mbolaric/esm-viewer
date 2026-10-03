import { MILLISECONDS_PER_WEEK } from './duration-constants.js';
import { parseIsoUtcDay } from './utc-day.js';

// Returns the YYYY-MM-DD key of the Monday starting the UTC calendar week for timestamp.
export function getCalendarWeekKey(timestamp: number): string {
    const date = new Date(timestamp);
    const day = date.getUTCDay();
    const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setUTCDate(diff));
    return monday.toISOString().slice(0, 10);
}

// Returns UTC timestamp of Monday 00:00 for a YYYY-MM-DD week key; NaN if malformed.
export function calendarWeekStart(weekKey: string): number {
    const timestamp = parseIsoUtcDay(weekKey);
    return timestamp !== null && new Date(timestamp).getUTCDay() === 1 ? timestamp : NaN;
}

// Contiguous calendar week keys from firstWeekKey through lastWeekKey inclusive.
export function contiguousCalendarWeekKeys(firstWeekKey: string, lastWeekKey: string): readonly string[] {
    const firstMonday = calendarWeekStart(firstWeekKey);
    const lastMonday = calendarWeekStart(lastWeekKey);
    if (!Number.isFinite(firstMonday) || !Number.isFinite(lastMonday)) {
        return [];
    }

    const weekKeys: string[] = [];
    for (let monday = firstMonday; monday <= lastMonday; monday += MILLISECONDS_PER_WEEK) {
        weekKeys.push(new Date(monday).toISOString().slice(0, 10));
    }
    return weekKeys;
}

export interface ICalendarWeekSegment {
    readonly durationMs: number;
    readonly end: number;
    readonly start: number;
    readonly weekKey: string;
}

// Splits [start, end) at each Monday 00:00 UTC boundary.
export function splitByCalendarWeek(start: number, end: number): readonly ICalendarWeekSegment[] {
    if (end <= start) {
        return [{ durationMs: 0, end: start, start, weekKey: getCalendarWeekKey(start) }];
    }

    const segments: ICalendarWeekSegment[] = [];
    let cursor = start;
    while (cursor < end) {
        const weekKey = getCalendarWeekKey(cursor);
        const segmentEnd = Math.min(end, calendarWeekStart(weekKey) + MILLISECONDS_PER_WEEK);
        segments.push({ durationMs: segmentEnd - cursor, end: segmentEnd, start: cursor, weekKey });
        cursor = segmentEnd;
    }
    return segments;
}
