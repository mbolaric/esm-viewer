import { MILLISECONDS_PER_DAY, startOfUtcDay } from '#time';
import type { CardSlot } from './association.js';
import type { ISourceReference } from './source-reference.js';
import { getUtcDuration, isDurationMilliseconds, isUtcTimestamp, type DurationMilliseconds, type UtcTimestamp } from './time.js';

export type ActivityKind = 'availability' | 'breakOrRest' | 'driving' | 'unknown' | 'work';

// Presentation order of the activity kinds (legends, totals, timeline lanes, calendar strips, exports).
export const ACTIVITY_KINDS: readonly ActivityKind[] = ['driving', 'work', 'availability', 'breakOrRest', 'unknown'];
export type ActivityIntervalRelation = 'contiguous' | 'gap' | 'outOfOrder' | 'overlap';

// 'crew' means two valid driver cards were inserted (Annex IC requirement 055), the data proxy for a second driver.
// While the card is out the same bit means known/unknown activity instead, so card-out time is always 'unknown'.
export type CrewPresence = 'crew' | 'single' | 'unknown';

export interface IActivityCrewContext {
    readonly crewPresence: CrewPresence;
    readonly slot: CardSlot;
}

export const UNKNOWN_CREW_CONTEXT = { crewPresence: 'unknown', slot: 'Unknown' } as const satisfies IActivityCrewContext;

interface IActivityIntervalBase {
    readonly end: UtcTimestamp;
    readonly start: UtcTimestamp;
}

export interface IRecordedActivityInterval extends IActivityIntervalBase, IActivityCrewContext {
    readonly activity: ActivityKind;
    readonly origin: 'recorded';
    readonly source: ISourceReference;
}

export interface IInferredActivityGap extends IActivityIntervalBase {
    readonly activity: 'unknown';
    readonly crewPresence: 'unknown';
    readonly origin: 'inferredGap';
    readonly slot: 'Unknown';
    readonly source: null;
}

export type ActivityInterval = IInferredActivityGap | IRecordedActivityInterval;

export interface IActivityTotals {
    readonly availability: DurationMilliseconds;
    readonly breakOrRest: DurationMilliseconds;
    readonly driving: DurationMilliseconds;
    readonly unknown: DurationMilliseconds;
    readonly work: DurationMilliseconds;
}

export interface IActivityDay {
    readonly intervals: readonly ActivityInterval[];
    readonly midnightUtc: UtcTimestamp;
    readonly totals: IActivityTotals;
}

export interface IActivityDayNormalized {
    readonly day: IActivityDay;
    readonly status: 'normalized';
}

export interface IActivityDayOverlap {
    readonly current: ActivityInterval;
    readonly overlapping: ActivityInterval;
    readonly status: 'overlap';
}

export interface IActivityDayInvalidInterval {
    readonly interval: ActivityInterval;
    readonly midnightUtc: UtcTimestamp;
    readonly status: 'invalidInterval';
}

export interface IActivityDayDurationOverflow {
    readonly activity: ActivityKind;
    readonly midnightUtc: UtcTimestamp;
    readonly status: 'durationOverflow';
}

export interface IActivityDayEmptyData {
    readonly midnightUtc: UtcTimestamp;
    readonly status: 'emptyData';
}

export interface IActivityDayMidnightBoundary {
    readonly interval: ActivityInterval;
    readonly midnightUtc: UtcTimestamp;
    readonly status: 'midnightBoundary';
}

export interface IActivityDayInvalidMidnight {
    readonly midnightUtc: number;
    readonly status: 'invalidMidnight';
}

export type ActivityDayNormalization =
    | IActivityDayDurationOverflow
    | IActivityDayEmptyData
    | IActivityDayInvalidInterval
    | IActivityDayInvalidMidnight
    | IActivityDayMidnightBoundary
    | IActivityDayNormalized
    | IActivityDayOverlap;

interface IActivityTotalAccumulator {
    availability: number;
    breakOrRest: number;
    driving: number;
    unknown: number;
    work: number;
}

export interface IActivityTotalsCalculated {
    readonly status: 'calculated';
    readonly totals: IActivityTotals;
}

export interface IActivityTotalsInvalidInterval {
    readonly interval: ActivityInterval;
    readonly status: 'invalidInterval';
}

export interface IActivityTotalsOverlap {
    readonly current: ActivityInterval;
    readonly candidate: ActivityInterval;
    readonly status: 'overlap';
}

export interface IActivityTotalsDurationOverflow {
    readonly activity: ActivityKind;
    readonly status: 'durationOverflow';
}

export type ActivityTotalsCalculation =
    IActivityTotalsCalculated | IActivityTotalsDurationOverflow | IActivityTotalsInvalidInterval | IActivityTotalsOverlap;

export type ActivityTotalsSumCalculation = IActivityTotalsCalculated | IActivityTotalsDurationOverflow;

export function createRecordedActivityInterval(
    activity: ActivityKind,
    start: UtcTimestamp,
    end: UtcTimestamp,
    source: ISourceReference,
    crew: IActivityCrewContext,
): IRecordedActivityInterval | null {
    const duration = getUtcDuration(start, end);

    if (duration === null || duration === 0) {
        return null;
    }

    return {
        activity,
        crewPresence: crew.crewPresence,
        end,
        origin: 'recorded',
        slot: crew.slot,
        source,
        start,
    };
}

function createInferredActivityGap(start: UtcTimestamp, end: UtcTimestamp): IInferredActivityGap {
    return { activity: 'unknown', end, origin: 'inferredGap', source: null, start, ...UNKNOWN_CREW_CONTEXT };
}

export function compareActivityIntervals(left: ActivityInterval, right: ActivityInterval): number {
    if (left.start !== right.start) {
        return left.start < right.start ? -1 : 1;
    }

    if (left.end === right.end) {
        return 0;
    }

    return left.end < right.end ? -1 : 1;
}

export function orderActivityIntervals(intervals: readonly ActivityInterval[]): readonly ActivityInterval[] {
    return [...intervals].sort(compareActivityIntervals);
}

export function classifyActivityIntervalRelation(
    current: ActivityInterval,
    candidate: ActivityInterval,
): ActivityIntervalRelation {
    if (candidate.start < current.start) {
        return 'outOfOrder';
    }

    if (candidate.start < current.end) {
        return 'overlap';
    }

    return candidate.start === current.end ? 'contiguous' : 'gap';
}

export function createUnknownActivityGap(current: ActivityInterval, candidate: ActivityInterval): IInferredActivityGap | null {
    const duration = getUtcDuration(current.end, candidate.start);

    if (classifyActivityIntervalRelation(current, candidate) !== 'gap' || duration === null || duration === 0) {
        return null;
    }

    return createInferredActivityGap(current.end, candidate.start);
}

function createActivityTotals(accumulator: IActivityTotalAccumulator): ActivityKind | IActivityTotals {
    const { availability, breakOrRest, driving, unknown, work } = accumulator;

    if (!isDurationMilliseconds(availability)) {
        return 'availability';
    }

    if (!isDurationMilliseconds(breakOrRest)) {
        return 'breakOrRest';
    }

    if (!isDurationMilliseconds(driving)) {
        return 'driving';
    }

    if (!isDurationMilliseconds(unknown)) {
        return 'unknown';
    }

    if (!isDurationMilliseconds(work)) {
        return 'work';
    }

    return {
        availability,
        breakOrRest,
        driving,
        unknown,
        work,
    };
}

function createActivityTotalAccumulator(): IActivityTotalAccumulator {
    return {
        availability: 0,
        breakOrRest: 0,
        driving: 0,
        unknown: 0,
        work: 0,
    };
}

export function sumActivityTotals(totalsToSum: readonly IActivityTotals[]): ActivityTotalsSumCalculation {
    const accumulator = createActivityTotalAccumulator();

    for (const totals of totalsToSum) {
        accumulator.availability += totals.availability;
        accumulator.breakOrRest += totals.breakOrRest;
        accumulator.driving += totals.driving;
        accumulator.unknown += totals.unknown;
        accumulator.work += totals.work;
    }

    const totals = createActivityTotals(accumulator);
    return typeof totals === 'string' ? { activity: totals, status: 'durationOverflow' } : { status: 'calculated', totals };
}

export function calculateActivityTotals(intervals: readonly ActivityInterval[]): ActivityTotalsCalculation {
    const orderedIntervals = orderActivityIntervals(intervals);
    const accumulator = createActivityTotalAccumulator();
    let previousInterval: ActivityInterval | null = null;

    for (const interval of orderedIntervals) {
        const duration = getUtcDuration(interval.start, interval.end);

        if (duration === null || duration === 0) {
            return {
                interval,
                status: 'invalidInterval',
            };
        }

        if (previousInterval !== null && classifyActivityIntervalRelation(previousInterval, interval) === 'overlap') {
            return {
                candidate: interval,
                current: previousInterval,
                status: 'overlap',
            };
        }

        const activity = interval.activity;
        const updatedTotal = accumulator[activity] + duration;

        if (!isDurationMilliseconds(updatedTotal)) {
            return {
                activity,
                status: 'durationOverflow',
            };
        }

        accumulator[activity] = updatedTotal;
        previousInterval = interval;
    }

    const totals = createActivityTotals(accumulator);

    if (typeof totals === 'string') {
        return {
            activity: totals,
            status: 'durationOverflow',
        };
    }

    return {
        status: 'calculated',
        totals,
    };
}

// Normalizes activity intervals within a UTC day, inferring unknown gaps.
// Midnight-crossing intervals must be pre-split by caller before normalization.

function firstDayMidnight(timestamp: UtcTimestamp): UtcTimestamp | null {
    const value = startOfUtcDay(timestamp);

    return isUtcTimestamp(value) ? value : null;
}

function nextDayMidnight(midnightUtc: UtcTimestamp): UtcTimestamp | null {
    const value = midnightUtc + MILLISECONDS_PER_DAY;

    return isUtcTimestamp(value) ? value : null;
}

function intervalBelongsToDay(interval: ActivityInterval, midnightUtc: UtcTimestamp): boolean {
    const dayEnd = nextDayMidnight(midnightUtc);

    if (dayEnd === null) {
        return false;
    }

    return interval.start >= midnightUtc && interval.end <= dayEnd;
}

export function normalizeActivityDay(
    intervals: readonly ActivityInterval[],
    midnightUtc: UtcTimestamp,
): ActivityDayNormalization {
    const dayMidnight = firstDayMidnight(midnightUtc);

    if (dayMidnight === null) {
        return {
            midnightUtc,
            status: 'invalidMidnight',
        };
    }

    if (midnightUtc !== dayMidnight) {
        return {
            midnightUtc,
            status: 'invalidMidnight',
        };
    }

    const dayEnd = nextDayMidnight(dayMidnight);

    if (dayEnd === null) {
        return {
            midnightUtc: dayMidnight,
            status: 'invalidMidnight',
        };
    }

    const dayIntervals: ActivityInterval[] = [];

    for (const interval of intervals) {
        const intervalDuration = getUtcDuration(interval.start, interval.end);

        if (intervalDuration === null || intervalDuration === 0) {
            return {
                interval,
                midnightUtc: dayMidnight,
                status: 'invalidInterval',
            };
        }

        if (interval.start < dayMidnight || interval.end > dayEnd) {
            return {
                interval,
                midnightUtc: dayMidnight,
                status: 'midnightBoundary',
            };
        }

        if (intervalBelongsToDay(interval, dayMidnight)) {
            dayIntervals.push(interval);
        }
    }

    if (dayIntervals.length === 0) {
        return {
            midnightUtc: dayMidnight,
            status: 'emptyData',
        };
    }

    const orderedIntervals = orderActivityIntervals(dayIntervals);

    for (let index = 1; index < orderedIntervals.length; index += 1) {
        const previous = orderedIntervals[index - 1];
        const current = orderedIntervals[index];

        if (previous !== undefined && current !== undefined) {
            const relation = classifyActivityIntervalRelation(previous, current);

            if (relation === 'overlap') {
                return {
                    current: previous,
                    overlapping: current,
                    status: 'overlap',
                };
            }
        }
    }

    const completeIntervals: ActivityInterval[] = [];

    // Infers unknown gap from midnight to first interval if needed.
    const firstInterval = orderedIntervals[0];

    if (firstInterval !== undefined && firstInterval.start > dayMidnight) {
        completeIntervals.push(createInferredActivityGap(dayMidnight, firstInterval.start));
    }

    completeIntervals.push(...orderedIntervals);

    for (let index = 1; index < orderedIntervals.length; index += 1) {
        const previous = orderedIntervals[index - 1];
        const current = orderedIntervals[index];

        if (previous !== undefined && current !== undefined) {
            const gap = createUnknownActivityGap(previous, current);

            if (gap !== null) {
                completeIntervals.push(gap);
            }
        }
    }

    // Infers unknown gap from last interval to midnight if needed.
    const lastInterval = orderedIntervals[orderedIntervals.length - 1];

    if (lastInterval !== undefined && lastInterval.end < dayEnd) {
        completeIntervals.push(createInferredActivityGap(lastInterval.end, dayEnd));
    }

    const allIntervals = orderActivityIntervals(completeIntervals);
    const totalsCalculation = calculateActivityTotals(allIntervals);

    if (totalsCalculation.status === 'invalidInterval') {
        return {
            interval: totalsCalculation.interval,
            midnightUtc: dayMidnight,
            status: 'invalidInterval',
        };
    }

    if (totalsCalculation.status === 'overlap') {
        return {
            current: totalsCalculation.current,
            overlapping: totalsCalculation.candidate,
            status: 'overlap',
        };
    }

    if (totalsCalculation.status === 'durationOverflow') {
        return {
            activity: totalsCalculation.activity,
            midnightUtc: dayMidnight,
            status: 'durationOverflow',
        };
    }

    return {
        day: {
            intervals: allIntervals,
            midnightUtc: dayMidnight,
            totals: totalsCalculation.totals,
        },
        status: 'normalized',
    };
}

export function groupActivityDays(intervals: readonly ActivityInterval[]): readonly ActivityDayNormalization[] {
    if (intervals.length === 0) {
        return [];
    }

    const orderedIntervals = orderActivityIntervals(intervals);

    const dayMap = new Map<UtcTimestamp, ActivityInterval[]>();

    for (const interval of orderedIntervals) {
        const rawMidnight = startOfUtcDay(interval.start);

        if (!isUtcTimestamp(rawMidnight)) {
            continue;
        }

        const existing = dayMap.get(rawMidnight);

        if (existing === undefined) {
            dayMap.set(rawMidnight, [interval]);
        } else {
            existing.push(interval);
        }
    }

    const days = Array.from(dayMap.entries())
        .map(([midnightUtc, dayIntervals]) => normalizeActivityDay(dayIntervals, midnightUtc))
        .sort((a, b) => {
            function midnightOf(result: ActivityDayNormalization): number {
                switch (result.status) {
                    case 'durationOverflow':
                    case 'emptyData':
                    case 'invalidInterval':
                    case 'midnightBoundary':
                        return result.midnightUtc;
                    case 'invalidMidnight':
                        return result.midnightUtc;
                    case 'normalized':
                        return result.day.midnightUtc;
                    case 'overlap':
                        return result.current.start;
                }
            }

            return midnightOf(a) - midnightOf(b);
        });

    return days;
}
