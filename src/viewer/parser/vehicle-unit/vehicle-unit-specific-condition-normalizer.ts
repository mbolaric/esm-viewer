import {
    createVehicleUnitSpecificConditionTechnicalRecord,
    type ITachographWarning,
    type TachographGeneration,
    type VehicleUnitTechnicalRecord,
} from '#viewer-domain';

import { normalizeParserSpecificConditionType } from '../normalizers/parser-enum-normalizer.js';
import type { SpecificConditionRecord } from '../generated/esm_parser.js';
import { createNormalizationSourceContext } from '../normalization-source.js';
import type { ParserVehicleUnitTransferParameter } from '../decoders/parser-result-types.js';
import { isRecordedParserTimestamp, normalizeParserUtcTimestamp } from '../normalizers/parser-value-normalizer.js';
import { decodeVehicleUnitCountedRecords, decodeVehicleUnitRecordArray } from './vehicle-unit-record-array.js';
import { normalizeVehicleUnitActivitySections, type IVehicleUnitActivitySection } from './vehicle-unit-activity-normalizer.js';

export interface INormalizedVehicleUnitSpecificConditions {
    readonly records: readonly VehicleUnitTechnicalRecord[];
    readonly warnings: readonly ITachographWarning[];
}

const maximumSpecificConditionRecords = 4_096;

const { source, warning } = createNormalizationSourceContext('vehicleUnit');

function normalizeSpecificConditionRecord(
    value: SpecificConditionRecord,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    warnings: ITachographWarning[],
): VehicleUnitTechnicalRecord | null {
    const enteredAt = normalizeParserUtcTimestamp(value.entryTime);
    const conditionType = normalizeParserSpecificConditionType(value.specificConditionType);
    if (!isRecordedParserTimestamp(enteredAt)) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'entryTime']));
    }
    if (conditionType === null) {
        warnings.push(warning('unsupportedData', generation, [...pathTokens, 'specificConditionType']));
    }
    if (!isRecordedParserTimestamp(enteredAt) || conditionType === null) {
        return null;
    }

    return createVehicleUnitSpecificConditionTechnicalRecord({
        conditionType,
        enteredAt,
        source: source(generation, pathTokens),
    });
}

// Gen1 counts its records in a separate field; Gen2 wraps them in a typed record array.
function specificConditionList(section: IVehicleUnitActivitySection): {
    readonly listPath: readonly (number | string)[];
    readonly records: readonly SpecificConditionRecord[] | null;
    readonly recordsKey: string;
} {
    if (section.generation === 'g1') {
        const data = section.activity.vuSpecificConditionData;
        return {
            listPath: [...section.rootPath, 'vuSpecificConditionData'],
            records: decodeVehicleUnitCountedRecords(
                data.noOfSpecificConditionRecords,
                data.specificConditionRecords,
                maximumSpecificConditionRecords,
            ),
            recordsKey: 'specificConditionRecords',
        };
    }
    return {
        listPath: [...section.rootPath, 'vuSpecificConditionRecordArray'],
        records: decodeVehicleUnitRecordArray(
            section.activity.vuSpecificConditionRecordArray,
            maximumSpecificConditionRecords,
            'SpecificConditionRecord',
        ),
        recordsKey: 'records',
    };
}

export function normalizeVehicleUnitSpecificConditions(
    transferParameters: readonly ParserVehicleUnitTransferParameter[],
    parserGeneration: TachographGeneration,
): INormalizedVehicleUnitSpecificConditions {
    const records: VehicleUnitTechnicalRecord[] = [];
    const warnings: ITachographWarning[] = [];

    const sectionsResult = normalizeVehicleUnitActivitySections(transferParameters, parserGeneration);
    warnings.push(...sectionsResult.warnings);

    for (const section of sectionsResult.sections) {
        const list = specificConditionList(section);
        if (list.records === null) {
            warnings.push(warning('inconsistentData', section.generation, list.listPath));
            continue;
        }
        for (const [index, record] of list.records.entries()) {
            const normalized = normalizeSpecificConditionRecord(
                record,
                section.generation,
                [...list.listPath, list.recordsKey, index],
                warnings,
            );
            if (normalized !== null) {
                records.push(normalized);
            }
        }
    }

    return {
        records,
        warnings,
    };
}
