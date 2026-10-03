import {
    createDetailedSpeedSample,
    isSpeedKilometresPerHour,
    isUtcTimestamp,
    type IDetailedSpeedSample,
    type ITachographWarning,
    type TachographGeneration,
} from '#viewer-domain';

import type {
    Gen1VuDetailedSpeed,
    Gen2VUSpeed,
    VUTransferResponseParameterID,
    VuDetailedSpeedBlock,
} from '../generated/esm_parser.js';
import { createNormalizationSourceContext } from '../normalization-source.js';
import type { ParserVehicleUnitTransferParameter } from '../decoders/parser-result-types.js';
import { isRecordedParserTimestamp, normalizeParserUtcTimestamp } from '../normalizers/parser-value-normalizer.js';
import { decodeVehicleUnitRecordArray } from './vehicle-unit-record-array.js';
import { vehicleUnitTypeIdGeneration } from './vehicle-unit-generation.js';

export interface INormalizedVehicleUnitSpeedData {
    readonly samples: readonly IDetailedSpeedSample[];
    readonly warnings: readonly ITachographWarning[];
}

interface INormalizedSpeedBlock {
    readonly samples: readonly IDetailedSpeedSample[];
    readonly warnings: readonly ITachographWarning[];
}

const millisecondsPerSecond = 1_000;
const samplesPerBlock = 60;
// Annex 1C 24h is a storage floor, not a ceiling; wire format u16 limit (0xFFFF) is the upper bound.
const maximumSpeedBlocksPerResponse = 0xff_ff;
const maximumSpeedSamplesPerDocument = maximumSpeedBlocksPerResponse * samplesPerBlock;
const speedTypeIds: ReadonlySet<VUTransferResponseParameterID> = new Set(['Gen2Speed', 'Gen2v2Speed', 'Speed']);

const { source, warning } = createNormalizationSourceContext('vehicleUnit');

function normalizeSpeedBlock(
    value: VuDetailedSpeedBlock,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
): INormalizedSpeedBlock {
    if (value.speedsPerSecond.length !== samplesPerBlock || !value.speedsPerSecond.every(isSpeedKilometresPerHour)) {
        return {
            samples: [],
            warnings: [warning('invalidValue', generation, pathTokens)],
        };
    }

    const blockStart = normalizeParserUtcTimestamp(value.speedBlockBeginDate);
    if (!isRecordedParserTimestamp(blockStart)) {
        return {
            samples: [],
            warnings: [warning('invalidValue', generation, [...pathTokens, 'speedBlockBeginDate'])],
        };
    }

    const samples: IDetailedSpeedSample[] = [];
    for (const [index, speedKilometresPerHour] of value.speedsPerSecond.entries()) {
        const recordedAt = blockStart + index * millisecondsPerSecond;
        if (!isUtcTimestamp(recordedAt)) {
            return {
                samples: [],
                warnings: [warning('invalidValue', generation, [...pathTokens, 'speedsPerSecond', index])],
            };
        }
        samples.push(
            createDetailedSpeedSample({
                recordedAt,
                source: source(generation, [...pathTokens, 'speedsPerSecond', index]),
                speedKilometresPerHour,
            }),
        );
    }

    return {
        samples: samples,
        warnings: [],
    };
}

function normalizeSpeedBlocks(
    blocks: readonly VuDetailedSpeedBlock[],
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
): INormalizedVehicleUnitSpeedData {
    const samples: IDetailedSpeedSample[] = [];
    const warnings: ITachographWarning[] = [];
    for (const [index, block] of blocks.entries()) {
        const normalized = normalizeSpeedBlock(block, generation, [...pathTokens, index]);
        samples.push(...normalized.samples);
        warnings.push(...normalized.warnings);
    }

    return {
        samples: samples,
        warnings: warnings,
    };
}

function normalizeGen1Speed(
    value: Gen1VuDetailedSpeed,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
): INormalizedVehicleUnitSpeedData {
    const dataPath = [...pathTokens, 'vuDetailedSpeedData'];
    const data = value.vuDetailedSpeedData;
    if (
        !Number.isInteger(data.noOfSpeedBlocks) ||
        data.noOfSpeedBlocks < 0 ||
        data.noOfSpeedBlocks !== data.vuDetailedSpeedBlocks.length
    ) {
        return {
            samples: [],
            warnings: [warning('inconsistentData', generation, dataPath)],
        };
    }
    if (data.vuDetailedSpeedBlocks.length > maximumSpeedBlocksPerResponse) {
        return {
            samples: [],
            warnings: [warning('unsupportedData', generation, dataPath)],
        };
    }

    return normalizeSpeedBlocks(data.vuDetailedSpeedBlocks, generation, [...dataPath, 'vuDetailedSpeedBlocks']);
}

function normalizeGen2Speed(
    value: Gen2VUSpeed,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
): INormalizedVehicleUnitSpeedData {
    const arrayPath = [...pathTokens, 'vuDetailedSpeedBlockRecordArray'];
    const blocks = decodeVehicleUnitRecordArray(
        value.vuDetailedSpeedBlockRecordArray,
        maximumSpeedBlocksPerResponse,
        'VuDetailedSpeedBlock',
    );
    if (blocks === null) {
        return {
            samples: [],
            warnings: [warning('inconsistentData', generation, arrayPath)],
        };
    }

    return normalizeSpeedBlocks(blocks, generation, [...arrayPath, 'records']);
}

export function normalizeVehicleUnitSpeedData(
    transferParameters: readonly ParserVehicleUnitTransferParameter[],
): INormalizedVehicleUnitSpeedData {
    const samples: IDetailedSpeedSample[] = [];
    const warnings: ITachographWarning[] = [];

    for (const [index, parameter] of transferParameters.entries()) {
        if (!speedTypeIds.has(parameter.typeId)) {
            continue;
        }

        const generation = vehicleUnitTypeIdGeneration(parameter.typeId);
        const dataPath = ['transferResParams', index, 'data'] as const;
        if (typeof parameter.data !== 'object' || !('Speed' in parameter.data)) {
            warnings.push(warning('invalidValue', generation, dataPath));
            continue;
        }

        const rootPath = [...dataPath, 'Speed'];
        const speed = parameter.data.Speed;
        const isGen1 = 'vuDetailedSpeedData' in speed;
        if ((generation === 'g1') !== isGen1) {
            warnings.push(warning('inconsistentData', generation, rootPath));
            continue;
        }
        const normalized = isGen1
            ? normalizeGen1Speed(speed, generation, rootPath)
            : normalizeGen2Speed(speed, generation, rootPath);
        warnings.push(...normalized.warnings);
        if (samples.length + normalized.samples.length > maximumSpeedSamplesPerDocument) {
            warnings.push(warning('unsupportedData', generation, rootPath));
            continue;
        }
        // Loop avoids call-stack limit from spreading large sample arrays.
        for (const sample of normalized.samples) {
            samples.push(sample);
        }
    }

    return {
        samples: samples,
        warnings: warnings,
    };
}
