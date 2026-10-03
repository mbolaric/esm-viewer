import { describe, expect, it } from 'vitest';

import {
    createSourceReference,
    isJsonPointer,
    isUtcTimestamp,
    type ActivityInterval,
    type ActivityKind,
    type ISourceReference,
    type UtcTimestamp,
} from '#tachograph-domain';

import { evaluateUnrecordedPeriodAssessments } from '../evaluators/unrecorded-period-evaluator.js';
import { AETR_2020_INTERNATIONAL, EU_561_2006_STANDARD, EU_MOBILITY_PACKAGE_2020, UK_GB_DOMESTIC } from '../rule-profile.js';
import { resolveUnrecordedTime, type IUnrecordedPeriod } from '../unrecorded-time.js';

const minute = 60_000;
const hour = 60 * minute;

function at(milliseconds: number): UtcTimestamp {
    if (!isUtcTimestamp(milliseconds)) {
        throw new TypeError('The unrecorded-time fixture timestamp must be valid.');
    }
    return milliseconds;
}

function pointer(path: string): ISourceReference {
    if (!isJsonPointer(path)) {
        throw new TypeError('The unrecorded-time fixture path must be a JSON Pointer.');
    }
    return createSourceReference('driverCard', 'g2', path);
}

function record(activity: ActivityKind, fromHour: number, toHour: number, path: string): ActivityInterval {
    return {
        activity,
        crewPresence: 'single',
        end: at(toHour * hour),
        origin: 'recorded',
        slot: 'Driver',
        source: pointer(path),
        start: at(fromHour * hour),
    };
}

function gap(fromHour: number, toHour: number): ActivityInterval {
    return {
        activity: 'unknown',
        crewPresence: 'unknown',
        end: at(toHour * hour),
        origin: 'inferredGap',
        slot: 'Unknown',
        source: null,
        start: at(fromHour * hour),
    };
}

describe('resolveUnrecordedTime', () => {
    it('reads a card-out period as rest that keeps its card-out record as the source', () => {
        const { evaluationIntervals } = resolveUnrecordedTime([
            record('driving', 0, 4, '/a'),
            record('unknown', 4, 14, '/b'),
            record('driving', 14, 18, '/c'),
        ]);

        expect(evaluationIntervals[1]).toEqual({
            activity: 'breakOrRest',
            crewPresence: 'unknown',
            end: 14 * hour,
            origin: 'unrecordedTime',
            slot: 'Unknown',
            source: pointer('/b'),
            start: 4 * hour,
            unrecordedKind: 'cardNotInserted',
        });
    });

    it('fills days without records as rest attributed to the last record before them', () => {
        const { evaluationIntervals } = resolveUnrecordedTime([record('work', 0, 24, '/a'), record('driving', 72, 76, '/b')]);

        expect(evaluationIntervals).toHaveLength(3);
        expect(evaluationIntervals[1]).toMatchObject({
            crewPresence: 'unknown',
            end: 72 * hour,
            origin: 'unrecordedTime',
            slot: 'Unknown',
            source: pointer('/a'),
            start: 24 * hour,
            unrecordedKind: 'noRecords',
        });
    });

    it('reads an inferred gap inside the records as rest but leaves time before the first and after the last record', () => {
        const leading = gap(0, 2);
        const trailing = gap(10, 12);
        const { evaluationIntervals } = resolveUnrecordedTime([
            leading,
            record('driving', 2, 4, '/a'),
            gap(4, 6),
            record('driving', 6, 10, '/b'),
            trailing,
        ]);

        expect(evaluationIntervals[0]).toBe(leading);
        expect(evaluationIntervals[2]).toMatchObject({
            crewPresence: 'unknown',
            origin: 'unrecordedTime',
            slot: 'Unknown',
            source: pointer('/a'),
            unrecordedKind: 'noRecords',
        });
        expect(evaluationIntervals[4]).toBe(trailing);
    });

    it('joins a card-out that spans days without records into one period named by the card-out record', () => {
        const { unrecordedPeriods } = resolveUnrecordedTime([
            record('work', 0, 18, '/a'),
            record('unknown', 18, 24, '/b'),
            record('unknown', 72, 80, '/c'),
            record('driving', 80, 84, '/d'),
        ]);

        expect(unrecordedPeriods).toEqual([
            { end: 80 * hour, isFollowedByRecord: true, kind: 'cardNotInserted', source: pointer('/b'), start: 18 * hour },
        ]);
    });

    it('marks a card-out still open when the records end as not followed by a record', () => {
        const { unrecordedPeriods } = resolveUnrecordedTime([record('driving', 0, 4, '/a'), record('unknown', 4, 24, '/b')]);

        expect(unrecordedPeriods).toEqual([
            { end: 24 * hour, isFollowedByRecord: false, kind: 'cardNotInserted', source: pointer('/b'), start: 4 * hour },
        ]);
    });
});

function period(durationMinutes: number, isFollowedByRecord = true): IUnrecordedPeriod {
    return {
        end: at(hour + durationMinutes * minute),
        isFollowedByRecord,
        kind: 'cardNotInserted',
        source: pointer('/b'),
        start: at(hour),
    };
}

describe('evaluateUnrecordedPeriodAssessments', () => {
    it('lists each closed period of at least the shortest break part as an Art. 34(3) review item', () => {
        const assessments = evaluateUnrecordedPeriodAssessments([period(14), period(15)], EU_561_2006_STANDARD);

        expect(assessments).toHaveLength(1);
        expect(assessments[0]).toMatchObject({
            category: 'anomaly',
            id: `unrecorded-period-${String(hour)}`,
            legalReference: { article: 'Art. 34(3)', regulation: 'Regulation (EU) No 165/2014' },
            profileId: 'EU_561_2006_STANDARD',
            recordedAt: hour,
            ruleId: 'UNRECORDED_PERIOD_REVIEW',
            source: pointer('/b'),
            status: 'externalEvidenceRequired',
        });
    });

    it('skips a period whose manual entry is not yet due', () => {
        expect(evaluateUnrecordedPeriodAssessments([period(600, false)], EU_MOBILITY_PACKAGE_2020)).toEqual([]);
    });

    it.each([AETR_2020_INTERNATIONAL, UK_GB_DOMESTIC])('emits no review item under the $profileId profile', (profile) => {
        expect(evaluateUnrecordedPeriodAssessments([period(600)], profile)).toEqual([]);
    });
});
