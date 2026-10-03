import { describe, expect, it } from 'vitest';

import {
    createCardUse,
    createSourceReference,
    createVehicleUnitUse,
    createVehicleUse,
    getOdometerDistance,
    isCardNumber,
    isIdentityName,
    isIssuingMemberState,
    isJsonPointer,
    isOdometerKilometres,
    isUtcTimestamp,
    isVehicleIdentificationNumber,
    isVehicleRegistrationNumber,
    type IVehicleUnitUseInput,
    type IVehicleUseInput,
} from '../index.js';

function vehicleUseInput(): IVehicleUseInput {
    const firstUse = Date.UTC(2024, 0, 2, 8);
    const lastUse = Date.UTC(2024, 0, 2, 16);
    const odometerBegin = 12_340;
    const odometerEnd = 12_620;
    const registrationMemberState = 'D';
    const registrationNumber = 'TEST-123';
    const vehicleIdentificationNumber = 'WVWZZZ1JZXW000001';
    const path = '/cardDataResponses/vehiclesUsed/cardVehicleRecords/0';
    if (
        !isUtcTimestamp(firstUse) ||
        !isUtcTimestamp(lastUse) ||
        !isOdometerKilometres(odometerBegin) ||
        !isOdometerKilometres(odometerEnd) ||
        !isIssuingMemberState(registrationMemberState) ||
        !isVehicleRegistrationNumber(registrationNumber) ||
        !isVehicleIdentificationNumber(vehicleIdentificationNumber) ||
        !isJsonPointer(path)
    ) {
        throw new Error('The synthetic vehicle use must be valid.');
    }

    return {
        firstUse,
        lastUse,
        odometerBegin,
        odometerEnd,
        registrationMemberState,
        registrationNumber,
        source: createSourceReference('driverCard', 'g2', path),
        vehicleIdentificationNumber,
    };
}

describe('tachograph associations', () => {
    it('creates immutable vehicle-use evidence and rejects reversed facts', () => {
        const input = vehicleUseInput();
        const record = createVehicleUse(input);

        expect(record).toMatchObject({
            firstUse: input.firstUse,
            kind: 'vehicleUse',
            odometerBegin: 12_340,
            registrationNumber: 'TEST-123',
        });
        const earlierLastUse = input.firstUse - 1;
        const earlierOdometer = 12_339;
        if (!isUtcTimestamp(earlierLastUse) || !isOdometerKilometres(earlierOdometer)) {
            throw new Error('Synthetic inconsistent values must retain their primitive bounds.');
        }
        expect(createVehicleUse({ ...input, lastUse: earlierLastUse })).toBeNull();
        expect(createVehicleUse({ ...input, odometerEnd: earlierOdometer })).toBeNull();
    });

    it('creates card-use evidence with an explicit open withdrawal', () => {
        const insertion = Date.UTC(2024, 0, 2, 8);
        const cardExpiryDate = Date.UTC(2030, 0, 2);
        const cardNumber = 'SYNTHETIC0000001';
        const firstNames = 'Alex';
        const surname = 'Example';
        const issuingMemberState = 'D';
        const path = '/transferResParams/0/data/Activity/vuCardIWData/vu_card_iw_records/0';
        if (
            !isUtcTimestamp(insertion) ||
            !isUtcTimestamp(cardExpiryDate) ||
            !isCardNumber(cardNumber) ||
            !isIdentityName(firstNames) ||
            !isIdentityName(surname) ||
            !isIssuingMemberState(issuingMemberState) ||
            !isJsonPointer(path)
        ) {
            throw new Error('The synthetic card use must be valid.');
        }

        const record = createCardUse({
            cardExpiryDate,
            cardNumber,
            cardType: 'driverCard',
            firstNames,
            insertion,
            issuingMemberState,
            odometerAtInsertion: null,
            odometerAtWithdrawal: null,
            slot: 'Driver',
            source: createSourceReference('vehicleUnit', 'g1', path),
            surname,
            withdrawal: null,
        });

        expect(record).toMatchObject({
            cardNumber,
            kind: 'cardUse',
            slot: 'Driver',
            withdrawal: null,
        });
    });

    it('bounds odometer values from the source format', () => {
        const begin = 0;
        const end = 120;
        const reversedBegin = 120;
        const reversedEnd = 100;
        if (
            !isOdometerKilometres(begin) ||
            !isOdometerKilometres(end) ||
            !isOdometerKilometres(reversedBegin) ||
            !isOdometerKilometres(reversedEnd)
        ) {
            throw new Error('Synthetic odometer values must be valid.');
        }

        expect(isOdometerKilometres(0)).toBe(true);
        expect(isOdometerKilometres(0xff_ff_fe)).toBe(true);
        expect(isOdometerKilometres(0xff_ff_ff)).toBe(false);
        expect(isOdometerKilometres(-1)).toBe(false);
        expect(isOdometerKilometres(1.5)).toBe(false);
        expect(getOdometerDistance(begin, end)).toBe(120);
        expect(getOdometerDistance(reversedBegin, reversedEnd)).toBeNull();
    });

    it('creates vehicle-unit-use evidence with exact device facts and source', () => {
        const usedAt = Date.UTC(2026, 0, 2, 8);
        const path = '/cardDataResponses/vehicleUnitsUsed/cardVehicleUnitRecords/0';
        if (!isUtcTimestamp(usedAt) || !isJsonPointer(path)) {
            throw new Error('The synthetic vehicle-unit use must be valid.');
        }

        const input: IVehicleUnitUseInput = {
            deviceID: 123_456,
            manufacturerCode: 2,
            source: createSourceReference('driverCard', 'g2', path),
            usedAt,
            vuSoftwareVersion: '0001',
        };

        expect(createVehicleUnitUse(input)).toEqual({
            deviceID: 123_456,
            kind: 'vehicleUnitUse',
            manufacturerCode: 2,
            source: input.source,
            usedAt,
            vuSoftwareVersion: '0001',
        });
    });
});
