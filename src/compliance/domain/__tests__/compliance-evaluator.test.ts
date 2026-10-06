import { describe, expect, it } from 'vitest';

import {
    createSourceReference,
    createTachographEvent,
    isJsonPointer,
    isUtcTimestamp,
    type ActivityInterval,
    type ISourceReference,
    type ITachographEvent,
    type UtcTimestamp,
} from '#tachograph-domain';

import { evaluateAnomalyInfringements } from '../evaluators/anomaly-evaluator.js';
import { evaluateBreakInfringements } from '../evaluators/break-evaluator.js';
import { evaluateDrivingInfringements } from '../evaluators/driving-evaluator.js';
import { evaluateDailyRestCompliance, evaluateRestInfringements } from '../evaluators/rest-evaluator.js';
import { evaluateWeeklyRestCompliance, evaluateWeeklyRestInfringements } from '../evaluators/weekly-rest-evaluator.js';
import type { IInfringement } from '../infringement.js';
import { mergeContiguousActivityIntervals } from '../interval-merge.js';
import { evaluateWorkingTimeInfringements, type INightWindow } from '../evaluators/working-time-evaluator.js';
import {
    AETR_2020_INTERNATIONAL,
    calculateDeficitSeverity,
    calculateSeverity,
    DIRECTIVE_2002_15_EC_WORKING_TIME,
    EU_MOBILITY_PACKAGE_2020,
    EU_561_2006_STANDARD,
    UK_GB_DOMESTIC,
} from '../rule-profile.js';

function createTestTimestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The test timestamp must be an exact UTC epoch-millisecond value.');
    }
    return value;
}

function createTestSource(pathValue: string): ISourceReference<'g1', 'driverCard'> {
    if (!isJsonPointer(pathValue)) {
        throw new TypeError('The test source path must be a canonical JSON Pointer.');
    }
    return createSourceReference('driverCard', 'g1', pathValue);
}

const mockSource = createTestSource('/card/activities/0');

function createInterval(
    activity: 'availability' | 'breakOrRest' | 'driving' | 'work',
    startMs: number,
    durationMinutes: number,
): ActivityInterval {
    const start = createTestTimestamp(startMs);
    const end = createTestTimestamp(startMs + durationMinutes * 60000);
    return {
        activity,
        end,
        crewPresence: 'single',
        origin: 'recorded',
        slot: 'Driver',
        source: mockSource,
        start,
    };
}

function createIntervalWithMilliseconds(
    activity: 'availability' | 'breakOrRest' | 'driving' | 'work',
    startMs: number,
    durationMs: number,
): ActivityInterval {
    return {
        activity,
        crewPresence: 'single',
        end: createTestTimestamp(startMs + durationMs),
        origin: 'recorded',
        slot: 'Driver',
        source: mockSource,
        start: createTestTimestamp(startMs),
    };
}

function createAlternatingDrivingDays(
    startUtc: number,
    drivingDurationMs: number,
    restDurationMs: number,
    dayCount = 3,
): readonly ActivityInterval[] {
    const intervals: ActivityInterval[] = [];
    let currentStart = startUtc;
    for (let day = 0; day < dayCount; day++) {
        const driving = createIntervalWithMilliseconds('driving', currentStart, drivingDurationMs);
        intervals.push(driving);
        currentStart = driving.end;
        if (day < dayCount - 1) {
            const rest = createIntervalWithMilliseconds('breakOrRest', currentStart, restDurationMs);
            intervals.push(rest);
            currentStart = rest.end;
        }
    }
    return intervals;
}

function createTwoReducedWeeklyRestPattern(firstMondayUtc: number): readonly ActivityInterval[] {
    const intervals: ActivityInterval[] = [];
    for (let week = 0; week < 2; week++) {
        const weekStart = firstMondayUtc + week * 7 * 24 * 3600 * 1000;
        intervals.push(createInterval('driving', weekStart, 600));
        intervals.push(createInterval('breakOrRest', weekStart + 4 * 24 * 3600 * 1000 + 18 * 3600 * 1000, 30 * 60));
        intervals.push(createInterval('driving', weekStart + 6 * 24 * 3600 * 1000, week === 1 ? 24 * 60 : 600));
    }
    return intervals;
}

function createInterruptedRestIntervals(baseTime: number): ActivityInterval[] {
    return [
        createInterval('driving', baseTime, 480),
        createInterval('breakOrRest', baseTime + 480 * 60000, 240),
        createInterval('driving', baseTime + 720 * 60000, 20),
        createInterval('breakOrRest', baseTime + 740 * 60000, 300),
        createInterval('driving', baseTime + 1040 * 60000, 15),
        createInterval('breakOrRest', baseTime + 1055 * 60000, 180),
    ];
}

function createWeekWithoutWeeklyRest(mondayUtc: number): ActivityInterval[] {
    const intervals: ActivityInterval[] = [];
    for (let day = 0; day < 7; day++) {
        const dayStart = mondayUtc + day * 24 * 3600 * 1000;
        intervals.push(createInterval('driving', dayStart, 360));
        intervals.push(createInterval('breakOrRest', dayStart + 6 * 3600 * 1000, 60));
    }
    return intervals;
}

function createInterruptedWeeklyRestWeek(mondayUtc: number, secondInterruptionMinutes: number): readonly ActivityInterval[] {
    const intervals: ActivityInterval[] = [];
    const week2Start = mondayUtc + 7 * 24 * 3600 * 1000;
    intervals.push(createInterval('driving', week2Start, 600));
    const restStart = week2Start + 24 * 3600 * 1000;
    intervals.push(createInterval('breakOrRest', restStart, 600));
    intervals.push(createInterval('driving', restStart + 600 * 60000, 20));
    intervals.push(createInterval('breakOrRest', restStart + 620 * 60000, 600));
    intervals.push(createInterval('driving', restStart + 1220 * 60000, secondInterruptionMinutes));
    const thirdRestStart = restStart + (1220 + secondInterruptionMinutes) * 60000;
    intervals.push(createInterval('breakOrRest', thirdRestStart, 300));
    intervals.push(createInterval('driving', thirdRestStart + 300 * 60000, 600));
    intervals.push(createInterval('driving', week2Start + 6 * 24 * 3600 * 1000 + 14 * 3600 * 1000, 600));
    return intervals;
}

function createTestEvent(
    code: 'drivingWithoutAppropriateCard' | 'motionDataError' | 'vehicleMotionConflict',
    startMs: number,
    durationMinutes: number,
): ITachographEvent {
    const start = createTestTimestamp(startMs);
    const end = createTestTimestamp(startMs + durationMinutes * 60000);
    const event = createTachographEvent({
        code,
        end,
        recordKind: 'event',
        recordPurpose: null,
        registrationMemberState: null,
        registrationNumber: null,
        similarOccurrences: null,
        source: mockSource,
        start,
    });
    if (event === null) {
        throw new Error('Test fixture produced an invalid tachograph event.');
    }
    return event;
}

describe('Compliance Evaluators with Configurable Rule Profiles', () => {
    it('evaluates break infringements when continuous driving exceeds EU 561/2006 threshold (4.5h)', () => {
        const baseTime = 1700000000000;
        const intervals: ActivityInterval[] = [createInterval('driving', baseTime, 300)];

        const infringements = evaluateBreakInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements).toHaveLength(1);
        expect(infringements[0]?.category).toBe('break');
        expect(infringements[0]?.allowedValueMinutes).toBe(270);
        expect(infringements[0]?.measuredValueMinutes).toBe(300);
        expect(infringements[0]?.excessOrDeficitMinutes).toBe(30);
        expect(infringements[0]?.severity).toBe('serious');
    });

    it('records the continuous-driving infringement at the moment the limit was crossed, not at the start of the driving stint', () => {
        // Regression test: a single merged 5-hour driving interval (08:00 -
        // 13:00) crosses the 4.5h (270m) limit at 12:30, not at 08:00 when
        // driving began.
        const baseTime = new Date('2026-06-15T08:00:00Z').getTime();
        const intervals: ActivityInterval[] = [createInterval('driving', baseTime, 5 * 60)];

        const infringements = evaluateBreakInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements).toHaveLength(1);
        expect(infringements[0]?.recordedAt).toBe(baseTime + 270 * 60000);
    });

    it('does not round away a genuine sub-minute breach of the continuous-driving limit', () => {
        const baseTime = 1700000000000;
        // 270 minutes and 15 seconds: a real breach of the 270-minute limit.
        // Math.round(270.25) rounds down to 270, which previously reported
        // an "excess" of zero minutes for a genuine violation.
        const intervals: ActivityInterval[] = [createIntervalWithMilliseconds('driving', baseTime, 270 * 60000 + 15000)];

        const infringements = evaluateBreakInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements).toHaveLength(1);
        expect(infringements[0]?.measuredValueMinutes).toBe(271);
        expect(infringements[0]?.excessOrDeficitMinutes).toBe(1);
    });

    it('adapts break evaluation when using UK Domestic profile limits (5.5h continuous driving)', () => {
        const baseTime = 1700000000000;
        const intervals: ActivityInterval[] = [createInterval('driving', baseTime, 300)];

        const euInfringements = evaluateBreakInfringements(intervals, EU_561_2006_STANDARD);
        const ukInfringements = evaluateBreakInfringements(intervals, UK_GB_DOMESTIC);

        expect(euInfringements).toHaveLength(1);
        expect(ukInfringements).toHaveLength(0);
    });

    it('cites each profile’s own legal instrument, not the EU regulation regardless of jurisdiction', () => {
        const baseTime = 1700000000000;
        const intervals: ActivityInterval[] = [createInterval('driving', baseTime, 700)];

        const euInfringements = evaluateBreakInfringements(intervals, EU_561_2006_STANDARD);
        const aetrInfringements = evaluateBreakInfringements(intervals, AETR_2020_INTERNATIONAL);
        const ukInfringements = evaluateBreakInfringements(intervals, UK_GB_DOMESTIC);

        expect(euInfringements[0]?.legalReference.regulation).toBe('Regulation (EC) No 561/2006');
        expect(aetrInfringements[0]?.legalReference.regulation).toContain('AETR');
        expect(aetrInfringements[0]?.legalReference.regulation).not.toContain('Regulation (EC)');
        expect(ukInfringements[0]?.legalReference.regulation).toBe('Transport Act 1968, Part VI (GB Domestic Rules)');
    });

    it('evaluates daily driving infringements when 9h limit is exceeded without valid extension', () => {
        const baseTime = 1700000000000;
        // 11 hours (660 min) exceeds extended 10h (600 min) limit
        const intervals: ActivityInterval[] = [createInterval('driving', baseTime, 660)];

        const infringements = evaluateDrivingInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements).toHaveLength(1);
        expect(infringements[0]?.category).toBe('dailyDriving');
        expect(infringements[0]?.measuredValueMinutes).toBe(660);
        expect(infringements[0]?.excessOrDeficitMinutes).toBe(60);
    });

    it('does not round away a partial-minute third daily extension', () => {
        const mondayUtc = new Date('2026-06-15T00:00:00Z').getTime();
        const drivingDurationMs = 540 * 60_000 + 30_000;
        const restDurationMs = 540 * 60_000;
        const intervals = createAlternatingDrivingDays(mondayUtc, drivingDurationMs, restDurationMs, 3);

        const findings = evaluateDrivingInfringements(intervals, EU_561_2006_STANDARD).filter(
            (finding) => finding.ruleId === 'DAILY_DRIVING_LIMIT',
        );

        expect(findings).toHaveLength(1);
        expect(findings[0]?.measuredValueMinutes).toBe(541);
        expect(findings[0]?.excessOrDeficitMinutes).toBe(1);
    });

    it('consumes a weekly extension slot even on a day that also exceeds the 10h extended limit, exhausting the twice-a-week quota', () => {
        // Regression test: a day driving beyond even the 10h extended limit
        // must still count as one use of the "not more than twice during
        // the week" extension (Art. 6(1)) - not just a day that happens to
        // land within 10h. Three consecutive 10h15m driving days in the
        // same week: the first two each consume an extension and are
        // measured against the 10h extended limit (15m excess each); the
        // third, with no extension left, must be measured against the 9h
        // standard limit (75m excess), not against 10h again.
        const mondayUtc = new Date('2026-06-15T00:00:00Z').getTime();
        const drivingDurationMs = (10 * 60 + 15) * 60_000; // 10h15m
        const restDurationMs = 9 * 60 * 60_000; // qualifying 9h reduced rest

        const intervals = createAlternatingDrivingDays(mondayUtc, drivingDurationMs, restDurationMs, 3);

        const findings = evaluateDrivingInfringements(intervals, EU_561_2006_STANDARD).filter(
            (finding) => finding.ruleId === 'DAILY_DRIVING_LIMIT',
        );

        expect(findings).toHaveLength(3);
        expect(findings[0]?.allowedValueMinutes).toBe(600);
        expect(findings[0]?.excessOrDeficitMinutes).toBe(15);
        expect(findings[1]?.allowedValueMinutes).toBe(600);
        expect(findings[1]?.excessOrDeficitMinutes).toBe(15);
        // Extension quota exhausted: the third day is measured against the
        // 9h standard limit, not the 10h extended limit again.
        expect(findings[2]?.allowedValueMinutes).toBe(540);
        expect(findings[2]?.excessOrDeficitMinutes).toBe(75);
    });

    it('accumulates continuous driving across midnight as a single daily driving cycle when no qualifying rest was taken', () => {
        // Base time at 20:00 UTC (4 hours before midnight)
        const baseTime = 1700000000000;
        const intervals: ActivityInterval[] = [
            createInterval('driving', baseTime, 240), // 20:00 to 00:00 (4h)
            createInterval('driving', baseTime + 240 * 60000, 480), // 00:00 to 08:00 (8h)
        ]; // Total 12 hours (720 min) continuous driving across midnight

        const infringements = evaluateDrivingInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements).toHaveLength(1);
        expect(infringements[0]?.category).toBe('dailyDriving');
        expect(infringements[0]?.measuredValueMinutes).toBe(720);
    });

    it('closes the daily driving cycle on a qualifying rest even when it is split into two contiguous intervals by a midnight crossing', () => {
        const baseTime = 1700000000000;
        // A genuine 550-minute (9h10m) rest, qualifying on its own, but
        // split by this app's own per-day normalization into a 250-minute
        // and a 300-minute piece - each individually under the 540-minute
        // reduced-rest threshold. `compliance-service.ts` always runs
        // `mergeContiguousActivityIntervals` before this evaluator, so that
        // is exercised here too - without it, neither piece alone would
        // close the driving cycle, and the two 500-minute driving blocks
        // either side of the rest would be wrongly merged into one
        // 1000-minute "daily driving period" and reported as exceeding the
        // limit, even though the driver took a fully qualifying rest.
        const intervals: readonly ActivityInterval[] = mergeContiguousActivityIntervals([
            createInterval('driving', baseTime, 500),
            createInterval('breakOrRest', baseTime + 500 * 60000, 250),
            createInterval('breakOrRest', baseTime + 750 * 60000, 300),
            createInterval('driving', baseTime + 1050 * 60000, 500),
        ]);

        const infringements = evaluateDrivingInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements).toHaveLength(0);
    });

    it('bounds daily driving cycles to a 24-hour window, preventing multi-day compounding on insufficient rest', () => {
        // Driver drives 8h and sleeps 8h every day for 4 days (under 9h daily driving each day).
        // Insufficient daily rest (<9h) must not cause all 4 days of driving (32h) to compound
        // into a single phantom 24h+ daily driving infringement.
        const mondayUtc = new Date('2026-06-15T08:00:00Z').getTime();
        const intervals: ActivityInterval[] = [];
        for (let day = 0; day < 4; day++) {
            const dayStart = mondayUtc + day * 24 * 60 * 60 * 1000;
            // 8 hours driving (08:00 - 16:00)
            intervals.push(createInterval('driving', dayStart, 8 * 60));
            // 8 hours rest (22:00 - 06:00)
            intervals.push(createInterval('breakOrRest', dayStart + 14 * 60 * 60 * 1000, 8 * 60));
        }

        const infringements = evaluateDrivingInfringements(intervals, EU_561_2006_STANDARD);
        const dailyDrivingBreaches = infringements.filter((i) => i.ruleId === 'DAILY_DRIVING_LIMIT');
        expect(dailyDrivingBreaches).toHaveLength(0);
    });

    it('does not close the daily driving cycle when contiguous breakOrRest intervals still fall short of the qualifying rest threshold', () => {
        const baseTime = 1700000000000;
        // Same shape as above, but the two pieces only sum to 500 minutes
        // (8h20m) - genuinely short of the 540-minute threshold even once
        // merged, so the cycle must still be treated as continuing.
        const intervals: readonly ActivityInterval[] = mergeContiguousActivityIntervals([
            createInterval('driving', baseTime, 500),
            createInterval('breakOrRest', baseTime + 500 * 60000, 250),
            createInterval('breakOrRest', baseTime + 750 * 60000, 250),
            createInterval('driving', baseTime + 1000 * 60000, 500),
        ]);

        // The second drive (minutes 1000-1500) runs past the 24-hour window
        // end at minute 1440, so window one holds 500 + 440 minutes and the
        // last 60 minutes count in the next window.
        const infringements = evaluateDrivingInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements).toHaveLength(1);
        expect(infringements[0]?.measuredValueMinutes).toBe(940);
    });

    it('does not reset continuous driving when fragmented small breaks under 15 minutes are taken', () => {
        const baseTime = 1700000000000;
        const intervals: ActivityInterval[] = [
            createInterval('driving', baseTime, 120), // 2h driving
            createInterval('breakOrRest', baseTime + 120 * 60000, 10), // 10m break (invalid)
            createInterval('driving', baseTime + 130 * 60000, 120), // 2h driving (total 4h)
            createInterval('breakOrRest', baseTime + 250 * 60000, 10), // 10m break (invalid)
            createInterval('driving', baseTime + 260 * 60000, 60), // 1h driving (total 5h > 4.5h)
        ];

        const infringements = evaluateBreakInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements).toHaveLength(1);
        expect(infringements[0]?.category).toBe('break');
    });

    it('reports one infringement measuring the whole stint when driving continues after the breach past a short non-break interruption (Regulation (EU) 2016/403 Annex I)', () => {
        const baseTime = 1700000000000;
        const intervals: ActivityInterval[] = [
            createInterval('driving', baseTime, 275), // 4h35 - breaches the 4h30 limit by 5 minutes
            createInterval('work', baseTime + 275 * 60000, 5), // 5m other work - not a break
            createInterval('driving', baseTime + 280 * 60000, 275), // 4h35 more with no qualifying break
        ];

        const infringements = evaluateBreakInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements).toHaveLength(1);
        // Recorded at the first crossing of the limit, not restarted at the second stretch.
        expect(infringements[0]?.recordedAt).toBe(baseTime + 270 * 60000);
        expect(infringements[0]?.measuredValueMinutes).toBe(550);
        expect(infringements[0]?.excessOrDeficitMinutes).toBe(280);
        expect(infringements[0]?.severity).toBe('verySerious');
    });

    it('starts a new infringement for a later stint once a qualifying 45-minute break has closed the breached one', () => {
        const baseTime = 1700000000000;
        const intervals: ActivityInterval[] = [
            createInterval('driving', baseTime, 280), // breach of the first stint
            createInterval('breakOrRest', baseTime + 280 * 60000, 45), // qualifying break closes the stint
            createInterval('driving', baseTime + 325 * 60000, 290), // breach of a second, separate stint
        ];

        const infringements = evaluateBreakInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements).toHaveLength(2);
        expect(infringements[0]?.measuredValueMinutes).toBe(280);
        expect(infringements[1]?.measuredValueMinutes).toBe(290);
        expect(infringements[0]?.id).not.toBe(infringements[1]?.id);
    });

    it('closes a breached stint on a valid split break (15m + 30m) so later driving is a separate stint', () => {
        const baseTime = 1700000000000;
        const intervals: ActivityInterval[] = [
            createInterval('driving', baseTime, 280), // breach
            createInterval('breakOrRest', baseTime + 280 * 60000, 15), // first split break
            createInterval('driving', baseTime + 295 * 60000, 10), // stint total is now 290m
            createInterval('breakOrRest', baseTime + 305 * 60000, 30), // second split break
            createInterval('driving', baseTime + 335 * 60000, 100), // well under the limit
        ];

        const infringements = evaluateBreakInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements).toHaveLength(1);
        expect(infringements[0]?.measuredValueMinutes).toBe(290);
    });

    it('closes a breached stint when a 15m first split taken before the breach is completed late by 30m', () => {
        const baseTime = 1700000000000;
        const intervals: ActivityInterval[] = [
            createInterval('driving', baseTime, 240), // 4h
            createInterval('breakOrRest', baseTime + 240 * 60000, 15), // first split break, before the breach
            createInterval('driving', baseTime + 255 * 60000, 60), // stint reaches 5h: breach at 4h30
            createInterval('breakOrRest', baseTime + 315 * 60000, 30), // late second split break ends the stint
            createInterval('driving', baseTime + 345 * 60000, 120), // new stint, under the limit
        ];

        const infringements = evaluateBreakInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements).toHaveLength(1);
        expect(infringements[0]?.measuredValueMinutes).toBe(300);
        expect(infringements[0]?.excessOrDeficitMinutes).toBe(30);
    });

    it('resets continuous driving when a valid split break (15m + 30m) is taken', () => {
        const baseTime = 1700000000000;
        const intervals: ActivityInterval[] = [
            createInterval('driving', baseTime, 120), // 2h driving
            createInterval('breakOrRest', baseTime + 120 * 60000, 15), // 15m qualifying split break
            createInterval('driving', baseTime + 135 * 60000, 120), // 2h driving
            createInterval('breakOrRest', baseTime + 255 * 60000, 30), // 30m qualifying second split break (resets accumulator!)
            createInterval('driving', baseTime + 285 * 60000, 120), // 2h driving
        ];

        const infringements = evaluateBreakInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements).toHaveLength(0);
    });

    it('allows a subsequent >= 15m break to update the split break candidate and pair with a following 30m break', () => {
        const baseTime = 1700000000000;
        // 2h driving -> 15m break -> 1h driving -> 20m break (newer candidate >= 15m) -> 1h driving -> 30m break (pairs with 20m!) -> 2h driving
        const intervals: ActivityInterval[] = [
            createInterval('driving', baseTime, 120), // 2h driving
            createInterval('breakOrRest', baseTime + 120 * 60000, 15), // 15m break
            createInterval('driving', baseTime + 135 * 60000, 60), // 1h driving
            createInterval('breakOrRest', baseTime + 195 * 60000, 20), // 20m break (updates candidate)
            createInterval('driving', baseTime + 215 * 60000, 60), // 1h driving
            createInterval('breakOrRest', baseTime + 275 * 60000, 30), // 30m break (pairs with 20m candidate)
            createInterval('driving', baseTime + 305 * 60000, 120), // 2h driving
        ];

        const infringements = evaluateBreakInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements).toHaveLength(0);
    });

    it('evaluates daily rest infringements when fragmented breaks sum to 9h but lack continuous rest block', () => {
        const baseTime = 1700000000000;
        // 24h window with fragmented 1h breaks and continuous work/driving
        const intervals: ActivityInterval[] = [
            createInterval('driving', baseTime, 120),
            createInterval('breakOrRest', baseTime + 120 * 60000, 60),
            createInterval('driving', baseTime + 180 * 60000, 120),
            createInterval('breakOrRest', baseTime + 300 * 60000, 60),
            createInterval('driving', baseTime + 360 * 60000, 120),
            createInterval('breakOrRest', baseTime + 480 * 60000, 60),
            createInterval('work', baseTime + 540 * 60000, 900), // 15h work to complete 24h
        ];

        const infringements = evaluateRestInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements.length).toBeGreaterThan(0);
        expect(infringements[0]?.category).toBe('dailyRest');
    });

    it('evaluates daily rest infringements when rest in 24h window is less than 9h', () => {
        const baseTime = 1700000000000;
        const intervals: ActivityInterval[] = [
            createInterval('driving', baseTime, 600),
            createInterval('work', baseTime + 600 * 60000, 480),
            createInterval('breakOrRest', baseTime + 1080 * 60000, 240),
            createInterval('work', baseTime + 1320 * 60000, 120),
        ];

        const infringements = evaluateRestInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements.length).toBeGreaterThan(0);
        expect(infringements[0]?.category).toBe('dailyRest');
    });

    it('does not report insufficient daily rest when a qualifying rest is split into two contiguous intervals by a midnight crossing', () => {
        const baseTime = 1700000000000;
        // A genuine 550-minute (9h10m) rest, qualifying on its own, split
        // into a 250-minute and a 300-minute piece by this app's own
        // per-day normalization - each individually short of the
        // 540-minute reduced-rest threshold. `compliance-service.ts`
        // always runs `mergeContiguousActivityIntervals` before this
        // evaluator, so that is exercised here too.
        const intervals: readonly ActivityInterval[] = mergeContiguousActivityIntervals([
            createInterval('driving', baseTime, 500),
            createInterval('breakOrRest', baseTime + 500 * 60000, 250),
            createInterval('breakOrRest', baseTime + 750 * 60000, 300),
            createInterval('driving', baseTime + 1050 * 60000, 500),
        ]);

        const infringements = evaluateRestInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements.some((i) => i.ruleId === 'DAILY_REST_INSUFFICIENT')).toBe(false);
    });

    it('still reports insufficient daily rest when contiguous breakOrRest intervals fall short of the threshold even combined', () => {
        const baseTime = 1700000000000;
        // Same shape as above, but the two pieces only sum to 500 minutes
        // (8h20m) - genuinely short of the 540-minute threshold even once
        // merged.
        const intervals: readonly ActivityInterval[] = mergeContiguousActivityIntervals([
            createInterval('driving', baseTime, 500),
            createInterval('breakOrRest', baseTime + 500 * 60000, 250),
            createInterval('breakOrRest', baseTime + 750 * 60000, 250),
            createInterval('driving', baseTime + 1000 * 60000, 500),
        ]);

        const infringements = evaluateRestInfringements(intervals, EU_561_2006_STANDARD);
        const finding = infringements.find((i) => i.ruleId === 'DAILY_REST_INSUFFICIENT');
        expect(finding).toBeDefined();
        // Reduced rest is permitted (first reduction in period): allowed is 540, measured is 500, deficit is 40.
        expect(finding?.allowedValueMinutes).toBe(540);
        expect(finding?.measuredValueMinutes).toBe(500);
        expect(finding?.excessOrDeficitMinutes).toBe(40);
    });

    it('measures daily rest deficit against 11h regular rest when reductions are exhausted', () => {
        const baseTime = 1700000000000;
        // 3 shifts with reduced rests (540m each, consuming the 3 allowed reductions),
        // followed by a 4th shift with an insufficient 8h rest (480m).
        const intervals: ActivityInterval[] = [];
        let t = baseTime;
        for (let s = 0; s < 3; s++) {
            intervals.push(createInterval('driving', t, 9 * 60)); // 9h drive
            t += 9 * 60 * 60000;
            intervals.push(createInterval('breakOrRest', t, 9 * 60)); // 9h reduced rest
            t += 9 * 60 * 60000;
        }
        // 4th shift: reductions exhausted, driver rests 8h (480m).
        intervals.push(createInterval('driving', t, 8 * 60));
        t += 8 * 60 * 60000;
        intervals.push(createInterval('breakOrRest', t, 8 * 60)); // 8h rest
        t += 8 * 60 * 60000;
        intervals.push(createInterval('work', t, 8 * 60)); // ensures window is fully covered

        const infringements = evaluateRestInfringements(intervals, EU_561_2006_STANDARD);
        const insufficientFinding = infringements.find((i) => i.ruleId === 'DAILY_REST_INSUFFICIENT');
        expect(insufficientFinding).toBeDefined();
        // Since reductions are exhausted, required rest is 660 (11h), measured is 480, deficit is 180 (660 - 480 = 180).
        expect(insufficientFinding?.allowedValueMinutes).toBe(660);
        expect(insufficientFinding?.measuredValueMinutes).toBe(480);
        expect(insufficientFinding?.excessOrDeficitMinutes).toBe(180);
    });

    it('credits a qualifying rest that immediately precedes duty resuming after a multi-day recording gap, instead of a blind spot no window ever scans (real-world file reproduction)', () => {
        // A driver card with no recorded evidence at all for several days
        // (card not in a vehicle, vehicle unused, etc.) is a normal,
        // common shape - not itself a violation this evaluator can speak
        // to. When data resumes with a fully qualifying rest immediately
        // followed by driving, that rest must count: it is recorded
        // evidence sitting right before the driving interval that would
        // otherwise anchor a new cycle, not part of the undocumented gap.
        // A forward-only window scan starting exactly at that driving
        // interval can never see it, since it looks only at what comes
        // after, not immediately before - reproduces a real "23h57m rest,
        // then 3 minutes of driving" false "Insufficient Daily Rest"
        // finding found in a real tachograph file.
        const baseTime = new Date('2026-06-15T00:00:00Z').getTime();
        const threeDayGap = 3 * 24 * 60;
        const intervals: ActivityInterval[] = [
            createInterval('breakOrRest', baseTime + threeDayGap * 60000, 600), // 10h qualifying rest right after the gap
            createInterval('driving', baseTime + (threeDayGap + 600) * 60000, 60), // duty resumes
            createInterval('breakOrRest', baseTime + (threeDayGap + 660) * 60000, 600), // another qualifying rest, so the cycle closes out cleanly
        ];

        const infringements = evaluateRestInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements.some((i) => i.ruleId === 'DAILY_REST_INSUFFICIENT')).toBe(false);
    });

    it('still reports insufficient rest when the period immediately preceding a post-gap duty resumption falls short of the qualifying threshold', () => {
        // Same shape as above, but the rest right before driving resumes
        // is only 3 hours - genuinely insufficient, so crediting it must
        // not become over-eager and excuse a real violation. Extends well
        // past the 24h window with no further qualifying rest, so the
        // document conclusively covers the window (otherwise the deficit
        // is presumed to be an incomplete download, not a violation).
        const baseTime = new Date('2026-06-15T00:00:00Z').getTime();
        const threeDayGap = 3 * 24 * 60;
        const intervals: ActivityInterval[] = [
            createInterval('breakOrRest', baseTime + threeDayGap * 60000, 180), // only 3h
            createInterval('driving', baseTime + (threeDayGap + 180) * 60000, 60),
            createInterval('work', baseTime + (threeDayGap + 240) * 60000, 60 * 24), // fills well past the 24h window
        ];

        const infringements = evaluateRestInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements.some((i) => i.ruleId === 'DAILY_REST_INSUFFICIENT')).toBe(true);
    });

    it('reports insufficient daily rest for a cycle that gets zero rest of its own, even when the immediately preceding cycle closed with a fully qualifying rest', () => {
        // Regression test for a bug where the rest that closed the
        // *previous* cycle was also credited toward this cycle's own Art.
        // 8(2) obligation (since it sits immediately before this cycle's
        // duty interval). One rest must never satisfy two different 24h
        // windows: a shift that gets no rest of its own must be flagged,
        // no matter how good the driver's rest was before that shift began.
        const baseTime = new Date('2026-06-15T00:00:00Z').getTime();
        const intervals: ActivityInterval[] = [
            createInterval('driving', baseTime, 8 * 60), // 8h drive, closes with a qualifying rest
            createInterval('breakOrRest', baseTime + 8 * 60 * 60000, 11 * 60), // 11h regular rest
            // 24h of continuous work immediately after, with zero rest of its own.
            createInterval('work', baseTime + 19 * 60 * 60000, 24 * 60),
            // Enough further evidence that the 24h window this cycle owns is conclusively covered.
            createInterval('breakOrRest', baseTime + 43 * 60 * 60000, 11 * 60),
        ];

        const infringements = evaluateRestInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements.some((i) => i.ruleId === 'DAILY_REST_INSUFFICIENT')).toBe(true);
    });

    it("anchors the next cycle on a genuine in-window rest, not on the prior cycle's already-credited closing rest", () => {
        // The prior cycle's closing rest and a genuine new rest inside the
        // current cycle's own window can both be present. The evaluator
        // must anchor the next cycle on the real new rest (progressing
        // forward), not fall back to treating the old, already-used rest as
        // if it were this cycle's evidence too.
        const baseTime = new Date('2026-06-15T00:00:00Z').getTime();
        const intervals: ActivityInterval[] = [
            createInterval('driving', baseTime, 8 * 60), // closes previous cycle
            createInterval('breakOrRest', baseTime + 8 * 60 * 60000, 11 * 60), // 11h regular rest
            createInterval('driving', baseTime + 19 * 60 * 60000, 4 * 60), // this cycle's own duty
            createInterval('breakOrRest', baseTime + 23 * 60 * 60000, 11 * 60), // this cycle's own qualifying rest
            createInterval('driving', baseTime + 34 * 60 * 60000, 4 * 60),
            createInterval('breakOrRest', baseTime + 38 * 60 * 60000, 11 * 60),
        ];

        const infringements = evaluateRestInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements.some((i) => i.ruleId === 'DAILY_REST_INSUFFICIENT')).toBe(false);
    });

    it('carries the full end of a qualifying rest longer than the current window forward as the next cycle anchor, instead of the window-clipped end (real-world file reproduction)', () => {
        // A rest can genuinely be longer than fits inside the 24h window
        // it is first observed from (e.g. a long duty period already ate
        // into the window before the rest began). The scan clips that
        // rest's *duration* to the window for this cycle's own threshold
        // check - correctly, that is all this cycle can credit - but the
        // rest's real end is still recorded evidence: it must anchor the
        // *next* cycle, not the artificial window boundary. Anchoring at
        // the clipped boundary instead loses credit for the remaining
        // portion of the same rest, which nothing ever re-scans (the
        // interval's own array index has already been consumed),
        // producing a false "Insufficient Daily Rest" once duty resumes,
        // even though the driver was within the same, long enough rest
        // the whole time. Reproduces a real "15h32m rest clipped at a
        // prior window boundary, then falsely insufficient rest reported
        // when duty resumed" finding found in a real tachograph file.
        //
        // Every rest below is kept under 24h (the weekly-rest threshold)
        // so it stays a *daily*-rest concern and is not instead pulled out
        // as a weekly-rest partition boundary, which would sidestep this
        // evaluator's own cycle-anchor logic entirely.
        const baseTime = new Date('2026-06-15T00:00:00Z').getTime();
        const hour = 60;
        const intervals: ActivityInterval[] = [
            createInterval('driving', baseTime, 60), // T+0h to T+1h
            createInterval('breakOrRest', baseTime + 1 * hour * 60000, 10 * hour), // T+1h to T+11h - a clean, unclipped qualifying rest, anchoring the next cycle at T+11h
            createInterval('driving', baseTime + 11 * hour * 60000, 12 * hour), // T+11h to T+23h - a long duty period eating into the next 24h window (closes at T+35h)
            createInterval('breakOrRest', baseTime + 23 * hour * 60000, 20 * hour), // T+23h to T+43h - qualifies (12h fits before the T+35h window close), but is clipped there; true end is T+43h
            createInterval('driving', baseTime + 43 * hour * 60000, 8 * hour), // duty resumes exactly when the rest truly ends, T+43h to T+51h
            createInterval('breakOrRest', baseTime + 51 * hour * 60000, 20 * hour), // T+51h to T+71h
        ];

        // With the clipped (buggy) anchor at T+35h, the next window closes
        // at T+59h, clipping the final rest to only 8h (T+51h to T+59h) -
        // short of the 9h threshold. With the true end (T+43h) as the
        // anchor, the window closes at T+67h, capturing 16h of the same
        // rest - comfortably qualifying. Only the anchor placement differs
        // between the two outcomes.
        const infringements = evaluateRestInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements.some((i) => i.ruleId === 'DAILY_REST_INSUFFICIENT')).toBe(false);
    });

    it('does not let a small, non-qualifying rest immediately preceding a duty period narrow that window, hiding a genuinely qualifying rest later in it (real-world file reproduction)', () => {
        // A rest interval immediately preceding a duty period is credited
        // as an extra candidate, but must never change the
        // window's own boundaries - an earlier version of this fix moved
        // the window's start back to match that preceding rest whenever
        // the anchor was stale, which was correct only when the preceding
        // rest was itself large enough to qualify. When it is too small
        // (as here, 5h), moving the window earlier only shrinks how far
        // into the future it reaches, which can turn a rest that
        // genuinely does qualify - because enough of it falls inside the
        // *correct* 24h window - into one that appears not to, purely
        // because the window closed 5 hours too early. Once that
        // mis-anchored window fails, the wrong anchor also carries into
        // every later cycle, compounding indefinitely (found against a
        // real tachograph file, where it produced a cascade of false
        // "Insufficient Daily Rest" findings for the rest of the
        // document).
        const baseTime = new Date('2026-06-15T00:00:00Z').getTime();
        const hour = 60;
        const intervals: ActivityInterval[] = [
            createInterval('breakOrRest', baseTime, 5 * hour), // 5h, non-qualifying, immediately precedes duty
            createInterval('driving', baseTime + 5 * hour * 60000, 60), // duty resumes at T+5h
            createInterval('breakOrRest', baseTime + (5 + 14) * hour * 60000, 15 * hour), // starts T+19h (14h after duty resumed) - 15h long
        ];

        // The qualifying rest starts 14h after duty resumed, so it must be
        // measured against a window that runs the full 24h from when duty
        // *actually* resumed (T+5h to T+29h): 10h of it falls inside that
        // window - qualifying. Anchored 5h too early instead (T to T+24h,
        // matching the small preceding rest's own start), only 5h of it
        // would fall inside - falsely insufficient.
        const infringements = evaluateRestInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements.some((i) => i.ruleId === 'DAILY_REST_INSUFFICIENT')).toBe(false);
    });

    it('anchors the daily-rest window to the end of the previous rest, not to when duty resumes (Regulation (EC) No 561/2006 Art. 8(2))', () => {
        const baseTime = new Date('2026-06-15T00:00:00Z').getTime(); // Monday
        const intervals: ActivityInterval[] = [
            createInterval('driving', baseTime, 60), // Mon 00:00-01:00
            createInterval('breakOrRest', baseTime + 60 * 60000, 660), // regular rest, Mon 01:00-12:00
            createInterval('availability', baseTime + 720 * 60000, 600), // 10h availability, Mon 12:00-22:00
            createInterval('driving', baseTime + 1320 * 60000, 60), // duty resumes Mon 22:00-23:00
            createInterval('breakOrRest', baseTime + 2220 * 60000, 540), // 9h rest, Tue 13:00-22:00
        ];

        // The next rest starts at Tue 13:00 — after the true 24h deadline
        // (Mon 12:00 rest-end + 24h = Tue 12:00) but before the deadline a
        // buggy evaluator would compute from when duty resumed instead
        // (Mon 22:00 + 24h = Tue 22:00). Anchoring to duty-resumption would
        // count this rest as a compliant reduced rest and miss the
        // violation entirely.
        const infringements = evaluateRestInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements.some((i) => i.ruleId === 'DAILY_REST_INSUFFICIENT')).toBe(true);
    });

    it('restarts the rest-window anchor from the next evidence after a gap wider than one window, instead of extrapolating extra violations', () => {
        const baseTime = new Date('2026-06-15T00:00:00Z').getTime(); // Monday
        const intervals: ActivityInterval[] = [
            createInterval('driving', baseTime, 60), // Mon 00:00-01:00
            createInterval('breakOrRest', baseTime + 60 * 60000, 660), // regular rest, Mon 01:00-12:00
            // 5-day gap with no recorded evidence at all before duty resumes.
            createInterval('driving', baseTime + 5 * 24 * 60 * 60000 + 8 * 3600000, 60), // Sat 08:00-09:00
            createInterval('breakOrRest', baseTime + 5 * 24 * 60 * 60000 + 9 * 3600000, 660), // regular rest, Sat 09:00-20:00
        ];

        const infringements = evaluateRestInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements.some((i) => i.ruleId === 'DAILY_REST_INSUFFICIENT')).toBe(false);
    });

    it('credits the part of a weekly rest inside the 24h window as the preceding cycle daily rest (Art. 8(3))', () => {
        const cycleStart = new Date('2026-06-15T06:00:00Z').getTime(); // Monday 06:00, end of the previous weekly rest
        const weeklyRest = (start: number): ActivityInterval => createInterval('breakOrRest', start, 45 * 60);
        const evaluate = (workMinutes: number): readonly IInfringement[] =>
            evaluateDailyRestCompliance(
                [
                    weeklyRest(cycleStart - 45 * 3600000),
                    createInterval('work', cycleStart, workMinutes),
                    weeklyRest(cycleStart + workMinutes * 60000),
                ],
                EU_561_2006_STANDARD,
            ).infringements.filter((i) => i.ruleId === 'DAILY_REST_INSUFFICIENT');

        // 16h of work leaves exactly 8h of the weekly rest inside the window: 60 minutes short of the 9h reduced rest.
        const eightHours = evaluate(16 * 60);
        expect(eightHours).toHaveLength(1);
        expect(eightHours[0]?.measuredValueMinutes).toBe(480);
        expect(eightHours[0]?.excessOrDeficitMinutes).toBe(60);
        expect(eightHours[0]?.severity).toBe('minor');

        const justUnderEightHours = evaluate(16 * 60 + 1);
        expect(justUnderEightHours[0]?.measuredValueMinutes).toBe(479);
        expect(justUnderEightHours[0]?.severity).toBe('serious');

        // 13h of work leaves 11h of the weekly rest inside the window, a full regular daily rest.
        expect(evaluate(13 * 60)).toHaveLength(0);
    });

    it('classifies insufficient daily rest against the 11h regular band once reductions are used up', () => {
        const hour = 3600000;
        const weeklyRestEnd = new Date('2026-06-15T06:00:00Z').getTime(); // Monday 06:00
        const intervals: ActivityInterval[] = [createInterval('breakOrRest', weeklyRestEnd - 45 * hour, 45 * 60)];
        // Three 24h cycles of 14h work + 10h reduced rest use every Art. 8(4) reduction.
        for (let cycle = 0; cycle < 3; cycle++) {
            const start = weeklyRestEnd + cycle * 24 * hour;
            intervals.push(createInterval('work', start, 14 * 60), createInterval('breakOrRest', start + 14 * hour, 10 * 60));
        }
        // Fourth cycle: 14h work, then 8h45 rest, then work again past the window end so the cycle is complete.
        const fourthStart = weeklyRestEnd + 3 * 24 * hour;
        intervals.push(
            createInterval('work', fourthStart, 14 * 60),
            createInterval('breakOrRest', fourthStart + 14 * hour, 8 * 60 + 45),
            createInterval('work', fourthStart + 22.75 * hour, 120),
        );

        const fourthCycle = evaluateDailyRestCompliance(intervals, EU_561_2006_STANDARD).infringements.find(
            (i) => i.ruleId === 'DAILY_REST_INSUFFICIENT' && i.id === `daily-rest-${String(fourthStart)}`,
        );
        expect(fourthCycle?.allowedValueMinutes).toBe(660);
        expect(fourthCycle?.excessOrDeficitMinutes).toBe(135);
        // Annex I row 16: 8h30 <= rest < 10h is serious; the 9h reduced-rest band would wrongly say very serious.
        expect(fourthCycle?.severity).toBe('serious');
    });

    it('evaluates Directive 2002/15/EC continuous working time breaks (6h without 30m break)', () => {
        const baseTime = 1700000000000;
        // 4h driving + 3h other work = 7h continuous work without break
        const intervals: ActivityInterval[] = [
            createInterval('driving', baseTime, 240),
            createInterval('work', baseTime + 240 * 60000, 180),
        ];

        const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME);
        expect(infringements.length).toBeGreaterThan(0);
        expect(infringements[0]?.category).toBe('workingTime');
        expect(infringements[0]?.ruleId).toBe('WORKING_TIME_BREAK_6H');
        expect(infringements[0]?.allowedValueMinutes).toBe(360);
        expect(infringements[0]?.measuredValueMinutes).toBe(420);
    });

    it('evaluates Directive 2002/15/EC 60h maximum weekly working time limit', () => {
        // Monday 00:00 UTC (1700092800000 is Monday 2023-11-16 00:00:00 UTC)
        const mondayUtc = new Date('2026-06-15T00:00:00Z').getTime();
        // 5 days of 13h work = 65h working time in one week
        const intervals: ActivityInterval[] = [];
        for (let day = 0; day < 5; day++) {
            const dayStart = mondayUtc + day * 24 * 3600 * 1000 + 6 * 3600 * 1000;
            intervals.push(createInterval('driving', dayStart, 540)); // 9h driving
            intervals.push(createInterval('work', dayStart + 540 * 60000, 240)); // 4h work (total 13h)
        }

        const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME);
        const weeklyInfringements = infringements.filter((i) => i.ruleId === 'WORKING_TIME_WEEKLY_LIMIT_60H');
        expect(weeklyInfringements).toHaveLength(1);
        expect(weeklyInfringements[0]?.measuredValueMinutes).toBe(65 * 60);
        expect(weeklyInfringements[0]?.excessOrDeficitMinutes).toBe(5 * 60);
    });

    it('detects a night-work violation whose 24h window falls between two sparse jump-anchored windows, not just at a shift boundary', () => {
        const mondayUtc = new Date('2026-06-15T00:00:00Z').getTime();
        // Shift A (00:00-02:00) and interval C (20:00-22:00, same day) both
        // fall inside Shift A's own 24h window, so anchoring only at Shift A
        // sees a compliant 4h total and never reaches Shift B (day 2,
        // 01:00-10:00, 9h, touching the 00:00-04:00 night window), which
        // starts just past that window. A jump-based scan that skips
        // straight from Shift A's anchor to Shift B's anchor (since C never
        // gets its own turn as an anchor) never checks the window starting
        // at C - which combines C (2h) with the whole of Shift B (9h) for a
        // real 11h/24h night-work breach.
        const intervals: ActivityInterval[] = [
            createInterval('driving', mondayUtc, 120),
            createInterval('driving', mondayUtc + 20 * 3600 * 1000, 120),
            createInterval('driving', mondayUtc + 25 * 3600 * 1000, 540),
        ];

        const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME);
        const nightInfringements = infringements.filter((i) => i.ruleId === 'NIGHT_WORK_DAILY_LIMIT_10H');
        expect(nightInfringements).toHaveLength(1);
        expect(nightInfringements[0]?.measuredValueMinutes).toBe(660);
        expect(nightInfringements[0]?.excessOrDeficitMinutes).toBe(60);
        expect(nightInfringements[0]?.recordedAt).toBe(mondayUtc + 20 * 3600 * 1000);
    });

    it('reports each night-work breach that a qualifying daily rest separates', () => {
        const mondayUtc = new Date('2026-06-15T18:00:00Z').getTime();
        // 12h of night work, a full daily rest (11h), then 12h of night work again. The two 24-hour windows are
        // disjoint, so suppressing the second breach would hide a separate statutory duty.
        const intervals: ActivityInterval[] = [
            createInterval('driving', mondayUtc, 720),
            createInterval('breakOrRest', mondayUtc + 12 * 3600 * 1000, 660),
            createInterval('driving', mondayUtc + 23 * 3600 * 1000, 720),
        ];

        const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME);
        const nightInfringements = infringements.filter((i) => i.ruleId === 'NIGHT_WORK_DAILY_LIMIT_10H');
        expect(nightInfringements.map((i) => i.recordedAt)).toEqual([mondayUtc, mondayUtc + 23 * 3600 * 1000]);
        // The first window also reaches the first hour of the second shift, which is the documented 24-hour reading.
        expect(nightInfringements.map((i) => i.measuredValueMinutes)).toEqual([780, 720]);
    });

    it('still collapses night-work anchors that a short break does not separate into separate duties', () => {
        const mondayUtc = new Date('2026-06-15T18:00:00Z').getTime();
        // A 30-minute break is no qualifying daily rest, so both anchors still describe one continuous duty period.
        const intervals: ActivityInterval[] = [
            createInterval('driving', mondayUtc, 120),
            createInterval('breakOrRest', mondayUtc + 2 * 3600 * 1000, 30),
            createInterval('driving', mondayUtc + 2.5 * 3600 * 1000, 660),
        ];

        const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME);
        expect(infringements.filter((i) => i.ruleId === 'NIGHT_WORK_DAILY_LIMIT_10H')).toHaveLength(1);
    });

    it('evaluates Directive 2002/15/EC Article 7 night work 10h ceiling', () => {
        // Shift starts at 02:00 UTC (inside the night window 00:00-04:00) with 11h total work
        const shiftStart = new Date('2026-06-15T02:00:00Z').getTime();
        const intervals: ActivityInterval[] = [
            createInterval('driving', shiftStart, 300), // 5h
            createInterval('breakOrRest', shiftStart + 300 * 60000, 45), // 45m break
            createInterval('work', shiftStart + 345 * 60000, 360), // 6h (total 11h work)
        ];

        const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME);
        const nightInfringements = infringements.filter((i) => i.ruleId === 'NIGHT_WORK_DAILY_LIMIT_10H');
        expect(nightInfringements).toHaveLength(1);
        expect(nightInfringements[0]?.category).toBe('nightWork');
        expect(nightInfringements[0]?.allowedValueMinutes).toBe(600);
        expect(nightInfringements[0]?.measuredValueMinutes).toBe(660);
    });

    it('does not flag night work when the shift avoids the 00:00-04:00 night window', () => {
        const shiftStart = new Date('2026-06-15T06:00:00Z').getTime();
        const intervals: ActivityInterval[] = [createInterval('driving', shiftStart, 660)]; // 11h from 06:00

        const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME);
        expect(infringements.filter((i) => i.ruleId === 'NIGHT_WORK_DAILY_LIMIT_10H')).toHaveLength(0);
    });

    it('classifies a user-configured local night window consistently across the 2026 spring-forward DST transition (Europe/Berlin)', () => {
        const berlinNightWindow: INightWindow = {
            endHour: 5,
            startHour: 1,
            timeZone: 'Europe/Berlin',
        };

        // Local 02:00 Berlin on 2026-03-28 (CET, UTC+1, before the 2026-03-29 transition) = 01:00Z.
        const beforeTransitionStart = new Date('2026-03-28T01:00:00Z').getTime();
        // Local 02:00 Berlin on 2026-03-30 (CEST, UTC+2, after the transition) = 00:00Z.
        const afterTransitionStart = new Date('2026-03-30T00:00:00Z').getTime();

        for (const shiftStart of [beforeTransitionStart, afterTransitionStart]) {
            const intervals: ActivityInterval[] = [createInterval('driving', shiftStart, 660)]; // 11h
            const infringements = evaluateWorkingTimeInfringements(
                intervals,
                DIRECTIVE_2002_15_EC_WORKING_TIME,
                berlinNightWindow,
            );
            expect(infringements.filter((i) => i.ruleId === 'NIGHT_WORK_DAILY_LIMIT_10H')).toHaveLength(1);
        }
    });

    it('classifies a user-configured local night window consistently across the 2026 autumn DST transition (Europe/Berlin)', () => {
        const berlinNightWindow: INightWindow = {
            endHour: 5,
            startHour: 1,
            timeZone: 'Europe/Berlin',
        };

        // Local 02:00 Berlin on 2026-10-24 (CEST, UTC+2, before the 2026-10-25 transition) = 00:00Z.
        const beforeTransitionStart = new Date('2026-10-24T00:00:00Z').getTime();
        // Local 02:00 Berlin on 2026-10-26 (CET, UTC+1, after the transition) = 01:00Z.
        const afterTransitionStart = new Date('2026-10-26T01:00:00Z').getTime();

        for (const shiftStart of [beforeTransitionStart, afterTransitionStart]) {
            const intervals: ActivityInterval[] = [createInterval('driving', shiftStart, 660)]; // 11h
            const infringements = evaluateWorkingTimeInfringements(
                intervals,
                DIRECTIVE_2002_15_EC_WORKING_TIME,
                berlinNightWindow,
            );
            expect(infringements.filter((i) => i.ruleId === 'NIGHT_WORK_DAILY_LIMIT_10H')).toHaveLength(1);
        }
    });

    it('does not flag work outside a user-configured local night window (Europe/Berlin control case)', () => {
        const berlinNightWindow: INightWindow = {
            endHour: 5,
            startHour: 1,
            timeZone: 'Europe/Berlin',
        };
        // Local 08:00-19:00 Berlin on 2026-03-30 (CEST, UTC+2) = 06:00Z, well outside 01:00-05:00 local.
        const shiftStart = new Date('2026-03-30T06:00:00Z').getTime();
        const intervals: ActivityInterval[] = [createInterval('driving', shiftStart, 660)]; // 11h

        const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME, berlinNightWindow);
        expect(infringements.filter((i) => i.ruleId === 'NIGHT_WORK_DAILY_LIMIT_10H')).toHaveLength(0);
    });

    it('detects night work in a configured local night window for zones behind UTC', () => {
        // Each shift starts at 01:00 local on 2026-01-13, inside a configured 01:00-05:00 local window.
        const shiftStarts: readonly (readonly [string, string])[] = [
            ['Atlantic/Azores', '2026-01-13T02:00:00Z'], // UTC-1 in winter
            ['America/New_York', '2026-01-13T06:00:00Z'], // UTC-5
            ['America/Los_Angeles', '2026-01-13T09:00:00Z'], // UTC-8
        ];

        for (const [timeZone, shiftStartIso] of shiftStarts) {
            const intervals: ActivityInterval[] = [createInterval('driving', new Date(shiftStartIso).getTime(), 660)]; // 11h
            const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME, {
                endHour: 5,
                startHour: 1,
                timeZone,
            });
            expect(
                infringements.filter((i) => i.ruleId === 'NIGHT_WORK_DAILY_LIMIT_10H'),
                timeZone,
            ).toHaveLength(1);
        }
    });

    it('detects night work on the next civil day for a shift crossing local midnight behind UTC', () => {
        // 22:00 local New York on 2026-01-12 (03:00Z on the 13th) runs through the 01:00-05:00 window of the 13th.
        const intervals: ActivityInterval[] = [createInterval('driving', new Date('2026-01-13T03:00:00Z').getTime(), 660)];

        const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME, {
            endHour: 5,
            startHour: 1,
            timeZone: 'America/New_York',
        });
        expect(infringements.filter((i) => i.ruleId === 'NIGHT_WORK_DAILY_LIMIT_10H')).toHaveLength(1);
    });

    it('does not flag daytime work outside the configured local night window behind UTC (New York control case)', () => {
        // 08:00-19:00 local New York on 2026-01-13 = 13:00Z, outside 01:00-05:00 local.
        const intervals: ActivityInterval[] = [createInterval('driving', new Date('2026-01-13T13:00:00Z').getTime(), 660)];

        const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME, {
            endHour: 5,
            startHour: 1,
            timeZone: 'America/New_York',
        });
        expect(infringements.filter((i) => i.ruleId === 'NIGHT_WORK_DAILY_LIMIT_10H')).toHaveLength(0);
    });

    it('requires a 45-minute break when total working time exceeds 9 hours even after a 30-minute break', () => {
        const baseTime = new Date('2026-06-15T06:00:00Z').getTime();
        // 4h work + 30m break + 5h30m work = 9h30m total working time with only 30m of breaks.
        const intervals: ActivityInterval[] = [
            createInterval('driving', baseTime, 240),
            createInterval('breakOrRest', baseTime + 240 * 60000, 30),
            createInterval('work', baseTime + 270 * 60000, 330),
        ];

        const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME);
        const nineHourInfringements = infringements.filter((i) => i.ruleId === 'WORKING_TIME_BREAK_9H');
        expect(nineHourInfringements).toHaveLength(1);
        expect(nineHourInfringements[0]?.allowedValueMinutes).toBe(45);
        expect(nineHourInfringements[0]?.measuredValueMinutes).toBe(30);
        expect(nineHourInfringements[0]?.excessOrDeficitMinutes).toBe(15);
        // The earlier 30-minute break satisfies the 6-9h band, so no 6h finding.
        expect(infringements.filter((i) => i.ruleId === 'WORKING_TIME_BREAK_6H')).toHaveLength(0);
    });

    it('resets the consecutive clock on a 15-minute break but still enforces the day-total break bands', () => {
        const baseTime = new Date('2026-06-15T06:00:00Z').getTime();
        // 4h + 15m + 3h = 7h total working time with only 15m of breaks: the
        // 6-9h band requires 30m, so a finding is expected for the day total.
        const intervals: ActivityInterval[] = [
            createInterval('driving', baseTime, 240),
            createInterval('breakOrRest', baseTime + 240 * 60000, 15),
            createInterval('work', baseTime + 255 * 60000, 180),
        ];

        const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME);
        expect(infringements).toHaveLength(1);
        expect(infringements[0]?.ruleId).toBe('WORKING_TIME_BREAK_6H');
        expect(infringements[0]?.allowedValueMinutes).toBe(30);
        expect(infringements[0]?.measuredValueMinutes).toBe(15);
        expect(infringements[0]?.excessOrDeficitMinutes).toBe(15);
    });

    it('does not flag the 6h band when a later same-day 15-minute break completes the 30-minute requirement (Directive 2002/15/EC Art. 5(2))', () => {
        const baseTime = new Date('2026-06-15T06:00:00Z').getTime();
        // 4h work + 15m break + ~2h10m work (day total crosses 6h with only
        // 15m of break accumulated so far) + a second 15m break later that
        // same day, completing the legally sufficient 30m split total.
        const intervals: ActivityInterval[] = [
            createInterval('driving', baseTime, 240),
            createInterval('breakOrRest', baseTime + 240 * 60000, 15),
            createInterval('work', baseTime + 255 * 60000, 130), // day total: 370m (> 360)
            createInterval('breakOrRest', baseTime + 385 * 60000, 15), // day break total: 30m
        ];

        const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME);
        expect(infringements.filter((i) => i.ruleId === 'WORKING_TIME_BREAK_6H')).toHaveLength(0);
    });

    it('still flags the 6h band when the day ends without a curing second break (control case)', () => {
        const baseTime = new Date('2026-06-15T06:00:00Z').getTime();
        const intervals: ActivityInterval[] = [
            createInterval('driving', baseTime, 240),
            createInterval('breakOrRest', baseTime + 240 * 60000, 15),
            createInterval('work', baseTime + 255 * 60000, 130), // day total: 370m, only 15m break
        ];

        const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME);
        const sixHourFindings = infringements.filter((i) => i.ruleId === 'WORKING_TIME_BREAK_6H');
        expect(sixHourFindings).toHaveLength(1);
        expect(sixHourFindings[0]?.allowedValueMinutes).toBe(30);
        expect(sixHourFindings[0]?.measuredValueMinutes).toBe(15);
        expect(sixHourFindings[0]?.excessOrDeficitMinutes).toBe(15);
    });

    it('classifies a consecutive-work breach by the break taken, not by the minutes worked past six hours', () => {
        const baseTime = new Date('2026-06-15T06:00:00Z').getTime();
        // 6h15m in one run with only a 10-minute break afterwards. Annex I section 3 row 6 bands a break of
        // 10 minutes or less as very serious; the 15-minute work excess must not select the tier instead.
        const intervals: ActivityInterval[] = [
            createInterval('work', baseTime, 6 * 60 + 15),
            createInterval('breakOrRest', baseTime + (6 * 60 + 15) * 60000, 10),
        ];

        const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME);
        const findings = infringements.filter((i) => i.ruleId === 'WORKING_TIME_BREAK_6H');
        expect(findings).toHaveLength(1);
        expect(findings[0]?.severity).toBe('verySerious');
    });

    it('keeps a consecutive-work breach with a 20-minute break in the serious band (Annex I section 3 row 5)', () => {
        const baseTime = new Date('2026-06-15T06:00:00Z').getTime();
        const intervals: ActivityInterval[] = [
            createInterval('work', baseTime, 60),
            createInterval('breakOrRest', baseTime + 60 * 60000, 20),
            createInterval('work', baseTime + 80 * 60000, 6 * 60 + 15),
        ];

        const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME);
        const findings = infringements.filter((i) => i.ruleId === 'WORKING_TIME_BREAK_6H');
        expect(findings).toHaveLength(1);
        expect(findings[0]?.severity).toBe('serious');
    });

    it('reports the day-total 45-minute deficit even when an earlier 6h-consecutive violation already fired that day', () => {
        // Regression test: 6h15m worked, a 15-minute break, then 5h more
        // worked (11h15m total that day, only 15m of break). The
        // consecutive-hours rule correctly fires once at the 6h15m mark -
        // but that must not suppress the day's own, separate 45-minute
        // aggregate requirement (>9h worked, only 15m of break taken all
        // day), which was previously silently skipped whenever the day had
        // already been flagged by the consecutive rule.
        const baseTime = new Date('2026-06-15T06:00:00Z').getTime();
        const intervals: ActivityInterval[] = [
            createInterval('driving', baseTime, 6 * 60 + 15), // 6h15m, triggers the consecutive rule
            createInterval('breakOrRest', baseTime + (6 * 60 + 15) * 60000, 15), // only 15m break
            createInterval('work', baseTime + (6 * 60 + 30) * 60000, 5 * 60), // 5h more work
        ];

        const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME);

        const consecutiveFindings = infringements.filter(
            (i) => i.ruleId === 'WORKING_TIME_BREAK_6H' && i.id.startsWith('wt-break-6h-consecutive-'),
        );
        expect(consecutiveFindings).toHaveLength(1);
        // The day exceeds nine hours with 15 minutes of break, so Annex I section 3 row 8 bands both this finding
        // and the 9h aggregate below as very serious: one shortfall must not carry two different tiers.
        expect(consecutiveFindings[0]?.severity).toBe('verySerious');

        const nineHourFindings = infringements.filter((i) => i.ruleId === 'WORKING_TIME_BREAK_9H');
        expect(nineHourFindings).toHaveLength(1);
        expect(nineHourFindings[0]?.allowedValueMinutes).toBe(45);
        expect(nineHourFindings[0]?.measuredValueMinutes).toBe(15);
        expect(nineHourFindings[0]?.excessOrDeficitMinutes).toBe(30);
        // Annex I section 3 row 8: a break of 20 minutes or less over nine hours of work is very serious.
        expect(nineHourFindings[0]?.severity).toBe('verySerious');

        // The 6-9h aggregate band shares its rule id with the consecutive
        // rule, so it must still be suppressed for this day (avoiding a
        // confusing same-rule-id duplicate), unlike the >9h band above.
        const dayAggregateSixHourFindings = infringements.filter(
            (i) => i.ruleId === 'WORKING_TIME_BREAK_6H' && i.id.startsWith('wt-break-6h-day-'),
        );
        expect(dayAggregateSixHourFindings).toHaveLength(0);
    });

    it('measures break deficit against the 45-minute requirement when working time exceeds 9 hours', () => {
        const baseTime = new Date('2026-06-15T06:00:00Z').getTime();
        // 4h driving + 20m break + 6h work (10h work total > 9h, with only 20m break < 45m).
        const intervals: ActivityInterval[] = [
            createInterval('driving', baseTime, 240),
            createInterval('breakOrRest', baseTime + 240 * 60000, 20),
            createInterval('work', baseTime + 260 * 60000, 360),
        ];

        const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME);
        const longDayFindings = infringements.filter((i) => i.ruleId === 'WORKING_TIME_BREAK_9H');
        expect(longDayFindings).toHaveLength(1);
        expect(longDayFindings[0]?.allowedValueMinutes).toBe(45);
        expect(longDayFindings[0]?.measuredValueMinutes).toBe(20);
        expect(longDayFindings[0]?.excessOrDeficitMinutes).toBe(25);
    });

    it('does not flag the 9h band when a later same-day break completes the 45-minute requirement', () => {
        const baseTime = new Date('2026-06-15T06:00:00Z').getTime();
        // 4h work + 30m break (resets the consecutive clock, each work
        // segment stays under 6h so the separate consecutive-hours rule
        // does not also fire) + 5h10m work (day total crosses 9h with only
        // 30m of break so far) + a second 15m break, completing 45m total.
        const intervals: ActivityInterval[] = [
            createInterval('driving', baseTime, 240),
            createInterval('breakOrRest', baseTime + 240 * 60000, 30),
            createInterval('work', baseTime + 270 * 60000, 310), // day total: 550m (> 540)
            createInterval('breakOrRest', baseTime + 580 * 60000, 15), // day break total: 45m
        ];

        const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME);
        expect(infringements.filter((i) => i.ruleId === 'WORKING_TIME_BREAK_9H')).toHaveLength(0);
        expect(infringements.filter((i) => i.ruleId === 'WORKING_TIME_BREAK_6H')).toHaveLength(0);
    });

    it('flags more than 6 consecutive hours of work across a UTC midnight', () => {
        const baseTime = new Date('2026-06-15T20:00:00Z').getTime();
        const intervals: ActivityInterval[] = [
            createInterval('driving', baseTime, 240), // 20:00 - 00:00
            createInterval('work', baseTime + 240 * 60000, 240), // 00:00 - 04:00 (8h consecutive total)
        ];

        const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME);
        expect(infringements.filter((i) => i.ruleId === 'WORKING_TIME_BREAK_6H')).toHaveLength(1);
    });

    it('evaluates a midnight-spanning shift as one working-day period, not split into two understated UTC-day totals', () => {
        // A single work interval - already merged, since the real pipeline
        // never hands this evaluator an unmerged one - runs 23:00 (day 1)
        // to 08:00 (day 2), exactly 9 hours, no break anywhere in it. This
        // is exactly at the >9h boundary (not exceeding it), so only the
        // chronological 6h-consecutive rule should fire - not a spurious
        // 6-9h aggregate finding for whichever UTC-day bucket the shift's
        // tail happened to land in.
        const day1 = new Date('2026-06-15T00:00:00Z').getTime();
        const intervals: ActivityInterval[] = [
            createInterval('work', day1 + 23 * 60 * 60000, 9 * 60), // 23:00 day1 -> 08:00 day2
        ];

        const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME);
        expect(infringements).toHaveLength(1);
        expect(infringements[0]?.id).toMatch(/^wt-break-6h-consecutive-/);
    });

    it('applies the correct 45-minute band to a midnight-spanning shift that truly exceeds 9 hours (regression: previously misclassified as the 30-minute band)', () => {
        // Regression test: this exact scenario (23:00 -> 08:15, 9h15m, no
        // break) previously split into a 1h UTC-day-1 portion and an
        // 8h15m UTC-day-2 portion. Since neither half individually crossed
        // 9 hours, the old day-based bucketing wrongly evaluated it against
        // the weaker 6-9h/30-minute band instead of the correct >9h/45-
        // minute band the true, continuous 9h15m shift requires.
        const day1 = new Date('2026-06-15T00:00:00Z').getTime();
        const intervals: ActivityInterval[] = [
            createInterval('work', day1 + 23 * 60 * 60000, 9 * 60 + 15), // 23:00 day1 -> 08:15 day2
        ];

        const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME);
        const nineHourFinding = infringements.find((i) => i.ruleId === 'WORKING_TIME_BREAK_9H');
        expect(nineHourFinding).toBeDefined();
        expect(nineHourFinding?.allowedValueMinutes).toBe(45);
        expect(nineHourFinding?.measuredValueMinutes).toBe(0);
        expect(nineHourFinding?.excessOrDeficitMinutes).toBe(45);
        // The weaker 6-9h band must not also fire for the same shift.
        expect(infringements.some((i) => i.ruleId === 'WORKING_TIME_BREAK_6H' && i.id.startsWith('wt-break-6h-day-'))).toBe(
            false,
        );
    });

    it('excludes periods of availability from working time (Directive 2002/15/EC Art. 3(a)-(b))', () => {
        const baseTime = 1700000000000;
        const intervals: ActivityInterval[] = [
            createInterval('driving', baseTime, 240),
            createInterval('availability', baseTime + 240 * 60000, 180), // excluded: not working time
        ];

        const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME);
        // Only 4h of genuine working time (driving) was recorded; the 3h of
        // availability must not push the total past the 6h break threshold.
        expect(infringements.filter((i) => i.ruleId === 'WORKING_TIME_BREAK_6H')).toHaveLength(0);
    });

    it('still flags the 6h break threshold when genuine working time (not availability) exceeds it', () => {
        const baseTime = 1700000000000;
        const intervals: ActivityInterval[] = [
            createInterval('driving', baseTime, 240),
            createInterval('availability', baseTime + 240 * 60000, 180), // excluded: not working time
            createInterval('work', baseTime + 420 * 60000, 180), // 4h + 3h = 7h genuine working time
        ];

        const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME);
        const breachFindings = infringements.filter((i) => i.ruleId === 'WORKING_TIME_BREAK_6H');
        expect(breachFindings).toHaveLength(1);
        expect(breachFindings[0]?.allowedValueMinutes).toBe(360);
        expect(breachFindings[0]?.measuredValueMinutes).toBe(420);
        expect(breachFindings[0]?.excessOrDeficitMinutes).toBe(60);
    });

    it('evaluates the 48h average weekly working time over the reference period', () => {
        const mondayUtc = new Date('2026-06-15T00:00:00Z').getTime();
        const intervals: ActivityInterval[] = [];
        // Week 1: 60h (valid absolute max, drives the average up).
        for (let day = 0; day < 5; day++) {
            const dayStart = mondayUtc + day * 24 * 3600 * 1000 + 6 * 3600 * 1000;
            intervals.push(createInterval('driving', dayStart, 720)); // 12h x 5 = 60h
        }
        // Week 2: 20h.
        const secondMondayUtc = mondayUtc + 7 * 24 * 3600 * 1000;
        for (let day = 0; day < 2; day++) {
            const dayStart = secondMondayUtc + day * 24 * 3600 * 1000 + 6 * 3600 * 1000;
            intervals.push(createInterval('work', dayStart, 600)); // 10h x 2 = 20h
        }

        const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME);
        const averageInfringements = infringements.filter((i) => i.ruleId === 'WORKING_TIME_WEEKLY_AVERAGE_48H');
        // (60h + 20h) / 2 = 40h average: no 48h-average finding. Exactly 60h
        // in a single week is not above the absolute 60h maximum.
        expect(averageInfringements).toHaveLength(0);
        expect(infringements.filter((i) => i.ruleId === 'WORKING_TIME_WEEKLY_LIMIT_60H')).toHaveLength(0);

        // Week 3: 60h again => trailing two-week averages: (60+20)/2=40h,
        // then (20+60)/2=40h: still no finding.
        const thirdMondayUtc = secondMondayUtc + 7 * 24 * 3600 * 1000;
        for (let day = 0; day < 5; day++) {
            const dayStart = thirdMondayUtc + day * 24 * 3600 * 1000 + 6 * 3600 * 1000;
            intervals.push(createInterval('driving', dayStart, 720));
        }
        const extendedInfringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME);
        expect(extendedInfringements.filter((i) => i.ruleId === 'WORKING_TIME_WEEKLY_AVERAGE_48H')).toHaveLength(0);
    });

    it('flags the 48h average once a full 17-week reference period of 50h weeks has elapsed', () => {
        const mondayUtc = new Date('2026-06-15T00:00:00Z').getTime();
        const intervals: ActivityInterval[] = [];
        // A full 17-week (the configured reference period) run of 50h
        // weeks: average 50h > 48h.
        for (let week = 0; week < 17; week++) {
            const weekStart = mondayUtc + week * 7 * 24 * 3600 * 1000;
            for (let day = 0; day < 5; day++) {
                const dayStart = weekStart + day * 24 * 3600 * 1000 + 6 * 3600 * 1000;
                intervals.push(createInterval('driving', dayStart, 600)); // 10h x 5 = 50h
            }
        }

        const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME);
        const averageInfringements = infringements.filter((i) => i.ruleId === 'WORKING_TIME_WEEKLY_AVERAGE_48H');
        expect(averageInfringements).toHaveLength(1);
        expect(averageInfringements[0]?.measuredValueMinutes).toBe(50 * 60);
        expect(averageInfringements[0]?.excessOrDeficitMinutes).toBe(2 * 60);
        expect(averageInfringements[0]?.legalReference.article).toBe('Art. 4(a)');
    });

    it('counts a real zero-work week inside a full reference period towards the average denominator', () => {
        const mondayUtc = new Date('2026-06-15T00:00:00Z').getTime();
        const intervals: ActivityInterval[] = [];
        // 16 weeks of 52h plus one real zero-work week inside the 17-week
        // reference period: (16 x 52h) / 17 weeks ≈ 48.94h > 48h. If the
        // zero week were dropped from the denominator instead of counted,
        // this would incorrectly average to a flat 52h.
        for (let week = 0; week < 17; week++) {
            if (week === 8) {
                continue;
            }
            const weekStart = mondayUtc + week * 7 * 24 * 3600 * 1000;
            for (let day = 0; day < 5; day++) {
                const dayStart = weekStart + day * 24 * 3600 * 1000 + 6 * 3600 * 1000;
                intervals.push(createInterval('driving', dayStart, 624)); // 10h24m x 5 = 52h
            }
        }

        const infringements = evaluateWorkingTimeInfringements(intervals, DIRECTIVE_2002_15_EC_WORKING_TIME);
        const averageInfringements = infringements.filter((i) => i.ruleId === 'WORKING_TIME_WEEKLY_AVERAGE_48H');
        expect(averageInfringements).toHaveLength(1);
        // True average is 49920/17 = 2936.47m; measured/excess round up
        // (never down) so a genuine breach can never report a zero or
        // understated excess at a fractional-minute boundary.
        expect(averageInfringements[0]?.measuredValueMinutes).toBe(2937);
        expect(averageInfringements[0]?.excessOrDeficitMinutes).toBe(57);
    });

    it('does not flag the 48h average from just two observed weeks separated by an unrecorded gap', () => {
        const mondayUtc = new Date('2026-06-15T00:00:00Z').getTime();
        // Audit repro: 60h in week 1, no recorded activity for the next 15
        // calendar weeks, then 60h in week 17. The two 60h weeks must not
        // become each other's only neighbour and average as if adjacent —
        // the full 17-week reference period contains 15 real zero-work
        // weeks that must count towards the denominator.
        const week1Start = mondayUtc;
        const week1: ActivityInterval[] = [];
        for (let day = 0; day < 5; day++) {
            week1.push(createInterval('driving', week1Start + day * 24 * 3600 * 1000 + 6 * 3600 * 1000, 720));
        }
        const week17Start = mondayUtc + 16 * 7 * 24 * 3600 * 1000;
        const week17: ActivityInterval[] = [];
        for (let day = 0; day < 5; day++) {
            week17.push(createInterval('driving', week17Start + day * 24 * 3600 * 1000 + 6 * 3600 * 1000, 720));
        }

        const infringements = evaluateWorkingTimeInfringements([...week1, ...week17], DIRECTIVE_2002_15_EC_WORKING_TIME);
        expect(infringements.filter((i) => i.ruleId === 'WORKING_TIME_WEEKLY_AVERAGE_48H')).toHaveLength(0);
    });

    it('does not apply the ferry rest derogation without ferry/train evidence', () => {
        const baseTime = 1700000000000;
        // Interrupted rest (4h + 5h + 3h = 12h total, two short work gaps):
        // the tachograph activity stream carries no ferry/train indicator, so
        // the rest cannot be accepted under Art. 9 and the day is flagged.
        const intervals = createInterruptedRestIntervals(baseTime);

        const infringements = evaluateRestInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements.some((i) => i.category === 'dailyRest')).toBe(true);
    });

    it('flags a possible ferry/train derogation as a review assessment, alongside the infringement it does not suppress (Art. 9(1))', () => {
        const baseTime = 1700000000000;
        // Same interrupted-rest shape as the previous test (4h + 5h + 3h =
        // 12h combined, two short driving gaps totalling 35 minutes, within
        // Art. 9(1)'s "at most two interruptions, one hour in total" for a
        // regular daily rest) - this evaluator cannot tell this apart from a
        // genuine ferry/train crossing using activity data alone, so both
        // conclusions must hold at once: the infringement is never silently
        // dropped, and a reviewer is told the pattern could be legally fine
        // if ferry/train evidence exists outside this file.
        const intervals = createInterruptedRestIntervals(baseTime);

        const result = evaluateDailyRestCompliance(intervals, EU_561_2006_STANDARD);
        expect(result.infringements.some((i) => i.category === 'dailyRest')).toBe(true);
        expect(result.assessments.some((a) => a.ruleId === 'DAILY_REST_FERRY_TRAIN_INTERRUPTION_REVIEW')).toBe(true);
    });

    it('does not flag a ferry/train derogation assessment when the interruption exceeds one hour in total', () => {
        const baseTime = 1700000000000;
        // Same combined duration and interruption count as the previous
        // test, but the second gap is 61 minutes - the two interruptions
        // together exceed Art. 9(1)'s one-hour total, so this cannot be a
        // qualifying ferry/train pattern regardless of evidence.
        const intervals: ActivityInterval[] = [
            createInterval('driving', baseTime, 480),
            createInterval('breakOrRest', baseTime + 480 * 60000, 240),
            createInterval('driving', baseTime + 720 * 60000, 20),
            createInterval('breakOrRest', baseTime + 740 * 60000, 300),
            createInterval('driving', baseTime + 1040 * 60000, 61),
            createInterval('breakOrRest', baseTime + 1101 * 60000, 180),
        ];

        const result = evaluateDailyRestCompliance(intervals, EU_561_2006_STANDARD);
        expect(result.assessments.some((a) => a.ruleId === 'DAILY_REST_FERRY_TRAIN_INTERRUPTION_REVIEW')).toBe(false);
    });

    it('resets the reduced daily-rest counter at a weekly rest boundary', () => {
        const mondayUtc = new Date('2026-06-15T00:00:00Z').getTime();
        const intervals: ActivityInterval[] = [];
        // Week 1: 3 reduced daily rests (9h each) separated by work.
        for (let day = 0; day < 3; day++) {
            const dayStart = mondayUtc + day * 24 * 3600 * 1000 + 6 * 3600 * 1000;
            intervals.push(createInterval('driving', dayStart, 600));
            intervals.push(
                createInterval('breakOrRest', dayStart + 600 * 60000, 540), // 9h reduced rest
            );
        }
        // Full weekly rest (45h) from Friday evening.
        const fridayStart = mondayUtc + 4 * 24 * 3600 * 1000 + 18 * 3600 * 1000;
        intervals.push(createInterval('breakOrRest', fridayStart, 45 * 60));
        // Week 2: 1 more reduced daily rest.
        const nextMondayUtc = mondayUtc + 7 * 24 * 3600 * 1000;
        intervals.push(createInterval('driving', nextMondayUtc + 6 * 3600 * 1000, 600));
        intervals.push(createInterval('breakOrRest', nextMondayUtc + 16 * 3600 * 1000, 540));

        const infringements = evaluateRestInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements.some((i) => i.ruleId === 'DAILY_REST_REDUCTIONS_EXCEEDED')).toBe(false);
    });

    it('does not infer the two-week weekly-rest quota from only one fully covered week', () => {
        const mondayUtc = new Date('2026-06-15T00:00:00Z').getTime();
        // The document window must cover the whole ISO week (Monday 00:00 to
        // Sunday 24:00) before the missing-rest rule applies.
        const intervals = createWeekWithoutWeeklyRest(mondayUtc);
        // Extend the last day so the document window covers Sunday 24:00.
        intervals.push(createInterval('driving', mondayUtc + 6 * 24 * 3600 * 1000 + 18 * 3600 * 1000, 360));

        const infringements = evaluateWeeklyRestInfringements(intervals, EU_561_2006_STANDARD);
        const weeklyRestInsufficient = infringements.find((i) => i.ruleId === 'WEEKLY_REST_INSUFFICIENT');
        expect(weeklyRestInsufficient).toBeUndefined();
    });

    it('accepts a 45h weekly rest in two consecutive weeks', () => {
        const mondayUtc = new Date('2026-06-15T00:00:00Z').getTime();
        const intervals: ActivityInterval[] = [
            createInterval('driving', mondayUtc, 600),
            // Regular weekly rest Friday 18:00 - Sunday 15:00 (45h).
            createInterval('breakOrRest', mondayUtc + 4 * 24 * 3600 * 1000 + 18 * 3600 * 1000, 45 * 60),
            createInterval('driving', mondayUtc + 7 * 24 * 3600 * 1000, 600),
            createInterval('breakOrRest', mondayUtc + 11 * 24 * 3600 * 1000 + 18 * 3600 * 1000, 45 * 60),
        ];

        const infringements = evaluateWeeklyRestInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements).toHaveLength(0);
    });

    it('flags two consecutive weeks without a regular weekly rest', () => {
        const mondayUtc = new Date('2026-06-15T00:00:00Z').getTime();
        const intervals: ActivityInterval[] = [];
        for (let week = 0; week < 2; week++) {
            const weekStart = mondayUtc + week * 7 * 24 * 3600 * 1000;
            // Work from Monday 00:00, reduced weekly rest (30h) Friday 18:00 - Sunday 00:00,
            // then work until Sunday 24:00 so the pair of weeks is fully covered.
            intervals.push(createInterval('driving', weekStart, 600));
            intervals.push(createInterval('breakOrRest', weekStart + 4 * 24 * 3600 * 1000 + 18 * 3600 * 1000, 30 * 60));
            const sundayStart = weekStart + 6 * 24 * 3600 * 1000;
            intervals.push(createInterval('driving', sundayStart, 600));
            // Extend the second week so the pair window covers Sunday 24:00.
            if (week === 1) {
                intervals.push(createInterval('driving', sundayStart + 14 * 3600 * 1000, 600));
            }
        }

        const infringements = evaluateWeeklyRestInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements.some((i) => i.ruleId === 'WEEKLY_REST_REGULAR_MISSING')).toBe(true);
    });

    it('reports a missing second weekly rest as a zero-progress deficit, not an unrelated shorter rest elsewhere in the window', () => {
        const mondayUtc = new Date('2026-06-15T00:00:00Z').getTime();
        // Week 0 has one qualifying 24h rest; week 1 has none at all (only
        // short daily rests, each well under 24h). The pair (week0, week1)
        // has exactly one qualifying rest, so the missing second rest is a
        // complete absence, not a partial one - the measured value must
        // reflect that (0 minutes toward it), not the longest unrelated
        // daily rest found anywhere in the window.
        const intervals: ActivityInterval[] = [
            createInterval('driving', mondayUtc, 600),
            createInterval('breakOrRest', mondayUtc + 4 * 24 * 3600 * 1000 + 18 * 3600 * 1000, 24 * 60),
        ];
        const week1Start = mondayUtc + 7 * 24 * 3600 * 1000;
        for (let day = 0; day < 7; day++) {
            const dayStart = week1Start + day * 24 * 3600 * 1000;
            intervals.push(createInterval('driving', dayStart, 360));
            intervals.push(createInterval('breakOrRest', dayStart + 360 * 60000, 480)); // 8h, non-qualifying
        }
        intervals.push(createInterval('driving', week1Start + 7 * 24 * 3600 * 1000, 60));

        const infringements = evaluateWeeklyRestInfringements(intervals, EU_561_2006_STANDARD);
        const insufficient = infringements.find((i) => i.ruleId === 'WEEKLY_REST_INSUFFICIENT');
        expect(insufficient?.measuredValueMinutes).toBe(0);
        expect(insufficient?.excessOrDeficitMinutes).toBe(1440);
    });

    it('reports one consecutive run of overlapping insufficient-weekly-rest pairs once, but reports a later, separated run as a distinct finding', () => {
        const mondayUtc = new Date('2026-06-15T00:00:00Z').getTime();
        const weekCount = 7;
        // Weeks with a qualifying rest: 0 (24h), 3 (45h), 4 (45h), 5 (45h).
        // Weeks 1, 2, and 6 have none. This produces:
        //  - pair(0,1): 1 rest -> insufficient (start of a run)
        //  - pair(1,2): 0 rests -> insufficient (same run, must be suppressed)
        //  - pair(2,3): 1 rest -> insufficient (same run, must be suppressed)
        //  - pair(3,4): 2 regular rests -> compliant (resets the run)
        //  - pair(4,5): 2 regular rests -> compliant
        //  - pair(5,6): 1 rest -> insufficient (a NEW run - must NOT be
        //    suppressed by the earlier, now-reset run)
        const restMinutesByWeek: Record<number, number> = {
            0: 24 * 60,
            3: 45 * 60,
            4: 45 * 60,
            5: 45 * 60,
        };
        const intervals: ActivityInterval[] = [];
        for (let week = 0; week < weekCount; week++) {
            const weekStart = mondayUtc + week * 7 * 24 * 3600 * 1000;
            intervals.push(createInterval('driving', weekStart, 600));
            const restMinutes = restMinutesByWeek[week];
            if (restMinutes !== undefined) {
                intervals.push(createInterval('breakOrRest', weekStart + 4 * 24 * 3600 * 1000 + 18 * 3600 * 1000, restMinutes));
            }
            intervals.push(createInterval('driving', weekStart + 6 * 24 * 3600 * 1000, 600));
        }
        intervals.push(createInterval('driving', mondayUtc + weekCount * 7 * 24 * 3600 * 1000, 60));

        const infringements = evaluateWeeklyRestInfringements(intervals, EU_561_2006_STANDARD);
        const insufficientFindings = infringements.filter((i) => i.ruleId === 'WEEKLY_REST_INSUFFICIENT');
        expect(insufficientFindings.map((i) => i.id)).toEqual(['weekly-rest-quota-2026-06-15', 'weekly-rest-quota-2026-07-20']);
    });

    it('flags a possible weekly-rest ferry/train derogation as a review assessment, alongside the infringement it does not suppress (Art. 9(1))', () => {
        const mondayUtc = new Date('2026-06-15T00:00:00Z').getTime();
        // Week 1: ordinary short driving/breaks, no rest anywhere near the
        // reduced weekly-rest threshold.
        const intervals = createWeekWithoutWeeklyRest(mondayUtc);
        // Week 2: a 25h reduced weekly rest (10h + 10h + 5h = 1500m, over the
        // 1440m reduced threshold) fragmented by two short driving gaps
        // (20m + 15m = 35m total) - within Art. 9(1)'s "at most two
        // interruptions, one hour in total". None of the three individual
        // fragments alone reaches the 24h threshold, so the ordinary
        // qualifying-rest filter sees zero qualifying rests in this pair.
        intervals.push(...createInterruptedWeeklyRestWeek(mondayUtc, 15));

        const result = evaluateWeeklyRestCompliance(intervals, EU_561_2006_STANDARD);
        expect(result.infringements.some((i) => i.ruleId === 'WEEKLY_REST_INSUFFICIENT')).toBe(true);
        expect(result.assessments.some((a) => a.ruleId === 'WEEKLY_REST_FERRY_TRAIN_INTERRUPTION_REVIEW')).toBe(true);
    });

    it('does not flag a weekly-rest ferry/train derogation assessment when the interruption exceeds one hour in total', () => {
        const mondayUtc = new Date('2026-06-15T00:00:00Z').getTime();
        const intervals = createWeekWithoutWeeklyRest(mondayUtc);
        // Same combined duration and fragment count as the previous test,
        // but the second gap is 61 minutes - the two interruptions together
        // exceed Art. 9(1)'s one-hour total, so this cannot be a qualifying
        // ferry/train pattern regardless of evidence.
        intervals.push(...createInterruptedWeeklyRestWeek(mondayUtc, 61));

        const result = evaluateWeeklyRestCompliance(intervals, EU_561_2006_STANDARD);
        expect(result.assessments.some((a) => a.ruleId === 'WEEKLY_REST_FERRY_TRAIN_INTERRUPTION_REVIEW')).toBe(false);
    });

    it('treats two reduced weekly rests as an external-evidence review under the Mobility profile', () => {
        const mondayUtc = new Date('2026-06-15T00:00:00Z').getTime();

        const result = evaluateWeeklyRestCompliance(createTwoReducedWeeklyRestPattern(mondayUtc), EU_MOBILITY_PACKAGE_2020);

        expect(result.infringements.some((infringement) => infringement.ruleId === 'WEEKLY_REST_REGULAR_MISSING')).toBe(false);
        expect(result.assessments.map((assessment) => assessment.ruleId)).toEqual([
            'CONSECUTIVE_REDUCED_WEEKLY_REST_DEROGATION_REVIEW',
            'CONSECUTIVE_REDUCED_WEEKLY_REST_COMPENSATION_REVIEW',
        ]);
        expect(result.assessments.map((assessment) => assessment.status)).toEqual([
            'externalEvidenceRequired',
            'externalEvidenceRequired',
        ]);
    });

    it('retains ordinary Article 8 treatment for a Mobility-profile pair wholly before 20 August 2020', () => {
        const mondayUtc = new Date('2020-08-03T00:00:00Z').getTime();

        const result = evaluateWeeklyRestCompliance(createTwoReducedWeeklyRestPattern(mondayUtc), EU_MOBILITY_PACKAGE_2020);

        expect(result.infringements.some((infringement) => infringement.ruleId === 'WEEKLY_REST_REGULAR_MISSING')).toBe(true);
        expect(result.assessments).toHaveLength(0);
    });

    it('emits an applicability review for a two-week pair crossing 20 August 2020', () => {
        const mondayUtc = new Date('2020-08-10T00:00:00Z').getTime();

        const result = evaluateWeeklyRestCompliance(createTwoReducedWeeklyRestPattern(mondayUtc), EU_MOBILITY_PACKAGE_2020);

        expect(result.infringements.some((infringement) => infringement.ruleId === 'WEEKLY_REST_REGULAR_MISSING')).toBe(false);
        expect(result.assessments.map((assessment) => assessment.ruleId)).toEqual([
            'MOBILITY_PACKAGE_TRANSITION_APPLICABILITY_REVIEW',
        ]);
    });

    it('emits the accommodation review only for a recorded post-effective regular weekly rest', () => {
        const mondayUtc = new Date('2020-08-24T00:00:00Z').getTime();
        const result = evaluateWeeklyRestCompliance(
            [createInterval('driving', mondayUtc, 60), createInterval('breakOrRest', mondayUtc + 2 * 3600 * 1000, 45 * 60)],
            EU_MOBILITY_PACKAGE_2020,
        );

        expect(result.assessments.map((assessment) => assessment.ruleId)).toEqual(['WEEKLY_REST_VEHICLE_ACCOMMODATION_REVIEW']);
        expect(result.assessments[0]?.source).not.toBeNull();
    });

    it('emits the return-organisation review only after four fully covered post-effective weeks', () => {
        const mondayUtc = new Date('2020-08-24T00:00:00Z').getTime();
        const result = evaluateWeeklyRestCompliance(
            [createInterval('driving', mondayUtc, 4 * 7 * 24 * 60)],
            EU_MOBILITY_PACKAGE_2020,
        );

        expect(result.assessments.some((assessment) => assessment.ruleId === 'DRIVER_RETURN_ORGANISATION_REVIEW')).toBe(true);
    });

    it('does not emit generic Mobility review cards for short post-effective evidence', () => {
        const start = new Date('2026-06-15T00:00:00Z').getTime();
        const result = evaluateWeeklyRestCompliance([createInterval('driving', start, 60)], EU_MOBILITY_PACKAGE_2020);

        expect(result.assessments).toHaveLength(0);
    });

    it('applies the two-rest rule across consecutive weeks without requiring one rest in each week', () => {
        const mondayUtc = new Date('2026-06-15T00:00:00Z').getTime();
        const intervals: ActivityInterval[] = [
            createInterval('driving', mondayUtc, 60),
            createInterval('breakOrRest', mondayUtc + 2 * 3600 * 1000, 24 * 60),
            createInterval('breakOrRest', mondayUtc + 4 * 24 * 3600 * 1000, 45 * 60),
            createInterval('driving', mondayUtc + 13 * 24 * 3600 * 1000 + 23 * 3600 * 1000, 60),
        ];

        const infringements = evaluateWeeklyRestInfringements(intervals, EU_561_2006_STANDARD);

        expect(
            infringements.some(
                (infringement) =>
                    infringement.ruleId === 'WEEKLY_REST_INSUFFICIENT' || infringement.ruleId === 'WEEKLY_REST_REGULAR_MISSING',
            ),
        ).toBe(false);
    });

    it('flags a weekly rest that starts more than six 24-hour periods after the previous one (Art. 8(6) 2nd subparagraph)', () => {
        const mondayUtc = new Date('2026-06-15T00:00:00Z').getTime();
        const intervals: ActivityInterval[] = [
            createInterval('driving', mondayUtc, 60), // Mon 00:00-01:00
            createInterval('breakOrRest', mondayUtc + 3600 * 1000, 24 * 60), // 24h rest, ends Mon+25h
            createInterval('driving', mondayUtc + 8 * 24 * 3600 * 1000, 60), // Day8 00:00-01:00
            createInterval('breakOrRest', mondayUtc + 8 * 24 * 3600 * 1000 + 3600 * 1000, 24 * 60), // next rest starts Day8 01:00, 168h after the previous rest ended
        ];

        const infringements = evaluateWeeklyRestInfringements(intervals, EU_561_2006_STANDARD);
        const spacingFindings = infringements.filter((i) => i.ruleId === 'WEEKLY_REST_MAX_SPACING_EXCEEDED');
        expect(spacingFindings).toHaveLength(1);
        expect(spacingFindings[0]?.measuredValueMinutes).toBeGreaterThan(6 * 24 * 60);
    });

    it('does not flag the rest spacing rule when the next weekly rest starts within six 24-hour periods (control case)', () => {
        const mondayUtc = new Date('2026-06-15T00:00:00Z').getTime();
        const intervals: ActivityInterval[] = [
            createInterval('driving', mondayUtc, 60),
            createInterval('breakOrRest', mondayUtc + 3600 * 1000, 24 * 60), // ends Mon+25h
            createInterval('driving', mondayUtc + 6 * 24 * 3600 * 1000, 60), // Day6 00:00-01:00
            createInterval('breakOrRest', mondayUtc + 6 * 24 * 3600 * 1000 + 3600 * 1000, 24 * 60), // next rest starts Day6 01:00, 144h after the previous one ended
        ];

        const infringements = evaluateWeeklyRestInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements.some((i) => i.ruleId === 'WEEKLY_REST_MAX_SPACING_EXCEEDED')).toBe(false);
    });

    it('does not credit a single rest spanning two weeks to both of them (Art. 8(9))', () => {
        const mondayUtc = new Date('2026-06-15T00:00:00Z').getTime(); // week 1 Monday
        const intervals: ActivityInterval[] = [
            createInterval('driving', mondayUtc, 60), // week 1 Mon 00:00-01:00
            // A single 24h rest spanning week 1 Sunday 12:00 to week 2 Monday 12:00.
            createInterval('breakOrRest', mondayUtc + 6 * 24 * 3600 * 1000 + 12 * 3600 * 1000, 24 * 60),
            // week 2 evidence, extending the document to cover week 2 in full.
            createInterval('driving', mondayUtc + 13 * 24 * 3600 * 1000 + 23 * 3600 * 1000, 60),
        ];

        const infringements = evaluateWeeklyRestInfringements(intervals, EU_561_2006_STANDARD);
        const insufficientFindings = infringements.filter((i) => i.ruleId === 'WEEKLY_REST_INSUFFICIENT');
        // Without Art. 8(9) allocation, the same spanning rest would satisfy
        // both weeks' individual checks and produce zero findings here.
        expect(insufficientFindings).toHaveLength(1);
    });

    it('evaluates the bi-weekly 90h driving limit', () => {
        const mondayUtc = new Date('2026-06-15T00:00:00Z').getTime();
        const intervals: ActivityInterval[] = [];
        // 48h driving per week x 2 consecutive weeks = 96h > 90h.
        for (let week = 0; week < 2; week++) {
            const weekStart = mondayUtc + week * 7 * 24 * 3600 * 1000;
            for (let day = 0; day < 5; day++) {
                intervals.push(
                    createInterval('driving', weekStart + day * 24 * 3600 * 1000 + 6 * 3600 * 1000, 576), // 9h36m x 5 = 48h
                );
            }
        }

        const infringements = evaluateDrivingInfringements(intervals, EU_561_2006_STANDARD);
        const biWeeklyFindings = infringements.filter((i) => i.ruleId === 'WEEKLY_DRIVING_BIWEEKLY_LIMIT');
        expect(biWeeklyFindings).toHaveLength(1);
        // Art. 6(3), not Art. 6(2) (which governs the separate 56h single-week
        // limit).
        expect(biWeeklyFindings[0]?.legalReference.article).toBe('Art. 6(3)');
    });

    it('does not round away a partial-minute weekly driving excess', () => {
        const mondayUtc = new Date('2026-06-15T00:00:00Z').getTime();
        const profile = {
            ...EU_561_2006_STANDARD,
            dailyDrivingRules: {
                ...EU_561_2006_STANDARD.dailyDrivingRules,
                extendedDailyDrivingMinutes: 6000,
                standardDailyDrivingMinutes: 6000,
            },
        };

        const findings = evaluateDrivingInfringements(
            [createIntervalWithMilliseconds('driving', mondayUtc, 3360 * 60_000 + 30_000)],
            profile,
        ).filter((finding) => finding.ruleId === 'WEEKLY_DRIVING_LIMIT');

        expect(findings).toHaveLength(1);
        expect(findings[0]?.measuredValueMinutes).toBe(3361);
        expect(findings[0]?.excessOrDeficitMinutes).toBe(1);
    });

    it('compares raw combined duration for the bi-weekly limit before reporting minutes', () => {
        const firstMonday = new Date('2026-06-15T00:00:00Z').getTime();
        const secondMonday = firstMonday + 7 * 24 * 60 * 60_000;
        const profile = {
            ...EU_561_2006_STANDARD,
            dailyDrivingRules: {
                ...EU_561_2006_STANDARD.dailyDrivingRules,
                extendedDailyDrivingMinutes: 6000,
                standardDailyDrivingMinutes: 6000,
            },
            weeklyDrivingRules: {
                maxBiWeeklyDrivingMinutes: 5400,
                maxWeeklyDrivingMinutes: 6000,
            },
        };
        const intervals = [
            createIntervalWithMilliseconds('driving', firstMonday, 2700 * 60_000 + 15_000),
            createInterval('breakOrRest', firstMonday + 3 * 24 * 60 * 60_000, 540),
            createIntervalWithMilliseconds('driving', secondMonday, 2700 * 60_000 + 15_000),
        ];

        const findings = evaluateDrivingInfringements(intervals, profile).filter(
            (finding) => finding.ruleId === 'WEEKLY_DRIVING_BIWEEKLY_LIMIT',
        );

        expect(findings).toHaveLength(1);
        expect(findings[0]?.measuredValueMinutes).toBe(5401);
        expect(findings[0]?.excessOrDeficitMinutes).toBe(1);
    });

    it('does not pair nonconsecutive driving weeks as if they were adjacent', () => {
        const mondayUtc = new Date('2026-06-15T00:00:00Z').getTime();
        const intervals: ActivityInterval[] = [];
        // Week 1: 50h driving. Week 2: no driving at all. Week 3: 50h driving.
        // 50 + 50 = 100h > 90h, but weeks 1 and 3 are not consecutive weeks -
        // the intervening zero-driving week must prevent them from being
        // paired.
        for (const week of [0, 2]) {
            const weekStart = mondayUtc + week * 7 * 24 * 3600 * 1000;
            for (let day = 0; day < 5; day++) {
                intervals.push(createInterval('driving', weekStart + day * 24 * 3600 * 1000 + 6 * 3600 * 1000, 600)); // 10h x 5 = 50h
            }
        }

        const infringements = evaluateDrivingInfringements(intervals, EU_561_2006_STANDARD);
        expect(infringements.some((i) => i.ruleId === 'WEEKLY_DRIVING_BIWEEKLY_LIMIT')).toBe(false);
    });

    it('skips weekly and bi-weekly driving limits for profiles without them', () => {
        const mondayUtc = new Date('2026-06-15T00:00:00Z').getTime();
        const intervals: ActivityInterval[] = [];
        for (let week = 0; week < 2; week++) {
            const weekStart = mondayUtc + week * 7 * 24 * 3600 * 1000;
            for (let day = 0; day < 6; day++) {
                intervals.push(createInterval('driving', weekStart + day * 24 * 3600 * 1000 + 6 * 3600 * 1000, 600));
            }
        }

        const infringements = evaluateDrivingInfringements(intervals, UK_GB_DOMESTIC);
        expect(infringements.some((i) => i.category === 'weeklyDriving')).toBe(false);
    });

    it('evaluates compliance correctly under UNECE AETR profile', () => {
        const baseTime = 1700000000000;
        const intervals: ActivityInterval[] = [createInterval('driving', baseTime, 300)]; // 5h driving without break

        const infringements = evaluateBreakInfringements(intervals, AETR_2020_INTERNATIONAL);
        expect(infringements).toHaveLength(1);
        expect(infringements[0]?.allowedValueMinutes).toBe(270);
        expect(infringements[0]?.measuredValueMinutes).toBe(300);
    });

    it('keeps driving-without-card, vehicle-motion-conflict, and motion-data-error as distinct rules', () => {
        const baseTime = 1700000000000;
        const events: ITachographEvent[] = [
            createTestEvent('drivingWithoutAppropriateCard', baseTime, 10),
            createTestEvent('vehicleMotionConflict', baseTime + 3600 * 1000, 5),
            createTestEvent('motionDataError', baseTime + 7200 * 1000, 5),
        ];

        const infringements = evaluateAnomalyInfringements(events, EU_561_2006_STANDARD);
        expect(infringements).toHaveLength(3);

        const byRuleId = new Map(infringements.map((i) => [i.ruleId, i]));
        expect(byRuleId.size).toBe(3);

        const cardFinding = byRuleId.get('ANOMALY_DRIVING_WITHOUT_CARD');
        expect(cardFinding?.legalReference.article).toBe('Art. 34(1)');
        expect(cardFinding?.severity).toBe('mostSerious');

        const motionConflictFinding = byRuleId.get('ANOMALY_VEHICLE_MOTION_CONFLICT');
        expect(motionConflictFinding?.legalReference.article).toBe('Art. 32(1)');
        expect(motionConflictFinding?.severity).toBe('mostSerious');

        const motionDataErrorFinding = byRuleId.get('ANOMALY_MOTION_DATA_ERROR');
        expect(motionDataErrorFinding?.legalReference.article).toBe('Art. 32(1)');
        expect(motionDataErrorFinding?.severity).toBe('mostSerious');

        // Art. 12 is a type-approval procedure for equipment manufacturers -
        // it does not apply to any of these three events.
        expect(infringements.every((i) => i.legalReference.article !== 'Art. 12')).toBe(true);
    });
});

describe('Annex I severity classification (Commission Regulation (EU) 2016/403)', () => {
    it('classifies a daily driving breach at the MSI margin as most serious under EU_561_2006_STANDARD', () => {
        expect(calculateSeverity(270, EU_561_2006_STANDARD, 'DAILY_DRIVING_LIMIT')).toBe('mostSerious');
        // One minute short of the MSI band still falls in the next tier down.
        expect(calculateSeverity(269, EU_561_2006_STANDARD, 'DAILY_DRIVING_LIMIT')).toBe('verySerious');
    });

    it('classifies a weekly driving breach at the SI margin as serious under EU_561_2006_STANDARD', () => {
        expect(calculateSeverity(240, EU_561_2006_STANDARD, 'WEEKLY_DRIVING_LIMIT')).toBe('serious');
        expect(calculateSeverity(239, EU_561_2006_STANDARD, 'WEEKLY_DRIVING_LIMIT')).toBe('minor');
    });

    it("classifies a late weekly rest against Annex I's 3h/12h max-spacing thresholds, not the generic 1h/2h fallback", () => {
        // Regression test: WEEKLY_REST_MAX_SPACING_EXCEEDED was missing from
        // the Annex I bands map, so it fell back to the flat
        // severityThresholds (60m SI / 120m VSI) instead of Annex I's real
        // thresholds for this item (3h/180m SI, 12h/720m VSI).
        expect(calculateSeverity(120, EU_561_2006_STANDARD, 'WEEKLY_REST_MAX_SPACING_EXCEEDED')).toBe('minor');
        expect(calculateSeverity(180, EU_561_2006_STANDARD, 'WEEKLY_REST_MAX_SPACING_EXCEEDED')).toBe('serious');
        expect(calculateSeverity(719, EU_561_2006_STANDARD, 'WEEKLY_REST_MAX_SPACING_EXCEEDED')).toBe('serious');
        expect(calculateSeverity(720, EU_561_2006_STANDARD, 'WEEKLY_REST_MAX_SPACING_EXCEEDED')).toBe('verySerious');
    });

    it('classifies working-time rules against Annex I section 3, not the flat profile margins', () => {
        // Night work, Art. 7(1) of Directive 2002/15/EC against the 10h ceiling: rows 9-10 (11h SI, 13h VSI).
        expect(calculateSeverity(59, DIRECTIVE_2002_15_EC_WORKING_TIME, 'NIGHT_WORK_DAILY_LIMIT_10H')).toBe('minor');
        expect(calculateSeverity(60, DIRECTIVE_2002_15_EC_WORKING_TIME, 'NIGHT_WORK_DAILY_LIMIT_10H')).toBe('serious');
        expect(calculateSeverity(179, DIRECTIVE_2002_15_EC_WORKING_TIME, 'NIGHT_WORK_DAILY_LIMIT_10H')).toBe('serious');
        expect(calculateSeverity(180, DIRECTIVE_2002_15_EC_WORKING_TIME, 'NIGHT_WORK_DAILY_LIMIT_10H')).toBe('verySerious');
        // The 60h cap, Art. 4: rows 3-4 (65h SI, 70h VSI).
        expect(calculateSeverity(299, DIRECTIVE_2002_15_EC_WORKING_TIME, 'WORKING_TIME_WEEKLY_LIMIT_60H')).toBe('minor');
        expect(calculateSeverity(300, DIRECTIVE_2002_15_EC_WORKING_TIME, 'WORKING_TIME_WEEKLY_LIMIT_60H')).toBe('serious');
        expect(calculateSeverity(599, DIRECTIVE_2002_15_EC_WORKING_TIME, 'WORKING_TIME_WEEKLY_LIMIT_60H')).toBe('serious');
        expect(calculateSeverity(600, DIRECTIVE_2002_15_EC_WORKING_TIME, 'WORKING_TIME_WEEKLY_LIMIT_60H')).toBe('verySerious');
    });

    it('classifies aggregate break findings by the break taken, as Annex I section 3 rows 5-8 state', () => {
        // Over nine hours of work (45-minute requirement): a 31-minute break is outside the classified bands.
        expect(calculateSeverity(14, DIRECTIVE_2002_15_EC_WORKING_TIME, 'WORKING_TIME_BREAK_9H')).toBe('minor');
        expect(calculateSeverity(15, DIRECTIVE_2002_15_EC_WORKING_TIME, 'WORKING_TIME_BREAK_9H')).toBe('serious');
        expect(calculateSeverity(24, DIRECTIVE_2002_15_EC_WORKING_TIME, 'WORKING_TIME_BREAK_9H')).toBe('serious');
        expect(calculateSeverity(25, DIRECTIVE_2002_15_EC_WORKING_TIME, 'WORKING_TIME_BREAK_9H')).toBe('verySerious');
        // Six to nine hours of work (30-minute requirement): a 21-minute break is outside the classified bands.
        expect(calculateSeverity(9, DIRECTIVE_2002_15_EC_WORKING_TIME, 'WORKING_TIME_BREAK_6H')).toBe('minor');
        expect(calculateSeverity(10, DIRECTIVE_2002_15_EC_WORKING_TIME, 'WORKING_TIME_BREAK_6H')).toBe('serious');
        expect(calculateSeverity(19, DIRECTIVE_2002_15_EC_WORKING_TIME, 'WORKING_TIME_BREAK_6H')).toBe('serious');
        expect(calculateSeverity(20, DIRECTIVE_2002_15_EC_WORKING_TIME, 'WORKING_TIME_BREAK_6H')).toBe('verySerious');
    });

    it('keeps the flat margins for profiles Annex I does not govern', () => {
        // AETR excludes the EU enforcement bands, so the profile's own margins still decide the tier.
        expect(calculateSeverity(59, AETR_2020_INTERNATIONAL, 'NIGHT_WORK_DAILY_LIMIT_10H')).toBe('minor');
        expect(calculateSeverity(60, AETR_2020_INTERNATIONAL, 'NIGHT_WORK_DAILY_LIMIT_10H')).toBe('serious');
        expect(calculateSeverity(120, AETR_2020_INTERNATIONAL, 'NIGHT_WORK_DAILY_LIMIT_10H')).toBe('verySerious');
    });

    it('keeps a rest deficit exactly on an Annex I margin in the lower tier (rest bands are upper-exclusive)', () => {
        // Rows 18-19, reduced daily rest 9h: 7h <= rest < 8h is SI, rest < 7h is VSI.
        expect(calculateDeficitSeverity(60, EU_561_2006_STANDARD, 'DAILY_REST_INSUFFICIENT')).toBe('minor'); // 8h00
        expect(calculateDeficitSeverity(61, EU_561_2006_STANDARD, 'DAILY_REST_INSUFFICIENT')).toBe('serious'); // 7h59
        expect(calculateDeficitSeverity(120, EU_561_2006_STANDARD, 'DAILY_REST_INSUFFICIENT')).toBe('serious'); // 7h00
        expect(calculateDeficitSeverity(121, EU_561_2006_STANDARD, 'DAILY_REST_INSUFFICIENT')).toBe('verySerious');
        // Rows 16-17, regular daily rest 11h: 8h30 <= rest < 10h is SI, rest < 8h30 is VSI.
        expect(calculateDeficitSeverity(60, EU_561_2006_STANDARD, 'DAILY_REST_INSUFFICIENT_REGULAR')).toBe('minor'); // 10h00
        expect(calculateDeficitSeverity(61, EU_561_2006_STANDARD, 'DAILY_REST_INSUFFICIENT_REGULAR')).toBe('serious'); // 9h59
        expect(calculateDeficitSeverity(150, EU_561_2006_STANDARD, 'DAILY_REST_INSUFFICIENT_REGULAR')).toBe('serious'); // 8h30
        expect(calculateDeficitSeverity(151, EU_561_2006_STANDARD, 'DAILY_REST_INSUFFICIENT_REGULAR')).toBe('verySerious'); // 8h29
        // Rows 24-27, weekly rest: reduced 24h (SI below 22h, VSI below 20h), regular 45h (SI below 42h, VSI below 36h).
        expect(calculateDeficitSeverity(120, EU_561_2006_STANDARD, 'WEEKLY_REST_INSUFFICIENT')).toBe('minor');
        expect(calculateDeficitSeverity(121, EU_561_2006_STANDARD, 'WEEKLY_REST_INSUFFICIENT')).toBe('serious');
        expect(calculateDeficitSeverity(240, EU_561_2006_STANDARD, 'WEEKLY_REST_INSUFFICIENT')).toBe('serious');
        expect(calculateDeficitSeverity(241, EU_561_2006_STANDARD, 'WEEKLY_REST_INSUFFICIENT')).toBe('verySerious');
        expect(calculateDeficitSeverity(180, EU_561_2006_STANDARD, 'WEEKLY_REST_REGULAR_MISSING')).toBe('minor');
        expect(calculateDeficitSeverity(181, EU_561_2006_STANDARD, 'WEEKLY_REST_REGULAR_MISSING')).toBe('serious');
        expect(calculateDeficitSeverity(540, EU_561_2006_STANDARD, 'WEEKLY_REST_REGULAR_MISSING')).toBe('serious');
        expect(calculateDeficitSeverity(541, EU_561_2006_STANDARD, 'WEEKLY_REST_REGULAR_MISSING')).toBe('verySerious');
    });

    it('falls back to the flat severityThresholds for a rule with no Annex I band entry', () => {
        // ANOMALY_* rules are not part of Annex I's driving/rest/break
        // categories, so a ruleId lookup must miss the map and fall back to
        // the profile's flat thresholds (serious=60, verySerious=120).
        expect(calculateSeverity(60, EU_561_2006_STANDARD, 'ANOMALY_DRIVING_WITHOUT_CARD')).toBe('serious');
    });

    it('does not apply Annex I bands to AETR or UK Domestic profiles, which fall back to flat thresholds', () => {
        // AETR is a separate international instrument from the EU
        // regulation Annex I classifies against, and UK Domestic rules are
        // a distinct national scheme - neither carries an
        // `annexISeverityBands` map, so a margin that would be "serious"
        // under the EU Annex I band for this rule (30) must still resolve
        // via the flat threshold (serious=60) for these profiles.
        expect(calculateSeverity(30, AETR_2020_INTERNATIONAL, 'BREAK_CONTINUOUS_DRIVING')).toBe('minor');
        expect(calculateSeverity(30, UK_GB_DOMESTIC, 'BREAK_CONTINUOUS_DRIVING')).toBe('minor');
    });
});
