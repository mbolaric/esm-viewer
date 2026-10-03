import {
    createVehicleIdentity,
    isVehicleIdentificationNumber,
    isVehicleRegistrationNumber,
    type ITachographWarning,
    type IVehicleIdentity,
    type TachographGeneration,
} from '#viewer-domain';

import type {
    Gen1VuOverview,
    Gen2VehicleIdentificationNumberRecordArray,
    Gen2VehicleRegistrationNumberRecordArray,
    Gen2VUOverview,
    RecordType,
    VUTransferResponseParameterID,
} from '../generated/esm_parser.js';
import { createNormalizationSourceContext } from '../normalization-source.js';
import type { ParserVehicleUnitTransferParameter } from '../decoders/parser-result-types.js';
import { normalizeParserNation, type ParserNationAlphaCodes } from '../normalizers/parser-value-normalizer.js';
import { decodeVehicleUnitRecordArray } from './vehicle-unit-record-array.js';

interface IVehicleUnitIdentityNormalization {
    readonly identity: IVehicleIdentity | null;
    readonly warnings: readonly ITachographWarning[];
}

interface IStringRecordArrayDecode {
    readonly value: string | null;
    readonly warnings: readonly ITachographWarning[];
}

const overviewTypeIds: ReadonlySet<VUTransferResponseParameterID> = new Set(['Gen2Overview', 'Gen2v2Overview', 'Overview']);

const { source, warning } = createNormalizationSourceContext('vehicleUnit');

function decodeSingleStringRecordArray(
    value: Gen2VehicleIdentificationNumberRecordArray | Gen2VehicleRegistrationNumberRecordArray,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    recordType: Extract<RecordType, 'VehicleIdentificationNumber' | 'VehicleRegistrationNumber'>,
): IStringRecordArrayDecode {
    const records = decodeVehicleUnitRecordArray(value, 1, recordType);
    if (records === null) {
        return {
            value: null,
            warnings: [warning('inconsistentData', generation, pathTokens)],
        };
    }
    if (records.length !== 1) {
        return {
            value: null,
            warnings: [
                warning(records.length === 0 ? 'missingValue' : 'inconsistentData', generation, [...pathTokens, 'records']),
            ],
        };
    }

    return {
        value: records[0] ?? null,
        warnings: [],
    };
}

function normalizeGen1Overview(
    overview: Gen1VuOverview,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
): IVehicleUnitIdentityNormalization {
    const warnings: ITachographWarning[] = [];
    const vehicleIdentificationNumber = isVehicleIdentificationNumber(overview.vehicleIdentificationNumber)
        ? overview.vehicleIdentificationNumber
        : null;
    if (vehicleIdentificationNumber === null) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'vehicleIdentificationNumber']));
    }

    const registrationPath = [...pathTokens, 'vehicleRegistrationIdentification'];
    const registration = overview.vehicleRegistrationIdentification;
    const registrationNumber = isVehicleRegistrationNumber(registration.vehicleRegistrationNumber)
        ? registration.vehicleRegistrationNumber
        : null;
    if (registrationNumber === null) {
        warnings.push(warning('invalidValue', generation, [...registrationPath, 'vehicleRegistrationNumber']));
    }

    const registrationMemberState = normalizeParserNation(registration.vehicleRegistrationNation, nationAlphaCodes);
    if (registrationMemberState === null) {
        warnings.push(warning('unsupportedData', generation, [...registrationPath, 'vehicleRegistrationNation']));
    }

    return {
        identity: createVehicleIdentity({
            registrationMemberState,
            registrationNumber,
            source: source(generation, pathTokens),
            vehicleIdentificationNumber,
        }),
        warnings: warnings,
    };
}

function normalizeGen2Overview(
    overview: Gen2VUOverview,
    expectedTypeId: VUTransferResponseParameterID,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
): IVehicleUnitIdentityNormalization {
    if (overview.trepId !== expectedTypeId) {
        return {
            identity: null,
            warnings: [warning('inconsistentData', generation, [...pathTokens, 'trepId'])],
        };
    }

    const vehicleIdentificationPath = [...pathTokens, 'vehicleIdentificationNumberRecordArray'];
    const vehicleRegistrationPath = [...pathTokens, 'vehicleRegistrationNumberRecordArray'];
    const vehicleIdentification = decodeSingleStringRecordArray(
        overview.vehicleIdentificationNumberRecordArray,
        generation,
        vehicleIdentificationPath,
        'VehicleIdentificationNumber',
    );
    const vehicleRegistration = decodeSingleStringRecordArray(
        overview.vehicleRegistrationNumberRecordArray,
        generation,
        vehicleRegistrationPath,
        'VehicleRegistrationNumber',
    );
    const warnings: ITachographWarning[] = [...vehicleIdentification.warnings, ...vehicleRegistration.warnings];

    const vehicleIdentificationNumber = isVehicleIdentificationNumber(vehicleIdentification.value)
        ? vehicleIdentification.value
        : null;
    if (vehicleIdentification.value !== null && vehicleIdentificationNumber === null) {
        warnings.push(warning('invalidValue', generation, [...vehicleIdentificationPath, 'records', 0]));
    }

    const registrationNumber = isVehicleRegistrationNumber(vehicleRegistration.value) ? vehicleRegistration.value : null;
    if (vehicleRegistration.value !== null && registrationNumber === null) {
        warnings.push(warning('invalidValue', generation, [...vehicleRegistrationPath, 'records', 0]));
    }

    return {
        identity: createVehicleIdentity({
            registrationMemberState: null,
            registrationNumber,
            source: source(generation, pathTokens),
            vehicleIdentificationNumber,
        }),
        warnings: warnings,
    };
}

export function normalizeVehicleUnitIdentity(
    transferParameters: readonly ParserVehicleUnitTransferParameter[],
    generation: TachographGeneration,
    nationAlphaCodes: ParserNationAlphaCodes,
): IVehicleUnitIdentityNormalization {
    const overviewIndexes = transferParameters.flatMap((parameter, index) =>
        overviewTypeIds.has(parameter.typeId) ? [index] : [],
    );

    if (overviewIndexes.length === 0) {
        return {
            identity: null,
            warnings: [],
        };
    }
    if (overviewIndexes.length > 1) {
        return {
            identity: null,
            warnings: [warning('inconsistentData', generation, ['transferResParams'])],
        };
    }

    const overviewIndex = overviewIndexes[0];
    if (overviewIndex === undefined) {
        return {
            identity: null,
            warnings: [warning('inconsistentData', generation, ['transferResParams'])],
        };
    }
    const parameter = transferParameters[overviewIndex];
    if (parameter === undefined) {
        return {
            identity: null,
            warnings: [warning('inconsistentData', generation, ['transferResParams'])],
        };
    }

    const dataPath = ['transferResParams', overviewIndex, 'data'] as const;
    if (typeof parameter.data !== 'object' || !('Control' in parameter.data)) {
        return {
            identity: null,
            warnings: [warning('invalidValue', generation, dataPath)],
        };
    }

    const overviewPath = [...dataPath, 'Control'];
    const overview = parameter.data.Control;
    const isGen1 = 'vehicleIdentificationNumber' in overview;
    if ((generation === 'g1') !== isGen1) {
        return {
            identity: null,
            warnings: [warning('inconsistentData', generation, overviewPath)],
        };
    }

    return isGen1
        ? normalizeGen1Overview(overview, generation, overviewPath, nationAlphaCodes)
        : normalizeGen2Overview(overview, parameter.typeId, generation, overviewPath);
}
