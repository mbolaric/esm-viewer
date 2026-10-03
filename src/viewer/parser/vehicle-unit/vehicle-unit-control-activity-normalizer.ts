import {
    createVehicleUnitControlActivityTechnicalRecord,
    type ITachographWarning,
    type TachographGeneration,
    type VehicleUnitTechnicalRecord,
} from '#viewer-domain';

import { normalizeWrappedCardReference } from '../card/full-card-identity-normalizer.js';
import { normalizeParserCardControlActivityType } from '../normalizers/parser-enum-normalizer.js';
import type { Gen1VuControlActivityRecord, Gen2VuControlActivityRecord } from '../generated/esm_parser.js';
import { createNormalizationSourceContext } from '../normalization-source.js';
import type { ParserVehicleUnitTransferParameter } from '../decoders/parser-result-types.js';
import type { ParserNationAlphaCodes } from '../normalizers/parser-value-normalizer.js';
import { decodeVehicleUnitCountedRecords, decodeVehicleUnitRecordArray } from './vehicle-unit-record-array.js';
import { iterateVehicleUnitOverviewSources } from './vehicle-unit-overview-source.js';
import { optionalTimestamp, requiredTimestamp } from './vehicle-unit-timestamps.js';

export interface INormalizedVehicleUnitControlActivity {
    readonly records: readonly VehicleUnitTechnicalRecord[];
    readonly warnings: readonly ITachographWarning[];
}

const maximumControlsPerParameter = 4_096;

const { source, warning } = createNormalizationSourceContext('vehicleUnit');

function createControlActivityRecord(
    value: Gen1VuControlActivityRecord | Gen2VuControlActivityRecord,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
    warnings: ITachographWarning[],
): VehicleUnitTechnicalRecord | null {
    const controlType = normalizeParserCardControlActivityType(value.controlType);
    if (controlType === null) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'controlType']));
        return null;
    }

    const controlledAt = requiredTimestamp(value.controlTime, generation, [...pathTokens, 'controlTime'], warnings);
    if (controlledAt === null) {
        return null;
    }

    const downloadPeriodBegin = optionalTimestamp(
        value.downloadPeriodBeginTime,
        generation,
        [...pathTokens, 'downloadPeriodBeginTime'],
        warnings,
    );
    const downloadPeriodEnd = optionalTimestamp(
        value.downloadPeriodEndTime,
        generation,
        [...pathTokens, 'downloadPeriodEndTime'],
        warnings,
    );

    const controlCard = normalizeWrappedCardReference(
        'controlCardNumber' in value ? value.controlCardNumber : value.controlCardNumberAndGeneration,
        generation,
        'controlCardNumber' in value ? [...pathTokens, 'controlCardNumber'] : [...pathTokens, 'controlCardNumberAndGeneration'],
        nationAlphaCodes,
        warning,
    );
    warnings.push(...controlCard.warnings);

    return createVehicleUnitControlActivityTechnicalRecord({
        controlCard: controlCard.reference,
        controlledAt,
        controlType,
        downloadPeriodBegin,
        downloadPeriodEnd,
        source: source(generation, pathTokens),
    });
}

export function normalizeVehicleUnitControlActivity(
    parameters: readonly ParserVehicleUnitTransferParameter[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedVehicleUnitControlActivity {
    const warnings: ITachographWarning[] = [];
    const records: VehicleUnitTechnicalRecord[] = [];

    for (const source of iterateVehicleUnitOverviewSources(parameters)) {
        const { generation, overview, pathTokens } = source;

        if (generation === 'g1') {
            if (!('vuControlActivity' in overview)) {
                continue;
            }
            const controlData = overview.vuControlActivity;
            const rawControls = controlData.vuControlActivities;
            const count = controlData.noOfControls;

            if (decodeVehicleUnitCountedRecords(count, rawControls, maximumControlsPerParameter) === null) {
                warnings.push(warning('inconsistentData', generation, [...pathTokens, 'Control', 'vuControlActivity']));
                continue;
            }

            for (let controlIndex = 0; controlIndex < rawControls.length; controlIndex++) {
                const control = rawControls[controlIndex];
                if (control !== undefined) {
                    const record = createControlActivityRecord(
                        control,
                        generation,
                        [...pathTokens, 'Control', 'vuControlActivity', 'vuControlActivities', controlIndex],
                        nationAlphaCodes,
                        warnings,
                    );
                    if (record !== null) {
                        records.push(record);
                    }
                }
            }
        } else {
            if (!('vuControlActivityRecordArray' in overview)) {
                continue;
            }
            const result = decodeVehicleUnitRecordArray(
                overview.vuControlActivityRecordArray,
                maximumControlsPerParameter,
                'VuControlActivityRecord',
            );
            if (result === null) {
                warnings.push(
                    warning('inconsistentData', generation, [...pathTokens, 'Control', 'vuControlActivityRecordArray']),
                );
                continue;
            }

            for (let controlIndex = 0; controlIndex < result.length; controlIndex++) {
                const control = result[controlIndex];
                if (control !== undefined) {
                    const record = createControlActivityRecord(
                        control,
                        generation,
                        [...pathTokens, 'Control', 'vuControlActivityRecordArray', 'records', controlIndex],
                        nationAlphaCodes,
                        warnings,
                    );
                    if (record !== null) {
                        records.push(record);
                    }
                }
            }
        }
    }

    return {
        records,
        warnings,
    };
}
