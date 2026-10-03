import { describe, expect, it } from 'vitest';

import type {
    CardActivityDailyRecord,
    CardEventRecord,
    CardFaultRecord,
    CardIdentification,
    DriverCardHolderIdentification,
} from '../generated/esm_parser.js';
import { normalizeDriverCardApplication } from '../card/driver-card-normalizer.js';
import type { ParserDriverCardApplication } from '../decoders/parser-result-types.js';
import { decodeParserNationAlphaCodes, type ParserNationAlphaCodes } from '../normalizers/parser-value-normalizer.js';
import {
    activityChange,
    cardActivityDailyRecord,
    gen1DriverCard,
    gen2DriverCard,
    vehicleRegistration,
} from './parser-fixtures.js';

function nationAlphaCodes(): ParserNationAlphaCodes {
    const decoded = decodeParserNationAlphaCodes({
        Germany: 'D',
    });
    if (!decoded.ok) {
        throw new Error('Synthetic nation metadata must be valid.');
    }
    return decoded.value;
}

const notesPath = '/cardDataResponses/cardNotes';

function withCardIdentification(
    application: ParserDriverCardApplication,
    overrides: Partial<CardIdentification>,
): ParserDriverCardApplication {
    const identification = application.identification;
    if (identification === null || !('driverCardHolderIdentification' in identification)) {
        throw new TypeError('The synthetic card must contain driver identification.');
    }

    return {
        ...application,
        identification: {
            ...identification,
            cardIdentification: {
                ...identification.cardIdentification,
                ...overrides,
            },
        },
    };
}

function withHolderIdentification(
    application: ParserDriverCardApplication,
    overrides: Partial<DriverCardHolderIdentification>,
): ParserDriverCardApplication {
    const identification = application.identification;
    if (identification === null || !('driverCardHolderIdentification' in identification)) {
        throw new TypeError('The synthetic card must contain driver identification.');
    }

    return {
        ...application,
        identification: {
            ...identification,
            driverCardHolderIdentification: {
                ...identification.driverCardHolderIdentification,
                ...overrides,
            },
        },
    };
}

function dailyRecord(activityRecordDate: CardActivityDailyRecord['activityRecordDate'], timeInMin = 0): CardActivityDailyRecord {
    return cardActivityDailyRecord(activityRecordDate, [activityChange('Rest', timeInMin)]);
}

function eventRecord(): CardEventRecord {
    return {
        eventBeginTime: '2026-01-02 10:00:00 UTC',
        eventEndTime: '2026-01-02 11:00:00 UTC',
        eventType: 'PowerSupplyInterruption',
        eventVehicleRegistration: vehicleRegistration(),
    };
}

function faultRecord(): CardFaultRecord {
    return {
        faultBeginTime: '2026-01-03 10:00:00 UTC',
        faultEndTime: '2026-01-03 11:00:00 UTC',
        faultType: 'REDisplayFault',
        faultVehicleRegistration: vehicleRegistration(),
    };
}

const generationCases = [
    {
        application: gen1DriverCard(),
        generation: 'g1',
    },
    {
        application: gen2DriverCard(),
        generation: 'g2',
    },
] as const;

describe('driver-card normalization', () => {
    it('normalizes populated card notes with an exact canonical source', () => {
        const result = normalizeDriverCardApplication(
            gen1DriverCard({ cardNotes: 'Card holder changed surname.' }),
            {},
            'g1',
            ['cardDataResponses'],
            nationAlphaCodes(),
        );

        expect(result.cardNotes).toEqual({
            kind: 'cardNotes',
            source: {
                documentKind: 'driverCard',
                generation: 'g1',
                path: notesPath,
            },
            text: 'Card holder changed surname.',
        });
        expect(result.warnings.filter((warning) => warning.source.path === notesPath)).toEqual([]);
    });

    it('treats an empty card-notes field as explicit absence', () => {
        const result = normalizeDriverCardApplication(
            gen1DriverCard({ cardNotes: '' }),
            {},
            'g1',
            ['cardDataResponses'],
            nationAlphaCodes(),
        );

        expect(result.cardNotes).toBeNull();
        expect(result.warnings.filter((warning) => warning.source.path === notesPath)).toEqual([]);
    });

    it('rejects over-length card-notes text with an exact-source warning', () => {
        const result = normalizeDriverCardApplication(
            gen1DriverCard({ cardNotes: 'x'.repeat(513) }),
            {},
            'g1',
            ['cardDataResponses'],
            nationAlphaCodes(),
        );

        expect(result.cardNotes).toBeNull();
        expect(result.warnings).toContainEqual({
            code: 'invalidValue',
            source: {
                documentKind: 'driverCard',
                generation: 'g1',
                path: notesPath,
            },
        });
    });

    it.each(generationCases)(
        'treats all-zero $generation identity timestamps as absent while preserving legitimate dates',
        ({ application, generation }) => {
            const zeroResult = normalizeDriverCardApplication(
                withCardIdentification(application, {
                    cardExpiryDate: '0000-00-00 00:00:00 UTC',
                    cardIssueDate: '0000-00-00 00:00:00 UTC',
                    cardValidityBegin: '0000-00-00 00:00:00 UTC',
                }),
                {},
                generation,
                ['cardDataResponses', generation],
                nationAlphaCodes(),
            );
            const datedResult = normalizeDriverCardApplication(
                withCardIdentification(application, {
                    cardExpiryDate: '2031-03-04 00:00:00 UTC',
                    cardIssueDate: '2025-02-03 00:00:00 UTC',
                    cardValidityBegin: '2025-02-04 00:00:00 UTC',
                }),
                {},
                generation,
                ['cardDataResponses', generation],
                nationAlphaCodes(),
            );

            expect(zeroResult.identity).toMatchObject({
                cardExpiryDate: null,
                cardIssueDate: null,
                cardValidityBegin: null,
            });
            expect(
                zeroResult.warnings.filter((item) => item.source.path.includes('/identification/cardIdentification/card')),
            ).toEqual([]);
            expect(datedResult.identity).toMatchObject({
                cardExpiryDate: Date.UTC(2031, 2, 4),
                cardIssueDate: Date.UTC(2025, 1, 3),
                cardValidityBegin: Date.UTC(2025, 1, 4),
            });
        },
    );

    it.each(generationCases)(
        'normalizes $generation cardHolderBirthDate and handles invalid or zero dates',
        ({ application, generation }) => {
            const validResult = normalizeDriverCardApplication(
                application,
                {},
                generation,
                ['cardDataResponses', generation],
                nationAlphaCodes(),
            );
            expect(validResult.identity?.cardHolderBirthDate).toBe(Date.UTC(1990, 0, 1));

            const zeroResult = normalizeDriverCardApplication(
                withHolderIdentification(application, {
                    cardHolderBirthDate: { day: '00', month: '00', year: '0000' },
                }),
                {},
                generation,
                ['cardDataResponses', generation],
                nationAlphaCodes(),
            );
            expect(zeroResult.identity?.cardHolderBirthDate).toBeNull();
            expect(
                zeroResult.warnings.filter((item) =>
                    item.source.path.includes('/driverCardHolderIdentification/cardHolderBirthDate'),
                ),
            ).toEqual([]);

            const invalidResult = normalizeDriverCardApplication(
                withHolderIdentification(application, {
                    cardHolderBirthDate: { day: '32', month: '13', year: '1990' },
                }),
                {},
                generation,
                ['cardDataResponses', generation],
                nationAlphaCodes(),
            );
            expect(invalidResult.identity?.cardHolderBirthDate).toBeNull();
            expect(invalidResult.warnings).toContainEqual({
                code: 'invalidValue',
                source: {
                    documentKind: 'driverCard',
                    generation,
                    path: `/cardDataResponses/${generation}/identification/driverCardHolderIdentification/cardHolderBirthDate`,
                },
            });
        },
    );

    it.each(generationCases)(
        'omits all-zero $generation daily record dates without creating an epoch day',
        ({ application, generation }) => {
            const result = normalizeDriverCardApplication(
                {
                    ...application,
                    driverActivityData: {
                        activityDailyRecords: [dailyRecord('0000-00-00 00:00:00 UTC'), dailyRecord('2026-01-02 00:00:00 UTC')],
                        activityPointerNewestRecord: 16,
                        activityPointerOldestDayRecord: 0,
                    },
                },
                {},
                generation,
                ['cardDataResponses', generation],
                nationAlphaCodes(),
            );

            expect(result.activityDays.map((day) => day.midnightUtc)).toEqual([Date.UTC(2026, 0, 2)]);
            expect(result.warnings).toEqual([]);
        },
    );

    it.each(generationCases)(
        'skips only the $generation activity day containing an out-of-range minute',
        ({ application, generation }) => {
            const result = normalizeDriverCardApplication(
                {
                    ...application,
                    driverActivityData: {
                        activityDailyRecords: [
                            dailyRecord('2026-01-02 00:00:00 UTC', 1440),
                            dailyRecord('2026-01-03 00:00:00 UTC'),
                        ],
                        activityPointerNewestRecord: 32,
                        activityPointerOldestDayRecord: 0,
                    },
                },
                {},
                generation,
                ['cardDataResponses', generation],
                nationAlphaCodes(),
            );

            expect(result.activityDays.map((day) => day.midnightUtc)).toEqual([Date.UTC(2026, 0, 3)]);
            expect(result.warnings).toContainEqual({
                code: 'invalidValue',
                source: {
                    documentKind: 'driverCard',
                    generation,
                    path: `/cardDataResponses/${generation}/driverActivityData/activityDailyRecords/0/activityChangeInfo/0`,
                },
            });
        },
    );

    it.each(generationCases)(
        'warns when $generation duplicate activity and event/fault evidence is canonicalized',
        ({ application, generation }) => {
            const result = normalizeDriverCardApplication(
                {
                    ...application,
                    driverActivityData: {
                        activityDailyRecords: [dailyRecord('2026-01-02 00:00:00 UTC'), dailyRecord('2026-01-02 00:00:00 UTC')],
                        activityPointerNewestRecord: 16,
                        activityPointerOldestDayRecord: 0,
                    },
                    eventsData: {
                        cardEventRecords: [[eventRecord(), eventRecord()]],
                        noOfRecords: 2,
                    },
                    faultsData: {
                        cardFaultRecords: [[faultRecord(), faultRecord()]],
                        noFaultsPerType: 2,
                    },
                },
                {},
                generation,
                ['cardDataResponses', generation],
                nationAlphaCodes(),
            );
            const basePath = `/cardDataResponses/${generation}`;

            expect(result.activityDays).toHaveLength(1);
            expect(result.events).toHaveLength(2);
            expect(result.faults).toHaveLength(2);
            expect(result.warnings.filter((item) => item.code === 'duplicateEvidence')).toEqual([
                {
                    code: 'duplicateEvidence',
                    source: {
                        documentKind: 'driverCard',
                        generation,
                        path: `${basePath}/driverActivityData/activityDailyRecords/1`,
                    },
                },
                {
                    code: 'duplicateEvidence',
                    source: {
                        documentKind: 'driverCard',
                        generation,
                        path: `${basePath}/eventsData/cardEventRecords/0/1`,
                    },
                },
                {
                    code: 'duplicateEvidence',
                    source: {
                        documentKind: 'driverCard',
                        generation,
                        path: `${basePath}/faultsData/cardFaultRecords/0/1`,
                    },
                },
            ]);
        },
    );

    it('allows same-minute activity changes and uses the latest entry as the prevailing state', () => {
        const result = normalizeDriverCardApplication(
            gen1DriverCard({
                driverActivityData: {
                    activityDailyRecords: [
                        {
                            ...cardActivityDailyRecord('2026-01-02 00:00:00 UTC', [
                                activityChange('Rest', 0),
                                activityChange('Rest', 354),
                                activityChange('Work', 354),
                                activityChange('Driving', 480),
                            ]),
                            activityDayDistance: 120,
                            activityRecordLength: 32,
                        },
                    ],
                    activityPointerNewestRecord: 32,
                    activityPointerOldestDayRecord: 0,
                },
            }),
            {},
            'g1',
            ['cardDataResponses'],
            nationAlphaCodes(),
        );

        expect(result.warnings).toEqual([]);
        expect(result.activityDays).toHaveLength(1);
        const day = result.activityDays[0];
        expect(day?.intervals).toHaveLength(3);
        // Interval 1: 00:00 to 05:54 (Break/Rest)
        expect(day?.intervals[0]?.activity).toBe('breakOrRest');
        // Interval 2: 05:54 to 08:00 (Work, which was the prevailing record at minute 354)
        expect(day?.intervals[1]?.activity).toBe('work');
        // Interval 3: 08:00 to 24:00 (Driving)
        expect(day?.intervals[2]?.activity).toBe('driving');
    });

    it('carries slot and crew presence only while the card is inserted', () => {
        const result = normalizeDriverCardApplication(
            gen1DriverCard({
                driverActivityData: {
                    activityDailyRecords: [
                        {
                            ...cardActivityDailyRecord('2026-01-02 00:00:00 UTC', [
                                activityChange('Rest', 0),
                                { ...activityChange('Driving', 360), cardSlot: 'CoDriver', drivingStatus: 'CrewOrKnown' },
                                { ...activityChange('Availability', 600), drivingStatus: 'Unknown' },
                                // Card out with a manual entry: bit 14 means "known", not crew, and the slot names
                                // only the slot the card was withdrawn from.
                                {
                                    ...activityChange('Work', 720),
                                    activitySource: 'Manual',
                                    cardStatus: 'NotInserted',
                                    drivingStatus: 'CrewOrKnown',
                                    isCardWithdrawal: true,
                                },
                            ]),
                            activityDayDistance: 120,
                            activityRecordLength: 32,
                        },
                    ],
                    activityPointerNewestRecord: 32,
                    activityPointerOldestDayRecord: 0,
                },
            }),
            {},
            'g1',
            ['cardDataResponses'],
            nationAlphaCodes(),
        );

        expect(result.warnings).toEqual([]);
        expect(
            result.activityDays[0]?.intervals.map(({ activity, crewPresence, slot }) => ({ activity, crewPresence, slot })),
        ).toEqual([
            { activity: 'breakOrRest', crewPresence: 'single', slot: 'Driver' },
            { activity: 'driving', crewPresence: 'crew', slot: 'CoDriver' },
            { activity: 'availability', crewPresence: 'unknown', slot: 'Driver' },
            { activity: 'work', crewPresence: 'unknown', slot: 'Unknown' },
        ]);
    });

    it('flags non-chronological activity changes with an inconsistentData warning', () => {
        const result = normalizeDriverCardApplication(
            gen1DriverCard({
                driverActivityData: {
                    activityDailyRecords: [
                        {
                            ...cardActivityDailyRecord('2026-01-02 00:00:00 UTC', [
                                activityChange('Rest', 354),
                                activityChange('Work', 300),
                            ]),
                            activityDayDistance: 120,
                            activityRecordLength: 32,
                        },
                    ],
                    activityPointerNewestRecord: 32,
                    activityPointerOldestDayRecord: 0,
                },
            }),
            {},
            'g1',
            ['cardDataResponses'],
            nationAlphaCodes(),
        );

        expect(result.warnings).toContainEqual({
            code: 'inconsistentData',
            source: {
                documentKind: 'driverCard',
                generation: 'g1',
                path: '/cardDataResponses/driverActivityData/activityDailyRecords/0/activityChangeInfo/1',
            },
        });
    });
});
