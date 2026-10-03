import type { TachographGeneration } from '#viewer-domain';

import type { VUTransferResponseParameterID } from '../generated/esm_parser.js';

// A transfer parameter's generation follows its typeId prefix; unprefixed (first-generation) ids take `unprefixed`.
export function vehicleUnitTypeIdGeneration(
    typeId: VUTransferResponseParameterID,
    unprefixed: TachographGeneration = 'g1',
): TachographGeneration {
    return typeId.startsWith('Gen2v2') ? 'g2v2' : typeId.startsWith('Gen2') ? 'g2' : unprefixed;
}
