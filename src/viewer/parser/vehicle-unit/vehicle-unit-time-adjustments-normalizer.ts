import {
    createVehicleUnitTimeAdjustmentTechnicalRecord,
    type ITachographWarning,
    type TachographGeneration,
    type VehicleUnitTechnicalRecord,
} from '#viewer-domain';

import { normalizeWrappedCardReference } from '../card/full-card-identity-normalizer.js';
import type {
    Gen1VuTimeAdjustmentData,
    Gen1VuTimeAdjustmentRecord,
    Gen2VuTimeAdjustmentRecord,
} from '../generated/esm_parser.js';
import { createNormalizationSourceContext } from '../normalization-source.js';
import type { ParserVehicleUnitTransferParameter } from '../decoders/parser-result-types.js';
import type { ParserNationAlphaCodes } from '../normalizers/parser-value-normalizer.js';
import { normalizeTechnicalText } from '../normalizers/technical-value-normalizer.js';
import { decodeVehicleUnitCountedRecords, decodeVehicleUnitRecordArray } from './vehicle-unit-record-array.js';
import { iterateVehicleUnitEventsSources } from './vehicle-unit-events-source.js';
import { requiredTimestamp } from './vehicle-unit-timestamps.js';

export interface INormalizedVehicleUnitTimeAdjustments {
    readonly records: readonly VehicleUnitTechnicalRecord[];
    readonly warnings: readonly ITachographWarning[];
}

const maximumTimeAdjustmentRecords = 4_096;
const maximumWorkshopTextLength = 35;

const { source, warning } = createNormalizationSourceContext('vehicleUnit');

function requiredText(
    value: string,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    warnings: ITachographWarning[],
): string | null {
    const text = normalizeTechnicalText(value, maximumWorkshopTextLength);
    if (text === null) {
        warnings.push(warning('invalidValue', generation, pathTokens));
    }
    return text;
}

function createTimeAdjustmentRecord(
    value: Gen1VuTimeAdjustmentRecord | Gen2VuTimeAdjustmentRecord,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    warnings: ITachographWarning[],
    nationAlphaCodes: ParserNationAlphaCodes,
): VehicleUnitTechnicalRecord | null {
    const oldTime = requiredTimestamp(value.oldTimeValue, generation, [...pathTokens, 'oldTimeValue'], warnings);
    if (oldTime === null) {
        return null;
    }

    const newTime = requiredTimestamp(value.newTimeValue, generation, [...pathTokens, 'newTimeValue'], warnings);
    if (newTime === null) {
        return null;
    }

    const workshopName = requiredText(value.workshopName, generation, [...pathTokens, 'workshopName'], warnings);
    if (workshopName === null) {
        return null;
    }

    const workshopAddress = requiredText(value.workshopAddress, generation, [...pathTokens, 'workshopAddress'], warnings);
    if (workshopAddress === null) {
        return null;
    }

    const workshopCard = normalizeWrappedCardReference(
        'workshopCardNumber' in value ? value.workshopCardNumber : value.workshopCardNumberAndGeneration,
        generation,
        'workshopCardNumber' in value
            ? [...pathTokens, 'workshopCardNumber']
            : [...pathTokens, 'workshopCardNumberAndGeneration'],
        nationAlphaCodes,
        warning,
    );
    warnings.push(...workshopCard.warnings);

    return createVehicleUnitTimeAdjustmentTechnicalRecord({
        newTime,
        oldTime,
        source: source(generation, pathTokens),
        workshopAddress,
        workshopCard: workshopCard.reference,
        workshopName,
    });
}

function normalizeGen1TimeAdjustments(
    value: Gen1VuTimeAdjustmentData,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedVehicleUnitTimeAdjustments {
    const warnings: ITachographWarning[] = [];
    const records: VehicleUnitTechnicalRecord[] = [];

    if (
        decodeVehicleUnitCountedRecords(
            value.noOfVuTimeAdjRecords,
            value.vuTimeAdjustmentRecords,
            maximumTimeAdjustmentRecords,
        ) === null
    ) {
        return {
            records: [],
            warnings: [warning('inconsistentData', generation, pathTokens)],
        };
    }

    for (const [index, record] of value.vuTimeAdjustmentRecords.entries()) {
        const normalized = createTimeAdjustmentRecord(
            record,
            generation,
            [...pathTokens, 'vuTimeAdjustmentRecords', index],
            warnings,
            nationAlphaCodes,
        );
        if (normalized !== null) {
            records.push(normalized);
        }
    }

    return {
        records,
        warnings,
    };
}

function normalizeGen2TimeAdjustments(
    value: readonly Gen2VuTimeAdjustmentRecord[],
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedVehicleUnitTimeAdjustments {
    const warnings: ITachographWarning[] = [];
    const records: VehicleUnitTechnicalRecord[] = [];

    for (const [index, record] of value.entries()) {
        const normalized = createTimeAdjustmentRecord(
            record,
            generation,
            [...pathTokens, 'records', index],
            warnings,
            nationAlphaCodes,
        );
        if (normalized !== null) {
            records.push(normalized);
        }
    }

    return {
        records,
        warnings,
    };
}

export function normalizeVehicleUnitTimeAdjustments(
    transferParameters: readonly ParserVehicleUnitTransferParameter[],
    parserVariant: 'vuGen1' | 'vuGen2',
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedVehicleUnitTimeAdjustments {
    const records: VehicleUnitTechnicalRecord[] = [];
    const warnings: ITachographWarning[] = [];
    const sourcesResult = iterateVehicleUnitEventsSources(transferParameters, parserVariant);
    warnings.push(...sourcesResult.warnings);

    for (const sourceEntry of sourcesResult.sources) {
        if (sourceEntry.gen1 !== null) {
            const normalized = normalizeGen1TimeAdjustments(
                sourceEntry.gen1.vuTimeAdjustmentData,
                sourceEntry.generation,
                [...sourceEntry.rootPath, 'vuTimeAdjustmentData'],
                nationAlphaCodes,
            );
            records.push(...normalized.records);
            warnings.push(...normalized.warnings);
        } else {
            const decoded = decodeVehicleUnitRecordArray(
                sourceEntry.gen2.vuTimeAdjustmentRecordArray,
                maximumTimeAdjustmentRecords,
                'VuTimeAdjustmentRecord',
            );
            if (decoded === null) {
                warnings.push(
                    warning('inconsistentData', sourceEntry.generation, [...sourceEntry.rootPath, 'vuTimeAdjustmentRecordArray']),
                );
                continue;
            }
            const normalized = normalizeGen2TimeAdjustments(
                decoded,
                sourceEntry.generation,
                [...sourceEntry.rootPath, 'vuTimeAdjustmentRecordArray'],
                nationAlphaCodes,
            );
            records.push(...normalized.records);
            warnings.push(...normalized.warnings);
        }
    }

    return {
        records,
        warnings,
    };
}
