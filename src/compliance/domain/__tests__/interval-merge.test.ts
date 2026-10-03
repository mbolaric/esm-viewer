import { describe, expect, it } from 'vitest';

import {
    createSourceReference,
    isJsonPointer,
    isUtcTimestamp,
    type ActivityInterval,
    type ActivityKind,
    type IActivityCrewContext,
    type IRecordedActivityInterval,
    type ISourceReference,
    type UtcTimestamp,
} from '#tachograph-domain';

import { mergeContiguousActivityIntervals } from '../interval-merge.js';

function ts(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The interval-merge fixture timestamp must be valid.');
    }
    return value;
}

function source(path: string): ISourceReference<'g1', 'driverCard'> {
    if (!isJsonPointer(path)) {
        throw new TypeError('The interval-merge fixture source path must be valid.');
    }
    return createSourceReference('driverCard', 'g1', path);
}

function recorded(
    activity: ActivityKind,
    startMs: number,
    endMs: number,
    path = '/activities/0',
    crew: IActivityCrewContext = { crewPresence: 'single', slot: 'Driver' },
): IRecordedActivityInterval {
    return {
        activity,
        crewPresence: crew.crewPresence,
        end: ts(endMs),
        origin: 'recorded',
        slot: crew.slot,
        source: source(path),
        start: ts(startMs),
    };
}

function inferredGap(startMs: number, endMs: number): ActivityInterval {
    return {
        activity: 'unknown',
        crewPresence: 'unknown',
        end: ts(endMs),
        origin: 'inferredGap',
        slot: 'Unknown',
        source: null,
        start: ts(startMs),
    };
}

const hour = 3_600_000;

describe('mergeContiguousActivityIntervals', () => {
    it('returns an empty list unchanged', () => {
        expect(mergeContiguousActivityIntervals([])).toEqual([]);
    });

    it('leaves a single interval unchanged', () => {
        const only = recorded('breakOrRest', 0, hour);
        expect(mergeContiguousActivityIntervals([only])).toEqual([only]);
    });

    it('merges two zero-gap same-activity intervals into one spanning the full range', () => {
        const first = recorded('breakOrRest', 0, 4 * hour, '/activities/0');
        const second = recorded('breakOrRest', 4 * hour, 10 * hour, '/activities/1');

        const merged = mergeContiguousActivityIntervals([first, second]);

        expect(merged).toHaveLength(1);
        expect(merged[0]?.start).toBe(0);
        expect(merged[0]?.end).toBe(10 * hour);
        expect(merged[0]?.activity).toBe('breakOrRest');
    });

    it('merges three or more zero-gap same-activity intervals into one', () => {
        const pieces = [
            recorded('driving', 0, 2 * hour, '/activities/0'),
            recorded('driving', 2 * hour, 4 * hour, '/activities/1'),
            recorded('driving', 4 * hour, 6 * hour, '/activities/2'),
        ];

        const merged = mergeContiguousActivityIntervals(pieces);

        expect(merged).toHaveLength(1);
        expect(merged[0]?.start).toBe(0);
        expect(merged[0]?.end).toBe(6 * hour);
    });

    it('keeps the merged interval attributed to the last piece for source/evidence lookups', () => {
        const first = recorded('breakOrRest', 0, 4 * hour, '/activities/0');
        const second = recorded('breakOrRest', 4 * hour, 10 * hour, '/activities/1');

        const merged = mergeContiguousActivityIntervals([first, second]);
        const result = merged[0];
        expect(result?.origin).toBe('recorded');
        if (result?.origin === 'recorded') {
            expect(result.source.path).toBe('/activities/1');
        }
    });

    it('keeps the attribution of the recorded piece when a rest joins recorded and unrecorded time', () => {
        const recordedRest = recorded('breakOrRest', 0, 4 * hour, '/activities/0');
        const unrecordedRest = {
            activity: 'breakOrRest',
            crewPresence: 'unknown',
            end: ts(30 * hour),
            origin: 'unrecordedTime',
            slot: 'Unknown',
            source: source('/activities/1'),
            start: ts(4 * hour),
            unrecordedKind: 'cardNotInserted',
        } as const;

        for (const pieces of [
            [recordedRest, unrecordedRest],
            [
                { ...unrecordedRest, end: ts(4 * hour), start: ts(0) },
                { ...recordedRest, end: ts(30 * hour), start: ts(4 * hour) },
            ],
        ]) {
            const merged = mergeContiguousActivityIntervals(pieces);
            expect(merged).toHaveLength(1);
            expect(merged[0]).toMatchObject({
                crewPresence: 'single',
                end: 30 * hour,
                origin: 'recorded',
                slot: 'Driver',
                source: source('/activities/0'),
                start: 0,
            });
        }
    });

    it('does not merge intervals with a real gap between them', () => {
        const first = recorded('breakOrRest', 0, 4 * hour, '/activities/0');
        const second = recorded('breakOrRest', 5 * hour, 10 * hour, '/activities/1');

        const merged = mergeContiguousActivityIntervals([first, second]);

        expect(merged).toHaveLength(2);
    });

    it('does not merge zero-gap intervals of different activities', () => {
        const driving = recorded('driving', 0, 4 * hour, '/activities/0');
        const rest = recorded('breakOrRest', 4 * hour, 10 * hour, '/activities/1');

        const merged = mergeContiguousActivityIntervals([driving, rest]);

        expect(merged).toHaveLength(2);
    });

    it('keeps driving split where the crew status or slot changes, since crew driving starts a legal boundary', () => {
        const single = recorded('driving', 0, 2 * hour, '/activities/0');
        const crew = recorded('driving', 2 * hour, 4 * hour, '/activities/1', { crewPresence: 'crew', slot: 'Driver' });
        const crewCoDriverSlot = recorded('driving', 4 * hour, 6 * hour, '/activities/2', {
            crewPresence: 'crew',
            slot: 'CoDriver',
        });

        const merged = mergeContiguousActivityIntervals([single, crew, crewCoDriverSlot]);

        expect(merged.map(({ crewPresence, slot }) => ({ crewPresence, slot }))).toEqual([
            { crewPresence: 'single', slot: 'Driver' },
            { crewPresence: 'crew', slot: 'Driver' },
            { crewPresence: 'crew', slot: 'CoDriver' },
        ]);
    });

    it('merges a rest across a crew change, because rest rules measure its uninterrupted length', () => {
        const single = recorded('breakOrRest', 0, 4 * hour, '/activities/0');
        const crew = recorded('breakOrRest', 4 * hour, 10 * hour, '/activities/1', { crewPresence: 'crew', slot: 'Driver' });

        const merged = mergeContiguousActivityIntervals([single, crew]);

        expect(merged).toHaveLength(1);
        expect(merged[0]).toMatchObject({ crewPresence: 'crew', end: 10 * hour, start: 0 });
    });

    it('does not merge zero-gap "unknown" intervals, whether recorded or inferred gaps', () => {
        const first = inferredGap(0, hour);
        const second = recorded('unknown', hour, 2 * hour, '/activities/0');

        const merged = mergeContiguousActivityIntervals([first, second]);

        expect(merged).toHaveLength(2);
    });

    it('merges a rest that a UTC midnight crossing split into two contiguous pieces, matching the audit reproduction', () => {
        const dayBoundary = 24 * hour;
        // A genuine 9h10m rest, split into 4h before midnight and 5h10m
        // after - each individually short of the 9h reduced-rest threshold.
        const beforeMidnight = recorded('breakOrRest', dayBoundary - 4 * hour, dayBoundary, '/a');
        const afterMidnight = recorded('breakOrRest', dayBoundary, dayBoundary + 5 * hour + 10 * 60_000, '/b');

        const merged = mergeContiguousActivityIntervals([beforeMidnight, afterMidnight]);

        expect(merged).toHaveLength(1);
        expect((merged[0]?.end ?? 0) - (merged[0]?.start ?? 0)).toBe(9 * hour + 10 * 60_000);
    });
});
