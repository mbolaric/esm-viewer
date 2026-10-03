import {
    createOverspeedRecord,
    isSpeedKilometresPerHour,
    type IOverspeedControlData,
    type IOverspeedRecord,
    type ITachographWarning,
    type TachographGeneration,
    type UtcTimestamp,
} from '#viewer-domain';

import { normalizeParserEventFaultPurpose } from '../normalizers/event-fault-value-normalizer.js';
import type {
    Gen1VuEvents,
    Gen1VuOverSpeedingEventRecord,
    Gen2VUEvents,
    Gen2VuOverSpeedingEventRecord,
    Gen2FullCardNumberAndGeneration,
    FullCardNumber,
    TimeReal,
    VuOverSpeedingControlData,
} from '../generated/esm_parser.js';
import { normalizeWrappedCardReference, type INormalizedRecordedCardReference } from '../card/full-card-identity-normalizer.js';
import { createNormalizationSourceContext } from '../normalization-source.js';
import type { ParserVehicleUnitTransferParameter } from '../decoders/parser-result-types.js';
import {
    isRecordedParserTimestamp,
    normalizeParserUtcTimestamp,
    type ParserNationAlphaCodes,
} from '../normalizers/parser-value-normalizer.js';
import { decodeVehicleUnitCountedRecords, decodeVehicleUnitRecordArray } from './vehicle-unit-record-array.js';
import { iterateVehicleUnitEventsSources } from './vehicle-unit-events-source.js';

export interface INormalizedVehicleUnitOverspeedData {
    readonly control: IOverspeedControlData | null;
    readonly records: readonly IOverspeedRecord[];
    readonly warnings: readonly ITachographWarning[];
}

const maximumRecords = 4_096;
const { source, warning } = createNormalizationSourceContext('vehicleUnit');

function normalizeParserUtcTimestampOrNull(
    value: TimeReal,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
): { readonly timestamp: UtcTimestamp | null; readonly warnings: readonly ITachographWarning[] } {
    if (value === null) {
        return {
            timestamp: null,
            warnings: [],
        };
    }

    const timestamp = normalizeParserUtcTimestamp(value);
    if (timestamp === null) {
        return {
            timestamp: null,
            warnings: [warning('invalidValue', generation, pathTokens)],
        };
    }

    return {
        timestamp: isRecordedParserTimestamp(timestamp) ? timestamp : null,
        warnings: [],
    };
}

function normalizeCardReference(
    value: FullCardNumber | Gen2FullCardNumberAndGeneration,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedRecordedCardReference {
    return normalizeWrappedCardReference(value, generation, pathTokens, nationAlphaCodes, warning);
}

interface INormalizedOverspeedRecord {
    readonly record: IOverspeedRecord | null;
    readonly warnings: readonly ITachographWarning[];
}

function normalizeOverspeedRecord(
    value: Gen1VuOverSpeedingEventRecord | Gen2VuOverSpeedingEventRecord,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedOverspeedRecord {
    const warnings: ITachographWarning[] = [];
    const beginResult = normalizeParserUtcTimestampOrNull(value.eventBeginTime, generation, [...pathTokens, 'eventBeginTime']);
    warnings.push(...beginResult.warnings);

    const endResult = normalizeParserUtcTimestampOrNull(value.eventEndTime, generation, [...pathTokens, 'eventEndTime']);
    warnings.push(...endResult.warnings);

    const maxSpeed = isSpeedKilometresPerHour(value.maxSpeedValue) ? value.maxSpeedValue : null;
    if (maxSpeed === null) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'maxSpeedValue']));
    }

    const cardReference = normalizeCardReference(
        'cardNumberDriverSlotBegin' in value ? value.cardNumberDriverSlotBegin : value.cardNumberAndGenDriverSlotBegin,
        generation,
        [...pathTokens, 'cardNumberDriverSlotBegin'],
        nationAlphaCodes,
    );
    warnings.push(...cardReference.warnings);

    const similarEventsNumber = value.similarEventsNumber;
    if (!Number.isInteger(similarEventsNumber) || similarEventsNumber < 0 || similarEventsNumber > 0xff) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'similarEventsNumber']));
    }

    const begin = beginResult.timestamp;
    const end = endResult.timestamp;
    if (begin === null || maxSpeed === null) {
        return {
            record: null,
            warnings,
        };
    }

    const record = createOverspeedRecord({
        averageSpeedKilometresPerHour: value.averageSpeedValue,
        begin,
        cardNumberDriverSlotBegin: cardReference.reference,
        end,
        maxSpeedKilometresPerHour: maxSpeed,
        purpose: normalizeParserEventFaultPurpose(value.eventRecordPurpose),
        similarEventsNumber: Number.isInteger(similarEventsNumber) && similarEventsNumber >= 0 ? similarEventsNumber : null,
        source: source(generation, pathTokens),
    });
    if (record === null) {
        warnings.push(warning('invalidValue', generation, pathTokens));
    }

    return {
        record,
        warnings,
    };
}

function normalizeControlData(
    value: VuOverSpeedingControlData,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
): {
    readonly control: IOverspeedControlData | null;
    readonly warnings: readonly ITachographWarning[];
} {
    const warnings: ITachographWarning[] = [];
    const firstOverspeedSince = normalizeParserUtcTimestampOrNull(value.firstOverspeedSince, generation, [
        ...pathTokens,
        'firstOverspeedSince',
    ]);
    warnings.push(...firstOverspeedSince.warnings);
    const lastOverspeedControlTime = normalizeParserUtcTimestampOrNull(value.lastOverspeedControlTime, generation, [
        ...pathTokens,
        'lastOverspeedControlTime',
    ]);
    warnings.push(...lastOverspeedControlTime.warnings);
    const numberOfOverspeedSince = value.numberOfOverspeedSince;
    if (!Number.isInteger(numberOfOverspeedSince) || numberOfOverspeedSince < 0 || numberOfOverspeedSince > 0xff) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'numberOfOverspeedSince']));
    }

    return {
        control: {
            firstOverspeedSince: firstOverspeedSince.timestamp,
            kind: 'overspeedControlData',
            lastOverspeedControlTime: lastOverspeedControlTime.timestamp,
            numberOfOverspeedSince:
                Number.isInteger(numberOfOverspeedSince) && numberOfOverspeedSince >= 0 ? numberOfOverspeedSince : null,
            source: source(generation, pathTokens),
        },
        warnings,
    };
}

function normalizeGen1Root(
    value: Gen1VuEvents,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedVehicleUnitOverspeedData {
    const warnings: ITachographWarning[] = [];
    const records: IOverspeedRecord[] = [];
    const data = value.vuOverSpeedingEventData;
    const dataPath = [...pathTokens, 'vuOverSpeedingEventData'];
    if (
        decodeVehicleUnitCountedRecords(data.noOfVuOverSpeedingEvents, data.vuOverSpeedingEventRecords, maximumRecords) === null
    ) {
        return {
            control: null,
            records: [],
            warnings: [warning('inconsistentData', generation, dataPath)],
        };
    }

    for (const [index, record] of data.vuOverSpeedingEventRecords.entries()) {
        const normalized = normalizeOverspeedRecord(
            record,
            generation,
            [...dataPath, 'vuOverSpeedingEventRecords', index],
            nationAlphaCodes,
        );
        warnings.push(...normalized.warnings);
        if (normalized.record !== null) {
            records.push(normalized.record);
        }
    }

    const control = normalizeControlData(value.vuOverSpeedingControlData, generation, [
        ...pathTokens,
        'vuOverSpeedingControlData',
    ]);
    warnings.push(...control.warnings);

    return {
        control: control.control,
        records,
        warnings,
    };
}

function normalizeGen2Root(
    value: Gen2VUEvents,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedVehicleUnitOverspeedData {
    const warnings: ITachographWarning[] = [];
    const records: IOverspeedRecord[] = [];
    const arrayPath = [...pathTokens, 'VuOverSpeedingEventRecordArray'];
    const decoded = decodeVehicleUnitRecordArray(
        value.VuOverSpeedingEventRecordArray,
        maximumRecords,
        'VuOverSpeedingEventRecord',
    );
    if (decoded === null) {
        return {
            control: null,
            records: [],
            warnings: [warning('inconsistentData', generation, arrayPath)],
        };
    }

    for (const [index, record] of decoded.entries()) {
        const normalized = normalizeOverspeedRecord(record, generation, [...arrayPath, 'records', index], nationAlphaCodes);
        warnings.push(...normalized.warnings);
        if (normalized.record !== null) {
            records.push(normalized.record);
        }
    }

    const controlArray = decodeVehicleUnitRecordArray(value.vuOverSpeedingControlDataRecordArray, 1, 'VuOverSpeedingControlData');
    if (controlArray === null || controlArray.length === 0) {
        return {
            control: null,
            records,
            warnings,
        };
    }

    const controlValue = controlArray[0];
    if (controlValue === undefined) {
        return {
            control: null,
            records,
            warnings,
        };
    }

    const control = normalizeControlData(controlValue, generation, [
        ...pathTokens,
        'vuOverSpeedingControlDataRecordArray',
        'records',
        0,
    ]);
    warnings.push(...control.warnings);

    return {
        control: control.control,
        records,
        warnings,
    };
}

export function normalizeVehicleUnitOverspeedData(
    transferParameters: readonly ParserVehicleUnitTransferParameter[],
    parserVariant: 'vuGen1' | 'vuGen2',
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedVehicleUnitOverspeedData {
    const records: IOverspeedRecord[] = [];
    let control: IOverspeedControlData | null = null;
    const warnings: ITachographWarning[] = [];
    const sourcesResult = iterateVehicleUnitEventsSources(transferParameters, parserVariant);
    warnings.push(...sourcesResult.warnings);

    for (const source of sourcesResult.sources) {
        const normalized =
            source.gen1 !== null
                ? normalizeGen1Root(source.gen1, source.generation, source.rootPath, nationAlphaCodes)
                : normalizeGen2Root(source.gen2, source.generation, source.rootPath, nationAlphaCodes);
        records.push(...normalized.records);
        if (normalized.control !== null) {
            control = normalized.control;
        }
        warnings.push(...normalized.warnings);
    }

    return {
        control,
        records,
        warnings,
    };
}
