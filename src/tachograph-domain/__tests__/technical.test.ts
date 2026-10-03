import { describe, expect, it } from 'vitest';

import {
    createCardControlActivityTechnicalRecord,
    createCardIccTechnicalData,
    createSourceReference,
    createVehicleUnitDownloadActivityTechnicalRecord,
    createVehicleUnitDownloadPeriodTechnicalRecord,
    isJsonPointer,
    isTechnicalByte,
    isTechnicalHexIdentifier,
    isTechnicalText,
    isTechnicalUnsignedLong,
    isTechnicalUnsignedShort,
    isUtcTimestamp,
} from '../index.js';

describe('driver-card technical evidence', () => {
    it('bounds technical primitive values', () => {
        expect(isTechnicalByte(0)).toBe(true);
        expect(isTechnicalByte(0xff)).toBe(true);
        expect(isTechnicalByte(0x100)).toBe(false);
        expect(isTechnicalUnsignedShort(0xff_ff)).toBe(true);
        expect(isTechnicalUnsignedShort(0x1_00_00)).toBe(false);
        expect(isTechnicalUnsignedLong(0xff_ff_ff_ff)).toBe(true);
        expect(isTechnicalUnsignedLong(0x1_00_00_00_00)).toBe(false);
        expect(isTechnicalHexIdentifier('DEADBEEF', 4)).toBe(true);
        expect(isTechnicalHexIdentifier('deadbeef', 4)).toBe(false);
        expect(isTechnicalHexIdentifier('DEADBEEF00', 4)).toBe(false);
        expect(isTechnicalText('Synthetic VU', 35)).toBe(true);
        expect(isTechnicalText(' Synthetic VU', 35)).toBe(false);
    });

    it('creates immutable ICC evidence and rejects inconsistent control periods', () => {
        const path = '/cardDataResponses/Gen2/cardIccIdentification';
        const controlPath = '/cardDataResponses/Gen2/controlActivityData';
        const controlledAtValue = Date.UTC(2026, 5, 18, 10);
        const periodBeginValue = Date.UTC(2026, 5, 17, 8);
        const periodEndValue = Date.UTC(2026, 5, 18, 8);
        if (
            !isJsonPointer(path) ||
            !isJsonPointer(controlPath) ||
            !isUtcTimestamp(controlledAtValue) ||
            !isUtcTimestamp(periodBeginValue) ||
            !isUtcTimestamp(periodEndValue)
        ) {
            throw new Error('Synthetic technical evidence must be valid.');
        }

        const icc = createCardIccTechnicalData({
            approvalNumber: 'APPROVAL',
            clockStop: 0,
            embedder: {
                countryCode: 'DE',
                manufacturerInformation: [4, 5],
                moduleEmbedder: '01',
            },
            extendedSerialNumber: {
                manufacturerCode: 2,
                monthYear: '0626',
                serialNumber: 123_456,
                type: 1,
            },
            icIdentifier: [6, 7],
            personaliserId: 3,
            source: createSourceReference('driverCard', 'g2', path),
        });
        const controlSource = createSourceReference('driverCard', 'g2', controlPath);
        const valid = createCardControlActivityTechnicalRecord({
            controlCard: null,
            controlledAt: controlledAtValue,
            controlType: 'cardDownloaded',
            downloadPeriodBegin: periodBeginValue,
            downloadPeriodEnd: periodEndValue,
            registrationMemberState: null,
            registrationNumber: null,
            source: controlSource,
        });
        const invalid = createCardControlActivityTechnicalRecord({
            controlCard: null,
            controlledAt: controlledAtValue,
            controlType: 'cardDownloaded',
            downloadPeriodBegin: periodEndValue,
            downloadPeriodEnd: periodBeginValue,
            registrationMemberState: null,
            registrationNumber: null,
            source: controlSource,
        });

        expect(valid).not.toBeNull();
        expect(invalid).toBeNull();
        expect(icc).not.toBeNull();
    });

    it('creates immutable Vehicle Unit download evidence and rejects inverted periods', () => {
        const path = '/transferResParams/0/data/Control/vuDownloadablePeriod';
        const activityPath = '/transferResParams/0/data/Control/vuDownloadActivityData';
        const periodBeginValue = Date.UTC(2026, 5, 1);
        const periodEndValue = Date.UTC(2026, 5, 18);
        if (
            !isJsonPointer(path) ||
            !isJsonPointer(activityPath) ||
            !isUtcTimestamp(periodBeginValue) ||
            !isUtcTimestamp(periodEndValue)
        ) {
            throw new Error('Synthetic VU technical evidence must be valid.');
        }
        const source = createSourceReference('vehicleUnit', 'g1', path);
        const valid = createVehicleUnitDownloadPeriodTechnicalRecord({
            periodBegin: periodBeginValue,
            periodEnd: periodEndValue,
            source,
        });
        const invalid = createVehicleUnitDownloadPeriodTechnicalRecord({
            periodBegin: periodEndValue,
            periodEnd: periodBeginValue,
            source,
        });
        const activity = createVehicleUnitDownloadActivityTechnicalRecord({
            card: null,
            downloadedAt: periodEndValue,
            operatorName: 'Synthetic workshop',
            source: createSourceReference('vehicleUnit', 'g1', activityPath),
        });

        expect(valid).not.toBeNull();
        expect(invalid).toBeNull();
        expect(activity).not.toBeNull();
    });
});
