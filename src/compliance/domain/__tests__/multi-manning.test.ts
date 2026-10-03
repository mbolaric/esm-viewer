import { describe, expect, it } from 'vitest';

import {
    createSourceReference,
    isJsonPointer,
    isUtcTimestamp,
    type ActivityKind,
    type CrewPresence,
    type IRecordedActivityInterval,
    type UtcTimestamp,
} from '#tachograph-domain';
import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_HOUR, MILLISECONDS_PER_MINUTE } from '#time';

import { evaluateBreakInfringements } from '../evaluators/break-evaluator.js';
import { evaluateDrivingInfringements } from '../evaluators/driving-evaluator.js';
import { evaluateDailyRestCompliance } from '../evaluators/rest-evaluator.js';
import { createDailyCyclePolicy, evaluateAvailabilityBreakAssessments } from '../multi-manning.js';
import { EU_561_2006_STANDARD, EU_MOBILITY_PACKAGE_2020, UK_GB_DOMESTIC } from '../rule-profile.js';

// Monday 2 March 2026 00:00 UTC, after the Art. 7 third-paragraph date.
const START = Date.UTC(2026, 2, 2);

type Segment = readonly [activity: ActivityKind, minutes: number, crewPresence?: CrewPresence];

function ts(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The multi-manning fixture timestamp must be valid.');
    }
    return value;
}

// Contiguous card activity from `start`; crew is the default because most scenarios describe a crew duty.
function timeline(segments: readonly Segment[], start = START): readonly IRecordedActivityInterval[] {
    let cursor = start;
    return segments.map(([activity, minutes, crewPresence = 'crew'], index) => {
        const path = `/activities/${String(index)}`;
        if (!isJsonPointer(path)) {
            throw new TypeError('The multi-manning fixture path must be valid.');
        }
        const interval: IRecordedActivityInterval = {
            activity,
            crewPresence,
            end: ts(cursor + minutes * MILLISECONDS_PER_MINUTE),
            origin: 'recorded',
            slot: crewPresence === 'unknown' ? 'Unknown' : 'Driver',
            source: createSourceReference('driverCard', 'g2', path),
            start: ts(cursor),
        };
        cursor = interval.end;
        return interval;
    });
}

const hours = (value: number): number => value * 60;

// A crew duty of 21h (9h driving, each 4.5h stint followed by co-driver availability), then 9h rest inside the
// 30h window, then a closing day so the window is not cut by the end of the records.
const crewDutyWithNineHourRest: readonly Segment[] = [
    ['driving', hours(4.5)],
    ['availability', hours(4.5)],
    ['driving', hours(4.5)],
    ['availability', hours(7.5)],
    ['breakOrRest', hours(9)],
    ['work', hours(1)],
    ['breakOrRest', hours(11)],
];

function asSingleDriver(segments: readonly Segment[]): readonly Segment[] {
    return segments.map(([activity, minutes]) => [activity, minutes, 'single']);
}

describe('multi-manning qualification (Art. 4(o))', () => {
    it('qualifies a duty period in which every driving interval had two cards', () => {
        const policy = createDailyCyclePolicy(timeline(crewDutyWithNineHourRest), EU_561_2006_STANDARD);

        expect(policy.qualify(START)).toEqual({ failedAt: null, status: 'crew' });
        expect(policy.windowLengthMs(START)).toBe(30 * MILLISECONDS_PER_HOUR);
    });

    it('keeps the ordinary 24-hour window for a single-driver day', () => {
        const policy = createDailyCyclePolicy(timeline(asSingleDriver(crewDutyWithNineHourRest)), EU_561_2006_STANDARD);

        expect(policy.qualify(START).status).toBe('single');
        expect(policy.windowLengthMs(START)).toBe(MILLISECONDS_PER_DAY);
    });

    it('allows single-card driving during the first hour of the duty period', () => {
        const policy = createDailyCyclePolicy(
            timeline([['driving', 50, 'single'], ...crewDutyWithNineHourRest]),
            EU_561_2006_STANDARD,
        );

        expect(policy.qualify(START).status).toBe('crew');
    });

    it('fails when single-card driving continues past the first hour and names where', () => {
        const policy = createDailyCyclePolicy(
            timeline([['driving', 90, 'single'], ...crewDutyWithNineHourRest]),
            EU_561_2006_STANDARD,
        );

        expect(policy.qualify(START)).toEqual({ failedAt: START + MILLISECONDS_PER_HOUR, status: 'crewFailed' });
        expect(policy.windowLengthMs(START)).toBe(MILLISECONDS_PER_DAY);
    });

    it('ignores single-card work while drivers swap slots, because only driving is tested', () => {
        const policy = createDailyCyclePolicy(
            timeline([['driving', hours(4.5)], ['work', 10, 'single'], ...crewDutyWithNineHourRest.slice(1)]),
            EU_561_2006_STANDARD,
        );

        expect(policy.qualify(START).status).toBe('crew');
    });

    it('ignores a one-minute single-card drive at a card change, but not a longer one', () => {
        const withBlip = (minutes: number): readonly Segment[] => [
            ['driving', hours(2)],
            ['driving', minutes, 'single'],
            ['driving', hours(2.5)],
            ...crewDutyWithNineHourRest.slice(1),
        ];

        expect(createDailyCyclePolicy(timeline(withBlip(1)), EU_561_2006_STANDARD).qualify(START).status).toBe('crew');
        expect(createDailyCyclePolicy(timeline(withBlip(2)), EU_561_2006_STANDARD).qualify(START).status).toBe('crewFailed');
    });

    it('is not applied under a profile without the Art. 8(5) derogation', () => {
        const policy = createDailyCyclePolicy(timeline(crewDutyWithNineHourRest), UK_GB_DOMESTIC);

        expect(policy.windowLengthMs(START)).toBe(MILLISECONDS_PER_DAY);
    });
});

describe('multi-manning daily rest (Art. 8(5))', () => {
    it('accepts 9 hours of rest within 30 hours where the 24-hour rule would report insufficient rest', () => {
        const crew = evaluateDailyRestCompliance(timeline(crewDutyWithNineHourRest), EU_561_2006_STANDARD);
        const single = evaluateDailyRestCompliance(timeline(asSingleDriver(crewDutyWithNineHourRest)), EU_561_2006_STANDARD);

        expect(crew.infringements).toEqual([]);
        expect(single.infringements.map((infringement) => infringement.ruleId)).toContain('DAILY_REST_INSUFFICIENT');
    });

    it.each([
        { restMinutes: hours(8), severity: 'minor' },
        { restMinutes: hours(8) - 1, severity: 'serious' },
        { restMinutes: hours(7), severity: 'serious' },
        { restMinutes: hours(7) - 1, severity: 'verySerious' },
    ] as const)('classifies $restMinutes minutes of crew rest as $severity (Annex I rows 22-23)', ({ restMinutes, severity }) => {
        const dutyMinutes = hours(30) - restMinutes;
        const result = evaluateDailyRestCompliance(
            timeline([
                ['driving', hours(4.5)],
                ['availability', hours(4.5)],
                ['driving', hours(4.5)],
                ['availability', dutyMinutes - hours(13.5)],
                ['breakOrRest', restMinutes],
                ['work', hours(1)],
                ['breakOrRest', hours(11)],
            ]),
            EU_561_2006_STANDARD,
        );

        expect(result.infringements).toEqual([
            expect.objectContaining({
                allowedValueMinutes: 540,
                excessOrDeficitMinutes: 540 - restMinutes,
                measuredValueMinutes: restMinutes,
                ruleId: 'DAILY_REST_MULTI_MANNING',
                severity,
            }),
        ]);
        expect(result.infringements[0]?.legalReference.article).toBe('Art. 8(5)');
    });
});

describe('multi-manning reduced rests (Art. 8(4), §1.1.3 reading)', () => {
    const crewCycle = (restMinutes: number): readonly Segment[] => [
        ['driving', hours(4.5)],
        ['availability', hours(4.5)],
        ['driving', hours(4.5)],
        ['availability', hours(30) - restMinutes - hours(13.5)],
        ['breakOrRest', restMinutes],
    ];
    const closingDay: readonly Segment[] = [
        ['work', hours(1)],
        ['breakOrRest', hours(11)],
    ];

    it('counts a 9-hour crew rest as reduced, so the fourth one exceeds the three allowed reductions', () => {
        const nineHourCycles = [1, 2, 3, 4].flatMap(() => crewCycle(hours(9)));
        const result = evaluateDailyRestCompliance(timeline([...nineHourCycles, ...closingDay]), EU_561_2006_STANDARD);

        expect(result.infringements.map((infringement) => infringement.ruleId)).toEqual(['DAILY_REST_REDUCTIONS_EXCEEDED']);
    });

    it('does not count an 11-hour crew rest as a reduction', () => {
        const cycles = [...[1, 2, 3].flatMap(() => crewCycle(hours(9))), ...crewCycle(hours(11))];
        const result = evaluateDailyRestCompliance(timeline([...cycles, ...closingDay]), EU_561_2006_STANDARD);

        expect(result.infringements).toEqual([]);
    });
});

describe('multi-manning daily driving', () => {
    it('measures driving over the whole 30-hour duty period instead of cutting it at 24 hours', () => {
        const segments: readonly Segment[] = [
            ['driving', hours(4.5)],
            ['availability', hours(1)],
            ['driving', hours(4.5)],
            ['availability', hours(13)],
            ['driving', hours(2)],
            ['availability', hours(5)],
            ['breakOrRest', hours(11)],
        ];

        const crewFindings = evaluateDrivingInfringements(timeline(segments), EU_561_2006_STANDARD);
        const singleFindings = evaluateDrivingInfringements(timeline(asSingleDriver(segments)), EU_561_2006_STANDARD);

        expect(crewFindings).toEqual([
            expect.objectContaining({ measuredValueMinutes: hours(11), ruleId: 'DAILY_DRIVING_LIMIT' }),
        ]);
        expect(singleFindings.filter((finding) => finding.ruleId === 'DAILY_DRIVING_LIMIT')).toEqual([]);
    });
});

describe('co-driver availability as a break (Art. 7, third paragraph)', () => {
    it('counts 45 consecutive minutes of crew availability as the break under the Mobility Package profile', () => {
        const intervals = timeline(crewDutyWithNineHourRest);

        expect(evaluateBreakInfringements(intervals, EU_MOBILITY_PACKAGE_2020)).toEqual([]);
        expect(evaluateAvailabilityBreakAssessments(intervals, EU_MOBILITY_PACKAGE_2020)).toEqual([
            expect.objectContaining({ recordedAt: START + hours(4.5) * MILLISECONDS_PER_MINUTE }),
            expect.objectContaining({ recordedAt: START + hours(13.5) * MILLISECONDS_PER_MINUTE }),
        ]);
    });

    it('does not count availability under the pre-2020 standard profile or before 20 August 2020', () => {
        const before = Date.UTC(2020, 7, 10);

        expect(evaluateBreakInfringements(timeline(crewDutyWithNineHourRest), EU_561_2006_STANDARD)).toEqual([
            expect.objectContaining({ ruleId: 'BREAK_CONTINUOUS_DRIVING' }),
        ]);
        expect(
            evaluateAvailabilityBreakAssessments(timeline(crewDutyWithNineHourRest, before), EU_MOBILITY_PACKAGE_2020),
        ).toEqual([]);
    });

    it('does not count availability shorter than 45 minutes or outside a qualifying crew duty', () => {
        const short: readonly Segment[] = [
            ['driving', hours(4.5)],
            ['availability', 44],
            ['driving', hours(1)],
            ['breakOrRest', hours(11)],
        ];

        expect(evaluateAvailabilityBreakAssessments(timeline(short), EU_MOBILITY_PACKAGE_2020)).toEqual([]);
        expect(
            evaluateAvailabilityBreakAssessments(timeline(asSingleDriver(crewDutyWithNineHourRest)), EU_MOBILITY_PACKAGE_2020),
        ).toEqual([]);
    });
});
