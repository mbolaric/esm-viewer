import { describe, expect, it } from 'vitest';

import {
    createAccumulatedDrivingPosition,
    createDailyWorkPeriodPlace,
    createGnssPositionEvidence,
    createSourceReference,
    isGnssAccuracyIndicator,
    isGnssAuthenticationStatus,
    isJsonPointer,
    isLatitude,
    isLongitude,
    isOdometerKilometres,
    isUtcTimestamp,
} from '../index.js';

describe('tachograph locations', () => {
    it('bounds coordinate and GNSS source primitives', () => {
        expect(isLatitude(-90)).toBe(true);
        expect(isLatitude(90)).toBe(true);
        expect(isLatitude(-90.000_001)).toBe(false);
        expect(isLongitude(-180)).toBe(true);
        expect(isLongitude(180)).toBe(true);
        expect(isLongitude(180.000_001)).toBe(false);
        expect(isLatitude(0x7f_ff_ff / 600_000)).toBe(false);
        expect(isLongitude(0x7f_ff_ff / 600_000)).toBe(false);
        expect(isGnssAccuracyIndicator(0)).toBe(true);
        expect(isGnssAccuracyIndicator(0xff)).toBe(true);
        expect(isGnssAccuracyIndicator(0x100)).toBe(false);
        expect(isGnssAuthenticationStatus(3)).toBe(true);
        expect(isGnssAuthenticationStatus(-1)).toBe(false);
    });

    it('creates immutable place and accumulated-driving evidence', () => {
        const latitude = 40.4168;
        const longitude = -3.7038;
        const accuracy = 2;
        const authenticationStatus = 1;
        const determinedAt = Date.UTC(2026, 5, 18, 8, 38, 58);
        const entryAt = Date.UTC(2026, 5, 18, 8, 39);
        const recordedAt = Date.UTC(2026, 5, 18, 11, 39);
        const odometer = 12_338;
        const path = '/cardDataResponses/places/placeRecords/0';
        if (
            !isLatitude(latitude) ||
            !isLongitude(longitude) ||
            !isGnssAccuracyIndicator(accuracy) ||
            !isGnssAuthenticationStatus(authenticationStatus) ||
            !isUtcTimestamp(determinedAt) ||
            !isUtcTimestamp(entryAt) ||
            !isUtcTimestamp(recordedAt) ||
            !isOdometerKilometres(odometer) ||
            !isJsonPointer(path)
        ) {
            throw new Error('The synthetic location evidence must be valid.');
        }

        const position = createGnssPositionEvidence({
            accuracy,
            authenticationStatus,
            coordinates: { latitude, longitude },
            determinedAt,
        });
        const source = createSourceReference('driverCard', 'g2', path);
        const place = createDailyWorkPeriodPlace({
            card: null,
            country: null,
            entryAt,
            entryType: 'beginCardInsertion',
            odometer,
            position,
            region: 'Madrid',
            source,
        });
        const accumulated = createAccumulatedDrivingPosition({
            coDriverCard: null,
            driverCard: null,
            odometer,
            position,
            recordedAt,
            source,
        });

        expect(place).toMatchObject({
            entryAt,
            entryType: 'beginCardInsertion',
            kind: 'dailyWorkPeriodPlace',
            region: 'Madrid',
        });
        expect(accumulated).toMatchObject({
            kind: 'accumulatedDrivingPosition',
            recordedAt,
        });
    });
});
