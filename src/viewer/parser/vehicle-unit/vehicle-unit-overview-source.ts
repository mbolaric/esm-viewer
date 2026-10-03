import type { TachographGeneration } from '#viewer-domain';

import type { Gen1VuOverview, Gen2VUOverview, VUTransferResponseParameterID } from '../generated/esm_parser.js';
import type { ParserVehicleUnitTransferParameter } from '../decoders/parser-result-types.js';
import { vehicleUnitTypeIdGeneration } from './vehicle-unit-generation.js';

export interface IVehicleUnitOverviewSource {
    readonly generation: TachographGeneration;
    readonly overview: Gen1VuOverview | Gen2VUOverview;
    readonly pathTokens: readonly (number | string)[];
}

const overviewTypeIds: ReadonlySet<VUTransferResponseParameterID> = new Set(['Gen2Overview', 'Gen2v2Overview', 'Overview']);

export function iterateVehicleUnitOverviewSources(
    transferParameters: readonly ParserVehicleUnitTransferParameter[],
): readonly IVehicleUnitOverviewSource[] {
    const sources: IVehicleUnitOverviewSource[] = [];

    for (const [index, parameter] of transferParameters.entries()) {
        if (!overviewTypeIds.has(parameter.typeId)) {
            continue;
        }

        const generation = vehicleUnitTypeIdGeneration(parameter.typeId);
        const pathTokens = ['transferResParams', index, 'data'] as const;
        if (typeof parameter.data !== 'object' || !('Control' in parameter.data)) {
            continue;
        }

        sources.push({
            generation,
            overview: parameter.data.Control,
            pathTokens,
        });
    }

    return sources;
}
