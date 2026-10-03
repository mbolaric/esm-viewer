import {
    createVehicleUnitUse,
    createVehicleUse,
    isTechnicalText,
    isVehicleIdentificationNumber,
    type ITachographWarning,
    type IVehicleUnitUse,
    type IVehicleUse,
    type TachographGeneration,
} from '#viewer-domain';

import type { Gen1CardVehicleRecord, Gen2CardVehicleRecord, Gen2CardVehicleUnitRecord } from '../generated/esm_parser.js';
import { normalizeCardVehicleRegistration } from './card-vehicle-registration-normalizer.js';
import { createNormalizationSourceContext } from '../normalization-source.js';
import type { ParserDriverCardApplication } from '../decoders/parser-result-types.js';
import {
    isRecordedParserTimestamp,
    normalizeParserUtcTimestamp,
    normalizeParserOdometerWithWarning,
    type ParserNationAlphaCodes,
} from '../normalizers/parser-value-normalizer.js';

export interface INormalizedCardAssociations {
    readonly vehicleUses: readonly IVehicleUse[];
    readonly vehicleUnitUses: readonly IVehicleUnitUse[];
    readonly warnings: readonly ITachographWarning[];
}

const maximumVehicleUses = 4_096;
const maximumVehicleUnitUses = 4_096;
const { source, warning } = createNormalizationSourceContext('driverCard');

function normalizeVehicleUse(
    value: Gen1CardVehicleRecord | Gen2CardVehicleRecord,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedCardAssociations {
    const hasVehicleIdentificationNumber = 'vehicleIdentificationNumber' in value;
    if ((generation === 'g1' && hasVehicleIdentificationNumber) || (generation !== 'g1' && !hasVehicleIdentificationNumber)) {
        return {
            vehicleUses: [],
            vehicleUnitUses: [],
            warnings: [warning('invalidValue', generation, pathTokens)],
        };
    }

    const warnings: ITachographWarning[] = [];
    const firstUse = normalizeParserUtcTimestamp(value.vehicleFirstUse);
    const lastUse = normalizeParserUtcTimestamp(value.vehicleLastUse);
    // The TimeReal maximum stands for a field the unit left unfilled, exactly like zero, so neither is a date.
    if (!isRecordedParserTimestamp(firstUse)) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'vehicleFirstUse']));
    }
    // An unrecorded last use is the sentinel for an open session (card inserted), not invalid data.
    if (value.vehicleLastUse !== null && lastUse === null) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'vehicleLastUse']));
    }

    const registration = normalizeCardVehicleRegistration(
        value.vehicleRegistration,
        generation,
        [...pathTokens, 'vehicleRegistration'],
        nationAlphaCodes,
    );
    warnings.push(...registration.warnings);

    const rawVin = hasVehicleIdentificationNumber ? value.vehicleIdentificationNumber : '';
    const vehicleIdentificationNumber =
        generation === 'g1' || rawVin === '' ? null : isVehicleIdentificationNumber(rawVin) ? rawVin : null;
    if (generation !== 'g1' && rawVin !== '' && vehicleIdentificationNumber === null) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'vehicleIdentificationNumber']));
    }

    const odometerBegin = normalizeParserOdometerWithWarning(
        value.vehicleOdometerBegin,
        generation,
        [...pathTokens, 'vehicleOdometerBegin'],
        warnings,
        warning,
    );
    const odometerEnd = normalizeParserOdometerWithWarning(
        value.vehicleOdometerEnd,
        generation,
        [...pathTokens, 'vehicleOdometerEnd'],
        warnings,
        warning,
    );
    if (!isRecordedParserTimestamp(firstUse)) {
        return {
            vehicleUses: [],
            vehicleUnitUses: [],
            warnings: warnings,
        };
    }

    // An unrecorded last use means the card was still in use when the file was downloaded.
    const record = createVehicleUse({
        firstUse,
        lastUse: isRecordedParserTimestamp(lastUse) ? lastUse : null,
        odometerBegin,
        odometerEnd,
        registrationMemberState: registration.memberState,
        registrationNumber: registration.number,
        source: source(generation, pathTokens),
        vehicleIdentificationNumber,
    });
    if (record === null) {
        warnings.push(warning('inconsistentData', generation, pathTokens));
    }

    return {
        vehicleUses: record === null ? [] : [record],
        vehicleUnitUses: [],
        warnings: warnings,
    };
}

function normalizeVehicleUnitUse(
    value: Gen2CardVehicleUnitRecord,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
): INormalizedCardAssociations {
    const warnings: ITachographWarning[] = [];
    const usedAt = normalizeParserUtcTimestamp(value.timeStamp);
    if (usedAt === null || usedAt === 0) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'timeStamp']));
    }
    if (!Number.isInteger(value.manufacturerCode) || value.manufacturerCode < 0 || value.manufacturerCode > 0xff) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'manufacturerCode']));
    }
    if (!Number.isInteger(value.deviceID) || value.deviceID < 0 || value.deviceID > 0xff_ff_ff_ff) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'deviceID']));
    }
    if (!isTechnicalText(value.vuSoftwareVersion, 4)) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'vuSoftwareVersion']));
    }
    if (usedAt === null || usedAt === 0 || warnings.length > 0) {
        return {
            vehicleUses: [],
            vehicleUnitUses: [],
            warnings: warnings,
        };
    }

    return {
        vehicleUses: [],
        vehicleUnitUses: [
            createVehicleUnitUse({
                deviceID: value.deviceID,
                manufacturerCode: value.manufacturerCode,
                source: source(generation, pathTokens),
                usedAt,
                vuSoftwareVersion: value.vuSoftwareVersion,
            }),
        ],
        warnings: warnings,
    };
}

function normalizeCardVehicleUnitsUsed(
    application: ParserDriverCardApplication,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
): INormalizedCardAssociations {
    const rootPath = [...pathTokens, 'vehicleUnitsUsed'];
    const value = 'vehicleUnitsUsed' in application ? application.vehicleUnitsUsed : null;
    if (value === null) {
        return {
            vehicleUses: [],
            vehicleUnitUses: [],
            warnings: [],
        };
    }
    if (
        !Number.isInteger(value.vehicleUnitPointerNewestRecord) ||
        value.vehicleUnitPointerNewestRecord < 0 ||
        value.vehicleUnitPointerNewestRecord > 0xff_ff ||
        value.cardVehicleUnitRecords.length > maximumVehicleUnitUses
    ) {
        return {
            vehicleUses: [],
            vehicleUnitUses: [],
            warnings: [warning('invalidValue', generation, rootPath)],
        };
    }

    const vehicleUnitUses: IVehicleUnitUse[] = [];
    const warnings: ITachographWarning[] = [];
    for (const [index, rawRecord] of value.cardVehicleUnitRecords.entries()) {
        const normalized = normalizeVehicleUnitUse(rawRecord, generation, [...rootPath, 'cardVehicleUnitRecords', index]);
        vehicleUnitUses.push(...normalized.vehicleUnitUses);
        warnings.push(...normalized.warnings);
    }

    return {
        vehicleUses: [],
        vehicleUnitUses: vehicleUnitUses,
        warnings: warnings,
    };
}

export function normalizeCardAssociations(
    application: ParserDriverCardApplication,
    generation: TachographGeneration,
    pathTokens: readonly string[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedCardAssociations {
    const rootPath = [...pathTokens, 'vehiclesUsed'];
    const value = application.vehiclesUsed;
    const vehicleUnitUses = normalizeCardVehicleUnitsUsed(application, generation, pathTokens);
    if (value === null) {
        return {
            vehicleUses: [],
            vehicleUnitUses: vehicleUnitUses.vehicleUnitUses,
            warnings: vehicleUnitUses.warnings,
        };
    }
    if (
        !Number.isInteger(value.vehiclePointerNewestRecord) ||
        value.vehiclePointerNewestRecord < 0 ||
        value.vehiclePointerNewestRecord > 0xff_ff ||
        value.cardVehicleRecords.length > maximumVehicleUses
    ) {
        return {
            vehicleUses: [],
            vehicleUnitUses: vehicleUnitUses.vehicleUnitUses,
            warnings: [...vehicleUnitUses.warnings, warning('invalidValue', generation, rootPath)],
        };
    }

    const vehicleUses: IVehicleUse[] = [];
    const warnings: ITachographWarning[] = [];
    for (const [index, rawRecord] of value.cardVehicleRecords.entries()) {
        const normalized = normalizeVehicleUse(
            rawRecord,
            generation,
            [...rootPath, 'cardVehicleRecords', index],
            nationAlphaCodes,
        );
        vehicleUses.push(...normalized.vehicleUses);
        warnings.push(...normalized.warnings);
    }

    return {
        vehicleUses: vehicleUses,
        vehicleUnitUses: vehicleUnitUses.vehicleUnitUses,
        warnings: [...warnings, ...vehicleUnitUses.warnings],
    };
}
