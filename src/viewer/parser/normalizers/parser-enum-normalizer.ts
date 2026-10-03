import type {
    ActivityCard as ParserActivityCard,
    ActivityType as ParserActivityType,
    CalibrationPurpose as ParserCalibrationPurpose,
    ControlType as ParserControlType,
    EntryTypeDailyWorkPeriod as ParserEntryTypeDailyWorkPeriod,
    EquipmentType as ParserEquipmentType,
    LoadType as ParserLoadType,
    OperationType as ParserOperationType,
    SpecificConditionType as ParserSpecificConditionType,
} from '../generated/esm_parser.js';
import type {
    ActivityKind,
    CalibrationPurpose,
    CardControlActivityType,
    DailyWorkPeriodEntryType,
    InsertedCardType,
    LoadTypeKind,
    LoadUnloadOperationType,
    SpecificConditionType,
} from '#viewer-domain';

const activityKinds: Readonly<Partial<Record<ParserActivityType, ActivityKind>>> = {
    Availability: 'availability',
    Driving: 'driving',
    Rest: 'breakOrRest',
    Unknown: 'unknown',
    Work: 'work',
};

const calibrationPurposes: Readonly<Partial<Record<ParserCalibrationPurpose, CalibrationPurpose>>> = {
    Activation: 'activation',
    FirstInstallation: 'firstInstallation',
    Installation: 'installation',
    PeriodicInspection: 'periodicInspection',
    Reserved: 'reserved',
    TimeAdjustmentWithoutCalibration: 'timeAdjustmentWithoutCalibration',
    Unknown: 'unknown',
    VRNEntryByCompany: 'vehicleRegistrationNumberEntryByCompany',
};

const cardControlActivityTypes: Readonly<Partial<Record<ParserControlType, CardControlActivityType>>> = {
    CalibrationParameters: 'calibrationParameters',
    CardDownloaded: 'cardDownloaded',
    DisplayUsed: 'displayUsed',
    PrintingDone: 'printingDone',
    Unknown: 'unknown',
    VUDownloaded: 'vehicleUnitDownloaded',
};

const dailyWorkPeriodEntryTypes: Readonly<Partial<Record<ParserEntryTypeDailyWorkPeriod, DailyWorkPeriodEntryType>>> = {
    BeginAssumedByVU: 'beginAssumedByVehicleUnit',
    BeginCardInsertion: 'beginCardInsertion',
    BeginGnssData: 'beginGnss',
    BeginManuallyEntered: 'beginManual',
    EndAssumedByVU: 'endAssumedByVehicleUnit',
    EndCardWithdrawal: 'endCardWithdrawal',
    EndGnssData: 'endGnss',
    EndManuallyEntered: 'endManual',
    Unknown: 'unknown',
};

const insertedCardTypes: Readonly<Partial<Record<ParserEquipmentType, InsertedCardType>>> = {
    CompanyCard: 'companyCard',
    ControlCard: 'controlCard',
    DriverCard: 'driverCard',
    NullCard: 'unknown',
    Unknown: 'unknown',
    WorkshopCard: 'workshopCard',
};

const operationTypes: Readonly<Partial<Record<ParserOperationType, LoadUnloadOperationType>>> = {
    Load: 'load',
    Reserved: 'reserved',
    SimultaneousLoadAndUnload: 'simultaneous',
    Unload: 'unload',
    Unknown: 'unknown',
};

const loadTypes: Readonly<Partial<Record<ParserLoadType, LoadTypeKind>>> = {
    Goods: 'goods',
    Passengers: 'passengers',
    Undefined: 'undefined',
    Unknown: 'unknown',
};

const specificConditionTypes: Readonly<Partial<Record<ParserSpecificConditionType, SpecificConditionType>>> = {
    FerryTrainCrossing: 'ferryTrainCrossing',
    FerryTrainCrossingEnd: 'ferryTrainCrossingEnd',
    OutOfScopeBegin: 'outOfScopeBegin',
    OutOfScopeEnd: 'outOfScopeEnd',
    Unknown: 'unknown',
};

export const parserDriverActivityCard = 'Card' satisfies ParserActivityCard;

function normalizeParserEnum<TParserValue extends string, TValue>(
    value: TParserValue,
    normalizedValues: Readonly<Partial<Record<TParserValue, TValue>>>,
): TValue | null {
    return normalizedValues[value] ?? null;
}

export function normalizeParserActivityKind(value: ParserActivityType): ActivityKind | null {
    return normalizeParserEnum(value, activityKinds);
}

export function normalizeParserCalibrationPurpose(value: ParserCalibrationPurpose): CalibrationPurpose | null {
    return normalizeParserEnum(value, calibrationPurposes);
}

export function normalizeParserCardControlActivityType(value: ParserControlType): CardControlActivityType | null {
    return normalizeParserEnum(value, cardControlActivityTypes);
}

export function normalizeParserDailyWorkPeriodEntryType(value: ParserEntryTypeDailyWorkPeriod): DailyWorkPeriodEntryType | null {
    return normalizeParserEnum(value, dailyWorkPeriodEntryTypes);
}

export function normalizeParserInsertedCardType(value: ParserEquipmentType): InsertedCardType | null {
    return normalizeParserEnum(value, insertedCardTypes);
}

export function normalizeParserOperationType(value: ParserOperationType): LoadUnloadOperationType | null {
    return normalizeParserEnum(value, operationTypes);
}

export function normalizeParserLoadType(value: ParserLoadType): LoadTypeKind | null {
    return normalizeParserEnum(value, loadTypes);
}

export function normalizeParserSpecificConditionType(value: ParserSpecificConditionType): SpecificConditionType | null {
    return normalizeParserEnum(value, specificConditionTypes);
}
