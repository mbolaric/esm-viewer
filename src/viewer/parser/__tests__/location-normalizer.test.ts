import { describe, expect, it } from 'vitest';

import { normalizeCardLocations } from '../card/card-location-normalizer.js';
import type { ParserGen2VehicleUnitTransferParameter } from '../decoders/parser-result-types.js';
import { decodeParserNationAlphaCodes, type ParserNationAlphaCodes } from '../normalizers/parser-value-normalizer.js';
import { normalizeVehicleUnitActivitySections } from '../vehicle-unit/vehicle-unit-activity-normalizer.js';
import { normalizeVehicleUnitLocations } from '../vehicle-unit/vehicle-unit-location-normalizer.js';
import { fullCardNumber, gen1DriverCard, gen2DriverCard, gnssPlaceRecord, recordArray } from './parser-fixtures.js';

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
                        vuGnssadRecordArray: recordArray('VuGNSSADRecord', [
                            {
                                cardNumberAndGenCodriverSlot: coDriverCard,
                                cardNumberAndGenDriverSlot: driverCard,
                                gnssPlaceRecord: gnssPlaceRecord('2026-06-18 11:38:57 UTC', 40.4421, -3.6875),
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
            source: {
                path: '/transferResParams/0/data/Activity/vuGnssadRecordArray/records/0',
            },
        });
    });
});
