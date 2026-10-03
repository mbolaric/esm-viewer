import { describe, expect, it } from 'vitest';

import {
    createSourceReference,
    isJsonPointer,
    isUtcTimestamp,
    type ActivityInterval,
    type ISourceReference,
    type UtcTimestamp,
} from '#tachograph-domain';
import { MILLISECONDS_PER_HOUR } from '#time';

import {
    isQualifyingDailyRest,
    nextDailyCycleAnchor,
    resolveDailyCycleWindow,
    STANDARD_DAILY_CYCLE_POLICY,
} from '../daily-cycle.js';
import { evaluateDrivingInfringements } from '../evaluators/driving-evaluator.js';
import { evaluateDailyRestCompliance, evaluateRestInfringements } from '../evaluators/rest-evaluator.js';
import { mergeContiguousActivityIntervals } from '../interval-merge.js';
import { evaluateWorkingTimeInfringements } from '../evaluators/working-time-evaluator.js';
import { DIRECTIVE_2002_15_EC_WORKING_TIME, EU_561_2006_STANDARD } from '../rule-profile.js';

// Monday 00:00 UTC.
const WEEK_START = Date.UTC(2024, 0, 8);

type Activity = 'availability' | 'breakOrRest' | 'driving' | 'work';

function timestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The test timestamp must be an exact UTC epoch-millisecond value.');
    }
    return value;
}

function source(index: number): ISourceReference<'g1', 'driverCard'> {
    const pointer = `/card/activities/${String(index)}`;
    if (!isJsonPointer(pointer)) {
        throw new TypeError('The test source path must be a canonical JSON Pointer.');
    }
    return createSourceReference('driverCard', 'g1', pointer);
}

// Builds back-to-back intervals from a list of [activity, hours] steps that
// starts `startHours` after Monday 00:00, the way Guidance Note 7's
// illustrations lay a day out.
function timeline(startHours: number, steps: readonly (readonly [Activity, number])[]): readonly ActivityInterval[] {
    let cursor = WEEK_START + startHours * MILLISECONDS_PER_HOUR;
    return mergeContiguousActivityIntervals(
        steps.map(([activity, hours], index): ActivityInterval => {
            const start = cursor;
            cursor += hours * MILLISECONDS_PER_HOUR;
            return {
                activity,
                crewPresence: 'single',
                end: timestamp(cursor),
                origin: 'recorded',
                slot: 'Driver',
                source: source(index),
                start: timestamp(start),
            };
        }),
    );
}

function atHours(hours: number): number {
    return WEEK_START + hours * MILLISECONDS_PER_HOUR;
}

describe('daily cycle window', () => {
    it('starts at the anchor while the duty begins inside the anchored 24 hours', () => {
        expect(resolveDailyCycleWindow(atHours(6), atHours(9), STANDARD_DAILY_CYCLE_POLICY)).toEqual({
            end: atHours(30),
            start: atHours(6),
        });
    });

    it('starts at the duty when no rest is visible or the anchor is more than 24 hours old', () => {
        expect(resolveDailyCycleWindow(null, atHours(9), STANDARD_DAILY_CYCLE_POLICY)).toEqual({
            end: atHours(33),
            start: atHours(9),
        });
        expect(resolveDailyCycleWindow(atHours(0), atHours(24), STANDARD_DAILY_CYCLE_POLICY)).toEqual({
            end: atHours(48),
            start: atHours(24),
        });
    });

    it('continues at the window end without a qualifying rest, and at the rest end with one', () => {
        const window = resolveDailyCycleWindow(atHours(0), atHours(2), STANDARD_DAILY_CYCLE_POLICY);
        expect(nextDailyCycleAnchor(window, null)).toBe(atHours(24));
        expect(nextDailyCycleAnchor(window, atHours(27))).toBe(atHours(27));
    });

    it('treats a single rest of at least the reduced daily rest as qualifying', () => {
        const [nineHours, justUnder, work] = [
            timeline(0, [['breakOrRest', 9]])[0],
            timeline(0, [['breakOrRest', 8.99]])[0],
            timeline(0, [['work', 12]])[0],
        ];
        expect(nineHours !== undefined && isQualifyingDailyRest(nineHours, EU_561_2006_STANDARD)).toBe(true);
        expect(justUnder !== undefined && isQualifyingDailyRest(justUnder, EU_561_2006_STANDARD)).toBe(false);
        expect(work !== undefined && isQualifyingDailyRest(work, EU_561_2006_STANDARD)).toBe(false);
    });
});

// Commission Guidance Note 7 on Regulation (EC) No 561/2006 Art. 8(2): the
// driving and daily-rest evaluators must measure the same 24-hour period.
describe('daily cycle consistency between the driving and daily-rest evaluators', () => {
    it('anchors the driving window at the end of the rest, not at the first driving', () => {
        // Rest ends at 00:00, six hours of work, then 5.5h + 5.5h of driving
        // separated by an 8h rest that is too short to qualify. Both drives
        // fall inside the 24 hours that started when the rest ended, so
        // they add up to 11h against the 10h limit. Measured from the first
        // driving (06:00) the second drive would have started a new period.
        const intervals = timeline(0, [
            ['work', 6],
            ['driving', 5.5],
            ['breakOrRest', 8],
            ['driving', 5.5],
            ['breakOrRest', 12],
        ]);

        const infringements = evaluateDrivingInfringements(intervals, EU_561_2006_STANDARD);

        expect(infringements.map((finding) => finding.ruleId)).toEqual(['DAILY_DRIVING_LIMIT']);
        expect(infringements[0]?.measuredValueMinutes).toBe(11 * 60);
    });

    it('starts a new window 24 hours after the last one when no rest qualified (Guidance Note 7, example 2)', () => {
        const intervals = timeline(0, [
            ['driving', 3],
            ['work', 4],
            ['breakOrRest', 0.75],
            ['driving', 4.5],
            ['work', 5],
            ['breakOrRest', 0.75],
            ['driving', 2],
            ['breakOrRest', 7],
            ['driving', 4],
            ['breakOrRest', 12],
        ]);

        const restFindings = evaluateRestInfringements(intervals, EU_561_2006_STANDARD);

        expect(restFindings.filter((finding) => finding.ruleId === 'DAILY_REST_INSUFFICIENT')).toHaveLength(1);
        expect(restFindings[0]?.id).toBe(`daily-rest-${String(atHours(0))}`);
    });

    it('starts the next window when an ongoing rest ends, if it later becomes qualifying (Guidance Note 7, example 3)', () => {
        // The 24-hour window ends at 24:00 inside an 8h + 3h = 11h rest that
        // ends at 03:00. The next window starts at 03:00 (27h), for both the
        // daily-rest finding's window and the driving period.
        const intervals = timeline(0, [
            ['driving', 2.5],
            ['breakOrRest', 0.75],
            ['driving', 4],
            ['work', 2],
            ['breakOrRest', 1],
            ['driving', 3],
            ['work', 2.75],
            ['breakOrRest', 8],
            ['breakOrRest', 3],
            ['driving', 9.5],
            ['breakOrRest', 8],
            ['work', 4.5],
            ['driving', 1],
            ['breakOrRest', 12],
        ]);

        const restFindings = evaluateRestInfringements(intervals, EU_561_2006_STANDARD);
        const drivingFindings = evaluateDrivingInfringements(intervals, EU_561_2006_STANDARD);

        expect(restFindings.map((finding) => finding.id)).toContain(`daily-rest-${String(atHours(27))}`);
        expect(drivingFindings.map((finding) => finding.ruleId)).toEqual(['DAILY_DRIVING_LIMIT']);
        expect(drivingFindings[0]?.measuredValueMinutes).toBe(10.5 * 60);
    });

    it('does not treat a ferry-shaped interrupted rest as ending the cycle in either evaluator', () => {
        // 5h rest + 30m work + 6h rest looks like a ferry/train rest (Art.
        // 9(1)) but tachograph data cannot prove it. Neither evaluator ends
        // the cycle on that assumption: the rest shortfall and the review
        // item are reported, and both drives still count in one 24-hour
        // window against the 10h limit (8h + the 4.5h of the second drive
        // before the window ends at 24h).
        const intervals = timeline(0, [
            ['driving', 8],
            ['breakOrRest', 5],
            ['work', 0.5],
            ['breakOrRest', 6],
            ['driving', 8],
            ['breakOrRest', 12],
        ]);

        const restResult = evaluateDailyRestCompliance(intervals, EU_561_2006_STANDARD);
        const drivingFindings = evaluateDrivingInfringements(intervals, EU_561_2006_STANDARD);

        expect(restResult.infringements.map((finding) => finding.ruleId)).toEqual(['DAILY_REST_INSUFFICIENT']);
        expect(restResult.assessments.map((assessment) => assessment.ruleId)).toEqual([
            'DAILY_REST_FERRY_TRAIN_INTERRUPTION_REVIEW',
        ]);
        expect(drivingFindings.map((finding) => finding.ruleId)).toEqual(['DAILY_DRIVING_LIMIT']);
        expect(drivingFindings[0]?.measuredValueMinutes).toBe(12.5 * 60);
    });
});

// An interval is measured where it lies, not wholly where it starts.
describe('intervals that cross a window or week boundary', () => {
    it('splits a drive at the end of the 24-hour window (Guidance Note 7, example 1)', () => {
        // 22:00-02:00 is one drive across the 24:00 window end. Window 1 holds
        // 3h + 4.5h + 2h = 9.5h, inside the 10h extended limit; counting the
        // whole 4h there would give 11.5h.
        const intervals = timeline(0, [
            ['driving', 3],
            ['work', 3],
            ['breakOrRest', 0.75],
            ['driving', 4.5],
            ['breakOrRest', 0.75],
            ['work', 3],
            ['breakOrRest', 7],
            ['driving', 4],
            ['breakOrRest', 0.75],
            ['driving', 4.5],
            ['breakOrRest', 12],
        ]);

        expect(evaluateDrivingInfringements(intervals, EU_561_2006_STANDARD)).toEqual([]);
    });

    it('counts the part of a drive after the window end in the next window', () => {
        // The 24-hour window starts when the 12h rest ends (12h) and ends at
        // 36h. The 12h drive from 30h to 42h has 6h before that and 6h after,
        // so neither window is over the limit; counting all 12h where the
        // drive starts would be.
        const intervals = timeline(0, [
            ['breakOrRest', 12],
            ['work', 18],
            ['driving', 12],
            ['breakOrRest', 12],
        ]);

        expect(evaluateDrivingInfringements(intervals, EU_561_2006_STANDARD)).toEqual([]);
    });

    // Six days of `dayHours` Monday-Saturday, then a Sunday stretch from 22:00
    // to 02:00 Monday. Sunday holds 2h of it and Monday holds 2h; counting all
    // 4h in the first week would add 2h to it.
    const weekEndingWithMidnightCrossing = (activity: 'driving' | 'work', dayHours: number): readonly ActivityInterval[] =>
        timeline(0, [
            ...Array.from(
                { length: 6 },
                () =>
                    [
                        ['breakOrRest', 6],
                        [activity, dayHours],
                        ['breakOrRest', 18 - dayHours],
                    ] as const,
            ).flat(),
            ['breakOrRest', 22],
            [activity, 4],
            ['breakOrRest', 18],
        ] as const);

    it('splits a drive across Sunday midnight between the two weeks for the weekly driving limit (54h + 2h = 56h)', () => {
        const findings = evaluateDrivingInfringements(weekEndingWithMidnightCrossing('driving', 9), EU_561_2006_STANDARD);

        expect(findings.map((finding) => finding.ruleId)).not.toContain('WEEKLY_DRIVING_LIMIT');
    });

    it('splits work across Sunday midnight between the two weeks for the weekly working-time limit (57h + 2h = 59h)', () => {
        const findings = evaluateWorkingTimeInfringements(
            weekEndingWithMidnightCrossing('work', 9.5),
            DIRECTIVE_2002_15_EC_WORKING_TIME,
        );

        expect(findings.map((finding) => finding.ruleId)).not.toContain('WORKING_TIME_WEEKLY_LIMIT_60H');
    });
});
