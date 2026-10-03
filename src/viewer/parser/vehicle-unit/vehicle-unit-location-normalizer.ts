import {
    type IAccumulatedDrivingPosition,
    type IDailyWorkPeriodPlace,
    type IRecordedCardReference,
    type ITachographWarning,
    type TachographGeneration,
} from '#viewer-domain';

import { normalizeWrappedCardReference } from '../card/full-card-identity-normalizer.js';
import type {
    FullCardNumber,
    Gen1PlaceRecord,
    Gen2FullCardNumberAndGeneration,
    Gen2PlaceAuthRecord,
    Gen2PlaceRecord,
} from '../generated/esm_parser.js';
import {
    appendNormalizedLocation,
    normalizeAccumulatedDrivingPositionRecord,
    normalizeDailyWorkPeriodPlaceRecord,
    type DailyWorkPeriodPlacePositionShape,
    type INormalizedLocationValue,
} from '../normalizers/location-value-normalizer.js';
import { createNormalizationSourceContext } from '../normalization-source.js';
import type { ParserNationAlphaCodes } from '../normalizers/parser-value-normalizer.js';
import type { IVehicleUnitActivitySection } from './vehicle-unit-activity-normalizer.js';
import { decodeVehicleUnitCountedRecords, decodeVehicleUnitRecordArray } from './vehicle-unit-record-array.js';

export interface INormalizedVehicleUnitLocations {
    readonly locations: readonly (IAccumulatedDrivingPosition | IDailyWorkPeriodPlace)[];
    readonly warnings: readonly ITachographWarning[];
}

interface ICardReferenceNormalization {
    readonly reference: IRecordedCardReference | null;
    readonly warnings: readonly ITachographWarning[];
}

const maximumLocationRecordsPerSection = 4_096;
const { source, warning } = createNormalizationSourceContext('vehicleUnit');

function normalizeCardReference(
    value: FullCardNumber | Gen2FullCardNumberAndGeneration,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
): ICardReferenceNormalization {
    const normalized = normalizeWrappedCardReference(value, generation, pathTokens, nationAlphaCodes, warning);
    return {
        reference: normalized.reference,
        warnings: normalized.warnings,
    };
}

function normalizeVehicleUnitPlaceRecord(
    value: Gen1PlaceRecord | Gen2PlaceAuthRecord | Gen2PlaceRecord,
    card: IRecordedCardReference | null,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
    positionShape: DailyWorkPeriodPlacePositionShape,
): INormalizedLocationValue<IDailyWorkPeriodPlace> {
    return normalizeDailyWorkPeriodPlaceRecord(value, {
        card,
        generation,
        nationAlphaCodes,
        pathTokens,
        positionShape,
        source: source(generation, pathTokens),
        warning,
    });
}

function normalizeGen1Places(
    section: Extract<IVehicleUnitActivitySection, { readonly generation: 'g1' }>,
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedVehicleUnitLocations {
    const value = section.activity.vuPlaceDailyWorkPeriodData;
    const pathTokens = [...section.rootPath, 'vuPlaceDailyWorkPeriodData'];
    if (
        decodeVehicleUnitCountedRecords(
            value.noOfPlaceRecords,
            value.vuPlaceDailyWorkPeriodRecords,
            maximumLocationRecordsPerSection,
        ) === null
    ) {
        return {
            locations: [],
            warnings: [warning('inconsistentData', section.generation, pathTokens)],
        };
    }

    const locations: IDailyWorkPeriodPlace[] = [];
    const warnings: ITachographWarning[] = [];
    for (const [index, rawRecord] of value.vuPlaceDailyWorkPeriodRecords.entries()) {
        const recordPath = [...pathTokens, 'vuPlaceDailyWorkPeriodRecords', index];
        const card = normalizeCardReference(
            rawRecord.fullCardNumber,
            section.generation,
            [...recordPath, 'fullCardNumber'],
            nationAlphaCodes,
        );
        warnings.push(...card.warnings);
        const placePath = [...recordPath, 'placeRecord'];
        const normalized = normalizeVehicleUnitPlaceRecord(
            rawRecord.placeRecord,
            card.reference,
            section.generation,
            placePath,
            nationAlphaCodes,
            'none',
        );
        appendNormalizedLocation(normalized, locations, warnings);
    }

    return {
        locations: locations,
        warnings: warnings,
    };
}

function normalizeGen2Places(
    section: Exclude<IVehicleUnitActivitySection, { readonly generation: 'g1' }>,
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedVehicleUnitLocations {
    const value = section.activity.vuPlaceDailyWorkPeriodRecordArray;
    const pathTokens = [...section.rootPath, 'vuPlaceDailyWorkPeriodRecordArray'];
    const records = decodeVehicleUnitRecordArray(value, maximumLocationRecordsPerSection, 'VuPlaceDailyWorkPeriodRecord');
    if (records === null || value.isGen2V2 !== (section.generation === 'g2v2')) {
        return {
            locations: [],
            warnings: [warning('inconsistentData', section.generation, pathTokens)],
        };
    }

    const authenticated = section.generation === 'g2v2';
    const locations: IDailyWorkPeriodPlace[] = [];
    const warnings: ITachographWarning[] = [];
    for (const [index, rawRecord] of records.entries()) {
        const recordPath = [...pathTokens, 'records', index];
        const card = normalizeCardReference(
            rawRecord.fullCardNumberAndGeneration,
            section.generation,
            [...recordPath, 'fullCardNumberAndGeneration'],
            nationAlphaCodes,
        );
        warnings.push(...card.warnings);
        const rawPlace = authenticated ? rawRecord.placeAuthRecord : rawRecord.placeRecord;
        const placeKey = authenticated ? 'placeAuthRecord' : 'placeRecord';
        const placePath = [...recordPath, placeKey];
        if (rawPlace === null) {
            warnings.push(warning('missingValue', section.generation, placePath));
            continue;
        }
        const normalized = normalizeVehicleUnitPlaceRecord(
            rawPlace,
            card.reference,
            section.generation,
            placePath,
            nationAlphaCodes,
            authenticated ? 'authenticated' : 'optional',
        );
        appendNormalizedLocation(normalized, locations, warnings);
    }

    return {
        locations: locations,
        warnings: warnings,
    };
}

function normalizeGen2Positions(
    section: Exclude<IVehicleUnitActivitySection, { readonly generation: 'g1' }>,
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedVehicleUnitLocations {
    const value = section.activity.vuGnssadRecordArray;
    const pathTokens = [...section.rootPath, 'vuGnssadRecordArray'];
    const records = decodeVehicleUnitRecordArray(value, maximumLocationRecordsPerSection, 'VuGNSSADRecord');
    if (records === null) {
        return {
            locations: [],
            warnings: [warning('inconsistentData', section.generation, pathTokens)],
        };
    }

    const locations: IAccumulatedDrivingPosition[] = [];
    const warnings: ITachographWarning[] = [];
    for (const [index, rawRecord] of records.entries()) {
        const recordPath = [...pathTokens, 'records', index];
        if (rawRecord.isGen2V2 !== (section.generation === 'g2v2')) {
            warnings.push(warning('inconsistentData', section.generation, recordPath));
            continue;
        }

        const driverCard = normalizeCardReference(
            rawRecord.cardNumberAndGenDriverSlot,
            section.generation,
            [...recordPath, 'cardNumberAndGenDriverSlot'],
            nationAlphaCodes,
        );
        const coDriverCard = normalizeCardReference(
            rawRecord.cardNumberAndGenCodriverSlot,
            section.generation,
            [...recordPath, 'cardNumberAndGenCodriverSlot'],
            nationAlphaCodes,
        );
        warnings.push(...driverCard.warnings, ...coDriverCard.warnings);
        const normalized = normalizeAccumulatedDrivingPositionRecord(rawRecord, {
            coDriverCard: coDriverCard.reference,
            driverCard: driverCard.reference,
            generation: section.generation,
            pathTokens: recordPath,
            source: source(section.generation, recordPath),
            warning,
        });
        appendNormalizedLocation(normalized, locations, warnings);
    }

    return {
        locations: locations,
        warnings: warnings,
    };
}

export function normalizeVehicleUnitLocations(
    activitySections: readonly IVehicleUnitActivitySection[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedVehicleUnitLocations {
    const locations: (IAccumulatedDrivingPosition | IDailyWorkPeriodPlace)[] = [];
    const warnings: ITachographWarning[] = [];
    for (const section of activitySections) {
        if (section.generation === 'g1') {
            const places = normalizeGen1Places(section, nationAlphaCodes);
            locations.push(...places.locations);
            warnings.push(...places.warnings);
            continue;
        }

        const places = normalizeGen2Places(section, nationAlphaCodes);
        const positions = normalizeGen2Positions(section, nationAlphaCodes);
        locations.push(...places.locations, ...positions.locations);
        warnings.push(...places.warnings, ...positions.warnings);
    }

    return {
        locations: locations,
        warnings: warnings,
    };
}
