import { describe, expect, it } from 'vitest';

import { resolveJsonPointer } from '#viewer-application';
import type { IJsonRecord, JsonValue } from '#contracts';
import { isJsonPointer, type JsonPointer } from '#viewer-domain';

import type {
    CardFileData,
    CardFileID,
    CardSlotStatus,
    DriverCardIdentification,
    Gen1SensorPaired,
    Gen1VuCompanyLocksData,
    Gen1VuEvents,
    Gen1VuOverSpeedingEventData,
    Gen1VuOverview,
    Gen1VuTechnicalData,
    Gen1VuTimeAdjustmentData,
    Gen2SensorExternalGNSSCoupledRecord,
    Gen2SensorPairedRecord,
    Gen2VUEvents,
    Gen2VUOverview,
    Gen2VUTechnicalData,
    Gen2VuCalibrationRecord,
    Gen2VuCardRecord,
    Gen2VuCompanyLocksRecord,
    Gen2VuEventRecord,
    Gen2VuIdentification,
    Gen2VuItsConsentRecord,
    Gen2VuPowerSupplyInterruptionRecord,
    Gen2VuOverSpeedingEventRecord,
    Gen2VuTimeAdjustmentRecord,
    SerializedTachographData,
} from '../generated/esm_parser.js';
import { decodeParserDocument } from '../decoders/parser-document-decoder.js';
import type {
    ParserGen1VehicleUnitTransferParameter,
    ParserGen2VehicleUnitTransferParameter,
} from '../decoders/parser-result-types.js';
import { decodeParserNationAlphaCodes, type ParserNationAlphaCodes } from '../normalizers/parser-value-normalizer.js';
import {
    activityChange,
    cardActivityDailyRecord,
    cardAndGeneration,
    fullCardNumber,
    gen1CardData,
    gen1CompanyCard,
    gen1DriverCard,
    gen2CardData,
    gen2DriverCard,
    gen1VuOverview,
    gen2VuActivity,
    gen2VuOverview,
    recordArray,
    vehicleRegistration,
    vehicleUnitHeader,
} from './parser-fixtures.js';

function expectPointersToResolve(root: JsonValue, expectations: readonly (readonly [JsonPointer, JsonValue])[]): void {
    for (const [pointer, value] of expectations) {
        expect(resolveJsonPointer(root, pointer)).toEqual({
            ok: true,
            value,
        });
    }
}

function rawPointer(value: string): JsonPointer {
    if (!isJsonPointer(value)) {
        throw new TypeError('The synthetic JSON pointer must be valid.');
    }
    return value;
}

interface IVehicleUnitParsedEvidence {
    readonly documentKind: 'vehicleUnit';
    readonly events: readonly { readonly code: string }[];
    readonly faults: readonly unknown[];
    readonly rawTree: IJsonRecord;
    readonly sections: readonly { readonly kind: string }[];
    readonly technicalRecords: readonly { readonly kind: string }[];
}

function expectExpertContainersRemainRaw(
    value: IVehicleUnitParsedEvidence,
    rawTree: IJsonRecord,
    technicalRecordKinds: readonly string[],
): void {
    expect(value.rawTree).toBe(rawTree);
    expect(value.sections.map((section) => section.kind)).toEqual([
        'identity',
        'companyLocks',
        'downloads',
        'events',
        'faults',
        'technicalData',
        'calibration',
    ]);
    expect(value.events.map((event) => event.code)).toEqual(['powerSupplyInterruption']);
    expect(value.faults).toEqual([]);
    expect(value.technicalRecords.map((record) => record.kind)).toEqual(technicalRecordKinds);
}

function nationAlphaCodes(): ParserNationAlphaCodes {
    const decoded = decodeParserNationAlphaCodes({
        Germany: 'D',
    });
    if (!decoded.ok) {
        throw new Error('Synthetic nation metadata must be valid.');
    }
    return decoded.value;
}

const nations = nationAlphaCodes();

function decode(value: SerializedTachographData): ReturnType<typeof decodeParserDocument> {
    return decodeParserDocument(value, nations);
}

function cardFile(cardFileId: CardFileID, data: number[]): CardFileData {
    return {
        appendix: 0,
        cardFileId,
        cardFileNotes: '',
        data,
        signature: null,
        size: data.length,
    };
}

function driverIdentification(): DriverCardIdentification {
    const identification = gen1DriverCard().identification;
    if (identification === null || !('driverCardHolderIdentification' in identification)) {
        throw new TypeError('The synthetic driver identity must use the driver variant.');
    }
    return identification;
}

function decodeGen2VehicleUnitParameter(parameter: ParserGen2VehicleUnitTransferParameter): ReturnType<typeof decode> {
    return decode({
        data: {
            dataFiles: [],
            header: vehicleUnitHeader('SecondGeneration'),
            transferResParams: [parameter],
        },
        kind: 'vuGen2',
    });
}

function hasParsedEmbeddedCardSnapshot(result: ReturnType<typeof decode>): boolean {
    return (
        result.ok &&
        result.value.documentKind === 'vehicleUnit' &&
        result.value.technicalRecords.some(
            (record) =>
                record.kind === 'vehicleUnitEmbeddedCardSnapshotTechnicalRecord' &&
                record.snapshotState === 'parsed' &&
                record.cardType === 'driverCard',
        )
    );
}

function hasEmbeddedCardMarkerRecord(result: ReturnType<typeof decode>): boolean {
    return (
        result.ok &&
        result.value.documentKind === 'vehicleUnit' &&
        result.value.technicalRecords.some((record) => record.kind === 'vehicleUnitEmbeddedCardTechnicalRecord')
    );
}

describe('decodeParserDocument', () => {
    it('classifies Gen1 driver-card content and preserves data-root source pointers', () => {
        const application = gen1DriverCard({
            dataFiles: {
                ApplicationIdentification: cardFile('ApplicationIdentification', [1]),
                DriverActivityData: cardFile('DriverActivityData', [2]),
            },
            driverActivityData: {
                activityDailyRecords: [
                    {
                        activityChangeInfo: [
                            activityChange('Rest', 0),
                            activityChange('Driving', 480),
                            activityChange('Work', 600),
                        ],
                        activityDailyPresenceCounter: '0001',
                        activityDayDistance: 120,
                        activityPreviousRecordLength: 0,
                        activityRecordDate: '2024-01-02 00:00:00 UTC',
                        activityRecordLength: 32,
                    },
                ],
                activityPointerNewestRecord: 32,
                activityPointerOldestDayRecord: 0,
            },
            vehiclesUsed: {
                cardVehicleRecords: [
                    {
                        vehicleFirstUse: '2024-01-02 08:00:00 UTC',
                        vehicleLastUse: '2024-01-02 10:00:00 UTC',
                        vehicleOdometerBegin: 12_000,
                        vehicleOdometerEnd: 12_120,
                        vehicleRegistration: vehicleRegistration(),
                        vuDataBlockCounter: '0001',
                    },
                ],
                vehiclePointerNewestRecord: 0,
            },
        });
        const envelope: SerializedTachographData = {
            data: gen1CardData(application),
            kind: 'cardGen1',
        };
        const result = decode(envelope);

        expect(result.ok).toBe(true);
        if (!result.ok || result.value.documentKind !== 'driverCard') {
            return;
        }

        expect(result.value).toMatchObject({
            cardType: 'driverCard',
            generation: 'g1',
            parserVariant: 'cardGen1',
        });
        expect(result.value.rawTree).toBe(envelope.data);
        expect(result.value.applications[0]).toMatchObject({
            identity: {
                cardNumber: 'SYNTHETIC0000001',
                issuingMemberState: 'D',
            },
            verification: {
                dataFileSourcePaths: {
                    ApplicationIdentification: '/cardDataResponses/dataFiles/ApplicationIdentification',
                    DriverActivityData: '/cardDataResponses/dataFiles/DriverActivityData',
                },
            },
            vehicleUses: [
                {
                    source: {
                        path: '/cardDataResponses/vehiclesUsed/cardVehicleRecords/0',
                    },
                },
            ],
        });
        expect(result.value.applications[0]?.activityDays[0]?.intervals[0]).toMatchObject({
            source: {
                path: '/cardDataResponses/driverActivityData/activityDailyRecords/0/activityChangeInfo/0',
            },
        });

        const normalizedApplication = result.value.applications[0];
        if (normalizedApplication === undefined) {
            throw new Error('Expected a normalized Gen1 card application.');
        }
        const activitySource = normalizedApplication.activityDays[0]?.intervals[0]?.source?.path;
        const vehicleSource = normalizedApplication.vehicleUses[0]?.source.path;
        if (activitySource === undefined || vehicleSource === undefined) {
            throw new Error('Expected canonical synthetic source pointers.');
        }
        expectPointersToResolve(result.value.rawTree, [
            [activitySource, application.driverActivityData?.activityDailyRecords[0]?.activityChangeInfo[0] ?? null],
            [vehicleSource, application.vehiclesUsed?.cardVehicleRecords[0] ?? null],
        ]);
    });

    it('warns instead of silently choosing when a combined card mirrors or contradicts a day', () => {
        function activityData(
            drivingStartMinute: number,
        ): NonNullable<Exclude<Parameters<typeof gen2DriverCard>[0], undefined>['driverActivityData']> {
            return {
                activityDailyRecords: [
                    cardActivityDailyRecord('2026-01-05 00:00:00 UTC', [activityChange('Driving', drivingStartMinute)]),
                ],
                activityPointerNewestRecord: 16,
                activityPointerOldestDayRecord: 0,
            };
        }
        const mirrored = decode({
            data: gen2CardData({
                gen1: gen1DriverCard({ driverActivityData: activityData(0) }),
                gen2: gen2DriverCard({ driverActivityData: activityData(0) }),
            }),
            kind: 'cardGen2',
        });
        expect(mirrored.ok).toBe(true);
        if (!mirrored.ok || mirrored.value.documentKind !== 'driverCard') {
            return;
        }
        const [mirroredGen1, mirroredGen2] = mirrored.value.applications;
        expect(mirroredGen1?.warnings.filter((warning) => warning.code === 'duplicateEvidence')).toHaveLength(0);
        expect(mirroredGen2?.warnings.filter((warning) => warning.code === 'duplicateEvidence')).toHaveLength(1);

        const conflicting = decode({
            data: gen2CardData({
                gen1: gen1DriverCard({ driverActivityData: activityData(0) }),
                gen2: gen2DriverCard({ driverActivityData: activityData(60) }),
            }),
            kind: 'cardGen2',
        });
        expect(conflicting.ok).toBe(true);
        if (!conflicting.ok || conflicting.value.documentKind !== 'driverCard') {
            return;
        }
        expect(conflicting.value.applications[1]?.warnings.filter((warning) => warning.code === 'inconsistentData')).toHaveLength(
            1,
        );
    });

    it('distinguishes Gen2, Gen2v2, and combined card applications', () => {
        const gen2 = decode({
            data: gen2CardData({
                gen2: gen2DriverCard(),
            }),
            kind: 'cardGen2',
        });
        const gen2v2 = decode({
            data: gen2CardData({
                gen2: gen2DriverCard({
                    applicationIdentificationV2: {
                        lengthOfFollowingData: 10,
                        noOfBorderCrossingRecords: 24,
                        noOfLoadTypeEntryRecords: 12,
                        noOfLoadUnloadRecords: 24,
                        vuConfigurationLengthRange: 128,
                    },
                }),
            }),
            kind: 'cardGen2',
        });
        const combined = decode({
            data: gen2CardData({
                gen1: gen1DriverCard(),
                gen2: gen2DriverCard({
                    applicationIdentificationV2: {
                        lengthOfFollowingData: 10,
                        noOfBorderCrossingRecords: 24,
                        noOfLoadTypeEntryRecords: 12,
                        noOfLoadUnloadRecords: 24,
                        vuConfigurationLengthRange: 128,
                    },
                }),
            }),
            kind: 'cardGen2',
        });

        expect(gen2.ok && gen2.value.generation).toBe('g2');
        expect(gen2v2.ok && gen2v2.value.generation).toBe('g2v2');
        expect(combined.ok && combined.value.generation).toBe('combined');
        if (combined.ok && combined.value.documentKind === 'driverCard') {
            expect(combined.value.applications.map((application) => application.generation)).toEqual(['g1', 'g2v2']);
            expect(combined.value.applications.map((application) => application.source.path)).toEqual([
                '/cardDataResponses/gen1',
                '/cardDataResponses/gen2',
            ]);
        }
    });

    it('preserves unsupported parser and card-type variants without claiming support', () => {
        const parserUnsupported = decode({
            data: gen1CardData('Unsupported'),
            kind: 'cardGen1',
        });
        const applicationUnsupported = decode({
            data: gen1CardData(gen1CompanyCard()),
            kind: 'cardGen1',
        });

        expect(parserUnsupported).toMatchObject({
            ok: true,
            value: {
                cardType: 'unsupportedCard',
                contentPath: '/cardDataResponses',
                documentKind: 'unsupportedCard',
            },
        });
        expect(applicationUnsupported).toMatchObject({
            ok: true,
            value: {
                cardType: 'companyCard',
                contentPath: '/cardDataResponses',
                documentKind: 'unsupportedCard',
            },
        });
    });

    it('preserves the application while rejecting a non-driver identity variant', () => {
        const validIdentity = driverIdentification();
        const application = gen1DriverCard({
            identification: {
                cardIdentification: validIdentity.cardIdentification,
                companyCardHolderIdentification: {
                    cardHolderPreferredLanguage: 'en',
                    companyAddress: 'Synthetic street',
                    companyName: 'Synthetic company',
                },
            },
        });
        const result = decode({
            data: gen1CardData(application),
            kind: 'cardGen1',
        });

        expect(result.ok).toBe(true);
        if (!result.ok || result.value.documentKind !== 'driverCard') {
            return;
        }
        expect(result.value.applications[0]).toMatchObject({
            identity: null,
            warnings: [
                {
                    code: 'invalidValue',
                    source: {
                        path: '/cardDataResponses/identification',
                    },
                },
            ],
        });
    });

    it('rejects unordered daily changes without inventing activity intervals', () => {
        const application = gen1DriverCard({
            driverActivityData: {
                activityDailyRecords: [
                    {
                        activityChangeInfo: [activityChange('Driving', 480), activityChange('Rest', 120)],
                        activityDailyPresenceCounter: '0001',
                        activityDayDistance: 120,
                        activityPreviousRecordLength: 0,
                        activityRecordDate: '2024-01-02 00:00:00 UTC',
                        activityRecordLength: 32,
                    },
                ],
                activityPointerNewestRecord: 32,
                activityPointerOldestDayRecord: 0,
            },
        });
        const result = decode({
            data: gen1CardData(application),
            kind: 'cardGen1',
        });

        expect(result.ok).toBe(true);
        if (!result.ok || result.value.documentKind !== 'driverCard') {
            return;
        }
        expect(result.value.applications[0]?.activityDays).toEqual([]);
        expect(result.value.applications[0]?.warnings).toContainEqual({
            code: 'inconsistentData',
            source: {
                documentKind: 'driverCard',
                generation: 'g1',
                path: '/cardDataResponses/driverActivityData/activityDailyRecords/0/activityChangeInfo/1',
            },
        });
    });

    it('normalizes card events and faults while rejecting invalid chronology and counts', () => {
        const application = gen1DriverCard({
            eventsData: {
                cardEventRecords: [
                    [
                        {
                            eventBeginTime: '2024-01-03 10:00:00 UTC',
                            eventEndTime: '2024-01-03 11:00:00 UTC',
                            eventType: 'PowerSupplyInterruption',
                            eventVehicleRegistration: vehicleRegistration(),
                        },
                        {
                            eventBeginTime: 'not-a-time',
                            eventEndTime: '2024-01-03 12:00:00 UTC',
                            eventType: 'CardConflict',
                            eventVehicleRegistration: vehicleRegistration(),
                        },
                    ],
                ],
                noOfRecords: 2,
            },
            faultsData: {
                cardFaultRecords: [
                    [
                        {
                            faultBeginTime: '2024-01-04 10:00:00 UTC',
                            faultEndTime: '2024-01-04 11:00:00 UTC',
                            faultType: 'REPrinterFault',
                            faultVehicleRegistration: vehicleRegistration(),
                        },
                    ],
                ],
                noFaultsPerType: 0,
            },
        });
        const result = decode({
            data: gen1CardData(application),
            kind: 'cardGen1',
        });

        expect(result.ok).toBe(true);
        if (!result.ok || result.value.documentKind !== 'driverCard') {
            return;
        }
        expect(result.value.applications[0]?.events).toHaveLength(1);
        expect(result.value.applications[0]?.events[0]?.source.path).toBe('/cardDataResponses/eventsData/cardEventRecords/0/0');
        expect(result.value.applications[0]?.faults).toEqual([]);
        expect(result.value.applications[0]?.warnings).toContainEqual({
            code: 'invalidValue',
            source: {
                documentKind: 'driverCard',
                generation: 'g1',
                path: '/cardDataResponses/eventsData/cardEventRecords/0/1/eventBeginTime',
            },
        });
        expect(result.value.applications[0]?.warnings).toContainEqual({
            code: 'inconsistentData',
            source: {
                documentKind: 'driverCard',
                generation: 'g1',
                path: '/cardDataResponses/faultsData',
            },
        });
    });

    it('reports parser nations absent from the supported lookup', () => {
        const identity = driverIdentification();
        const application = gen1DriverCard({
            identification: {
                ...identity,
                cardIdentification: {
                    ...identity.cardIdentification,
                    cardIssuingMemberState: 'France',
                },
            },
        });
        const result = decode({
            data: gen1CardData(application),
            kind: 'cardGen1',
        });

        expect(result.ok).toBe(true);
        if (!result.ok || result.value.documentKind !== 'driverCard') {
            return;
        }
        expect(result.value.applications[0]?.identity).toMatchObject({
            issuingMemberState: null,
        });
        expect(result.value.applications[0]?.warnings).toContainEqual({
            code: 'unsupportedData',
            source: {
                documentKind: 'driverCard',
                generation: 'g1',
                path: '/cardDataResponses/identification/cardIdentification/cardIssuingMemberState',
            },
        });
    });

    it('classifies Gen2v2 VU sections from typed TREP identifiers', () => {
        const parameters: ParserGen2VehicleUnitTransferParameter[] = [
            {
                data: {
                    Control: gen2VuOverview('Gen2v2Overview'),
                },
                position: 0,
                typeId: 'Gen2v2Overview',
            },
            {
                data: {
                    Activity: gen2VuActivity(true),
                },
                position: 1,
                typeId: 'Gen2v2Activities',
            },
        ];
        const data = {
            dataFiles: [],
            header: vehicleUnitHeader('SecondGeneration'),
            transferResParams: parameters,
        };
        const result = decode({
            data,
            kind: 'vuGen2',
        });

        expect(result.ok).toBe(true);
        if (!result.ok || result.value.documentKind !== 'vehicleUnit') {
            return;
        }
        expect(result.value).toMatchObject({
            generation: 'g2v2',
            identity: {
                registrationNumber: 'TEST-123',
                vehicleIdentificationNumber: 'WVWZZZ1JZXW000001',
            },
            parserVariant: 'vuGen2',
        });
        expect(result.value.rawTree).toBe(data);
        expect(result.value.sections.map((section) => section.kind)).toEqual([
            'identity',
            'companyLocks',
            'downloads',
            'activities',
            'places',
            'positions',
        ]);
        expect(result.value.sections.every((section) => !section.source.path.startsWith('/data/'))).toBe(true);
    });

    it('accepts the CardDownload identifier the pinned parser emits for a Gen2 VU card download', () => {
        const result = decodeGen2VehicleUnitParameter({
            data: {
                CardDownload: {
                    card: gen2CardData(),
                    signatureRecordArray: null,
                },
            },
            position: 0,
            typeId: 'CardDownload',
        });

        expect(hasParsedEmbeddedCardSnapshot(result)).toBe(true);
    });

    it('accepts an unparsed Gen2CardDownload block instead of rejecting the whole document', () => {
        const result = decodeGen2VehicleUnitParameter({
            data: {
                Unknown: {
                    data: [],
                    noOfRecords: 0,
                    recordSize: 0,
                    recordType: 'Unknown',
                    trepId: 'Gen2CardDownload',
                },
            },
            position: 0,
            typeId: 'Gen2CardDownload',
        });

        expect(result.ok).toBe(true);
        expect(hasEmbeddedCardMarkerRecord(result)).toBe(false);
    });

    it('normalizes the embedded-card snapshot into technical records', () => {
        const result = decodeGen2VehicleUnitParameter({
            data: {
                CardDownload: {
                    card: gen2CardData(),
                    signatureRecordArray: null,
                },
            },
            position: 0,
            typeId: 'Gen2CardDownload',
        });

        expect(hasParsedEmbeddedCardSnapshot(result)).toBe(true);
        expect(hasEmbeddedCardMarkerRecord(result)).toBe(false);
    });

    it('normalizes the Gen1 marker-only card download as an unsupported snapshot', () => {
        const parameter: ParserGen1VehicleUnitTransferParameter = {
            data: 'CardDownload',
            position: 0,
            typeId: 'CardDownload',
        };
        const result = decode({
            data: {
                dataFiles: [],
                header: vehicleUnitHeader('FirstGeneration'),
                transferResParams: [parameter],
            },
            kind: 'vuGen1',
        });

        expect(result.ok).toBe(true);
        if (!result.ok || result.value.documentKind !== 'vehicleUnit') {
            return;
        }
        const snapshot = result.value.technicalRecords.find(
            (record) => record.kind === 'vehicleUnitEmbeddedCardSnapshotTechnicalRecord',
        );
        expect(snapshot).toMatchObject({
            generation: 'g1',
            snapshotState: 'unsupported',
        });
    });

    it('normalizes Gen1 VU identity and reports unsupported registration nations', () => {
        const parameter: ParserGen1VehicleUnitTransferParameter = {
            data: {
                Control: gen1VuOverview('France'),
            },
            position: 0,
            typeId: 'Overview',
        };
        const result = decode({
            data: {
                dataFiles: [],
                header: vehicleUnitHeader('FirstGeneration'),
                transferResParams: [parameter],
            },
            kind: 'vuGen1',
        });

        expect(result.ok).toBe(true);
        if (!result.ok || result.value.documentKind !== 'vehicleUnit') {
            return;
        }
        expect(result.value.identity).toMatchObject({
            registrationMemberState: null,
            registrationNumber: 'TEST-123',
            vehicleIdentificationNumber: 'WVWZZZ1JZXW000001',
        });
        expect(result.value.warnings).toContainEqual({
            code: 'unsupportedData',
            source: {
                documentKind: 'vehicleUnit',
                generation: 'g1',
                path: '/transferResParams/0/data/Control/vehicleRegistrationIdentification/vehicleRegistrationNation',
            },
        });
    });

    it('preserves partial Gen2 VU identity when one record array is inconsistent', () => {
        const overview = gen2VuOverview('Gen2Overview');
        const parameter: ParserGen2VehicleUnitTransferParameter = {
            data: {
                Control: {
                    ...overview,
                    vehicleIdentificationNumberRecordArray: {
                        ...overview.vehicleIdentificationNumberRecordArray,
                        noOfRecords: 2,
                    },
                },
            },
            position: 0,
            typeId: 'Gen2Overview',
        };
        const result = decode({
            data: {
                dataFiles: [],
                header: vehicleUnitHeader('SecondGeneration'),
                transferResParams: [parameter],
            },
            kind: 'vuGen2',
        });

        expect(result.ok).toBe(true);
        if (!result.ok || result.value.documentKind !== 'vehicleUnit') {
            return;
        }
        expect(result.value.identity).toMatchObject({
            registrationNumber: 'TEST-123',
            vehicleIdentificationNumber: null,
        });
        expect(result.value.warnings).toContainEqual({
            code: 'inconsistentData',
            source: {
                documentKind: 'vehicleUnit',
                generation: 'g2',
                path: '/transferResParams/0/data/Control/vehicleIdentificationNumberRecordArray',
            },
        });
    });

    it('does not choose between multiple VU overview records', () => {
        const parameters: ParserGen2VehicleUnitTransferParameter[] = [
            {
                data: {
                    Control: gen2VuOverview('Gen2Overview'),
                },
                position: 0,
                typeId: 'Gen2Overview',
            },
            {
                data: {
                    Control: gen2VuOverview('Gen2v2Overview'),
                },
                position: 1,
                typeId: 'Gen2v2Overview',
            },
        ];
        const result = decode({
            data: {
                dataFiles: [],
                header: vehicleUnitHeader('SecondGeneration'),
                transferResParams: parameters,
            },
            kind: 'vuGen2',
        });

        expect(result.ok).toBe(true);
        if (!result.ok || result.value.documentKind !== 'vehicleUnit') {
            return;
        }
        expect(result.value).toMatchObject({
            generation: 'g2v2',
            identity: null,
            warnings: [
                {
                    code: 'inconsistentData',
                    source: {
                        path: '/transferResParams',
                    },
                },
            ],
        });
    });

    it('preserves Gen1 VU expert containers as raw evidence without fabricating records', () => {
        const companyLocks: Gen1VuCompanyLocksData = {
            company_locks: [
                {
                    companyAddress: 'Synthetic street 3',
                    companyCardNumber: fullCardNumber('SYNTHETIC0002', 'CompanyCard'),
                    companyName: 'Synthetic carrier',
                    lockInTime: '2026-06-10 06:00:00 UTC',
                    lockOutTime: '2026-06-12 18:00:00 UTC',
                },
            ],
            no_of_locks: 1,
        };
        const overview: Gen1VuOverview = {
            ...gen1VuOverview('Germany'),
            memberStateCertificate: [1, 2, 3],
            signature: [9],
            vuCertificate: [4, 5, 6],
            vuCompanyLocksData: companyLocks,
            vuControlActivity: {
                noOfControls: 1,
                vuControlActivities: [
                    {
                        controlCardNumber: fullCardNumber('SYNTHETIC0003', 'ControlCard'),
                        controlTime: '2026-06-15 09:00:00 UTC',
                        controlType: 'VUDownloaded',
                        downloadPeriodBeginTime: '2026-06-01 00:00:00 UTC',
                        downloadPeriodEndTime: '2026-06-15 09:00:00 UTC',
                    },
                ],
            },
        };
        const timeAdjustment: Gen1VuTimeAdjustmentData = {
            noOfVuTimeAdjRecords: 1,
            vuTimeAdjustmentRecords: [
                {
                    newTimeValue: '2026-06-18 12:00:00 UTC',
                    oldTimeValue: '2026-06-18 11:58:00 UTC',
                    workshopAddress: 'Synthetic street 4',
                    workshopCardNumber: fullCardNumber('SYNTHETIC0004', 'WorkshopCard'),
                    workshopName: 'Synthetic workshop',
                },
            ],
        };
        const overSpeeding: Gen1VuOverSpeedingEventData = {
            noOfVuOverSpeedingEvents: 1,
            vuOverSpeedingEventRecords: [
                {
                    averageSpeedValue: 95,
                    cardNumberDriverSlotBegin: fullCardNumber(),
                    eventBeginTime: '2026-06-14 08:00:00 UTC',
                    eventEndTime: '2026-06-14 08:05:00 UTC',
                    eventRecordPurpose: 'OneOf10MostRecentOrLast',
                    eventType: 'OverSpeeding',
                    maxSpeedValue: 98,
                    similarEventsNumber: 1,
                },
            ],
        };
        const events: Gen1VuEvents = {
            signature: null,
            vuEventData: {
                noOfVuEvents: 1,
                vuEventRecords: [
                    {
                        cardNumberCodriverSlotBegin: fullCardNumber(),
                        cardNumberCodriverSlotEnd: fullCardNumber(),
                        cardNumberDriverSlotBegin: fullCardNumber(),
                        cardNumberDriverSlotEnd: fullCardNumber(),
                        eventBeginTime: '2026-06-16 10:00:00 UTC',
                        eventEndTime: '2026-06-16 11:00:00 UTC',
                        eventRecordPurpose: 'OneOf10MostRecentOrLast',
                        eventType: 'PowerSupplyInterruption',
                        similarEventsNumber: 2,
                    },
                ],
            },
            vuFaultData: {
                noOfVuFaults: 0,
                vuFaultRecords: [],
            },
            vuOverSpeedingControlData: {
                firstOverspeedSince: null,
                lastOverspeedControlTime: null,
                numberOfOverspeedSince: 0,
            },
            vuOverSpeedingEventData: overSpeeding,
            vuTimeAdjustmentData: timeAdjustment,
        };
        const sensorPaired: Gen1SensorPaired = {
            sensorApprovalNumber: 'SENSOR',
            sensorPairingDateFirst: '2026-05-11 08:00:00 UTC',
            sensorSerialNumber: {
                manufacturerCode: 32,
                monthYear: '0526',
                serialNumber: 654_321,
                type: 2,
            },
        };
        const technical: Gen1VuTechnicalData = {
            identification: {
                vuApprovalNumber: 'APPROVAL',
                vuManufacturerAddress: 'Synthetic street 2',
                vuManufacturerName: 'Synthetic VU',
                vuManufacturingDate: '2026-05-10 08:00:00 UTC',
                vuPartNumber: 'VU-2000',
                vuSerialNumber: {
                    manufacturerCode: 32,
                    monthYear: '0526',
                    serialNumber: 123_456,
                    type: 1,
                },
                vuSoftwareIdentification: {
                    vuSoftInstallationDate: '2026-05-11 08:00:00 UTC',
                    vuSoftwareVersion: '4.3',
                },
            },
            sensorPaired,
            signature: [7, 8],
            trepId: 'TechnicalData',
            vuCalibrationData: {
                calibrations: [
                    {
                        authorisedSpeed: 90,
                        calibrationPurpose: 'PeriodicInspection',
                        kConstantOfRecordingEquipment: 8_000,
                        lTyreCircumference: 3_150,
                        newOdometerValue: 125_100,
                        newTimeValue: '2026-06-18 10:00:00 UTC',
                        nextCalibrationDate: '2028-06-18 00:00:00 UTC',
                        oldOdometerValue: 125_000,
                        oldTimeValue: '2026-06-18 09:58:00 UTC',
                        tyreSize: '315/70 R22.5',
                        vehicleIdentificationNumber: 'WVWZZZ1JZXW000001',
                        vehicleRegistrationIdentification: vehicleRegistration(),
                        wVehicleCharacteristicConstant: 8_100,
                        workshopAddress: 'Synthetic street 1',
                        workshopCardExpiryDate: '2030-01-02 00:00:00 UTC',
                        workshopCardNumber: fullCardNumber('SYNTHETIC0005', 'WorkshopCard'),
                        workshopName: 'Synthetic workshop',
                    },
                ],
                no_of_vu_calibrations: 1,
            },
        };
        const parameters: ParserGen1VehicleUnitTransferParameter[] = [
            {
                data: {
                    Control: overview,
                },
                position: 0,
                typeId: 'Overview',
            },
            {
                data: {
                    Events: events,
                },
                position: 1,
                typeId: 'EventsAndFaults',
            },
            {
                data: {
                    Calibration: technical,
                },
                position: 2,
                typeId: 'TechnicalData',
            },
        ];
        const data = {
            dataFiles: [],
            header: vehicleUnitHeader('FirstGeneration'),
            transferResParams: parameters,
        };
        const result = decode({
            data,
            kind: 'vuGen1',
        });

        expect(result.ok).toBe(true);
        if (!result.ok || result.value.documentKind !== 'vehicleUnit') {
            return;
        }
        expectExpertContainersRemainRaw(result.value, data, [
            'vehicleUnitDownloadPeriodTechnicalRecord',
            'vehicleUnitDownloadActivityTechnicalRecord',
            'vehicleUnitCardSlotStatusTechnicalRecord',
            'vehicleUnitIdentificationTechnicalRecord',
            'vehicleUnitSensorPairedTechnicalRecord',
            'vehicleUnitCalibrationTechnicalRecord',
            'vehicleUnitTimeAdjustmentTechnicalRecord',
            'vehicleUnitControlActivityTechnicalRecord',
        ]);
        expect(result.value.companyLocks.map((record) => record.kind)).toEqual(['vehicleUnitCompanyLockTechnicalRecord']);
        expectPointersToResolve(data, [
            [rawPointer('/transferResParams/0/data/Control/vuCompanyLocksData'), companyLocks],
            [rawPointer('/transferResParams/0/data/Control/vuControlActivity'), overview.vuControlActivity],
            [rawPointer('/transferResParams/1/data/Events/vuTimeAdjustmentData'), timeAdjustment],
            [rawPointer('/transferResParams/1/data/Events/vuOverSpeedingEventData'), overSpeeding],
            [rawPointer('/transferResParams/2/data/Calibration/sensorPaired'), sensorPaired],
        ]);
        expect(result.value.overspeedRecords).toMatchObject([
            {
                averageSpeedKilometresPerHour: 95,
                begin: Date.parse('2026-06-14T08:00:00Z'),
                end: Date.parse('2026-06-14T08:05:00Z'),
                kind: 'overspeedRecord',
                maxSpeedKilometresPerHour: 98,
                purpose: 'oneOf10MostRecentOrLast',
                similarEventsNumber: 1,
                source: {
                    path: '/transferResParams/1/data/Events/vuOverSpeedingEventData/vuOverSpeedingEventRecords/0',
                },
            },
        ]);
        expect(result.value.overspeedControl).toMatchObject({
            firstOverspeedSince: null,
            kind: 'overspeedControlData',
            lastOverspeedControlTime: null,
            numberOfOverspeedSince: 0,
        });
    });

    it('preserves Gen2 VU expert record arrays as raw evidence without fabricating records', () => {
        const companyLock: Gen2VuCompanyLocksRecord = {
            companyAddress: 'Synthetic street 3',
            companyCardNumberAndGeneration: cardAndGeneration('SYNTHETIC0002'),
            companyName: 'Synthetic carrier',
            lockInTime: '2026-06-10 06:00:00 UTC',
            lockOutTime: '2026-06-12 18:00:00 UTC',
        };
        const cardSlotStatus: CardSlotStatus = {
            coDriverSlot: 'Unknown',
            data: 0,
            driverSlot: 'DriverCard',
        };
        const overview: Gen2VUOverview = {
            ...gen2VuOverview('Gen2v2Overview'),
            CurrentDateTimeRecordArray: recordArray('CurrentDateTime', ['2026-06-18 12:00:00 UTC']),
            cardSlotsStatusRecordArray: recordArray('CardSlotStatus', [cardSlotStatus]),
            memberStateCertificateRecordArray: recordArray('MemberStateCertificate', [
                {
                    certificateProfile: null,
                    data: [1, 2, 3],
                },
            ]),
            signatureRecordArray: recordArray('Signature', [[10, 11]]),
            vuCertificateRecordArray: recordArray('VuCertificate', [
                {
                    certificateProfile: null,
                    data: [4, 5, 6],
                },
            ]),
            vuCompanyLocksRecordArray: recordArray('VuCompanyLocksRecord', [companyLock]),
            vuControlActivityRecordArray: recordArray('VuControlActivityRecord', [
                {
                    controlCardNumberAndGeneration: cardAndGeneration('SYNTHETIC0003'),
                    controlTime: '2026-06-15 09:00:00 UTC',
                    controlType: 'VUDownloaded',
                    downloadPeriodBeginTime: '2026-06-01 00:00:00 UTC',
                    downloadPeriodEndTime: '2026-06-15 09:00:00 UTC',
                },
            ]),
        };
        const sensorPairedRecord: Gen2SensorPairedRecord = {
            sensorApprovalNumber: 'SENSOR',
            sensorPairingDate: '2026-05-11 08:00:00 UTC',
            sensorSerialNumber: {
                manufacturerCode: 32,
                monthYear: '0526',
                serialNumber: 654_321,
                type: 2,
            },
        };
        const externalGnssRecord: Gen2SensorExternalGNSSCoupledRecord = {
            sensorApprovalNumber: 'GNSS-SENSOR',
            sensorCouplingDate: '2026-05-12 08:00:00 UTC',
            sensorSerialNumber: {
                manufacturerCode: 33,
                monthYear: '0526',
                serialNumber: 654_322,
                type: 3,
            },
        };
        const embeddedCardRecord: Gen2VuCardRecord = {
            cardExtendedSerialNumber: {
                manufacturerCode: 34,
                monthYear: '0526',
                serialNumber: 654_323,
                type: 4,
            },
            cardNumber: {
                cardConsecutiveindex: '',
                cardIssuingMemberState: 'DriverCard',
                cardReplacementindex: '',
                cardRenewalindex: '',
                identification: '',
                number: 'SYNTHETIC0006',
            },
            cardNumberAndGenerationInformation: cardAndGeneration('SYNTHETIC0006'),
            cardStructureVersion: {
                dataElementUseVersion: 1,
                structureVersion: 2,
            },
        };
        const itsConsentRecord: Gen2VuItsConsentRecord = {
            cardNumberAndGen: cardAndGeneration('SYNTHETIC0007'),
            consent: true,
        };
        const powerSupplyRecord: Gen2VuPowerSupplyInterruptionRecord = {
            cardNumberAndGenCodriverSlotBegin: cardAndGeneration(),
            cardNumberAndGenCodriverSlotEnd: cardAndGeneration(),
            cardNumberAndGenDriverSlotBegin: cardAndGeneration(),
            cardNumberAndGenDriverSlotEnd: cardAndGeneration(),
            eventBeginTime: '2026-06-16 10:00:00 UTC',
            eventEndTime: '2026-06-16 11:00:00 UTC',
            eventRecordPurpose: 'OneOf10MostRecentOrLast',
            eventType: 'PowerSupplyInterruption',
            similarEventsNumber: 2,
        };
        const identification: Gen2VuIdentification = {
            isGen2V2: true,
            vuAbility: 2,
            vuApprovalNumber: 'APPROVAL',
            vuGeneration: 2,
            vuManufacturerAddress: 'Synthetic street 2',
            vuManufacturerName: 'Synthetic VU',
            vuManufacturingDate: '2026-05-10 08:00:00 UTC',
            vuPartNumber: 'VU-2000',
            vuSerialNumber: {
                manufacturerCode: 32,
                monthYear: '0526',
                serialNumber: 123_456,
                type: 1,
            },
            vuSoftwareIdentification: {
                vuSoftInstallationDate: '2026-05-11 08:00:00 UTC',
                vuSoftwareVersion: '4.3',
            },
        };
        const calibration: Gen2VuCalibrationRecord = {
            authorisedSpeed: 90,
            calibrationPurpose: 'PeriodicInspection',
            isGen2V2: true,
            kConstantOfRecordingEquipment: 8_000,
            lTyreCircumference: 3_150,
            newOdometerValue: 125_100,
            newTimeValue: '2026-06-18 10:00:00 UTC',
            nextCalibrationDate: '2028-06-18 00:00:00 UTC',
            oldOdometerValue: 125_000,
            oldTimeValue: '2026-06-18 09:58:00 UTC',
            sealDataVu: {
                sealRecords: [
                    {
                        equipmentType: 'VehicleUnit',
                        extendedSealIdentifier: {
                            manufacturerCode: [1],
                            sealIdentifier: [2, 3],
                        },
                    },
                ],
            },
            tyreSize: '315/70 R22.5',
            vehicleIdentificationNumber: 'WVWZZZ1JZXW000001',
            vehicleRegistrationIdentification: vehicleRegistration(),
            wVehicleCharacteristicConstant: 8_100,
            workshopAddress: 'Synthetic street 1',
            workshopCardExpiryDate: '2030-01-02 00:00:00 UTC',
            workshopCardNumber: fullCardNumber('SYNTHETIC0005', 'WorkshopCard'),
            workshopName: 'Synthetic workshop',
        };
        const technical: Gen2VUTechnicalData = {
            signatureRecordArray: null,
            vuCalibrationRecordArray: recordArray('VuCalibrationRecord', [calibration]),
            vuCardRecordArray: recordArray('VuCardRecord', [embeddedCardRecord]),
            vuIdentificationRecordArray: recordArray('VuIdentification', [identification]),
            vuItsConsentRecordArray: recordArray('VuITSConsentRecord', [itsConsentRecord]),
            vuPowerSupplyInterruptionRecordArray: recordArray('VuPowerSupplyInterruptionRecord', [powerSupplyRecord]),
            vuSensorExternalGnssCoupledRecordArray: recordArray('SensorExternalGNSSCoupledRecord', [externalGnssRecord]),
            vuSensorPairedRecordArray: recordArray('SensorPairedRecord', [sensorPairedRecord]),
        };
        const timeAdjustmentRecord: Gen2VuTimeAdjustmentRecord = {
            newTimeValue: '2026-06-18 12:00:00 UTC',
            oldTimeValue: '2026-06-18 11:58:00 UTC',
            workshopAddress: 'Synthetic street 4',
            workshopCardNumberAndGeneration: cardAndGeneration('SYNTHETIC0004'),
            workshopName: 'Synthetic workshop',
        };
        const eventRecord: Gen2VuEventRecord = {
            cardNumberAndGenCodriverSlotBegin: cardAndGeneration(),
            cardNumberAndGenCodriverSlotEnd: cardAndGeneration(),
            cardNumberAndGenDriverSlotBegin: cardAndGeneration(),
            cardNumberAndGenDriverSlotEnd: cardAndGeneration(),
            eventBeginTime: '2026-06-16 10:00:00 UTC',
            eventEndTime: '2026-06-16 11:00:00 UTC',
            eventRecordPurpose: 'OneOf10MostRecentOrLast',
            eventType: 'PowerSupplyInterruption',
            manufacturerSpecificEventFaultData: {
                manufacturerCode: 32,
                manufacturerSpecificErrorCode: [1, 2],
            },
            similarEventsNumber: 2,
        };
        const gen2OverSpeeding: Gen2VuOverSpeedingEventRecord = {
            averageSpeedValue: 96,
            cardNumberAndGen: 'OverSpeeding',
            cardNumberAndGenDriverSlotBegin: cardAndGeneration('SYNTHETIC0001'),
            eventBeginTime: '2026-06-14 08:00:00 UTC',
            eventEndTime: '2026-06-14 08:05:00 UTC',
            eventRecordPurpose: 'OneOf10MostRecentOrLast',
            maxSpeedValue: 100,
            similarEventsNumber: 2,
        };
        const events: Gen2VUEvents = {
            signatureRecordArray: null,
            vuEventRecordArray: recordArray('VuEventRecord', [eventRecord]),
            vuFaultRecordArray: recordArray('VuFaultRecord', []),
            vuOverSpeedingControlDataRecordArray: recordArray('VuOverSpeedingControlData', [
                {
                    firstOverspeedSince: '2026-06-14 08:00:00 UTC',
                    lastOverspeedControlTime: '2026-06-14 12:00:00 UTC',
                    numberOfOverspeedSince: 1,
                },
            ]),
            VuOverSpeedingEventRecordArray: recordArray('VuOverSpeedingEventRecord', [gen2OverSpeeding]),
            vuTimeAdjustmentRecordArray: recordArray('VuTimeAdjustmentRecord', [timeAdjustmentRecord]),
        };
        const parameters: ParserGen2VehicleUnitTransferParameter[] = [
            {
                data: {
                    Control: overview,
                },
                position: 0,
                typeId: 'Gen2v2Overview',
            },
            {
                data: {
                    Events: events,
                },
                position: 1,
                typeId: 'Gen2v2EventsAndFaults',
            },
            {
                data: {
                    Calibration: technical,
                },
                position: 2,
                typeId: 'Gen2v2TechnicalData',
            },
        ];
        const data = {
            dataFiles: [],
            header: vehicleUnitHeader('SecondGeneration'),
            transferResParams: parameters,
        };
        const result = decode({
            data,
            kind: 'vuGen2',
        });

        expect(result.ok).toBe(true);
        if (!result.ok || result.value.documentKind !== 'vehicleUnit') {
            return;
        }
        expectExpertContainersRemainRaw(result.value, data, [
            'vehicleUnitCardSlotStatusTechnicalRecord',
            'vehicleUnitIdentificationTechnicalRecord',
            'vehicleUnitCalibrationTechnicalRecord',
            'vehicleUnitSensorPairedTechnicalRecord',
            'vehicleUnitGnssCoupledTechnicalRecord',
            'vehicleUnitEmbeddedCardTechnicalRecord',
            'vehicleUnitItsConsentTechnicalRecord',
            'vehicleUnitPowerSupplyInterruptionTechnicalRecord',
            'vehicleUnitTimeAdjustmentTechnicalRecord',
            'vehicleUnitControlActivityTechnicalRecord',
        ]);
        expect(result.value.companyLocks.map((record) => record.kind)).toEqual(['vehicleUnitCompanyLockTechnicalRecord']);
        expectPointersToResolve(data, [
            [rawPointer('/transferResParams/0/data/Control/vuCompanyLocksRecordArray/records/0'), companyLock],
            [rawPointer('/transferResParams/0/data/Control/cardSlotsStatusRecordArray/records/0'), cardSlotStatus],
            [rawPointer('/transferResParams/1/data/Events/vuTimeAdjustmentRecordArray/records/0'), timeAdjustmentRecord],
            [rawPointer('/transferResParams/2/data/Calibration/vuSensorPairedRecordArray/records/0'), sensorPairedRecord],
            [
                rawPointer('/transferResParams/2/data/Calibration/vuSensorExternalGnssCoupledRecordArray/records/0'),
                externalGnssRecord,
            ],
            [rawPointer('/transferResParams/2/data/Calibration/vuCardRecordArray/records/0'), embeddedCardRecord],
            [rawPointer('/transferResParams/2/data/Calibration/vuItsConsentRecordArray/records/0'), itsConsentRecord],
            [
                rawPointer('/transferResParams/2/data/Calibration/vuPowerSupplyInterruptionRecordArray/records/0'),
                powerSupplyRecord,
            ],
            [rawPointer('/transferResParams/2/data/Calibration/vuCalibrationRecordArray/records/0'), calibration],
            [rawPointer('/transferResParams/1/data/Events/VuOverSpeedingEventRecordArray/records/0'), gen2OverSpeeding],
        ]);
        expect(result.value.overspeedRecords).toMatchObject([
            {
                averageSpeedKilometresPerHour: 96,
                begin: Date.parse('2026-06-14T08:00:00Z'),
                end: Date.parse('2026-06-14T08:05:00Z'),
                kind: 'overspeedRecord',
                maxSpeedKilometresPerHour: 100,
                purpose: 'oneOf10MostRecentOrLast',
                similarEventsNumber: 2,
            },
        ]);
        expect(result.value.overspeedControl).toMatchObject({
            firstOverspeedSince: Date.parse('2026-06-14T08:00:00Z'),
            kind: 'overspeedControlData',
            lastOverspeedControlTime: Date.parse('2026-06-14T12:00:00Z'),
            numberOfOverspeedSince: 1,
        });
    });

    it('rejects discriminator/header and VU parameter inconsistencies', () => {
        const invalidHeader: SerializedTachographData = {
            data: {
                ...gen1CardData('Unsupported'),
                header: vehicleUnitHeader('FirstGeneration'),
            },
            kind: 'cardGen1',
        };
        const invalidParameter: ParserGen1VehicleUnitTransferParameter = {
            data: {
                Control: gen1VuOverview(),
            },
            position: -1,
            typeId: 'Overview',
        };
        const invalidGen2Parameter: ParserGen2VehicleUnitTransferParameter = {
            data: {
                Control: gen2VuOverview('Gen2Overview'),
            },
            position: 0,
            typeId: 'Overview',
        };
        const invalidCardApplication = gen1DriverCard({
            applicationIdentification: {
                ...gen1DriverCard().applicationIdentification,
                typeOfTachographCardId: 'CompanyCard',
            },
        });

        expect(decode(invalidHeader)).toEqual({
            error: 'invalidHeader',
            ok: false,
        });
        expect(
            decode({
                data: gen1CardData(invalidCardApplication),
                kind: 'cardGen1',
            }),
        ).toEqual({
            error: 'invalidCardContent',
            ok: false,
        });
        expect(
            decode({
                data: {
                    dataFiles: [],
                    header: vehicleUnitHeader('FirstGeneration'),
                    transferResParams: [invalidParameter],
                },
                kind: 'vuGen1',
            }),
        ).toEqual({
            error: 'invalidVehicleUnitContent',
            ok: false,
        });
        expect(
            decode({
                data: {
                    dataFiles: [],
                    header: vehicleUnitHeader('SecondGeneration'),
                    transferResParams: [invalidGen2Parameter],
                },
                kind: 'vuGen2',
            }),
        ).toEqual({
            error: 'invalidVehicleUnitContent',
            ok: false,
        });
    });

    it('rejects typed parser data that violates the bounded JSON contract', () => {
        const invalidPosition: ParserGen1VehicleUnitTransferParameter = {
            data: {
                Control: gen1VuOverview(),
            },
            position: Number.NaN,
            typeId: 'Overview',
        };

        expect(
            decode({
                data: {
                    dataFiles: [],
                    header: vehicleUnitHeader('FirstGeneration'),
                    transferResParams: [invalidPosition],
                },
                kind: 'vuGen1',
            }),
        ).toEqual({
            error: 'parserResultOutsideBounds',
            ok: false,
        });
    });
});
