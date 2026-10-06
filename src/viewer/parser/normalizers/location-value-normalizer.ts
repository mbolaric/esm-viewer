import {
    createAccumulatedDrivingPosition,
    createBorderCrossing,
    createDailyWorkPeriodPlace,
    createGnssPositionEvidence,
    createLoadTypeEntry,
    createLoadUnloadOperation,
    isGnssAccuracyIndicator,
    isGnssAuthenticationStatus,
    isLatitude,
    isLongitude,
    isUnknownParserCoordinate,
    type DailyWorkPeriodRegion,
    type IAccumulatedDrivingPosition,
    type IBorderCrossing,
    type IDailyWorkPeriodPlace,
    type IGnssPositionEvidence,
    type ILoadTypeEntry,
    type ILoadUnloadOperation,
    type IRecordedCardReference,
    type ISourceReference,
    type ITachographWarning,
    type OdometerKilometres,
    type TachographGeneration,
} from '#viewer-domain';

import type {
    Gen1PlaceRecord,
    Gen2BorderCrossingRecord,
    Gen2GnssAccumulatedDrivingRecord,
    Gen2GnssPlaceAuthRecord,
    Gen2GnssPlaceRecord,
    Gen2LoadTypeEntryRecord,
    Gen2LoadUnloadRecord,
    Gen2PlaceAuthRecord,
    Gen2PlaceRecord,
    Gen2VuGnssadRecord,
    OdometerShort,
    RegionNumeric,
} from '../generated/esm_parser.js';
import {
    normalizeParserDailyWorkPeriodEntryType,
    normalizeParserLoadType,
    normalizeParserOperationType,
} from './parser-enum-normalizer.js';
import {
    isRecordedParserTimestamp,
    normalizeParserNation,
    normalizeParserOdometerWithWarning,
    normalizeParserUtcTimestamp,
    type ParserNationAlphaCodes,
    type ParserWarningFactory,
} from './parser-value-normalizer.js';

export interface INormalizedLocationValue<TValue> {
    readonly value: TValue | null;
    readonly warnings: readonly ITachographWarning[];
}

export type DailyWorkPeriodRegionDecodeResult =
    | {
          readonly status: 'known';
          readonly value: DailyWorkPeriodRegion;
      }
    | {
          readonly status: 'unknown';
      };

export type DailyWorkPeriodPlacePositionShape = 'authenticated' | 'none' | 'optional';
export type GnssPositionRequirement = 'authenticatedRequired' | 'optional' | 'required';

interface IAccumulatedDrivingPositionNormalizationInput {
    readonly coDriverCard: IRecordedCardReference | null;
    readonly driverCard: IRecordedCardReference | null;
    readonly generation: TachographGeneration;
    readonly pathTokens: readonly (number | string)[];
    readonly source: ISourceReference;
    readonly warning: ParserWarningFactory;
}

interface IDailyWorkPeriodPlaceNormalizationInput {
    readonly card: IRecordedCardReference | null;
    readonly generation: TachographGeneration;
    readonly nationAlphaCodes: ParserNationAlphaCodes;
    readonly pathTokens: readonly (number | string)[];
    readonly positionShape: DailyWorkPeriodPlacePositionShape;
    readonly source: ISourceReference;
    readonly warning: ParserWarningFactory;
}

export function appendNormalizedLocation<TLocation>(
    normalized: INormalizedLocationValue<TLocation>,
    locations: TLocation[],
    warnings: ITachographWarning[],
): void {
    if (normalized.value !== null) {
        locations.push(normalized.value);
    }
    warnings.push(...normalized.warnings);
}

export function decodeDailyWorkPeriodRegion(value: RegionNumeric): DailyWorkPeriodRegionDecodeResult {
    if (value === 'Unknown') {
        return { status: 'unknown' };
    }
    return { status: 'known', value };
}

export function normalizeGnssPositionEvidence(
    value: Gen2GnssPlaceAuthRecord | Gen2GnssPlaceRecord,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    requirement: GnssPositionRequirement,
    warning: ParserWarningFactory,
): INormalizedLocationValue<IGnssPositionEvidence> {
    const authenticated = requirement === 'authenticatedRequired';
    if (authenticated && !('authenticationStatus' in value)) {
        return {
            value: null,
            warnings: [warning('invalidValue', generation, pathTokens)],
        };
    }

    const determinedAt = normalizeParserUtcTimestamp(value.timeStamp);
    if (requirement === 'optional' && (value.timeStamp === null || !isRecordedParserTimestamp(determinedAt))) {
        return {
            value: null,
            warnings: [],
        };
    }

    const rawCoordinates = value.geoCoordinates;
    const accuracy = value.gnssAccuracy;
    const authenticationStatus = 'authenticationStatus' in value ? value.authenticationStatus : null;
    const normalizedAuthenticationStatus = isGnssAuthenticationStatus(authenticationStatus) ? authenticationStatus : null;
    if (isUnknownParserCoordinate(rawCoordinates.latitude) || isUnknownParserCoordinate(rawCoordinates.longitude)) {
        // The equipment recorded that it could not determine a position: the rest of the record stays evidence.
        return {
            value: null,
            warnings: [],
        };
    }
    if (
        !isRecordedParserTimestamp(determinedAt) ||
        !isGnssAccuracyIndicator(accuracy) ||
        !isLatitude(rawCoordinates.latitude) ||
        !isLongitude(rawCoordinates.longitude) ||
        (authenticated && normalizedAuthenticationStatus === null)
    ) {
        return {
            value: null,
            warnings: [warning('invalidValue', generation, pathTokens)],
        };
    }

    return {
        value: createGnssPositionEvidence({
            accuracy,
            authenticationStatus: authenticated ? normalizedAuthenticationStatus : null,
            coordinates: {
                latitude: rawCoordinates.latitude,
                longitude: rawCoordinates.longitude,
            },
            determinedAt,
        }),
        warnings: [],
    };
}

export function normalizeDailyWorkPeriodPlaceRecord(
    value: Gen1PlaceRecord | Gen2PlaceAuthRecord | Gen2PlaceRecord,
    input: IDailyWorkPeriodPlaceNormalizationInput,
): INormalizedLocationValue<IDailyWorkPeriodPlace> {
    const hasAuthenticatedPosition = 'entryGnssPlaceAuthRecord' in value;
    const hasOptionalPosition = 'entryGnssPlaceRecord' in value;
    if (
        (input.positionShape === 'authenticated' && !hasAuthenticatedPosition) ||
        (input.positionShape === 'optional' && !hasOptionalPosition) ||
        (input.positionShape === 'none' && (hasAuthenticatedPosition || hasOptionalPosition))
    ) {
        return {
            value: null,
            warnings: [input.warning('invalidValue', input.generation, input.pathTokens)],
        };
    }

    const warnings: ITachographWarning[] = [];
    const entryAt = normalizeParserUtcTimestamp(value.entryTime);
    const entryType = normalizeParserDailyWorkPeriodEntryType(value.entryTypeDailyWorkPeriod);
    const rawCountry = value.dailyWorkPeriodCountry;
    const country = rawCountry === 'Unknown' ? null : normalizeParserNation(rawCountry, input.nationAlphaCodes);
    const region = decodeDailyWorkPeriodRegion(value.dailyWorkPeriodRegion);
    if (!isRecordedParserTimestamp(entryAt)) {
        warnings.push(input.warning('invalidValue', input.generation, [...input.pathTokens, 'entryTime']));
    }
    if (entryType === null) {
        warnings.push(input.warning('unsupportedData', input.generation, [...input.pathTokens, 'entryTypeDailyWorkPeriod']));
    }
    if (country === null && rawCountry !== 'Unknown') {
        warnings.push(input.warning('unsupportedData', input.generation, [...input.pathTokens, 'dailyWorkPeriodCountry']));
    }
    const odometer = normalizeParserOdometerWithWarning(
        value.vehicleOdometerValue,
        input.generation,
        [...input.pathTokens, 'vehicleOdometerValue'],
        warnings,
        input.warning,
    );
    const position = hasAuthenticatedPosition
        ? normalizeGnssPositionEvidence(
              value.entryGnssPlaceAuthRecord,
              input.generation,
              [...input.pathTokens, 'entryGnssPlaceAuthRecord'],
              'authenticatedRequired',
              input.warning,
          )
        : hasOptionalPosition
          ? normalizeGnssPositionEvidence(
                value.entryGnssPlaceRecord,
                input.generation,
                [...input.pathTokens, 'entryGnssPlaceRecord'],
                'optional',
                input.warning,
            )
          : null;
    if (position !== null) {
        warnings.push(...position.warnings);
    }

    return {
        value:
            entryAt === null || entryAt === 0
                ? null
                : createDailyWorkPeriodPlace({
                      card: input.card,
                      country,
                      entryAt,
                      entryType: entryType ?? 'unknown',
                      odometer,
                      position: position?.value ?? null,
                      region: region.status === 'known' ? region.value : null,
                      source: input.source,
                  }),
        warnings: warnings,
    };
}

interface IRequiredPlaceAndOdometer {
    readonly odometer: OdometerKilometres | null;
    readonly position: IGnssPositionEvidence | null;
}

// Accumulated-driving positions, border crossings and load/unload operations all carry a required GNSS place and
// the odometer reading at that place.
function normalizeRequiredPlaceAndOdometer(
    value: {
        readonly gnssPlaceRecord: Gen2GnssPlaceAuthRecord | Gen2GnssPlaceRecord;
        readonly vehicleOdometerValue: OdometerShort;
    },
    input: {
        readonly generation: TachographGeneration;
        readonly pathTokens: readonly (number | string)[];
        readonly warning: ParserWarningFactory;
    },
    warnings: ITachographWarning[],
): IRequiredPlaceAndOdometer {
    const position = normalizeGnssPositionEvidence(
        value.gnssPlaceRecord,
        input.generation,
        [...input.pathTokens, 'gnssPlaceRecord'],
        'required',
        input.warning,
    );
    warnings.push(...position.warnings);
    const odometer = normalizeParserOdometerWithWarning(
        value.vehicleOdometerValue,
        input.generation,
        [...input.pathTokens, 'vehicleOdometerValue'],
        warnings,
        input.warning,
    );
    return { odometer, position: position.value };
}

export function normalizeAccumulatedDrivingPositionRecord(
    value: Gen2GnssAccumulatedDrivingRecord | Gen2VuGnssadRecord,
    input: IAccumulatedDrivingPositionNormalizationInput,
): INormalizedLocationValue<IAccumulatedDrivingPosition> {
    const warnings: ITachographWarning[] = [];
    const recordedAt = normalizeParserUtcTimestamp(value.timeStamp);
    if (!isRecordedParserTimestamp(recordedAt)) {
        warnings.push(input.warning('invalidValue', input.generation, [...input.pathTokens, 'timeStamp']));
    }
    const { odometer, position } = normalizeRequiredPlaceAndOdometer(value, input, warnings);

    return {
        value: !isRecordedParserTimestamp(recordedAt)
            ? null
            : createAccumulatedDrivingPosition({
                  coDriverCard: input.coDriverCard,
                  driverCard: input.driverCard,
                  odometer,
                  position,
                  recordedAt,
                  source: input.source,
              }),
        warnings: warnings,
    };
}

interface IBorderCrossingNormalizationInput {
    readonly generation: TachographGeneration;
    readonly nationAlphaCodes: ParserNationAlphaCodes;
    readonly pathTokens: readonly (number | string)[];
    readonly source: ISourceReference;
    readonly warning: ParserWarningFactory;
}

export function normalizeBorderCrossingRecord(
    value: Gen2BorderCrossingRecord,
    input: IBorderCrossingNormalizationInput,
): INormalizedLocationValue<IBorderCrossing> {
    const warnings: ITachographWarning[] = [];
    const crossedAt = normalizeParserUtcTimestamp(value.timeStamp);
    if (!isRecordedParserTimestamp(crossedAt)) {
        warnings.push(input.warning('invalidValue', input.generation, [...input.pathTokens, 'timeStamp']));
    }
    const rawCountryLeft = value.countryLeft;
    const countryLeft = rawCountryLeft === 'Unknown' ? null : normalizeParserNation(rawCountryLeft, input.nationAlphaCodes);
    const rawCountryEntered = value.countryEntered;
    const countryEntered =
        rawCountryEntered === 'Unknown' ? null : normalizeParserNation(rawCountryEntered, input.nationAlphaCodes);

    if (countryLeft === null && rawCountryLeft !== 'Unknown') {
        warnings.push(input.warning('unsupportedData', input.generation, [...input.pathTokens, 'countryLeft']));
    }
    if (countryEntered === null && rawCountryEntered !== 'Unknown') {
        warnings.push(input.warning('unsupportedData', input.generation, [...input.pathTokens, 'countryEntered']));
    }
    const { odometer, position } = normalizeRequiredPlaceAndOdometer(value, input, warnings);

    return {
        value: !isRecordedParserTimestamp(crossedAt)
            ? null
            : createBorderCrossing({
                  countryEntered,
                  countryLeft,
                  crossedAt,
                  odometer,
                  position,
                  source: input.source,
              }),
        warnings: warnings,
    };
}

interface ILoadUnloadOperationNormalizationInput {
    readonly generation: TachographGeneration;
    readonly nationAlphaCodes: ParserNationAlphaCodes;
    readonly pathTokens: readonly (number | string)[];
    readonly source: ISourceReference;
    readonly warning: ParserWarningFactory;
}

export function normalizeLoadUnloadRecord(
    value: Gen2LoadUnloadRecord,
    input: ILoadUnloadOperationNormalizationInput,
): INormalizedLocationValue<ILoadUnloadOperation> {
    const warnings: ITachographWarning[] = [];
    const operationAt = normalizeParserUtcTimestamp(value.timeStamp);
    const operationType = normalizeParserOperationType(value.operationType);
    const rawCountry = value.country;
    const country = rawCountry === 'Unknown' ? null : normalizeParserNation(rawCountry, input.nationAlphaCodes);
    const region = decodeDailyWorkPeriodRegion(value.region);

    if (!isRecordedParserTimestamp(operationAt)) {
        warnings.push(input.warning('invalidValue', input.generation, [...input.pathTokens, 'timeStamp']));
    }
    if (operationType === null) {
        warnings.push(input.warning('unsupportedData', input.generation, [...input.pathTokens, 'operationType']));
    }
    if (country === null && rawCountry !== 'Unknown') {
        warnings.push(input.warning('unsupportedData', input.generation, [...input.pathTokens, 'country']));
    }
    const { odometer, position } = normalizeRequiredPlaceAndOdometer(value, input, warnings);

    return {
        value: !isRecordedParserTimestamp(operationAt)
            ? null
            : createLoadUnloadOperation({
                  country,
                  odometer,
                  operationAt,
                  operationType: operationType ?? 'unknown',
                  position,
                  region: region.status === 'known' ? region.value : null,
                  source: input.source,
              }),
        warnings: warnings,
    };
}

interface ILoadTypeEntryNormalizationInput {
    readonly generation: TachographGeneration;
    readonly pathTokens: readonly (number | string)[];
    readonly source: ISourceReference;
    readonly warning: ParserWarningFactory;
}

export function normalizeLoadTypeEntryRecord(
    value: Gen2LoadTypeEntryRecord,
    input: ILoadTypeEntryNormalizationInput,
): INormalizedLocationValue<ILoadTypeEntry> {
    const warnings: ITachographWarning[] = [];
    const enteredAt = normalizeParserUtcTimestamp(value.timeStamp);
    const loadType = normalizeParserLoadType(value.loadTypeEntered);

    if (!isRecordedParserTimestamp(enteredAt)) {
        warnings.push(input.warning('invalidValue', input.generation, [...input.pathTokens, 'timeStamp']));
    }
    if (loadType === null) {
        warnings.push(input.warning('unsupportedData', input.generation, [...input.pathTokens, 'loadTypeEntered']));
    }

    return {
        value: !isRecordedParserTimestamp(enteredAt)
            ? null
            : createLoadTypeEntry({
                  enteredAt,
                  loadType: loadType ?? 'unknown',
                  source: input.source,
              }),
        warnings: warnings,
    };
}
