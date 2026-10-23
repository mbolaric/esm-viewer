import { describe, expect, it } from 'vitest';

import { normalizeCardLocations } from '../card/card-location-normalizer.js';
import type { Gen2VuBorderCrossingRecord, Gen2VuLoadUnloadRecord } from '../generated/esm_parser.js';
import type { ParserGen2VehicleUnitTransferParameter } from '../decoders/parser-result-types.js';
import { decodeParserNationAlphaCodes, type ParserNationAlphaCodes } from '../normalizers/parser-value-normalizer.js';
import { normalizeVehicleUnitActivitySections } from '../vehicle-unit/vehicle-unit-activity-normalizer.js';
import { normalizeVehicleUnitLocations } from '../vehicle-unit/vehicle-unit-location-normalizer.js';
import {
    cardAndGeneration,
    fullCardNumber,
    gen1DriverCard,
    gen2DriverCard,
    gen2VuActivity,
    gnssPlaceRecord,
    recordArray,
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

describe('location normalization', () => {
    it('normalizes card places and accumulated-driving positions with exact source paths', () => {
        const application = gen2DriverCard({
            gnssPlaces: {
                gnssADPointerNewestRecord: 0,
                gnssAccumulatedDrivingRecords: [
                    {
                        gnssPlaceRecord: gnssPlaceRecord('2026-06-18 11:38:57 UTC', 40.4421, -3.6875),
                        timeStamp: '2026-06-18 11:39:00 UTC',
                        vehicleOdometerValue: 12_470,
                    },
                ],
            },
            places: {
                placePointerNewestRecord: 0,
                placeRecords: [
                    {
                        dailyWorkPeriodCountry: 'Germany',
                        dailyWorkPeriodRegion: 'Madrid',
                        entryGnssPlaceRecord: gnssPlaceRecord('2026-06-18 08:38:58 UTC', 40.4168, -3.7038),
                        entryTime: '2026-06-18 08:39:00 UTC',
                        entryTypeDailyWorkPeriod: 'BeginCardInsertion',
                        vehicleOdometerValue: 12_338,
                    },
                ],
            },
        });

        const result = normalizeCardLocations(application, 'g2', ['cardDataResponses', 'Gen2'], nationAlphaCodes());

        expect(result.warnings).toEqual([]);
        expect(result.locations).toHaveLength(2);
        expect(result.locations[0]).toMatchObject({
            country: 'D',
            entryType: 'beginCardInsertion',
            kind: 'dailyWorkPeriodPlace',
            odometer: 12_338,
            position: {
                accuracy: 2,
                authenticationStatus: null,
                coordinates: {
                    latitude: 40.4168,
                    longitude: -3.7038,
                },
            },
            region: 'Madrid',
            source: {
                path: '/cardDataResponses/Gen2/places/placeRecords/0',
            },
        });
        expect(result.locations[1]).toMatchObject({
            kind: 'accumulatedDrivingPosition',
            odometer: 12_470,
            source: {
                path: '/cardDataResponses/Gen2/gnssPlaces/gnssAccumulatedDrivingRecords/0',
            },
        });
    });

    it('keeps a record whose position the equipment marked as not available', () => {
        // 0x7FFFFF over the coordinate scale is the specification's "not available" marker.
        const unknown = 0x7f_ff_ff / 600_000;
        const application = gen2DriverCard({
            gnssPlaces: {
                gnssADPointerNewestRecord: 0,
                gnssAccumulatedDrivingRecords: [
                    {
                        gnssPlaceRecord: gnssPlaceRecord('2026-06-18 11:38:57 UTC', unknown, unknown),
                        timeStamp: '2026-06-18 11:39:00 UTC',
                        vehicleOdometerValue: 12_470,
                    },
                ],
            },
        });

        const result = normalizeCardLocations(application, 'g2', ['cardDataResponses', 'Gen2'], nationAlphaCodes());

        // The timestamp and odometer are evidence even when no position was determined, so the record stays.
        expect(result.warnings).toEqual([]);
        expect(result.locations).toHaveLength(1);
        expect(result.locations[0]).toMatchObject({
            kind: 'accumulatedDrivingPosition',
            odometer: 12_470,
            position: null,
            recordedAt: Date.UTC(2026, 5, 18, 11, 39),
        });
    });

    it('keeps a record with unusable coordinates and reports the invalid values', () => {
        const application = gen2DriverCard({
            gnssPlaces: {
                gnssADPointerNewestRecord: 0,
                gnssAccumulatedDrivingRecords: [
                    {
                        gnssPlaceRecord: gnssPlaceRecord('2026-06-18 11:38:57 UTC', 991, 0),
                        timeStamp: '2026-06-18 11:39:00 UTC',
                        vehicleOdometerValue: 12_470,
                    },
                ],
            },
        });

        const result = normalizeCardLocations(application, 'g2', ['cardDataResponses', 'Gen2'], nationAlphaCodes());

        const record = result.locations[0];
        expect(record?.kind === 'accumulatedDrivingPosition' ? record.position : null).toBeNull();
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toMatchObject({ code: 'invalidValue' });
    });

    it('preserves Unknown and reports a typed RFU entry variant', () => {
        const application = gen1DriverCard({
            places: {
                placePointerNewestRecord: 0,
                placeRecords: [
                    {
                        dailyWorkPeriodCountry: 'Unknown',
                        dailyWorkPeriodRegion: 'Unknown',
                        entryTime: '2026-06-18 08:39:00 UTC',
                        entryTypeDailyWorkPeriod: 'RFU8',
                        vehicleOdometerValue: null,
                    },
                ],
            },
        });

        const result = normalizeCardLocations(application, 'g1', ['cardDataResponses', 'Gen1'], nationAlphaCodes());

        expect(result.locations[0]).toMatchObject({
            country: null,
            entryType: 'unknown',
            region: null,
        });
        expect(result.warnings).toMatchObject([
            {
                code: 'unsupportedData',
                source: {
                    path: '/cardDataResponses/Gen1/places/placeRecords/0/entryTypeDailyWorkPeriod',
                },
            },
        ]);
    });

    it('normalizes Vehicle Unit Gen2v2 authenticated places and GNSS card context', () => {
        const driverCard = {
            fullcardNumber: fullCardNumber('SYNTHETIC0000001'),
            generation: 2,
        };
        const coDriverCard = {
            fullcardNumber: fullCardNumber('SYNTHETIC0000002'),
            generation: 2,
        };
        const transferParameters: ParserGen2VehicleUnitTransferParameter[] = [
            {
                data: {
                    Activity: {
                        dateOfDayDownloadedRecordArray: recordArray('DateOfDayDownloaded', []),
                        odometerValueMidnightRecordArray: recordArray('OdometerValueMidnight', []),
                        signatureRecordArray: null,
                        vuActivityDailyRecordArray: recordArray('ActivityChangeInfo', []),
                        vuCardIWRecordArray: recordArray('VuCardIWRecord', []),
                        vuBorderCrossingRecordArray: null,
                        vuLoadUnloadRecordArray: null,
                        vuGnssadRecordArray: recordArray('VuGNSSADRecord', [
                            {
                                cardNumberAndGenCodriverSlot: coDriverCard,
                                cardNumberAndGenDriverSlot: driverCard,
                                gnssPlaceRecord: null,
                                gnssPlaceAuthRecord: {
                                    ...gnssPlaceRecord('2026-06-18 11:38:57 UTC', 40.4421, -3.6875),
                                    authenticationStatus: 1,
                                },
                                isGen2V2: true,
                                timeStamp: '2026-06-18 11:39:00 UTC',
                                vehicleOdometerValue: 12_470,
                            },
                        ]),
                        vuPlaceDailyWorkPeriodRecordArray: {
                            isGen2V2: true,
                            ...recordArray('VuPlaceDailyWorkPeriodRecord', [
                                {
                                    fullCardNumberAndGeneration: driverCard,
                                    placeAuthRecord: {
                                        dailyWorkPeriodCountry: 'Germany',
                                        dailyWorkPeriodRegion: 'CastillaLeon',
                                        entryGnssPlaceAuthRecord: {
                                            authenticationStatus: 1,
                                            ...gnssPlaceRecord('2026-06-18 08:38:58 UTC', 40.4168, -3.7038),
                                        },
                                        entryTime: '2026-06-18 08:39:00 UTC',
                                        entryTypeDailyWorkPeriod: 'BeginCardInsertion',
                                        vehicleOdometerValue: 12_338,
                                    },
                                    placeRecord: null,
                                },
                            ]),
                        },
                        vuSpecificConditionRecordArray: recordArray('SpecificConditionRecord', []),
                    },
                },
                position: 0,
                typeId: 'Gen2v2Activities',
            },
        ];

        const activitySections = normalizeVehicleUnitActivitySections(transferParameters, 'g2');
        const result = normalizeVehicleUnitLocations(activitySections.sections, nationAlphaCodes());

        expect(activitySections.warnings).toEqual([]);
        expect(result.warnings).toEqual([]);
        expect(result.locations).toHaveLength(2);
        expect(result.locations[0]).toMatchObject({
            card: {
                cardNumber: 'SYNTHETIC0000001',
                cardType: 'driverCard',
                issuingMemberState: 'D',
            },
            kind: 'dailyWorkPeriodPlace',
            position: {
                authenticationStatus: 1,
            },
            region: 'CastillaLeon',
            source: {
                path: '/transferResParams/0/data/Activity/vuPlaceDailyWorkPeriodRecordArray/records/0/placeAuthRecord',
            },
        });
        expect(result.locations[1]).toMatchObject({
            coDriverCard: {
                cardNumber: 'SYNTHETIC0000002',
            },
            driverCard: {
                cardNumber: 'SYNTHETIC0000001',
            },
            kind: 'accumulatedDrivingPosition',
            position: { authenticationStatus: 1 },
            source: {
                path: '/transferResParams/0/data/Activity/vuGnssadRecordArray/records/0',
            },
        });
    });

    it('reads card border timestamps and loading positions from authenticated GNSS records', () => {
        const place = { ...gnssPlaceRecord('2026-06-18 11:38:57 UTC', 40.4421, -3.6875), authenticationStatus: 1 };
        const application = gen2DriverCard({
            borderCrossings: {
                borderCrossingPointerNewestRecord: 0,
                cardBorderCrossingRecords: [
                    {
                        countryLeft: 'Germany',
                        countryEntered: 'Unknown',
                        gnssPlaceAuthRecord: place,
                        vehicleOdometerValue: 12_470,
                    },
                ],
            },
            loadUnloadOperations: {
                loadUnloadPointerNewestRecord: 0,
                cardLoadUnloadRecords: [
                    {
                        timeStamp: '2026-06-18 11:39:00 UTC',
                        operationType: 'Load',
                        gnssPlaceAuthRecord: place,
                        vehicleOdometerValue: 12_471,
                    },
                ],
            },
        });
        const result = normalizeCardLocations(application, 'g2v2', ['cardDataResponses', 'gen2'], nationAlphaCodes());

        expect(result.warnings).toEqual([]);
        expect(result.locations).toMatchObject([
            {
                kind: 'borderCrossing',
                countryLeft: 'D',
                countryEntered: null,
                crossedAt: Date.UTC(2026, 5, 18, 11, 38, 57),
                position: { authenticationStatus: 1 },
                odometer: 12_470,
            },
            {
                kind: 'loadUnloadOperation',
                country: null,
                region: null,
                operationAt: Date.UTC(2026, 5, 18, 11, 39),
                position: { authenticationStatus: 1 },
                odometer: 12_471,
            },
        ]);
    });

    it.each([false, true])('normalizes VU border and load arrays with bounded validation (inconsistent: %s)', (inconsistent) => {
        const place = { ...gnssPlaceRecord('2026-06-18 11:38:57 UTC', 40.4421, -3.6875), authenticationStatus: 1 };
        const cards = { cardNumberAndGenDriverSlot: cardAndGeneration(), cardNumberAndGenCodriverSlot: cardAndGeneration() };
        const crossings = recordArray<Gen2VuBorderCrossingRecord>('VuBorderCrossingRecord', [
            {
                ...cards,
                countryLeft: 'Germany',
                countryEntered: 'Germany',
                gnssPlaceAuthRecord: place,
                vehicleOdometerValue: 12_470,
            },
        ]);
        const activity = {
            ...gen2VuActivity(true),
            vuBorderCrossingRecordArray: { ...crossings, noOfRecords: inconsistent ? 2 : 1 },
            vuLoadUnloadRecordArray: recordArray<Gen2VuLoadUnloadRecord>('VuLoadUnloadRecord', [
                {
                    ...cards,
                    timeStamp: '2026-06-18 11:39:00 UTC',
                    operationType: 'Unload',
                    gnssPlaceAuthRecord: place,
                    vehicleOdometerValue: 12_471,
                },
            ]),
        };
        const sections = normalizeVehicleUnitActivitySections(
            [{ data: { Activity: activity }, position: 0, typeId: 'Gen2v2Activities' }],
            'g2v2',
        );
        const result = normalizeVehicleUnitLocations(sections.sections, nationAlphaCodes());

        expect(sections.warnings).toEqual([]);
        expect(result.locations).toHaveLength(inconsistent ? 1 : 2);
        expect(result.locations.at(-1)).toMatchObject({
            kind: 'loadUnloadOperation',
            country: null,
            region: null,
            odometer: 12_471,
            position: { authenticationStatus: 1 },
            source: { path: '/transferResParams/0/data/Activity/vuLoadUnloadRecordArray/records/0' },
        });
        if (inconsistent) {
            expect(result.warnings).toMatchObject([
                { code: 'inconsistentData', source: { path: '/transferResParams/0/data/Activity/vuBorderCrossingRecordArray' } },
            ]);
        } else {
            expect(result.warnings).toEqual([]);
            expect(result.locations[0]).toMatchObject({
                kind: 'borderCrossing',
                countryLeft: 'D',
                countryEntered: 'D',
                crossedAt: Date.UTC(2026, 5, 18, 11, 38, 57),
                source: { path: '/transferResParams/0/data/Activity/vuBorderCrossingRecordArray/records/0' },
            });
        }
    });
});
