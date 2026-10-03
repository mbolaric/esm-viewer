declare const durationMillisecondsBrand: unique symbol;
declare const utcTimestampBrand: unique symbol;

export type DurationMilliseconds = number & {
    readonly [durationMillisecondsBrand]: 'DurationMilliseconds';
};

export type UtcTimestamp = number & {
    readonly [utcTimestampBrand]: 'UtcTimestamp';
};

const maximumDateEpochMilliseconds = 8_640_000_000_000_000;

export function isDurationMilliseconds(value: unknown): value is DurationMilliseconds {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function isUtcTimestamp(value: unknown): value is UtcTimestamp {
    return typeof value === 'number' && Number.isSafeInteger(value) && Math.abs(value) <= maximumDateEpochMilliseconds;
}

// Returns the current time as a validated UtcTimestamp.
export function nowAsUtcTimestamp(): UtcTimestamp {
    const now = Date.now();
    if (!isUtcTimestamp(now)) {
        throw new TypeError('The current UTC timestamp is outside the supported range.');
    }
    return now;
}

export function getUtcDuration(start: UtcTimestamp, end: UtcTimestamp): DurationMilliseconds | null {
    const duration = end - start;

    return isDurationMilliseconds(duration) ? duration : null;
}

export interface IUtcInterval {
    readonly end: number;
    readonly start: number;
}

// Half-open [start, end): intervals that only share an endpoint do not overlap. An interval whose end equals its
// start is the single instant `start`, which overlaps another interval when it lies inside it.
export function utcIntervalsOverlap(left: IUtcInterval, right: IUtcInterval): boolean {
    const leftIsInstant = left.start === left.end;
    const rightIsInstant = right.start === right.end;
    if (leftIsInstant && rightIsInstant) {
        return left.start === right.start;
    }
    if (leftIsInstant) {
        return right.start <= left.start && left.start < right.end;
    }
    if (rightIsInstant) {
        return left.start <= right.start && right.start < left.end;
    }
    return left.start < right.end && right.start < left.end;
}
