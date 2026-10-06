import { createOpenedTachographDocument, type IDriverCardApplication, type IParsedDriverCardDocument } from '#viewer-application';
import { decodeFileMetadata } from '#contracts';
import type {
    ActivityKind,
    DurationMilliseconds,
    IActivityDay,
    IRecordedActivityInterval,
    ISourceReference,
    UtcTimestamp,
} from '#tachograph-domain';
import {
    createRecordedActivityInterval,
    createSourceReference,
    createTachographEvent,
    isDurationMilliseconds,
    isJsonPointer,
    isUtcTimestamp,
    type IActivityCrewContext,
} from '#tachograph-domain';
import { describe, expect, it } from 'vitest';

import { evaluateDocumentCompliance, nightWindowFromPreferences } from '../compliance-service.js';
import { AETR_2020_INTERNATIONAL, EU_MOBILITY_PACKAGE_2020 } from '../../domain/rule-profile.js';

const singleDriverCrew: IActivityCrewContext = { crewPresence: 'single', slot: 'Driver' };

function utc(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The compliance fixture timestamp must be valid.');
    }
    return value;
}

function duration(value: number): DurationMilliseconds {
    if (!isDurationMilliseconds(value)) {
        throw new TypeError('The compliance fixture duration must be valid.');
    }
    return value;
}

function cardSource(generation: 'g1' | 'g2', path: string): ISourceReference<'g1' | 'g2', 'driverCard'> {
    if (!isJsonPointer(path)) {
        throw new TypeError('The compliance fixture source path must be valid.');
    }
    return createSourceReference('driverCard', generation, path);
}

function activityDay(midnightUtc: UtcTimestamp, intervals: readonly IRecordedActivityInterval[]): IActivityDay {
    return {
        intervals,
        midnightUtc,
        totals: {
            availability: duration(0),
            breakOrRest: duration(0),
            driving: duration(4 * 3_600_000),
            unknown: duration(0),
            work: duration(0),
        },
    };
}

function application(generation: 'g1' | 'g2', day: IActivityDay, eventSourcePath: string): IDriverCardApplication {
    const eventStart = day.intervals[0]?.start;
    if (eventStart === undefined) {
        throw new TypeError('The compliance fixture needs a driving interval.');
    }
    const event = createTachographEvent({
        code: 'motionDataError',
        end: eventStart,
        recordKind: 'event',
        recordPurpose: null,
        registrationMemberState: null,
        registrationNumber: null,
        similarOccurrences: null,
        source: cardSource(generation, eventSourcePath),
        start: eventStart,
    });
    if (event === null) {
        throw new TypeError('The compliance fixture event must be valid.');
    }
    return {
        activityDays: [day],
        cardNotes: null,
        events: [event],
        faults: [],
        generation,
        identity: null,
        locations: [],
        source: cardSource(generation, '/cardDataResponses'),
        technicalRecords: [],
        verification: {
            dataFiles: {},
            dataFileSourcePaths: {},
            generation,
        },
        vehicleUnitUses: [],
        vehicleUses: [],
        warnings: [],
    };
}

function parsedDriverCard(applications: readonly IDriverCardApplication[]): IParsedDriverCardDocument {
    return {
        applications,
        cardType: 'driverCard',
        documentKind: 'driverCard',
        generation: 'combined',
        parserVariant: 'cardGen2',
        rawTree: {},
        sections: [],
    };
}

function combinedDocument(day: IActivityDay): ReturnType<typeof createOpenedTachographDocument> {
    return combinedDocumentFromDays(day, day);
}

function combinedDocumentFromDays(
    gen1Day: IActivityDay,
    gen2Day: IActivityDay,
): ReturnType<typeof createOpenedTachographDocument> {
    const metadata = decodeFileMetadata({
        byteLength: 3,
        displayName: 'combined.ddd',
        sha256: 'b'.repeat(64),
    });
    if (!metadata.ok) {
        throw new TypeError('The compliance fixture metadata must be valid.');
    }
    const gen1 = application('g1', gen1Day, '/cardDataResponses/gen1/eventsData/0');
    const gen2 = application('g2', gen2Day, '/cardDataResponses/gen2/eventsData/0');
    return createOpenedTachographDocument(
        {
            ...metadata.value,
            openedAt: utc(Date.UTC(2026, 7, 25, 10, 49, 28)),
            reopenToken: null,
            sourceToken: null,
        },
        parsedDriverCard([gen1, gen2]),
    );
}

function drivingMinutesOf(
    intervals: readonly { readonly activity: string; readonly end: number; readonly start: number }[],
): number {
    return intervals
        .filter((interval) => interval.activity === 'driving')
        .reduce((total, interval) => total + (interval.end - interval.start) / 60_000, 0);
}

describe('evaluateDocumentCompliance with combined Gen1+Gen2 cards', () => {
    it('evaluates mirrored activity days once and never duplicates infringement ids', () => {
        const midnightUtc = utc(Date.UTC(2026, 6, 27));
        const drivingInterval = createRecordedActivityInterval(
            'driving',
            utc(midnightUtc + 6 * 3_600_000),
            utc(midnightUtc + 10 * 3_600_000),
            cardSource('g2', '/driverActivityData/0/0'),
            singleDriverCrew,
        );
        if (drivingInterval === null) {
            throw new TypeError('The compliance driving interval must be valid.');
        }
        const day = activityDay(midnightUtc, [drivingInterval]);
        const document = combinedDocument(day);

        const result = evaluateDocumentCompliance(document);

        const ids = result.infringements.map((infringement) => infringement.id);
        expect(new Set(ids).size).toBe(ids.length);
        // Mirrored event fault (motion data error) is evaluated once.
        expect(ids.filter((id) => id.includes('motionDataError'))).toHaveLength(1);
    });

    it('reads a mirrored day once, whatever the lower generation holds', () => {
        const midnightUtc = utc(Date.UTC(2026, 6, 27));
        const mirrored = createRecordedActivityInterval(
            'driving',
            utc(midnightUtc + 6 * 3_600_000),
            utc(midnightUtc + 10 * 3_600_000),
            cardSource('g2', '/driverActivityData/0/0'),
            singleDriverCrew,
        );
        if (mirrored === null) {
            throw new TypeError('The compliance mirrored interval must be valid.');
        }

        const result = evaluateDocumentCompliance(combinedDocument(activityDay(midnightUtc, [mirrored])));

        // Four hours of mirrored driving stay four hours; a doubled copy would read eight.
        expect(drivingMinutesOf(result.evaluationIntervals)).toBe(240);
    });

    it('reads a day whose copies disagree once, from the higher generation', () => {
        const midnightUtc = utc(Date.UTC(2026, 6, 27));
        const fourHours = createRecordedActivityInterval(
            'driving',
            utc(midnightUtc + 6 * 3_600_000),
            utc(midnightUtc + 10 * 3_600_000),
            cardSource('g1', '/driverActivityData/0/0'),
            singleDriverCrew,
        );
        const fiveHours = createRecordedActivityInterval(
            'driving',
            utc(midnightUtc + 6 * 3_600_000),
            utc(midnightUtc + 11 * 3_600_000),
            cardSource('g2', '/driverActivityData/0/0'),
            singleDriverCrew,
        );
        if (fourHours === null || fiveHours === null) {
            throw new TypeError('The compliance conflicting intervals must be valid.');
        }

        const result = evaluateDocumentCompliance(
            combinedDocumentFromDays(activityDay(midnightUtc, [fourHours]), activityDay(midnightUtc, [fiveHours])),
        );

        // The conflict is disclosed by the decode-time warning; the aggregates use the newer application.
        expect(drivingMinutesOf(result.evaluationIntervals)).toBe(300);
    });

    it('does not add generic Mobility Package assessments to a short document', () => {
        const midnightUtc = utc(Date.UTC(2026, 6, 27));
        const drivingInterval = createRecordedActivityInterval(
            'driving',
            utc(midnightUtc + 6 * 3_600_000),
            utc(midnightUtc + 10 * 3_600_000),
            cardSource('g2', '/driverActivityData/0/0'),
            singleDriverCrew,
        );
        if (drivingInterval === null) {
            throw new TypeError('The compliance driving interval must be valid.');
        }

        const result = evaluateDocumentCompliance(
            combinedDocument(activityDay(midnightUtc, [drivingInterval])),
            EU_MOBILITY_PACKAGE_2020,
        );

        expect(result.assessments).toHaveLength(0);
        expect(result.totalCount).toBe(result.infringements.length);
    });
});

function singleGenerationDocument(days: readonly IActivityDay[]): ReturnType<typeof createOpenedTachographDocument> {
    const metadata = decodeFileMetadata({
        byteLength: 3,
        displayName: 'single-generation.ddd',
        sha256: 'c'.repeat(64),
    });
    if (!metadata.ok) {
        throw new TypeError('The compliance fixture metadata must be valid.');
    }
    const application: IDriverCardApplication = {
        activityDays: days,
        cardNotes: null,
        events: [],
        faults: [],
        generation: 'g2',
        identity: null,
        locations: [],
        source: cardSource('g2', '/cardDataResponses'),
        technicalRecords: [],
        verification: {
            dataFiles: {},
            dataFileSourcePaths: {},
            generation: 'g2',
        },
        vehicleUnitUses: [],
        vehicleUses: [],
        warnings: [],
    };
    return createOpenedTachographDocument(
        {
            ...metadata.value,
            openedAt: utc(Date.UTC(2026, 7, 25, 10, 49, 28)),
            reopenToken: null,
            sourceToken: null,
        },
        parsedDriverCard([application]),
    );
}

describe('evaluateDocumentCompliance across a midnight-crossing rest (VIEWER-01 sibling bug)', () => {
    it('does not report a daily driving or daily rest violation for a genuine qualifying rest that a UTC midnight crossing split into two contiguous activity days', () => {
        // A realistic two-day driver card: day 1 has 8h of driving then a
        // rest starting at 20:00 that continues past midnight; day 2 picks
        // the same rest back up at 00:00 for another 5h10m (9h10m rest
        // total - qualifying), then 8h more driving. Each day's own
        // on-card activity record is necessarily split exactly at midnight
        // by this app's per-day normalization, which is the real-world
        // shape that exposed this bug, not a synthetic one.
        const day1Midnight = utc(Date.UTC(2026, 6, 27));
        const day2Midnight = utc(Date.UTC(2026, 6, 28));

        const day1Driving = createRecordedActivityInterval(
            'driving',
            utc(day1Midnight + 12 * 3_600_000),
            utc(day1Midnight + 20 * 3_600_000),
            cardSource('g2', '/driverActivityData/0/0'),
            singleDriverCrew,
        );
        const day1Rest = createRecordedActivityInterval(
            'breakOrRest',
            utc(day1Midnight + 20 * 3_600_000),
            day2Midnight,
            cardSource('g2', '/driverActivityData/0/1'),
            singleDriverCrew,
        );
        const day2Rest = createRecordedActivityInterval(
            'breakOrRest',
            day2Midnight,
            utc(day2Midnight + 5 * 3_600_000 + 10 * 60_000),
            cardSource('g2', '/driverActivityData/1/0'),
            singleDriverCrew,
        );
        const day2Driving = createRecordedActivityInterval(
            'driving',
            utc(day2Midnight + 5 * 3_600_000 + 10 * 60_000),
            utc(day2Midnight + 13 * 3_600_000 + 10 * 60_000),
            cardSource('g2', '/driverActivityData/1/1'),
            singleDriverCrew,
        );
        if (day1Driving === null || day1Rest === null || day2Rest === null || day2Driving === null) {
            throw new TypeError('The midnight-crossing compliance fixture intervals must be valid.');
        }

        const document = singleGenerationDocument([
            activityDay(day1Midnight, [day1Driving, day1Rest]),
            activityDay(day2Midnight, [day2Rest, day2Driving]),
        ]);

        const result = evaluateDocumentCompliance(document);

        expect(result.infringements.some((i) => i.ruleId === 'DAILY_DRIVING_LIMIT')).toBe(false);
        expect(result.infringements.some((i) => i.ruleId === 'DAILY_REST_INSUFFICIENT')).toBe(false);
    });
});

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const MONDAY = Date.UTC(2026, 5, 15);

// Lays [activity, minutes] steps back to back from Monday 00:00 UTC and splits them into activity days at UTC
// midnights, as the card normalizer does. 'noRecords' leaves its time without any daily record.
function cardTimeline(steps: readonly (readonly [ActivityKind | 'noRecords', number])[]): readonly IActivityDay[] {
    const intervalsByMidnight = new Map<number, IRecordedActivityInterval[]>();
    let cursor = MONDAY;
    for (const [index, [activity, minutes]] of steps.entries()) {
        const stepEnd = cursor + minutes * MINUTE_MS;
        for (let start = cursor; activity !== 'noRecords' && start < stepEnd;) {
            const midnight = start - (start % DAY_MS);
            const end = Math.min(stepEnd, midnight + DAY_MS);
            const interval = createRecordedActivityInterval(
                activity,
                utc(start),
                utc(end),
                cardSource('g2', `/driverActivityData/${String(index)}`),
                singleDriverCrew,
            );
            if (interval === null) {
                throw new TypeError('The timeline step must be a valid interval.');
            }
            intervalsByMidnight.set(midnight, [...(intervalsByMidnight.get(midnight) ?? []), interval]);
            start = end;
        }
        cursor = stepEnd;
    }
    return [...intervalsByMidnight].map(([midnight, intervals]) => activityDay(utc(midnight), intervals));
}

function reviewItems(
    result: ReturnType<typeof evaluateDocumentCompliance>,
): readonly (readonly [number | null, string | undefined])[] {
    return result.assessments
        .filter((assessment) => assessment.ruleId === 'UNRECORDED_PERIOD_REVIEW')
        .map((assessment) => [assessment.recordedAt, assessment.source?.path]);
}

// 9 h reduced rest, two 4 h stints split by a 45-minute break, then work to midnight: one reduced rest per day.
const REDUCED_REST_DAY = [
    ['breakOrRest', 540],
    ['driving', 240],
    ['breakOrRest', 45],
    ['driving', 240],
    ['work', 375],
] as const;

describe('evaluateDocumentCompliance with unrecorded time', () => {
    it('evaluates an overnight card-out without a manual entry as rest and lists it for review', () => {
        const result = evaluateDocumentCompliance(
            singleGenerationDocument(
                cardTimeline([
                    ['breakOrRest', 480],
                    ['driving', 240],
                    ['breakOrRest', 45],
                    ['driving', 240],
                    ['work', 75],
                    ['unknown', 780],
                    ['driving', 240],
                    ['breakOrRest', 45],
                    ['driving', 240],
                    ['breakOrRest', 495],
                ]),
            ),
        );

        expect(result.infringements.some((i) => i.ruleId === 'DAILY_REST_INSUFFICIENT')).toBe(false);
        expect(reviewItems(result)).toEqual([[MONDAY + 18 * 60 * MINUTE_MS, '/driverActivityData/5']]);
    });

    it('counts a card-out hour between two driving stints as the break', () => {
        const result = evaluateDocumentCompliance(
            singleGenerationDocument(
                cardTimeline([
                    ['breakOrRest', 360],
                    ['driving', 240],
                    ['unknown', 60],
                    ['driving', 180],
                    ['breakOrRest', 600],
                ]),
            ),
        );

        expect(result.infringements.some((i) => i.ruleId === 'BREAK_CONTINUOUS_DRIVING')).toBe(false);
        expect(reviewItems(result)).toEqual([[MONDAY + 10 * 60 * MINUTE_MS, '/driverActivityData/2']]);
    });

    it('still reports a daily rest shortfall that remains even when the card-out time is counted as rest', () => {
        const result = evaluateDocumentCompliance(
            singleGenerationDocument(
                cardTimeline([
                    ['breakOrRest', 360],
                    ['driving', 240],
                    ['breakOrRest', 45],
                    ['driving', 240],
                    ['work', 435],
                    ['unknown', 300],
                    ['driving', 240],
                    ['breakOrRest', 45],
                    ['driving', 240],
                    ['work', 735],
                ]),
            ),
        );

        expect(result.infringements).toContainEqual(
            expect.objectContaining({
                measuredValueMinutes: 300,
                ruleId: 'DAILY_REST_INSUFFICIENT',
                source: cardSource('g2', '/driverActivityData/5'),
            }),
        );
    });

    it('lets a day-long card-out close the weekly partition so earlier reductions no longer count', () => {
        const everyDayWorked = evaluateDocumentCompliance(
            singleGenerationDocument(cardTimeline(Array.from({ length: 6 }, () => REDUCED_REST_DAY).flat())),
        );
        const wednesdayCardOut = evaluateDocumentCompliance(
            singleGenerationDocument(
                cardTimeline([
                    ...REDUCED_REST_DAY,
                    ...REDUCED_REST_DAY,
                    ['unknown', 1440],
                    ...REDUCED_REST_DAY,
                    ...REDUCED_REST_DAY,
                    ...REDUCED_REST_DAY,
                ]),
            ),
        );

        expect(everyDayWorked.infringements.some((i) => i.ruleId === 'DAILY_REST_REDUCTIONS_EXCEEDED')).toBe(true);
        // Neither an insufficient Tuesday rest nor a fourth reduction on Friday: the card-out is rest and resets the count.
        expect(wednesdayCardOut.infringements.filter((i) => i.ruleId.startsWith('DAILY_REST_')).map((i) => i.ruleId)).toEqual([]);
        expect(reviewItems(wednesdayCardOut)).toEqual([[MONDAY + 2 * DAY_MS, '/driverActivityData/10']]);
    });

    it('evaluates a day without any record as rest attributed to the last record before it', () => {
        const result = evaluateDocumentCompliance(
            singleGenerationDocument(
                cardTimeline([
                    ...REDUCED_REST_DAY,
                    ...REDUCED_REST_DAY,
                    ['noRecords', 1440],
                    ...REDUCED_REST_DAY,
                    ...REDUCED_REST_DAY,
                    ...REDUCED_REST_DAY,
                ]),
            ),
        );

        expect(result.infringements.filter((i) => i.ruleId.startsWith('DAILY_REST_')).map((i) => i.ruleId)).toEqual([]);
        expect(reviewItems(result)).toEqual([[MONDAY + 2 * DAY_MS, '/driverActivityData/9']]);
    });

    it('applies the same reading without an Art. 34(3) review item under a non-EU profile', () => {
        const result = evaluateDocumentCompliance(
            singleGenerationDocument(
                cardTimeline([
                    ['breakOrRest', 360],
                    ['driving', 240],
                    ['unknown', 60],
                    ['driving', 180],
                    ['breakOrRest', 600],
                ]),
            ),
            AETR_2020_INTERNATIONAL,
        );

        expect(result.infringements.some((i) => i.ruleId === 'BREAK_CONTINUOUS_DRIVING')).toBe(false);
        expect(reviewItems(result)).toEqual([]);
    });
});

describe('nightWindowFromPreferences', () => {
    it('maps the night-work preference fields to the evaluator window', () => {
        expect(
            nightWindowFromPreferences({ nightWorkEndHour: 5, nightWorkStartHour: 1, nightWorkTimeZone: 'Europe/Berlin' }),
        ).toEqual({ endHour: 5, startHour: 1, timeZone: 'Europe/Berlin' });
    });
});
