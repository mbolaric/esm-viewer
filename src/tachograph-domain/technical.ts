import type { InsertedCardType } from './association.js';
import type { IRecordedCardReference } from './location.js';
import type { OdometerKilometres } from './association.js';
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

declare const drivingLicenceNumberBrand: unique symbol;
declare const technicalHexIdentifierBrand: unique symbol;

export type DrivingLicenceNumber = string & {
    readonly [drivingLicenceNumberBrand]: 'DrivingLicenceNumber';
};

export type TechnicalHexIdentifier = string & {
    readonly [technicalHexIdentifierBrand]: 'TechnicalHexIdentifier';
};

export type CardControlActivityType =
    'calibrationParameters' | 'cardDownloaded' | 'displayUsed' | 'printingDone' | 'unknown' | 'vehicleUnitDownloaded';

export type SpecificConditionType =
    'ferryTrainCrossing' | 'ferryTrainCrossingEnd' | 'outOfScopeBegin' | 'outOfScopeEnd' | 'unknown';

export type CalibrationPurpose =
    | 'activation'
    | 'firstInstallation'
    | 'installation'
    | 'periodicInspection'
    | 'reserved'
    | 'timeAdjustmentWithoutCalibration'
    | 'unknown'
    | 'vehicleRegistrationNumberEntryByCompany';

type DriverCardTechnicalSource = ISourceReference<TachographGeneration, 'driverCard'>;
type VehicleUnitTechnicalSource = ISourceReference<TachographGeneration, 'vehicleUnit'>;

export interface ICardApplicationTechnicalData {
    readonly activityStructureLength: number;
    readonly dataElementUseVersion: number;
    readonly eventsPerType: number;
    readonly faultsPerType: number;
    readonly generation: TachographGeneration;
    readonly gnssRecords: number | null;
    readonly kind: 'cardApplicationTechnicalData';
    readonly placeRecords: number;
    readonly source: DriverCardTechnicalSource;
    readonly specificConditionRecords: number | null;
    readonly structureVersion: number;
    readonly vehicleRecords: number;
    readonly vehicleUnitRecords: number | null;
}

export interface ICardApplicationV2TechnicalData {
    readonly borderCrossingRecords: number;
    readonly followingDataLength: number;
    readonly generation: 'g2v2';
    readonly kind: 'cardApplicationV2TechnicalData';
    readonly loadTypeEntryRecords: number;
    readonly loadUnloadRecords: number;
    readonly source: DriverCardTechnicalSource;
    readonly vehicleUnitConfigurationLengthRange: number;
}

export interface ICardChipTechnicalData {
    readonly generation: TachographGeneration;
    readonly kind: 'cardChipTechnicalData';
    readonly manufacturingReference: TechnicalHexIdentifier;
    readonly serialNumber: TechnicalHexIdentifier;
    readonly source: DriverCardTechnicalSource;
}

export interface ITechnicalExtendedSerialNumber {
    readonly manufacturerCode: number;
    readonly monthYear: string;
    readonly serialNumber: number;
    readonly type: number;
}

export type ICardExtendedSerialNumber = ITechnicalExtendedSerialNumber;

export interface ICardEmbedderIdentification {
    readonly countryCode: string;
    readonly manufacturerInformation: readonly number[];
    readonly moduleEmbedder: string;
}

export interface ICardIccTechnicalData {
    readonly approvalNumber: string;
    readonly clockStop: number;
    readonly embedder: ICardEmbedderIdentification;
    readonly extendedSerialNumber: ICardExtendedSerialNumber;
    readonly generation: TachographGeneration;
    readonly icIdentifier: readonly number[];
    readonly kind: 'cardIccTechnicalData';
    readonly personaliserId: number;
    readonly source: DriverCardTechnicalSource;
}

export interface IVehicleUnitIdentificationTechnicalRecord {
    readonly ability: number | null;
    readonly approvalNumber: string;
    readonly generation: TachographGeneration;
    readonly kind: 'vehicleUnitIdentificationTechnicalRecord';
    readonly manufacturerAddress: string;
    readonly manufacturerName: string;
    readonly manufacturedAt: UtcTimestamp;
    readonly partNumber: string;
    readonly serialNumber: ITechnicalExtendedSerialNumber;
    readonly softwareInstalledAt: UtcTimestamp;
    readonly softwareVersion: string;
    readonly source: VehicleUnitTechnicalSource;
    readonly vehicleUnitGeneration: number | null;
}

export interface IVehicleUnitDownloadPeriodTechnicalRecord {
    readonly generation: TachographGeneration;
    readonly kind: 'vehicleUnitDownloadPeriodTechnicalRecord';
    readonly periodBegin: UtcTimestamp;
    readonly periodEnd: UtcTimestamp;
    readonly source: VehicleUnitTechnicalSource;
}

// Daily midnight odometer reading recorded by VU (Annex 1B/1C).
export interface IVehicleUnitDailyOdometerTechnicalRecord {
    readonly day: UtcTimestamp;
    readonly generation: TachographGeneration;
    readonly kind: 'vehicleUnitDailyOdometerTechnicalRecord';
    readonly odometerKm: OdometerKilometres | null;
    readonly source: VehicleUnitTechnicalSource;
}

export interface IVehicleUnitDownloadActivityTechnicalRecord {
    readonly card: IRecordedCardReference | null;
    readonly downloadedAt: UtcTimestamp | null;
    readonly generation: TachographGeneration;
    readonly kind: 'vehicleUnitDownloadActivityTechnicalRecord';
    readonly operatorName: string | null;
    readonly source: VehicleUnitTechnicalSource;
}

export interface IVehicleUnitCalibrationTechnicalRecord {
    readonly authorisedSpeedKilometresPerHour: number;
    readonly calibratedAt: UtcTimestamp;
    readonly generation: TachographGeneration;
    readonly kConstantPulsesPerKilometre: number;
    readonly kind: 'vehicleUnitCalibrationTechnicalRecord';
    readonly lTyreCircumferenceMillimetres: number;
    readonly newOdometer: OdometerKilometres | null;
    readonly nextCalibrationAt: UtcTimestamp | null;
    readonly oldOdometer: OdometerKilometres | null;
    readonly previousTime: UtcTimestamp | null;
    readonly purpose: CalibrationPurpose;
    readonly registrationMemberState: RecordedIssuingMemberState | null;
    readonly registrationNumber: VehicleRegistrationNumber | null;
    readonly source: VehicleUnitTechnicalSource;
    readonly tyreSize: string;
    readonly vehicleIdentificationNumber: VehicleIdentificationNumber;
    readonly wVehicleCharacteristicPulsesPerKilometre: number;
    readonly workshopAddress: string;
    readonly workshopCard: IRecordedCardReference | null;
    readonly workshopCardExpiryAt: UtcTimestamp | null;
    readonly workshopName: string;
}

export interface IVehicleUnitCardSlotStatusTechnicalRecord {
    readonly coDriverSlot: InsertedCardType;
    readonly driverSlot: InsertedCardType;
    readonly generation: TachographGeneration;
    readonly kind: 'vehicleUnitCardSlotStatusTechnicalRecord';
    readonly source: VehicleUnitTechnicalSource;
}

export interface IVehicleUnitCompanyLockTechnicalRecord {
    readonly companyAddress: string;
    readonly companyCardNumber: string;
    readonly companyName: string;
    readonly generation: TachographGeneration;
    readonly kind: 'vehicleUnitCompanyLockTechnicalRecord';
    readonly lockInTime: UtcTimestamp;
    readonly lockOutTime: UtcTimestamp | null;
    readonly source: VehicleUnitTechnicalSource;
}

export interface IVehicleUnitSensorPairedTechnicalRecord {
    readonly generation: TachographGeneration;
    readonly kind: 'vehicleUnitSensorPairedTechnicalRecord';
    readonly pairedAt: UtcTimestamp;
    readonly sensorApprovalNumber: string;
    readonly sensorSerialNumber: ITechnicalExtendedSerialNumber;
    readonly source: VehicleUnitTechnicalSource;
}

export interface IVehicleUnitGnssCoupledTechnicalRecord {
    readonly coupledAt: UtcTimestamp;
    readonly generation: TachographGeneration;
    readonly kind: 'vehicleUnitGnssCoupledTechnicalRecord';
    readonly sensorApprovalNumber: string;
    readonly sensorSerialNumber: ITechnicalExtendedSerialNumber;
    readonly source: VehicleUnitTechnicalSource;
}

export interface IVehicleUnitEmbeddedCardTechnicalRecord {
    readonly card: IRecordedCardReference | null;
    readonly cardStructureVersion: number | null;
    readonly dataElementUseVersion: number | null;
    readonly extendedSerialNumber: ITechnicalExtendedSerialNumber | null;
    readonly generation: TachographGeneration;
    readonly kind: 'vehicleUnitEmbeddedCardTechnicalRecord';
    readonly source: VehicleUnitTechnicalSource;
}

export interface IVehicleUnitEmbeddedCardSnapshotTechnicalRecord {
    readonly cardExpiryDate: UtcTimestamp | null;
    readonly cardNumber: CardNumber | null;
    readonly cardType: InsertedCardType | null;
    readonly generation: TachographGeneration;
    readonly hasSignature: boolean;
    readonly holderName: string | null;
    readonly issuingMemberState: RecordedIssuingMemberState | null;
    readonly kind: 'vehicleUnitEmbeddedCardSnapshotTechnicalRecord';
    readonly snapshotState: 'noCard' | 'parsed' | 'unsupported';
    readonly source: VehicleUnitTechnicalSource;
}

export interface IVehicleUnitItsConsentTechnicalRecord {
    readonly card: IRecordedCardReference | null;
    readonly consent: boolean;
    readonly generation: TachographGeneration;
    readonly kind: 'vehicleUnitItsConsentTechnicalRecord';
    readonly source: VehicleUnitTechnicalSource;
}

export interface IVehicleUnitPowerSupplyInterruptionTechnicalRecord {
    readonly begin: UtcTimestamp;
    readonly end: UtcTimestamp | null;
    readonly generation: TachographGeneration;
    readonly kind: 'vehicleUnitPowerSupplyInterruptionTechnicalRecord';
    readonly similarEvents: number;
    readonly source: VehicleUnitTechnicalSource;
}

export interface IVehicleUnitTimeAdjustmentTechnicalRecord {
    readonly generation: TachographGeneration;
    readonly kind: 'vehicleUnitTimeAdjustmentTechnicalRecord';
    readonly newTime: UtcTimestamp;
    readonly oldTime: UtcTimestamp;
    readonly source: VehicleUnitTechnicalSource;
    readonly workshopAddress: string;
    readonly workshopCard: IRecordedCardReference | null;
    readonly workshopName: string;
}

export interface IVehicleUnitControlActivityTechnicalRecord {
    readonly controlCard: IRecordedCardReference | null;
    readonly controlledAt: UtcTimestamp;
    readonly controlType: CardControlActivityType;
    readonly downloadPeriodBegin: UtcTimestamp | null;
    readonly downloadPeriodEnd: UtcTimestamp | null;
    readonly generation: TachographGeneration;
    readonly kind: 'vehicleUnitControlActivityTechnicalRecord';
    readonly source: VehicleUnitTechnicalSource;
}

export interface IVehicleUnitSpecificConditionTechnicalRecord {
    readonly conditionType: SpecificConditionType;
    readonly enteredAt: UtcTimestamp;
    readonly generation: TachographGeneration;
    readonly kind: 'vehicleUnitSpecificConditionTechnicalRecord';
    readonly source: VehicleUnitTechnicalSource;
}

export interface IDrivingLicenceTechnicalData {
    readonly generation: TachographGeneration;
    readonly issuingAuthority: IdentityName | null;
    readonly issuingMemberState: RecordedIssuingMemberState | null;
    readonly kind: 'drivingLicenceTechnicalData';
    readonly licenceNumber: DrivingLicenceNumber;
    readonly source: DriverCardTechnicalSource;
}

export interface ICardDownloadTechnicalRecord {
    readonly downloadedAt: UtcTimestamp | null;
    readonly generation: TachographGeneration;
    readonly kind: 'cardDownloadTechnicalRecord';
    readonly source: DriverCardTechnicalSource;
}

export interface ICardCurrentUsageTechnicalRecord {
    readonly generation: TachographGeneration;
    readonly kind: 'cardCurrentUsageTechnicalRecord';
    readonly registrationMemberState: RecordedIssuingMemberState | null;
    readonly registrationNumber: VehicleRegistrationNumber | null;
    readonly sessionOpenedAt: UtcTimestamp | null;
    readonly source: DriverCardTechnicalSource;
}

export interface ICardControlActivityTechnicalRecord {
    readonly controlCard: IRecordedCardReference | null;
    readonly controlledAt: UtcTimestamp;
    readonly controlType: CardControlActivityType;
    readonly downloadPeriodBegin: UtcTimestamp | null;
    readonly downloadPeriodEnd: UtcTimestamp | null;
    readonly generation: TachographGeneration;
    readonly kind: 'cardControlActivityTechnicalRecord';
    readonly registrationMemberState: RecordedIssuingMemberState | null;
    readonly registrationNumber: VehicleRegistrationNumber | null;
    readonly source: DriverCardTechnicalSource;
}

export interface ISpecificConditionTechnicalRecord {
    readonly conditionType: SpecificConditionType;
    readonly enteredAt: UtcTimestamp;
    readonly generation: TachographGeneration;
    readonly kind: 'specificConditionTechnicalRecord';
    readonly source: DriverCardTechnicalSource;
}

export type DriverCardTechnicalRecord =
    | ICardApplicationTechnicalData
    | ICardApplicationV2TechnicalData
    | ICardChipTechnicalData
    | ICardControlActivityTechnicalRecord
    | ICardCurrentUsageTechnicalRecord
    | ICardDownloadTechnicalRecord
    | ICardIccTechnicalData
    | IDrivingLicenceTechnicalData
    | ISpecificConditionTechnicalRecord;

export type VehicleUnitTechnicalRecord =
    | IVehicleUnitCalibrationTechnicalRecord
    | IVehicleUnitCardSlotStatusTechnicalRecord
    | IVehicleUnitCompanyLockTechnicalRecord
    | IVehicleUnitControlActivityTechnicalRecord
    | IVehicleUnitDailyOdometerTechnicalRecord
    | IVehicleUnitDownloadActivityTechnicalRecord
    | IVehicleUnitDownloadPeriodTechnicalRecord
    | IVehicleUnitEmbeddedCardTechnicalRecord
    | IVehicleUnitEmbeddedCardSnapshotTechnicalRecord
    | IVehicleUnitGnssCoupledTechnicalRecord
    | IVehicleUnitIdentificationTechnicalRecord
    | IVehicleUnitItsConsentTechnicalRecord
    | IVehicleUnitPowerSupplyInterruptionTechnicalRecord
    | IVehicleUnitSensorPairedTechnicalRecord
    | IVehicleUnitSpecificConditionTechnicalRecord
    | IVehicleUnitTimeAdjustmentTechnicalRecord;

export type TachographTechnicalRecord = DriverCardTechnicalRecord | VehicleUnitTechnicalRecord;

export function isDrivingLicenceNumber(value: unknown): value is DrivingLicenceNumber {
    return typeof value === 'string' && value.length >= 1 && value.length <= 16 && value.trim() === value;
}

export function isTechnicalHexIdentifier(value: unknown, byteLength: number): value is TechnicalHexIdentifier {
    return typeof value === 'string' && value.length === byteLength * 2 && /^[\dA-F]+$/u.test(value);
}

export function isTechnicalByte(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xff;
}

export function isTechnicalUnsignedShort(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xff_ff;
}

export function isTechnicalUnsignedLong(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xff_ff_ff_ff;
}

// What a technical record factory is given: every field except the two it derives.
type TechnicalRecordInput<TRecord> = Omit<TRecord, 'generation' | 'kind'>;

// Completes a technical record: the kind is fixed per record type and the generation always comes from the source.
function completeTechnicalRecord<
    const TKind extends string,
    TInput extends { readonly source: { readonly generation: TachographGeneration } },
>(kind: TKind, input: TInput): TInput & { readonly generation: TachographGeneration; readonly kind: TKind } {
    return { ...input, generation: input.source.generation, kind };
}

export function isTechnicalText(value: unknown, maximumLength: number): value is string {
    return typeof value === 'string' && value.length >= 1 && value.length <= maximumLength && value.trim() === value;
}

export interface ICardControlActivityTechnicalRecordInput {
    readonly controlCard: IRecordedCardReference | null;
    readonly controlledAt: UtcTimestamp;
    readonly controlType: CardControlActivityType;
    readonly downloadPeriodBegin: UtcTimestamp | null;
    readonly downloadPeriodEnd: UtcTimestamp | null;
    readonly registrationMemberState: RecordedIssuingMemberState | null;
    readonly registrationNumber: VehicleRegistrationNumber | null;
    readonly source: DriverCardTechnicalSource;
}

export function createCardControlActivityTechnicalRecord(
    input: ICardControlActivityTechnicalRecordInput,
): ICardControlActivityTechnicalRecord | null {
    if (
        (input.downloadPeriodBegin === null) !== (input.downloadPeriodEnd === null) ||
        (input.downloadPeriodBegin !== null &&
            input.downloadPeriodEnd !== null &&
            input.downloadPeriodBegin > input.downloadPeriodEnd)
    ) {
        return null;
    }

    return {
        controlCard: input.controlCard === null ? null : { ...input.controlCard },
        controlledAt: input.controlledAt,
        controlType: input.controlType,
        downloadPeriodBegin: input.downloadPeriodBegin,
        downloadPeriodEnd: input.downloadPeriodEnd,
        generation: input.source.generation,
        kind: 'cardControlActivityTechnicalRecord',
        registrationMemberState: input.registrationMemberState,
        registrationNumber: input.registrationNumber,
        source: input.source,
    };
}

export interface ICardIccTechnicalDataInput {
    readonly approvalNumber: string;
    readonly clockStop: number;
    readonly embedder: ICardEmbedderIdentification;
    readonly extendedSerialNumber: ICardExtendedSerialNumber;
    readonly icIdentifier: readonly number[];
    readonly personaliserId: number;
    readonly source: DriverCardTechnicalSource;
}

export function createCardIccTechnicalData(input: ICardIccTechnicalDataInput): ICardIccTechnicalData {
    return {
        approvalNumber: input.approvalNumber,
        clockStop: input.clockStop,
        embedder: {
            countryCode: input.embedder.countryCode,
            manufacturerInformation: [...input.embedder.manufacturerInformation],
            moduleEmbedder: input.embedder.moduleEmbedder,
        },
        extendedSerialNumber: { ...input.extendedSerialNumber },
        generation: input.source.generation,
        icIdentifier: [...input.icIdentifier],
        kind: 'cardIccTechnicalData',
        personaliserId: input.personaliserId,
        source: input.source,
    };
}

export type IDrivingLicenceTechnicalDataInput = TechnicalRecordInput<IDrivingLicenceTechnicalData>;

export function createDrivingLicenceTechnicalData(input: IDrivingLicenceTechnicalDataInput): IDrivingLicenceTechnicalData {
    return completeTechnicalRecord('drivingLicenceTechnicalData', input);
}

export type ICardCurrentUsageTechnicalRecordInput = TechnicalRecordInput<ICardCurrentUsageTechnicalRecord>;

export function createCardCurrentUsageTechnicalRecord(
    input: ICardCurrentUsageTechnicalRecordInput,
): ICardCurrentUsageTechnicalRecord {
    return completeTechnicalRecord('cardCurrentUsageTechnicalRecord', input);
}

export type ISpecificConditionTechnicalRecordInput = TechnicalRecordInput<ISpecificConditionTechnicalRecord>;

export function createSpecificConditionTechnicalRecord(
    input: ISpecificConditionTechnicalRecordInput,
): ISpecificConditionTechnicalRecord {
    return completeTechnicalRecord('specificConditionTechnicalRecord', input);
}

export type ICardDownloadTechnicalRecordInput = TechnicalRecordInput<ICardDownloadTechnicalRecord>;

export function createCardDownloadTechnicalRecord(input: ICardDownloadTechnicalRecordInput): ICardDownloadTechnicalRecord {
    return completeTechnicalRecord('cardDownloadTechnicalRecord', input);
}

export type ICardChipTechnicalDataInput = TechnicalRecordInput<ICardChipTechnicalData>;

export function createCardChipTechnicalData(input: ICardChipTechnicalDataInput): ICardChipTechnicalData {
    return completeTechnicalRecord('cardChipTechnicalData', input);
}

export type ICardApplicationTechnicalDataInput = TechnicalRecordInput<ICardApplicationTechnicalData>;

export function createCardApplicationTechnicalData(input: ICardApplicationTechnicalDataInput): ICardApplicationTechnicalData {
    return completeTechnicalRecord('cardApplicationTechnicalData', input);
}

export interface ICardApplicationV2TechnicalDataInput {
    readonly borderCrossingRecords: number;
    readonly followingDataLength: number;
    readonly loadTypeEntryRecords: number;
    readonly loadUnloadRecords: number;
    readonly source: DriverCardTechnicalSource;
    readonly vehicleUnitConfigurationLengthRange: number;
}

export function createCardApplicationV2TechnicalData(
    input: ICardApplicationV2TechnicalDataInput,
): ICardApplicationV2TechnicalData {
    return {
        borderCrossingRecords: input.borderCrossingRecords,
        followingDataLength: input.followingDataLength,
        generation: 'g2v2',
        kind: 'cardApplicationV2TechnicalData',
        loadTypeEntryRecords: input.loadTypeEntryRecords,
        loadUnloadRecords: input.loadUnloadRecords,
        source: input.source,
        vehicleUnitConfigurationLengthRange: input.vehicleUnitConfigurationLengthRange,
    };
}

export interface IVehicleUnitIdentificationTechnicalRecordInput {
    readonly ability: number | null;
    readonly approvalNumber: string;
    readonly manufacturerAddress: string;
    readonly manufacturerName: string;
    readonly manufacturedAt: UtcTimestamp;
    readonly partNumber: string;
    readonly serialNumber: ITechnicalExtendedSerialNumber;
    readonly softwareInstalledAt: UtcTimestamp;
    readonly softwareVersion: string;
    readonly source: VehicleUnitTechnicalSource;
    readonly vehicleUnitGeneration: number | null;
}

export function createVehicleUnitIdentificationTechnicalRecord(
    input: IVehicleUnitIdentificationTechnicalRecordInput,
): IVehicleUnitIdentificationTechnicalRecord {
    return {
        ability: input.ability,
        approvalNumber: input.approvalNumber,
        generation: input.source.generation,
        kind: 'vehicleUnitIdentificationTechnicalRecord',
        manufacturerAddress: input.manufacturerAddress,
        manufacturerName: input.manufacturerName,
        manufacturedAt: input.manufacturedAt,
        partNumber: input.partNumber,
        serialNumber: { ...input.serialNumber },
        softwareInstalledAt: input.softwareInstalledAt,
        softwareVersion: input.softwareVersion,
        source: input.source,
        vehicleUnitGeneration: input.vehicleUnitGeneration,
    };
}

export interface IVehicleUnitDownloadPeriodTechnicalRecordInput {
    readonly periodBegin: UtcTimestamp;
    readonly periodEnd: UtcTimestamp;
    readonly source: VehicleUnitTechnicalSource;
}

export function createVehicleUnitDownloadPeriodTechnicalRecord(
    input: IVehicleUnitDownloadPeriodTechnicalRecordInput,
): IVehicleUnitDownloadPeriodTechnicalRecord | null {
    if (input.periodBegin > input.periodEnd) {
        return null;
    }

    return {
        generation: input.source.generation,
        kind: 'vehicleUnitDownloadPeriodTechnicalRecord',
        periodBegin: input.periodBegin,
        periodEnd: input.periodEnd,
        source: input.source,
    };
}

export type IVehicleUnitDailyOdometerTechnicalRecordInput = TechnicalRecordInput<IVehicleUnitDailyOdometerTechnicalRecord>;

export function createVehicleUnitDailyOdometerTechnicalRecord(
    input: IVehicleUnitDailyOdometerTechnicalRecordInput,
): IVehicleUnitDailyOdometerTechnicalRecord {
    return completeTechnicalRecord('vehicleUnitDailyOdometerTechnicalRecord', input);
}

export interface IVehicleUnitDownloadActivityTechnicalRecordInput {
    readonly card: IRecordedCardReference | null;
    readonly downloadedAt: UtcTimestamp | null;
    readonly operatorName: string | null;
    readonly source: VehicleUnitTechnicalSource;
}

export function createVehicleUnitDownloadActivityTechnicalRecord(
    input: IVehicleUnitDownloadActivityTechnicalRecordInput,
): IVehicleUnitDownloadActivityTechnicalRecord {
    return {
        card: input.card === null ? null : { ...input.card },
        downloadedAt: input.downloadedAt,
        generation: input.source.generation,
        kind: 'vehicleUnitDownloadActivityTechnicalRecord',
        operatorName: input.operatorName,
        source: input.source,
    };
}

export type IVehicleUnitCalibrationTechnicalRecordInput = TechnicalRecordInput<IVehicleUnitCalibrationTechnicalRecord>;

export function createVehicleUnitCalibrationTechnicalRecord(
    input: IVehicleUnitCalibrationTechnicalRecordInput,
): IVehicleUnitCalibrationTechnicalRecord {
    return completeTechnicalRecord('vehicleUnitCalibrationTechnicalRecord', input);
}

export type IVehicleUnitCompanyLockTechnicalRecordInput = TechnicalRecordInput<IVehicleUnitCompanyLockTechnicalRecord>;

export type IVehicleUnitCardSlotStatusTechnicalRecordInput = TechnicalRecordInput<IVehicleUnitCardSlotStatusTechnicalRecord>;

export function createVehicleUnitCardSlotStatusTechnicalRecord(
    input: IVehicleUnitCardSlotStatusTechnicalRecordInput,
): IVehicleUnitCardSlotStatusTechnicalRecord {
    return completeTechnicalRecord('vehicleUnitCardSlotStatusTechnicalRecord', input);
}

export function createVehicleUnitCompanyLockTechnicalRecord(
    input: IVehicleUnitCompanyLockTechnicalRecordInput,
): IVehicleUnitCompanyLockTechnicalRecord {
    return completeTechnicalRecord('vehicleUnitCompanyLockTechnicalRecord', input);
}

export type IVehicleUnitSensorPairedTechnicalRecordInput = TechnicalRecordInput<IVehicleUnitSensorPairedTechnicalRecord>;

export function createVehicleUnitSensorPairedTechnicalRecord(
    input: IVehicleUnitSensorPairedTechnicalRecordInput,
): IVehicleUnitSensorPairedTechnicalRecord {
    return completeTechnicalRecord('vehicleUnitSensorPairedTechnicalRecord', input);
}

export type IVehicleUnitGnssCoupledTechnicalRecordInput = TechnicalRecordInput<IVehicleUnitGnssCoupledTechnicalRecord>;

export function createVehicleUnitGnssCoupledTechnicalRecord(
    input: IVehicleUnitGnssCoupledTechnicalRecordInput,
): IVehicleUnitGnssCoupledTechnicalRecord {
    return completeTechnicalRecord('vehicleUnitGnssCoupledTechnicalRecord', input);
}

export type IVehicleUnitEmbeddedCardTechnicalRecordInput = TechnicalRecordInput<IVehicleUnitEmbeddedCardTechnicalRecord>;

export function createVehicleUnitEmbeddedCardTechnicalRecord(
    input: IVehicleUnitEmbeddedCardTechnicalRecordInput,
): IVehicleUnitEmbeddedCardTechnicalRecord {
    return completeTechnicalRecord('vehicleUnitEmbeddedCardTechnicalRecord', input);
}

export type IVehicleUnitEmbeddedCardSnapshotTechnicalRecordInput =
    TechnicalRecordInput<IVehicleUnitEmbeddedCardSnapshotTechnicalRecord>;

export function createVehicleUnitEmbeddedCardSnapshotTechnicalRecord(
    input: IVehicleUnitEmbeddedCardSnapshotTechnicalRecordInput,
): IVehicleUnitEmbeddedCardSnapshotTechnicalRecord {
    return completeTechnicalRecord('vehicleUnitEmbeddedCardSnapshotTechnicalRecord', input);
}

export type IVehicleUnitItsConsentTechnicalRecordInput = TechnicalRecordInput<IVehicleUnitItsConsentTechnicalRecord>;

export function createVehicleUnitItsConsentTechnicalRecord(
    input: IVehicleUnitItsConsentTechnicalRecordInput,
): IVehicleUnitItsConsentTechnicalRecord {
    return completeTechnicalRecord('vehicleUnitItsConsentTechnicalRecord', input);
}

export type IVehicleUnitPowerSupplyInterruptionTechnicalRecordInput =
    TechnicalRecordInput<IVehicleUnitPowerSupplyInterruptionTechnicalRecord>;

export function createVehicleUnitPowerSupplyInterruptionTechnicalRecord(
    input: IVehicleUnitPowerSupplyInterruptionTechnicalRecordInput,
): IVehicleUnitPowerSupplyInterruptionTechnicalRecord {
    return completeTechnicalRecord('vehicleUnitPowerSupplyInterruptionTechnicalRecord', input);
}

export type IVehicleUnitTimeAdjustmentTechnicalRecordInput = TechnicalRecordInput<IVehicleUnitTimeAdjustmentTechnicalRecord>;

export function createVehicleUnitTimeAdjustmentTechnicalRecord(
    input: IVehicleUnitTimeAdjustmentTechnicalRecordInput,
): IVehicleUnitTimeAdjustmentTechnicalRecord {
    return completeTechnicalRecord('vehicleUnitTimeAdjustmentTechnicalRecord', input);
}

export type IVehicleUnitControlActivityTechnicalRecordInput = TechnicalRecordInput<IVehicleUnitControlActivityTechnicalRecord>;

export function createVehicleUnitControlActivityTechnicalRecord(
    input: IVehicleUnitControlActivityTechnicalRecordInput,
): IVehicleUnitControlActivityTechnicalRecord {
    return completeTechnicalRecord('vehicleUnitControlActivityTechnicalRecord', input);
}

export type IVehicleUnitSpecificConditionTechnicalRecordInput =
    TechnicalRecordInput<IVehicleUnitSpecificConditionTechnicalRecord>;

export function createVehicleUnitSpecificConditionTechnicalRecord(
    input: IVehicleUnitSpecificConditionTechnicalRecordInput,
): IVehicleUnitSpecificConditionTechnicalRecord {
    return completeTechnicalRecord('vehicleUnitSpecificConditionTechnicalRecord', input);
}
