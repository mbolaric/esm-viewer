import type { EvaluationInterval } from './unrecorded-time.js';

// Merges adjacent zero-gap intervals of the same activity to rejoin spans split at UTC midnights.
// 'unknown' is excluded from merging. Requires intervals sorted by start time.
// A merged span keeps the attribution of its last recorded piece, so a rest that joins recorded and unrecorded time
// still counts as recorded evidence.
// Other activities merge only within one slot and crew status, because the start of crew driving is a legal boundary
// for multi-manning. Rest merges across them: the rest rules measure its uninterrupted length, and the crew test only
// looks at driving.
export function mergeContiguousActivityIntervals<TInterval extends EvaluationInterval>(
    intervals: readonly TInterval[],
): readonly TInterval[] {
    const merged: TInterval[] = [];

    for (const interval of intervals) {
        const previous = merged.at(-1);

        if (
            interval.activity !== 'unknown' &&
            previous?.activity === interval.activity &&
            previous.end === interval.start &&
            (interval.activity === 'breakOrRest' || hasSameCrewContext(previous, interval))
        ) {
            const attribution = previous.origin === 'recorded' && interval.origin !== 'recorded' ? previous : interval;
            merged[merged.length - 1] = { ...attribution, end: interval.end, start: previous.start };
        } else {
            merged.push(interval);
        }
    }

    return merged;
}

function hasSameCrewContext(left: EvaluationInterval, right: EvaluationInterval): boolean {
    return left.slot === right.slot && left.crewPresence === right.crewPresence;
}
