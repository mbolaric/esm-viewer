import type { ITachographWarning, TachographGeneration } from '#viewer-domain';

import type { Gen1VuEvents, Gen2VUEvents, VUTransferResponseParameterID } from '../generated/esm_parser.js';
import { createNormalizationSourceContext } from '../normalization-source.js';
import type { ParserVehicleUnitTransferParameter } from '../decoders/parser-result-types.js';

interface IVehicleUnitEventsSourceBase {
    readonly generation: TachographGeneration;
    readonly rootPath: readonly (number | string)[];
}

export interface IVehicleUnitGen1EventsSource extends IVehicleUnitEventsSourceBase {
    readonly gen1: Gen1VuEvents;
    readonly gen2: null;
}

export interface IVehicleUnitGen2EventsSource extends IVehicleUnitEventsSourceBase {
    readonly gen1: null;
    readonly gen2: Gen2VUEvents;
}

export type IVehicleUnitEventsSource = IVehicleUnitGen1EventsSource | IVehicleUnitGen2EventsSource;

export interface IVehicleUnitEventsSourcesResult {
    readonly sources: readonly IVehicleUnitEventsSource[];
    readonly warnings: readonly ITachographWarning[];
}

const { warning } = createNormalizationSourceContext('vehicleUnit');

const eventTypeIds: ReadonlySet<VUTransferResponseParameterID> = new Set([
    'EventsAndFaults',
    'Gen2EventsAndFaults',
    'Gen2v2EventsAndFaults',
]);

function eventsGeneration(parserVariant: 'vuGen1' | 'vuGen2', typeId: VUTransferResponseParameterID): TachographGeneration {
    return parserVariant === 'vuGen1' ? 'g1' : typeId === 'Gen2v2EventsAndFaults' ? 'g2v2' : 'g2';
}

export function iterateVehicleUnitEventsSources(
    transferParameters: readonly ParserVehicleUnitTransferParameter[],
    parserVariant: 'vuGen1' | 'vuGen2',
): IVehicleUnitEventsSourcesResult {
    const sources: IVehicleUnitEventsSource[] = [];
    const warnings: ITachographWarning[] = [];

    for (const [index, parameter] of transferParameters.entries()) {
        if (!eventTypeIds.has(parameter.typeId)) {
            continue;
        }

        const generation = eventsGeneration(parserVariant, parameter.typeId);
        const dataPath = ['transferResParams', index, 'data'] as const;
        if (typeof parameter.data !== 'object' || !('Events' in parameter.data)) {
            warnings.push(warning('invalidValue', generation, dataPath));
            continue;
        }

        const rootPath = [...dataPath, 'Events'];
        const eventData = parameter.data.Events;
        const isGen1 = 'vuEventData' in eventData;
        if ((parserVariant === 'vuGen1') !== isGen1) {
            warnings.push(warning('inconsistentData', generation, rootPath));
            continue;
        }

        sources.push(
            isGen1
                ? { gen1: eventData, gen2: null, generation, rootPath }
                : { gen1: null, gen2: eventData, generation, rootPath },
        );
    }

    return {
        sources,
        warnings,
    };
}
