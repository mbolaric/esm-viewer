import { describe, expect, it } from 'vitest';

import { normalizeCardAssociations } from '../card/card-association-normalizer.js';
import { normalizeVehicleUnitAssociations } from '../vehicle-unit/vehicle-unit-association-normalizer.js';
import { decodeParserNationAlphaCodes, type ParserNationAlphaCodes } from '../normalizers/parser-value-normalizer.js';
import {
    fullCardNumber,
    gen1DriverCard,
    gen1VuActivity,
    gen2DriverCard,
    vehicleRegistration,
    vehicleUnitsUsedFixture,
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

describe('association normalization', () => {
    it('rejects a card vehicle use with decreasing odometer evidence', () => {
        const result = normalizeCardAssociations(
            gen1DriverCard({
                vehiclesUsed: {
                    cardVehicleRecords: [
                        {
                            vehicleFirstUse: '2024-01-02 08:00:00 UTC',
                            vehicleLastUse: '2024-01-02 16:00:00 UTC',
                            vehicleOdometerBegin: 12_620,
                            vehicleOdometerEnd: 12_340,
                            vehicleRegistration: vehicleRegistration(),
                            vuDataBlockCounter: '0001',
                        },
                    ],
                    vehiclePointerNewestRecord: 0,
                },
            }),
            'g1',
            ['cardDataResponses'],
            nationAlphaCodes(),
        );

        expect(result.vehicleUses).toEqual([]);
        expect(result.warnings).toEqual([
            {
                code: 'inconsistentData',
                source: {
                    documentKind: 'driverCard',
                    generation: 'g1',
                    path: '/cardDataResponses/vehiclesUsed/cardVehicleRecords/0',
                },
            },
        ]);
    });

    it('retains a vehicle-use record with an open (not-yet-closed) session instead of dropping it entirely', () => {
        // Zero timestamp indicates open session when card is inserted; keep valid record data.
        const result = normalizeCardAssociations(
            gen1DriverCard({
                vehiclesUsed: {
                    cardVehicleRecords: [
                        {
                            vehicleFirstUse: '2024-01-02 08:00:00 UTC',
                            vehicleLastUse: '0000-00-00 00:00:00 UTC',
                            vehicleOdometerBegin: 12_340,
                            vehicleOdometerEnd: 12_620,
                            vehicleRegistration: vehicleRegistration(),
                            vuDataBlockCounter: '0001',
                        },
                    ],
                    vehiclePointerNewestRecord: 0,
                },
            }),
            'g1',
            ['cardDataResponses'],
            nationAlphaCodes(),
        );

        expect(result.vehicleUses).toHaveLength(1);
        expect(result.vehicleUses[0]?.firstUse).toBe(Date.UTC(2024, 0, 2, 8));
        expect(result.vehicleUses[0]?.lastUse).toBeNull();
        expect(result.vehicleUses[0]?.odometerBegin).toBe(12_340);
        expect(result.vehicleUses[0]?.odometerEnd).toBe(12_620);
    });

    it.each([
        { lastUse: '2106-02-07 06:28:15 UTC', representation: 'the TimeReal maximum' },
        { lastUse: null, representation: 'null for an unset TimeReal' },
    ])('treats $representation as an open vehicle-use session without warnings', ({ lastUse }) => {
        const result = normalizeCardAssociations(
            gen1DriverCard({
                vehiclesUsed: {
                    cardVehicleRecords: [
                        {
                            vehicleFirstUse: '2024-01-02 08:00:00 UTC',
                            vehicleLastUse: lastUse,
                            vehicleOdometerBegin: 12_340,
                            vehicleOdometerEnd: 12_620,
                            vehicleRegistration: vehicleRegistration(),
                            vuDataBlockCounter: '0001',
                        },
                    ],
                    vehiclePointerNewestRecord: 0,
                },
            }),
            'g1',
            ['cardDataResponses'],
            nationAlphaCodes(),
        );

        expect(result.vehicleUses).toHaveLength(1);
        expect(result.vehicleUses[0]?.lastUse).toBeNull();
        expect(result.warnings).toEqual([]);
    });

    it.each([
        { representation: 'the TimeReal maximum', withdrawal: '2106-02-07 06:28:15 UTC' },
        { representation: 'null for an unset TimeReal', withdrawal: null },
    ])('treats $representation as a card still inserted without warnings', ({ withdrawal }) => {
        const result = normalizeVehicleUnitAssociations(
            [
                {
                    activity: gen1VuActivity({
                        vuCardIWData: {
                            no_of_iw_records: 1,
                            vu_card_iw_records: [
                                {
                                    cardExpiryDate: '2030-01-02 00:00:00 UTC',
                                    cardHolderName: {
                                        holderFirstNames: 'Alex',
                                        holderSurname: 'Example',
                                    },
                                    cardInsertionTime: '2024-01-02 08:00:00 UTC',
                                    cardSlotNumber: 'Driver',
                                    cardWithdrawalTime: withdrawal,
                                    fullCardNumber: fullCardNumber(),
                                    manualInputFlag: 'NoEntry',
                                    previousVehicleInfo: {
                                        cardWithdrawalTime: '2024-01-01 16:00:00 UTC',
                                        vehicleRegistrationIdentification: vehicleRegistration(),
                                    },
                                    vehicleOdometerValueAtInsertion: 12_340,
                                    vehicleOdometerValueAtWithdrawal: 12_620,
                                },
                            ],
                        },
                    }),
                    generation: 'g1',
                    rootPath: ['transferResParams', 0, 'data', 'Activity'],
                },
            ],
            nationAlphaCodes(),
        );

        expect(result.cardUses).toHaveLength(1);
        expect(result.cardUses[0]?.withdrawal).toBeNull();
        expect(result.warnings).toEqual([]);
    });

    it('rejects a VU card use whose withdrawal precedes insertion', () => {
        const result = normalizeVehicleUnitAssociations(
            [
                {
                    activity: gen1VuActivity({
                        vuCardIWData: {
                            no_of_iw_records: 1,
                            vu_card_iw_records: [
                                {
                                    cardExpiryDate: '2030-01-02 00:00:00 UTC',
                                    cardHolderName: {
                                        holderFirstNames: 'Alex',
                                        holderSurname: 'Example',
                                    },
                                    cardInsertionTime: '2024-01-02 16:00:00 UTC',
                                    cardSlotNumber: 'Driver',
                                    cardWithdrawalTime: '2024-01-02 08:00:00 UTC',
                                    fullCardNumber: fullCardNumber(),
                                    manualInputFlag: 'NoEntry',
                                    previousVehicleInfo: {
                                        cardWithdrawalTime: '2024-01-01 16:00:00 UTC',
                                        vehicleRegistrationIdentification: vehicleRegistration(),
                                    },
                                    vehicleOdometerValueAtInsertion: 12_340,
                                    vehicleOdometerValueAtWithdrawal: 12_620,
                                },
                            ],
                        },
                    }),
                    generation: 'g1',
                    rootPath: ['transferResParams', 0, 'data', 'Activity'],
                },
            ],
            nationAlphaCodes(),
        );

        expect(result.cardUses).toEqual([]);
        expect(result.warnings).toEqual([
            {
                code: 'inconsistentData',
                source: {
                    documentKind: 'vehicleUnit',
                    generation: 'g1',
                    path: '/transferResParams/0/data/Activity/vuCardIWData/vu_card_iw_records/0',
                },
            },
        ]);
    });
});

describe('Gen2 card vehicle-unit normalization', () => {
    it('normalizes vehicle-unit-use records with exact canonical sources', () => {
        const result = normalizeCardAssociations(
            gen2DriverCard({
                vehicleUnitsUsed: vehicleUnitsUsedFixture(),
            }),
            'g2',
            ['cardDataResponses'],
            nationAlphaCodes(),
        );

        expect(result.vehicleUnitUses).toEqual([
            {
                deviceID: 123_456,
                kind: 'vehicleUnitUse',
                manufacturerCode: 2,
                source: {
                    documentKind: 'driverCard',
                    generation: 'g2',
                    path: '/cardDataResponses/vehicleUnitsUsed/cardVehicleUnitRecords/0',
                },
                usedAt: Date.UTC(2026, 0, 2, 8),
                vuSoftwareVersion: '0001',
            },
        ]);
        expect(result.vehicleUses).toEqual([]);
        expect(result.warnings).toEqual([]);
    });

    it('rejects a vehicle-unit-use record with an empty timestamp', () => {
        const result = normalizeCardAssociations(
            gen2DriverCard({
                vehicleUnitsUsed: vehicleUnitsUsedFixture({
                    cardVehicleUnitRecords: [
                        {
                            deviceID: 123_456,
                            manufacturerCode: 2,
                            timeStamp: '0000-00-00 00:00:00 UTC',
                            vuSoftwareVersion: '0001',
                        },
                    ],
                }),
            }),
            'g2',
            ['cardDataResponses'],
            nationAlphaCodes(),
        );

        expect(result.vehicleUnitUses).toEqual([]);
        expect(result.warnings).toEqual([
            {
                code: 'invalidValue',
                source: {
                    documentKind: 'driverCard',
                    generation: 'g2',
                    path: '/cardDataResponses/vehicleUnitsUsed/cardVehicleUnitRecords/0/timeStamp',
                },
            },
        ]);
    });

    it('rejects a vehicle-unit-use record with an out-of-bounds device ID', () => {
        const result = normalizeCardAssociations(
            gen2DriverCard({
                vehicleUnitsUsed: vehicleUnitsUsedFixture({
                    cardVehicleUnitRecords: [
                        {
                            deviceID: 0x1_0000_0000,
                            manufacturerCode: 2,
                            timeStamp: '2026-01-02 08:00:00 UTC',
                            vuSoftwareVersion: '0001',
                        },
                    ],
                }),
            }),
            'g2',
            ['cardDataResponses'],
            nationAlphaCodes(),
        );

        expect(result.vehicleUnitUses).toEqual([]);
        expect(result.warnings).toEqual([
            {
                code: 'invalidValue',
                source: {
                    documentKind: 'driverCard',
                    generation: 'g2',
                    path: '/cardDataResponses/vehicleUnitsUsed/cardVehicleUnitRecords/0/deviceID',
                },
            },
        ]);
    });

    it('rejects a vehicle-unit-use record with an over-length software version', () => {
        const result = normalizeCardAssociations(
            gen2DriverCard({
                vehicleUnitsUsed: vehicleUnitsUsedFixture({
                    cardVehicleUnitRecords: [
                        {
                            deviceID: 123_456,
                            manufacturerCode: 2,
                            timeStamp: '2026-01-02 08:00:00 UTC',
                            vuSoftwareVersion: '12345',
                        },
                    ],
                }),
            }),
            'g2',
            ['cardDataResponses'],
            nationAlphaCodes(),
        );

        expect(result.vehicleUnitUses).toEqual([]);
        expect(result.warnings).toEqual([
            {
                code: 'invalidValue',
                source: {
                    documentKind: 'driverCard',
                    generation: 'g2',
                    path: '/cardDataResponses/vehicleUnitsUsed/cardVehicleUnitRecords/0/vuSoftwareVersion',
                },
            },
        ]);
    });
});
