import type { ITachographWarning, TachographGeneration } from '#viewer-domain';

import type { Gen1VUActivity, Gen2VUActivity } from '../generated/esm_parser.js';
import { createNormalizationSourceContext } from '../normalization-source.js';
import type { ParserVehicleUnitTransferParameter } from '../decoders/parser-result-types.js';
import { vehicleUnitTypeIdGeneration } from './vehicle-unit-generation.js';

export type IVehicleUnitActivitySection =
    | {
          readonly activity: Gen1VUActivity;
          readonly generation: 'g1';
          readonly rootPath: readonly (number | string)[];
      }
    | {
          readonly activity: Gen2VUActivity;
          readonly generation: 'g2' | 'g2v2';
          readonly rootPath: readonly (number | string)[];
      };

export interface INormalizedVehicleUnitActivitySections {
    readonly sections: readonly IVehicleUnitActivitySection[];
    readonly warnings: readonly ITachographWarning[];
}

const activityTypeIds: ReadonlySet<ParserVehicleUnitTransferParameter['typeId']> = new Set([
    'Activities',
    'Gen2Activities',
    'Gen2v2Activities',
]);
const { warning } = createNormalizationSourceContext('vehicleUnit');

export function normalizeVehicleUnitActivitySections(
    transferParameters: readonly ParserVehicleUnitTransferParameter[],
    parserGeneration: TachographGeneration,
): INormalizedVehicleUnitActivitySections {
    const sections: IVehicleUnitActivitySection[] = [];
    const warnings: ITachographWarning[] = [];
    for (const [index, parameter] of transferParameters.entries()) {
        if (!activityTypeIds.has(parameter.typeId)) {
            continue;
        }

        const generation = vehicleUnitTypeIdGeneration(parameter.typeId, parserGeneration);
        const rootPath = ['transferResParams', index, 'data', 'Activity'] as const;
        if (typeof parameter.data !== 'object' || !('Activity' in parameter.data)) {
            warnings.push(warning('invalidValue', generation, rootPath));
            continue;
        }

        const activity = parameter.data.Activity;
        const isGen1 = 'vuCardIWData' in activity;
        if ((generation === 'g1') !== isGen1) {
            warnings.push(warning('inconsistentData', generation, rootPath));
            continue;
        }

        if (isGen1) {
            sections.push({
                activity,
                generation: 'g1',
                rootPath,
            });
        } else {
            sections.push({
                activity,
                generation: generation === 'g2v2' ? 'g2v2' : 'g2',
                rootPath,
            });
        }
    }

    return {
        sections: sections,
        warnings: warnings,
    };
}
