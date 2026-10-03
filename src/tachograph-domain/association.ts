import type {
    CardNumber,
    IdentityName,
    RecordedIssuingMemberState,
    VehicleIdentificationNumber,
    VehicleRegistrationNumber,
} from './identity.js';
import type { ISourceReference } from './source-reference.js';
import type { TachographGeneration } from './tachograph.js';
import type { UtcTimestamp } from './time.js';

declare const odometerKilometresBrand: unique symbol;

export type OdometerKilometres = number & {
    readonly [odometerKilometresBrand]: 'OdometerKilometres';
};

// Same spelling as the parser's CardSlotNumber, so normalizers assign it without translation.
export type CardSlot = 'CoDriver' | 'Driver' | 'Unknown';
export type InsertedCardType = 'companyCard' | 'controlCard' | 'driverCard' | 'unknown' | 'workshopCard';

export interface IVehicleUse {
    readonly firstUse: UtcTimestamp;
    readonly kind: 'vehicleUse';
    // Null indicates the vehicle session was open when downloaded while inserted.
    readonly lastUse: UtcTimestamp | null;
    readonly odometerBegin: OdometerKilometres | null;
    readonly odometerEnd: OdometerKilometres | null;
    readonly registrationMemberState: RecordedIssuingMemberState | null;
    readonly registrationNumber: VehicleRegistrationNumber | null;
    readonly source: ISourceReference<TachographGeneration, 'driverCard'>;
    readonly vehicleIdentificationNumber: VehicleIdentificationNumber | null;
}

export interface ICardUse {
    readonly cardExpiryDate: UtcTimestamp | null;
    readonly cardNumber: CardNumber | null;
    readonly cardType: InsertedCardType;
    readonly firstNames: IdentityName | null;
    readonly insertion: UtcTimestamp;
    readonly issuingMemberState: RecordedIssuingMemberState | null;
    readonly kind: 'cardUse';
    readonly odometerAtInsertion: OdometerKilometres | null;
    readonly odometerAtWithdrawal: OdometerKilometres | null;
    readonly slot: CardSlot;
    readonly source: ISourceReference<TachographGeneration, 'vehicleUnit'>;
    readonly surname: IdentityName | null;
    readonly withdrawal: UtcTimestamp | null;
}

export type TachographAssociation = ICardUse | IVehicleUnitUse | IVehicleUse;

const maximumOdometerKilometres = 0xff_ff_fe;

export function isOdometerKilometres(value: unknown): value is OdometerKilometres {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= maximumOdometerKilometres;
}

export function getOdometerDistance(begin: OdometerKilometres | null, end: OdometerKilometres | null): OdometerKilometres | null {
    if (begin === null || end === null || begin > end) {
        return null;
    }

    const distance = end - begin;
    return isOdometerKilometres(distance) ? distance : null;
}

function hasConsistentOdometers(begin: OdometerKilometres | null, end: OdometerKilometres | null): boolean {
    return begin === null || end === null || begin <= end;
}

export interface IVehicleUseInput {
    readonly firstUse: UtcTimestamp;
    readonly lastUse: UtcTimestamp | null;
    readonly odometerBegin: OdometerKilometres | null;
    readonly odometerEnd: OdometerKilometres | null;
    readonly registrationMemberState: RecordedIssuingMemberState | null;
    readonly registrationNumber: VehicleRegistrationNumber | null;
    readonly source: ISourceReference<TachographGeneration, 'driverCard'>;
    readonly vehicleIdentificationNumber: VehicleIdentificationNumber | null;
}

export function createVehicleUse(input: IVehicleUseInput): IVehicleUse | null {
    if (
        (input.lastUse !== null && input.firstUse > input.lastUse) ||
        !hasConsistentOdometers(input.odometerBegin, input.odometerEnd)
    ) {
        return null;
    }

    return {
        firstUse: input.firstUse,
        kind: 'vehicleUse',
        lastUse: input.lastUse,
        odometerBegin: input.odometerBegin,
        odometerEnd: input.odometerEnd,
        registrationMemberState: input.registrationMemberState,
        registrationNumber: input.registrationNumber,
        source: input.source,
        vehicleIdentificationNumber: input.vehicleIdentificationNumber,
    };
}

export interface ICardUseInput {
    readonly cardExpiryDate: UtcTimestamp | null;
    readonly cardNumber: CardNumber | null;
    readonly cardType: InsertedCardType;
    readonly firstNames: IdentityName | null;
    readonly insertion: UtcTimestamp;
    readonly issuingMemberState: RecordedIssuingMemberState | null;
    readonly odometerAtInsertion: OdometerKilometres | null;
    readonly odometerAtWithdrawal: OdometerKilometres | null;
    readonly slot: CardSlot;
    readonly source: ISourceReference<TachographGeneration, 'vehicleUnit'>;
    readonly surname: IdentityName | null;
    readonly withdrawal: UtcTimestamp | null;
}

export function createCardUse(input: ICardUseInput): ICardUse | null {
    if (
        (input.withdrawal !== null && input.insertion > input.withdrawal) ||
        !hasConsistentOdometers(input.odometerAtInsertion, input.odometerAtWithdrawal)
    ) {
        return null;
    }

    return {
        cardExpiryDate: input.cardExpiryDate,
        cardNumber: input.cardNumber,
        cardType: input.cardType,
        firstNames: input.firstNames,
        insertion: input.insertion,
        issuingMemberState: input.issuingMemberState,
        kind: 'cardUse',
        odometerAtInsertion: input.odometerAtInsertion,
        odometerAtWithdrawal: input.odometerAtWithdrawal,
        slot: input.slot,
        source: input.source,
        surname: input.surname,
        withdrawal: input.withdrawal,
    };
}

export interface IVehicleUnitUse {
    readonly deviceID: number;
    readonly kind: 'vehicleUnitUse';
    readonly manufacturerCode: number;
    readonly source: ISourceReference<TachographGeneration, 'driverCard'>;
    readonly usedAt: UtcTimestamp;
    readonly vuSoftwareVersion: string;
}

export interface IVehicleUnitUseInput {
    readonly deviceID: number;
    readonly manufacturerCode: number;
    readonly source: ISourceReference<TachographGeneration, 'driverCard'>;
    readonly usedAt: UtcTimestamp;
    readonly vuSoftwareVersion: string;
}

export function createVehicleUnitUse(input: IVehicleUnitUseInput): IVehicleUnitUse {
    return {
        deviceID: input.deviceID,
        kind: 'vehicleUnitUse',
        manufacturerCode: input.manufacturerCode,
        source: input.source,
        usedAt: input.usedAt,
        vuSoftwareVersion: input.vuSoftwareVersion,
    };
}
