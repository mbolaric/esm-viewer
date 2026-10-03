import { describe, expect, it } from 'vitest';

import {
    createCardNotes,
    createDriverIdentity,
    createSourceReference,
    createVehicleIdentity,
    isCardNotesText,
    isCardNumber,
    isIdentityName,
    isIssuingMemberState,
    isJsonPointer,
    isUtcTimestamp,
    isVehicleIdentificationNumber,
    isVehicleRegistrationNumber,
    type CardNotesText,
    type CardNumber,
    type IdentityName,
    type JsonPointer,
    type VehicleIdentificationNumber,
    type VehicleRegistrationNumber,
} from '../index.js';

function createTestPath(value: string): JsonPointer {
    if (!isJsonPointer(value)) {
        throw new TypeError('The test source path must be a canonical JSON Pointer.');
    }

    return value;
}

function createTestCardNumber(value: string): CardNumber {
    if (!isCardNumber(value)) {
        throw new TypeError('The test card number must be normalized.');
    }

    return value;
}

function createTestIdentityName(value: string): IdentityName {
    if (!isIdentityName(value)) {
        throw new TypeError('The test identity name must be normalized.');
    }

    return value;
}

function createTestVehicleIdentificationNumber(value: string): VehicleIdentificationNumber {
    if (!isVehicleIdentificationNumber(value)) {
        throw new TypeError('The test vehicle identification number must be normalized.');
    }

    return value;
}

function createTestVehicleRegistrationNumber(value: string): VehicleRegistrationNumber {
    if (!isVehicleRegistrationNumber(value)) {
        throw new TypeError('The test vehicle registration number must be normalized.');
    }

    return value;
}

function createTestCardNotesText(value: string): CardNotesText {
    if (!isCardNotesText(value)) {
        throw new TypeError('The test card-notes text must be normalized.');
    }

    return value;
}

describe('identity value guards', () => {
    it.each([
        [isCardNumber, 'ABC1234567890123'],
        [isIdentityName, 'Example'],
        [isIssuingMemberState, 'D'],
        [isIssuingMemberState, 'UK'],
        [isIssuingMemberState, 'DEU'],
        [isVehicleIdentificationNumber, 'WVWZZZ1JZXW000001'],
        [isVehicleRegistrationNumber, 'TEST-123'],
    ])('accepts a normalized identity value', (guard, value: string) => {
        expect(guard(value)).toBe(true);
    });

    it.each([
        [isCardNumber, 'ABC123'],
        [isIdentityName, ''],
        [isIdentityName, ' Example'],
        [isIdentityName, 'E'.repeat(36)],
        [isIssuingMemberState, 'DEUT'],
        [isVehicleIdentificationNumber, 'WVWZZZ1JZXW00001'],
        [isVehicleRegistrationNumber, 'TEST-1234567890'],
        [isVehicleRegistrationNumber, 'TEST-123 '],
    ])('rejects a malformed or non-normalized identity value', (guard, value: string) => {
        expect(guard(value)).toBe(false);
    });
});

describe('normalized identities', () => {
    it('creates an immutable driver identity with explicit absent names', () => {
        const source = createSourceReference('driverCard', 'g2', createTestPath('/driverCard/gen2/identification'));
        const identity = createDriverIdentity({
            cardExpiryDate: null,
            cardHolderBirthDate: null,
            cardIssueDate: null,
            cardValidityBegin: null,
            cardIssuingAuthorityName: null,
            cardNumber: createTestCardNumber('ABC1234567890123'),
            firstNames: null,
            issuingMemberState: null,
            source,
            surname: null,
        });

        expect(identity).toEqual({
            cardExpiryDate: null,
            cardHolderBirthDate: null,
            cardIssueDate: null,
            cardValidityBegin: null,
            cardIssuingAuthorityName: null,
            cardNumber: 'ABC1234567890123',
            firstNames: null,
            issuingMemberState: null,
            kind: 'driver',
            source,
            surname: null,
        });
    });

    it('creates an immutable vehicle identity when either core identifier exists', () => {
        const source = createSourceReference('vehicleUnit', 'g2v2', createTestPath('/vehicleUnit/gen2v2/overview'));
        const identity = createVehicleIdentity({
            registrationMemberState: null,
            registrationNumber: createTestVehicleRegistrationNumber('TEST-123'),
            source,
            vehicleIdentificationNumber: createTestVehicleIdentificationNumber('WVWZZZ1JZXW000001'),
        });

        expect(identity).toEqual({
            kind: 'vehicle',
            registrationMemberState: null,
            registrationNumber: 'TEST-123',
            source,
            vehicleIdentificationNumber: 'WVWZZZ1JZXW000001',
        });
    });

    it('does not invent a vehicle identity without a VIN or registration number', () => {
        const source = createSourceReference('vehicleUnit', 'g1', createTestPath('/vehicleUnit/gen1/overview'));

        expect(
            createVehicleIdentity({
                registrationMemberState: null,
                registrationNumber: null,
                source,
                vehicleIdentificationNumber: null,
            }),
        ).toBeNull();
    });

    it('preserves normalized driver names as source evidence', () => {
        const source = createSourceReference('driverCard', 'g1', createTestPath('/driverCard/gen1/identification'));

        expect(
            createDriverIdentity({
                cardExpiryDate: null,
                cardHolderBirthDate: null,
                cardIssueDate: null,
                cardValidityBegin: null,
                cardIssuingAuthorityName: null,
                cardNumber: createTestCardNumber('ABC1234567890123'),
                firstNames: createTestIdentityName('Alex'),
                issuingMemberState: null,
                source,
                surname: createTestIdentityName('Example'),
            }),
        ).toMatchObject({
            firstNames: 'Alex',
            surname: 'Example',
        });
    });

    it('preserves birth date timestamp when present', () => {
        const source = createSourceReference('driverCard', 'g1', createTestPath('/driverCard/gen1/identification'));
        const birthDate = 631_152_000_000;
        if (!isUtcTimestamp(birthDate)) {
            throw new TypeError('Birth date must be a valid UTC timestamp.');
        }

        const identity = createDriverIdentity({
            cardExpiryDate: null,
            cardHolderBirthDate: birthDate,
            cardIssueDate: null,
            cardValidityBegin: null,
            cardIssuingAuthorityName: null,
            cardNumber: createTestCardNumber('ABC1234567890123'),
            firstNames: null,
            issuingMemberState: null,
            source,
            surname: null,
        });

        expect(identity.cardHolderBirthDate).toBe(birthDate);
    });
});

describe('card notes', () => {
    it.each([['A'], ['Card holder changed surname.'], ['x'.repeat(512)]])(
        'accepts a normalized card-notes text %#',
        (value: string) => {
            expect(isCardNotesText(value)).toBe(true);
        },
    );

    it.each([[''], [' padded'], ['x'.repeat(513)]])(
        'rejects an empty, padded, or over-length card-notes text %#',
        (value: string) => {
            expect(isCardNotesText(value)).toBe(false);
        },
    );

    it('creates a card-notes record with its canonical source', () => {
        const source = createSourceReference('driverCard', 'g2', createTestPath('/cardDataResponses/gen2/cardNotes'));

        expect(
            createCardNotes({
                source,
                text: createTestCardNotesText('Card holder changed surname.'),
            }),
        ).toEqual({
            kind: 'cardNotes',
            source,
            text: 'Card holder changed surname.',
        });
    });
});
