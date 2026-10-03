import { describe, expect, it } from 'vitest';

import {
    fixtureActivityInterval,
    fixtureCardNumber,
    fixtureDriverIdentity,
    fixtureUtcTimestamp,
    fixtureVehicleIdentity,
} from '#testing';
import { calculateActivityTotals } from '../activity.js';

describe('fixture builders', () => {
    it('produces an immutable driver identity with golden default values', () => {
        const identity = fixtureDriverIdentity();

        expect(identity).toEqual({
            cardExpiryDate: 1_894_771_200_000,
            cardHolderBirthDate: 631_152_000_000,
            cardIssueDate: 1_515_264_000_000,
            cardValidityBegin: 1_515_264_000_000,
            cardIssuingAuthorityName: 'Synthetic Authority',
            cardNumber: 'SYNTHETICCARD001',
            firstNames: 'Synthetic',
            issuingMemberState: 'D',
            kind: 'driver',
            source: {
                documentKind: 'driverCard',
                generation: 'g2',
                path: '/driverCard/g2/identification',
            },
            surname: 'Driver',
        });
    });

    it('preserves defaults when no overrides are provided', () => {
        const identity = fixtureDriverIdentity({});

        expect(identity.cardNumber).toBe('SYNTHETICCARD001');
        expect(identity.firstNames).toBe('Synthetic');
        expect(identity.surname).toBe('Driver');
    });

    it('uses overrides for every provided identity field', () => {
        const identity = fixtureDriverIdentity({
            cardNumber: fixtureCardNumber('ZZZZZZZZZZZZZZZZ'),
        });

        expect(identity.cardNumber).toBe('ZZZZZZZZZZZZZZZZ');
        expect(identity.firstNames).toBe('Synthetic');
    });

    it('preserves explicit null overrides for absent driver evidence', () => {
        const identity = fixtureDriverIdentity({
            cardExpiryDate: null,
            cardHolderBirthDate: null,
            cardIssueDate: null,
            firstNames: null,
            issuingMemberState: null,
            surname: null,
        });

        expect(identity).toMatchObject({
            cardExpiryDate: null,
            cardHolderBirthDate: null,
            cardIssueDate: null,
            firstNames: null,
            issuingMemberState: null,
            surname: null,
        });
    });

    it('produces an immutable vehicle identity with golden default values', () => {
        const identity = fixtureVehicleIdentity();

        expect(identity).toEqual({
            kind: 'vehicle',
            registrationMemberState: 'D',
            registrationNumber: 'TEST-000',
            source: {
                documentKind: 'vehicleUnit',
                generation: 'g2',
                path: '/vehicleUnit/g2/overview',
            },
            vehicleIdentificationNumber: 'SYNTHETICVIN00001',
        });
    });

    it('preserves explicit null vehicle fields and rejects a fixture without identifiers', () => {
        const identity = fixtureVehicleIdentity({
            registrationMemberState: null,
            vehicleIdentificationNumber: null,
        });

        expect(identity.registrationMemberState).toBeNull();
        expect(identity.registrationNumber).toBe('TEST-000');
        expect(identity.vehicleIdentificationNumber).toBeNull();

        expect(() =>
            fixtureVehicleIdentity({
                registrationNumber: null,
                vehicleIdentificationNumber: null,
            }),
        ).toThrow('must have at least one identifier');
    });

    it('throws an informative error for an invalid timestamp', () => {
        expect(() => fixtureUtcTimestamp(Number.NaN)).toThrow('not a valid UTC epoch-millisecond value');
    });

    it('produces activity intervals usable in totals calculation', () => {
        const morning = fixtureActivityInterval('driving', 0, 14_400_000, '/activities/0');
        const afternoon = fixtureActivityInterval('work', 18_000_000, 28_800_000, '/activities/1');

        const calculation = calculateActivityTotals([morning, afternoon]);

        expect(calculation.status).toBe('calculated');

        if (calculation.status === 'calculated') {
            expect(calculation.totals.driving).toBe(14_400_000);
            expect(calculation.totals.work).toBe(10_800_000);
        }
    });
});
