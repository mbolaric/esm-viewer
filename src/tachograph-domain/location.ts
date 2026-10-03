import type { OdometerKilometres } from './association.js';
import type { InsertedCardType } from './association.js';
import type { CardNumber, RecordedIssuingMemberState } from './identity.js';
import type { ISourceReference } from './source-reference.js';
import type { UtcTimestamp } from './time.js';

declare const gnssAccuracyIndicatorBrand: unique symbol;
declare const gnssAuthenticationStatusBrand: unique symbol;
declare const latitudeBrand: unique symbol;
declare const longitudeBrand: unique symbol;

export type GnssAccuracyIndicator = number & {
    readonly [gnssAccuracyIndicatorBrand]: 'GnssAccuracyIndicator';
};

export type GnssAuthenticationStatus = number & {
    readonly [gnssAuthenticationStatusBrand]: 'GnssAuthenticationStatus';
};

export type Latitude = number & {
    readonly [latitudeBrand]: 'Latitude';
};

export type Longitude = number & {
    readonly [longitudeBrand]: 'Longitude';
};

export type DailyWorkPeriodEntryType =
    | 'beginAssumedByVehicleUnit'
    | 'beginCardInsertion'
    | 'beginGnss'
    | 'beginManual'
    | 'endAssumedByVehicleUnit'
    | 'endCardWithdrawal'
    | 'endGnss'
    | 'endManual'
    | 'unknown';

export type DailyWorkPeriodRegion = string;

export interface IRecordedCardReference {
    readonly cardNumber: CardNumber | null;
    readonly cardType: InsertedCardType;
    readonly issuingMemberState: RecordedIssuingMemberState | null;
}

export interface IGeoCoordinates {
    readonly latitude: Latitude;
    readonly longitude: Longitude;
}

export interface IGnssPositionEvidence {
    readonly accuracy: GnssAccuracyIndicator;
    readonly authenticationStatus: GnssAuthenticationStatus | null;
    readonly coordinates: IGeoCoordinates;
    readonly determinedAt: UtcTimestamp;
}

export interface IDailyWorkPeriodPlace {
    readonly card: IRecordedCardReference | null;
    readonly country: RecordedIssuingMemberState | null;
    readonly entryAt: UtcTimestamp;
    readonly entryType: DailyWorkPeriodEntryType;
    readonly kind: 'dailyWorkPeriodPlace';
    readonly odometer: OdometerKilometres | null;
    readonly position: IGnssPositionEvidence | null;
    readonly region: DailyWorkPeriodRegion | null;
    readonly source: ISourceReference;
}

export interface IAccumulatedDrivingPosition {
    readonly coDriverCard: IRecordedCardReference | null;
    readonly driverCard: IRecordedCardReference | null;
    readonly kind: 'accumulatedDrivingPosition';
    readonly odometer: OdometerKilometres | null;
    readonly position: IGnssPositionEvidence;
    readonly recordedAt: UtcTimestamp;
    readonly source: ISourceReference;
}

export interface IBorderCrossing {
    readonly countryEntered: RecordedIssuingMemberState | null;
    readonly countryLeft: RecordedIssuingMemberState | null;
    readonly crossedAt: UtcTimestamp;
    readonly kind: 'borderCrossing';
    readonly odometer: OdometerKilometres | null;
    readonly position: IGnssPositionEvidence;
    readonly source: ISourceReference;
}

export type LoadUnloadOperationType = 'load' | 'unload' | 'simultaneous' | 'reserved' | 'unknown';

export interface ILoadUnloadOperation {
    readonly country: RecordedIssuingMemberState | null;
    readonly kind: 'loadUnloadOperation';
    readonly odometer: OdometerKilometres | null;
    readonly operationAt: UtcTimestamp;
    readonly operationType: LoadUnloadOperationType;
    readonly position: IGnssPositionEvidence;
    readonly region: DailyWorkPeriodRegion | null;
    readonly source: ISourceReference;
}

export type LoadTypeKind = 'goods' | 'passengers' | 'undefined' | 'unknown';

export interface ILoadTypeEntry {
    readonly enteredAt: UtcTimestamp;
    readonly kind: 'loadTypeEntry';
    readonly loadType: LoadTypeKind;
    readonly source: ISourceReference;
}

export type TachographLocationRecord =
    IDailyWorkPeriodPlace | IAccumulatedDrivingPosition | IBorderCrossing | ILoadUnloadOperation | ILoadTypeEntry;

const maximumByteValue = 0xff;
const parserUnknownCoordinate = 0x7f_ff_ff / 600_000;

export function isGnssAccuracyIndicator(value: unknown): value is GnssAccuracyIndicator {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= maximumByteValue;
}

export function isGnssAuthenticationStatus(value: unknown): value is GnssAuthenticationStatus {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= maximumByteValue;
}

export function isLatitude(value: unknown): value is Latitude {
    return (
        typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90 && value !== parserUnknownCoordinate
    );
}

export function isLongitude(value: unknown): value is Longitude {
    return (
        typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180 && value !== parserUnknownCoordinate
    );
}

export interface IGnssPositionEvidenceInput {
    readonly accuracy: GnssAccuracyIndicator;
    readonly authenticationStatus: GnssAuthenticationStatus | null;
    readonly coordinates: IGeoCoordinates;
    readonly determinedAt: UtcTimestamp;
}

export function createGnssPositionEvidence(input: IGnssPositionEvidenceInput): IGnssPositionEvidence {
    return {
        accuracy: input.accuracy,
        authenticationStatus: input.authenticationStatus,
        coordinates: {
            latitude: input.coordinates.latitude,
            longitude: input.coordinates.longitude,
        },
        determinedAt: input.determinedAt,
    };
}

export interface IDailyWorkPeriodPlaceInput {
    readonly card: IRecordedCardReference | null;
    readonly country: RecordedIssuingMemberState | null;
    readonly entryAt: UtcTimestamp;
    readonly entryType: DailyWorkPeriodEntryType;
    readonly odometer: OdometerKilometres | null;
    readonly position: IGnssPositionEvidence | null;
    readonly region: DailyWorkPeriodRegion | null;
    readonly source: ISourceReference;
}

export function createDailyWorkPeriodPlace(input: IDailyWorkPeriodPlaceInput): IDailyWorkPeriodPlace {
    return {
        card: input.card === null ? null : { ...input.card },
        country: input.country,
        entryAt: input.entryAt,
        entryType: input.entryType,
        kind: 'dailyWorkPeriodPlace',
        odometer: input.odometer,
        position: input.position,
        region: input.region,
        source: input.source,
    };
}

export interface IAccumulatedDrivingPositionInput {
    readonly coDriverCard: IRecordedCardReference | null;
    readonly driverCard: IRecordedCardReference | null;
    readonly odometer: OdometerKilometres | null;
    readonly position: IGnssPositionEvidence;
    readonly recordedAt: UtcTimestamp;
    readonly source: ISourceReference;
}

export function createAccumulatedDrivingPosition(input: IAccumulatedDrivingPositionInput): IAccumulatedDrivingPosition {
    return {
        coDriverCard: input.coDriverCard === null ? null : { ...input.coDriverCard },
        driverCard: input.driverCard === null ? null : { ...input.driverCard },
        kind: 'accumulatedDrivingPosition',
        odometer: input.odometer,
        position: input.position,
        recordedAt: input.recordedAt,
        source: input.source,
    };
}

export interface IBorderCrossingInput {
    readonly countryEntered: RecordedIssuingMemberState | null;
    readonly countryLeft: RecordedIssuingMemberState | null;
    readonly crossedAt: UtcTimestamp;
    readonly odometer: OdometerKilometres | null;
    readonly position: IGnssPositionEvidence;
    readonly source: ISourceReference;
}

export function createBorderCrossing(input: IBorderCrossingInput): IBorderCrossing {
    return {
        countryEntered: input.countryEntered,
        countryLeft: input.countryLeft,
        crossedAt: input.crossedAt,
        kind: 'borderCrossing',
        odometer: input.odometer,
        position: input.position,
        source: input.source,
    };
}

export interface ILoadUnloadOperationInput {
    readonly country: RecordedIssuingMemberState | null;
    readonly odometer: OdometerKilometres | null;
    readonly operationAt: UtcTimestamp;
    readonly operationType: LoadUnloadOperationType;
    readonly position: IGnssPositionEvidence;
    readonly region: DailyWorkPeriodRegion | null;
    readonly source: ISourceReference;
}

export function createLoadUnloadOperation(input: ILoadUnloadOperationInput): ILoadUnloadOperation {
    return {
        country: input.country,
        kind: 'loadUnloadOperation',
        odometer: input.odometer,
        operationAt: input.operationAt,
        operationType: input.operationType,
        position: input.position,
        region: input.region,
        source: input.source,
    };
}

export interface ILoadTypeEntryInput {
    readonly enteredAt: UtcTimestamp;
    readonly loadType: LoadTypeKind;
    readonly source: ISourceReference;
}

export function createLoadTypeEntry(input: ILoadTypeEntryInput): ILoadTypeEntry {
    return {
        enteredAt: input.enteredAt,
        kind: 'loadTypeEntry',
        loadType: input.loadType,
        source: input.source,
    };
}
