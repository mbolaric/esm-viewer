import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_MINUTE } from './duration-constants.js';

export interface IZonedDateParts {
    readonly day: number;
    readonly hour: number;
    readonly month: number;
    readonly year: number;
}

// Cache zoned formatters by time zone to avoid expensive Intl.DateTimeFormat rebuilds.
const zonedDatePartsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function zonedDatePartsFormatter(timeZone: string): Intl.DateTimeFormat {
    const cached = zonedDatePartsFormatterCache.get(timeZone);
    if (cached !== undefined) {
        return cached;
    }
    // Fixed 'en-CA' locale: only numeric parts are read, so the display language must not affect parsing.
    // Minutes are read too: offsets such as +05:30 or +05:45 are not whole hours.
    const formatter = new Intl.DateTimeFormat('en-CA', {
        day: '2-digit',
        hour: '2-digit',
        hourCycle: 'h23',
        minute: '2-digit',
        month: '2-digit',
        timeZone,
        year: 'numeric',
    });
    zonedDatePartsFormatterCache.set(timeZone, formatter);
    return formatter;
}

interface IZonedWallClock extends IZonedDateParts {
    readonly minute: number;
}

function zonedWallClock(timestamp: number, timeZone: string): IZonedWallClock {
    const parts = zonedDatePartsFormatter(timeZone).formatToParts(new Date(timestamp));

    const get = (type: string): number => {
        const part = parts.find((p) => p.type === type);
        return part === undefined ? 0 : Number(part.value);
    };

    return { day: get('day'), hour: get('hour'), minute: get('minute'), month: get('month'), year: get('year') };
}

// Resolves civil date and hour components for an instant in an IANA time zone.
export function zonedDateParts(timestamp: number, timeZone: string): IZonedDateParts {
    const { day, hour, month, year } = zonedWallClock(timestamp, timeZone);
    return { day, hour, month, year };
}

// The zone's offset from UTC at an instant, to the minute (wall clock read as UTC minus the instant).
function zonedOffsetMs(timestamp: number, timeZone: string): number {
    const wall = zonedWallClock(timestamp, timeZone);
    const wallAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
    return wallAsUtc - Math.floor(timestamp / MILLISECONDS_PER_MINUTE) * MILLISECONDS_PER_MINUTE;
}

// Converts a local wall-clock hour on a calendar date to UTC. An hour repeated by a backward clock change resolves to
// its first occurrence; an hour skipped by a forward change (in some zones midnight itself) resolves to the first
// instant after the gap, so a local day always starts at its first real instant.
export function zonedWallClockToUtc(year: number, month: number, day: number, hour: number, timeZone: string): number {
    const target = Date.UTC(year, month - 1, day, hour, 0, 0, 0);
    // A day either side brackets any single clock change around the target.
    const offsetBefore = zonedOffsetMs(target - MILLISECONDS_PER_DAY, timeZone);
    const offsetAfter = zonedOffsetMs(target + MILLISECONDS_PER_DAY, timeZone);
    const candidates = [target - offsetBefore, target - offsetAfter].filter(
        (candidate) => candidate + zonedOffsetMs(candidate, timeZone) === target,
    );
    if (candidates.length > 0) {
        return Math.min(...candidates);
    }

    // The wall-clock time does not exist: find the clock change, the first instant already on the later offset.
    let low = target - offsetAfter;
    let high = target - offsetBefore;
    while (high - low > MILLISECONDS_PER_MINUTE) {
        const middle = low + Math.floor((high - low) / (2 * MILLISECONDS_PER_MINUTE)) * MILLISECONDS_PER_MINUTE;
        if (zonedOffsetMs(middle, timeZone) === offsetAfter) {
            high = middle;
        } else {
            low = middle;
        }
    }
    return high;
}

export interface IZonedUtcDateRange {
    readonly calendarDayCount: number;
    readonly fromInclusive: number;
    readonly toInclusive: number;
}

// Converts UTC-midnight civil-date markers to inclusive UTC query bounds in the selected IANA time zone.
export function zonedCivilDateRangeToUtc(startDate: number, endDate: number, timeZone: string): IZonedUtcDateRange | null {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const isUtcMidnight = (value: number, date: Date): boolean =>
        Number.isSafeInteger(value) &&
        date.getTime() === value &&
        date.getUTCHours() === 0 &&
        date.getUTCMinutes() === 0 &&
        date.getUTCSeconds() === 0 &&
        date.getUTCMilliseconds() === 0;
    if (!isUtcMidnight(startDate, start) || !isUtcMidnight(endDate, end) || startDate > endDate) {
        return null;
    }
    const dayCount = Math.round((endDate - startDate) / MILLISECONDS_PER_DAY) + 1;
    const fromInclusive = zonedWallClockToUtc(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate(), 0, timeZone);
    const nextEnd = new Date(endDate + MILLISECONDS_PER_DAY);
    const toExclusive = zonedWallClockToUtc(
        nextEnd.getUTCFullYear(),
        nextEnd.getUTCMonth() + 1,
        nextEnd.getUTCDate(),
        0,
        timeZone,
    );
    if (!Number.isSafeInteger(dayCount) || dayCount < 1 || toExclusive <= fromInclusive) {
        return null;
    }
    return { calendarDayCount: dayCount, fromInclusive, toInclusive: toExclusive - 1 };
}
