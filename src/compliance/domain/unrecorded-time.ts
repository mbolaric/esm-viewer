import {
    UNKNOWN_CREW_CONTEXT,
    type ActivityInterval,
    type IRecordedActivityInterval,
    type ISourceReference,
    type UtcTimestamp,
} from '#tachograph-domain';

// Reg. (EU) 165/2014 Art. 34(3) requires time away from the vehicle to be entered manually, and the records are the
// primary evidence of rest. Time the records leave open therefore proves a missing entry, not missing rest: it is
// evaluated as rest (the most favourable reading the records allow) and listed separately for review.

// 'cardNotInserted': a card-out period without a manual entry. 'noRecords': time with no activity record at all,
// such as the days between a card withdrawal and the next insertion.
export type UnrecordedTimeKind = 'cardNotInserted' | 'noRecords';

// The source is the card-out record, or for time with no record the last record before it, so a finding anchored on
// unrecorded time still points at evidence.
export interface IUnrecordedRestInterval {
    readonly activity: 'breakOrRest';
    readonly crewPresence: 'unknown';
    readonly end: UtcTimestamp;
    readonly origin: 'unrecordedTime';
    readonly slot: 'Unknown';
    readonly source: ISourceReference;
    readonly start: UtcTimestamp;
    readonly unrecordedKind: UnrecordedTimeKind;
}

export type EvaluationInterval = ActivityInterval | IUnrecordedRestInterval;

// Every rest interval of the evaluation view is one of these, so rest-anchored findings always carry a source.
export type EvidencedEvaluationInterval = IRecordedActivityInterval | IUnrecordedRestInterval;

export interface IUnrecordedPeriod {
    readonly end: UtcTimestamp;
    // False for a period still open when the records end: the manual entry is only due at the next card insertion.
    readonly isFollowedByRecord: boolean;
    readonly kind: UnrecordedTimeKind;
    readonly source: ISourceReference;
    readonly start: UtcTimestamp;
}

export interface IUnrecordedTimeResolution {
    readonly evaluationIntervals: readonly EvaluationInterval[];
    readonly unrecordedPeriods: readonly IUnrecordedPeriod[];
}

function unrecordedRest(
    start: UtcTimestamp,
    end: UtcTimestamp,
    unrecordedKind: UnrecordedTimeKind,
    source: ISourceReference,
): IUnrecordedRestInterval {
    return { activity: 'breakOrRest', end, origin: 'unrecordedTime', source, start, unrecordedKind, ...UNKNOWN_CREW_CONTEXT };
}

type OpenUnrecordedPeriod = Omit<IUnrecordedPeriod, 'isFollowedByRecord'>;

// Adjacent parts form one period; a card-out part names the whole period because its record explains the days
// without records around it.
function collectUnrecordedPeriods(intervals: readonly EvaluationInterval[]): readonly IUnrecordedPeriod[] {
    const periods: IUnrecordedPeriod[] = [];
    let open: OpenUnrecordedPeriod | null = null;

    for (const interval of intervals) {
        if (interval.origin !== 'unrecordedTime') {
            if (open !== null) {
                periods.push({ ...open, isFollowedByRecord: interval.origin === 'recorded' });
                open = null;
            }
            continue;
        }

        if (open !== null && open.end === interval.start) {
            const current: OpenUnrecordedPeriod = open;
            open =
                current.kind === 'noRecords' && interval.unrecordedKind === 'cardNotInserted'
                    ? { ...current, end: interval.end, kind: interval.unrecordedKind, source: interval.source }
                    : { ...current, end: interval.end };
            continue;
        }

        if (open !== null) {
            periods.push({ ...open, isFollowedByRecord: false });
        }
        open = { end: interval.end, kind: interval.unrecordedKind, source: interval.source, start: interval.start };
    }

    if (open !== null) {
        periods.push({ ...open, isFollowedByRecord: false });
    }
    return periods;
}

// Reads unrecorded time inside the recorded range as rest. Time before the first or after the last record is left
// untouched: nothing shows the driver's activity there. Requires intervals sorted by start time.
export function resolveUnrecordedTime(intervals: readonly ActivityInterval[]): IUnrecordedTimeResolution {
    const lastRecordedIndex = intervals.findLastIndex((interval) => interval.origin === 'recorded');
    const evaluationIntervals: EvaluationInterval[] = [];
    let previous: ActivityInterval | undefined;
    let previousRecordSource: ISourceReference | null = null;

    for (const [index, interval] of intervals.entries()) {
        // Non-null only between the first and the last record.
        const enclosingRecordSource = index <= lastRecordedIndex ? previousRecordSource : null;

        if (enclosingRecordSource !== null && previous !== undefined && interval.start > previous.end) {
            evaluationIntervals.push(unrecordedRest(previous.end, interval.start, 'noRecords', enclosingRecordSource));
        }

        if (interval.origin === 'recorded') {
            evaluationIntervals.push(
                interval.activity === 'unknown'
                    ? unrecordedRest(interval.start, interval.end, 'cardNotInserted', interval.source)
                    : interval,
            );
            previousRecordSource = interval.source;
        } else if (enclosingRecordSource !== null) {
            evaluationIntervals.push(unrecordedRest(interval.start, interval.end, 'noRecords', enclosingRecordSource));
        } else {
            evaluationIntervals.push(interval);
        }
        previous = interval;
    }

    return { evaluationIntervals, unrecordedPeriods: collectUnrecordedPeriods(evaluationIntervals) };
}
