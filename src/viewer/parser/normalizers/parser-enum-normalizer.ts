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
    VRNEntryByCompany: 'vehicleRegistrationNumberEntryByCompany',
};

const cardControlActivityTypes: Readonly<Record<number, CardControlActivityType>> = {
    0x80: 'cardDownloaded',
    0x40: 'vehicleUnitDownloaded',
    0x20: 'printingDone',
    0x10: 'displayUsed',
    0x08: 'calibrationParameters',
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
    return typeof value === 'number' ? 'unknown' : normalizeParserEnum(value, calibrationPurposes);
}

export function normalizeParserCardControlActivityType(value: ParserControlType): readonly CardControlActivityType[] | null {
    if (!Number.isInteger(value) || value < 0 || value > 0xff) {
        return null;
    }
    if (value === 0) {
        return ['none'];
    }
    const types = Object.entries(cardControlActivityTypes)
        .filter(([mask]) => (value & Number(mask)) !== 0)
        .map(([, type]) => type);
    if ((value & 0x07) !== 0) {
        types.push('unknown');
    }
    return types;
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
