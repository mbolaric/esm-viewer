import type { ISourceReference } from './source-reference.js';
import type { TachographGeneration } from './tachograph.js';
import type { UtcTimestamp } from './time.js';

declare const cardNumberBrand: unique symbol;
declare const identityNameBrand: unique symbol;
declare const issuingMemberStateBrand: unique symbol;
declare const rawMemberStateBrand: unique symbol;
declare const vehicleIdentificationNumberBrand: unique symbol;
declare const vehicleRegistrationNumberBrand: unique symbol;

export type CardNumber = string & {
    readonly [cardNumberBrand]: 'CardNumber';
};

export type IdentityName = string & {
    readonly [identityNameBrand]: 'IdentityName';
};

export type IssuingMemberState = string & {
    readonly [issuingMemberStateBrand]: 'IssuingMemberState';
};

export type RawMemberState = string & {
    readonly [rawMemberStateBrand]: 'RawMemberState';
};

export type RecordedIssuingMemberState = IssuingMemberState | RawMemberState;

export type VehicleIdentificationNumber = string & {
    readonly [vehicleIdentificationNumberBrand]: 'VehicleIdentificationNumber';
};

export type VehicleRegistrationNumber = string & {
    readonly [vehicleRegistrationNumberBrand]: 'VehicleRegistrationNumber';
};

export interface IDriverIdentity {
    readonly cardExpiryDate: UtcTimestamp | null;
    readonly cardHolderBirthDate: UtcTimestamp | null;
    readonly cardIssueDate: UtcTimestamp | null;
    readonly cardValidityBegin: UtcTimestamp | null;
    readonly cardIssuingAuthorityName: string | null;
    readonly cardNumber: CardNumber;
    readonly firstNames: IdentityName | null;
    readonly issuingMemberState: RecordedIssuingMemberState | null;
    readonly kind: 'driver';
    readonly source: ISourceReference<TachographGeneration, 'driverCard'>;
    readonly surname: IdentityName | null;
}

export interface IVehicleIdentity {
    readonly kind: 'vehicle';
    readonly registrationMemberState: RecordedIssuingMemberState | null;
    readonly registrationNumber: VehicleRegistrationNumber | null;
    readonly source: ISourceReference<TachographGeneration, 'vehicleUnit'>;
    readonly vehicleIdentificationNumber: VehicleIdentificationNumber | null;
}

export type TachographIdentity = IDriverIdentity | IVehicleIdentity;

function isTrimmedStringWithinLength(value: unknown, minimumLength: number, maximumLength: number): value is string {
    return typeof value === 'string' && value.length >= minimumLength && value.length <= maximumLength && value.trim() === value;
}

export function isCardNumber(value: unknown): value is CardNumber {
    return isTrimmedStringWithinLength(value, 16, 16);
}

export function isIdentityName(value: unknown): value is IdentityName {
    return isTrimmedStringWithinLength(value, 1, 35);
}

export function isRawMemberState(value: string): value is RawMemberState {
    return value.length > 0;
}

export function isIssuingMemberState(value: unknown): value is IssuingMemberState {
    return isTrimmedStringWithinLength(value, 1, 3);
}

export function isVehicleIdentificationNumber(value: unknown): value is VehicleIdentificationNumber {
    return isTrimmedStringWithinLength(value, 17, 17);
}

export function isVehicleRegistrationNumber(value: unknown): value is VehicleRegistrationNumber {
    return isTrimmedStringWithinLength(value, 1, 13);
}

export interface IDriverIdentityInput {
    readonly cardExpiryDate: UtcTimestamp | null;
    readonly cardHolderBirthDate: UtcTimestamp | null;
    readonly cardIssueDate: UtcTimestamp | null;
    readonly cardValidityBegin: UtcTimestamp | null;
    readonly cardIssuingAuthorityName: string | null;
    readonly cardNumber: CardNumber;
    readonly firstNames: IdentityName | null;
    readonly issuingMemberState: RecordedIssuingMemberState | null;
    readonly source: ISourceReference<TachographGeneration, 'driverCard'>;
    readonly surname: IdentityName | null;
}

export function createDriverIdentity(input: IDriverIdentityInput): IDriverIdentity {
    return {
        cardExpiryDate: input.cardExpiryDate,
        cardHolderBirthDate: input.cardHolderBirthDate,
        cardIssueDate: input.cardIssueDate,
        cardValidityBegin: input.cardValidityBegin,
        cardIssuingAuthorityName: input.cardIssuingAuthorityName,
        cardNumber: input.cardNumber,
        firstNames: input.firstNames,
        issuingMemberState: input.issuingMemberState,
        kind: 'driver',
        source: input.source,
        surname: input.surname,
    };
}

export interface IVehicleIdentityInput {
    readonly registrationMemberState: RecordedIssuingMemberState | null;
    readonly registrationNumber: VehicleRegistrationNumber | null;
    readonly source: ISourceReference<TachographGeneration, 'vehicleUnit'>;
    readonly vehicleIdentificationNumber: VehicleIdentificationNumber | null;
}

export function createVehicleIdentity(input: IVehicleIdentityInput): IVehicleIdentity | null {
    if (input.vehicleIdentificationNumber === null && input.registrationNumber === null) {
        return null;
    }

    return {
        kind: 'vehicle',
        registrationMemberState: input.registrationMemberState,
        registrationNumber: input.registrationNumber,
        source: input.source,
        vehicleIdentificationNumber: input.vehicleIdentificationNumber,
    };
}

declare const cardNotesTextBrand: unique symbol;

export type CardNotesText = string & {
    readonly [cardNotesTextBrand]: 'CardNotesText';
};

const maximumCardNotesLength = 512;

export function isCardNotesText(value: unknown): value is CardNotesText {
    return isTrimmedStringWithinLength(value, 1, maximumCardNotesLength);
}

export interface ICardNotes {
    readonly kind: 'cardNotes';
    readonly source: ISourceReference<TachographGeneration, 'driverCard'>;
    readonly text: CardNotesText;
}

export interface ICardNotesInput {
    readonly source: ISourceReference<TachographGeneration, 'driverCard'>;
    readonly text: CardNotesText;
}

export function createCardNotes(input: ICardNotesInput): ICardNotes {
    return {
        kind: 'cardNotes',
        source: input.source,
        text: input.text,
    };
}
