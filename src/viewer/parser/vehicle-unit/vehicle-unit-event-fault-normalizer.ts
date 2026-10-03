import {
    createTachographEvent,
    createTachographFault,
    type EventFaultRecordPurpose,
    type ITachographEvent,
    type ITachographFault,
    type ITachographWarning,
    type TachographGeneration,
    type UtcTimestamp,
} from '#viewer-domain';

import { normalizeParserEventFaultCode, normalizeParserEventFaultPurpose } from '../normalizers/event-fault-value-normalizer.js';
import type {
    EventFaultRecordPurpose as ParserEventFaultRecordPurpose,
    EventFaultType,
    Gen1VuEventRecord,
    Gen1VuEvents,
    Gen1VuFaultRecord,
    Gen2VUEvents,
    Gen2VuEventRecord,
    Gen2VuFaultRecord,
    TimeReal,
} from '../generated/esm_parser.js';
import { createNormalizationSourceContext } from '../normalization-source.js';
import type { ParserVehicleUnitTransferParameter } from '../decoders/parser-result-types.js';
import { isRecordedParserTimestamp, normalizeParserUtcTimestamp } from '../normalizers/parser-value-normalizer.js';
import { appendSameGenerationDuplicateEventFaultWarnings } from '../normalizers/duplicate-evidence-normalizer.js';
import { decodeVehicleUnitCountedRecords, decodeVehicleUnitRecordArray } from './vehicle-unit-record-array.js';
import { iterateVehicleUnitEventsSources } from './vehicle-unit-events-source.js';

export interface INormalizedVehicleUnitEventFaultData {
    readonly events: readonly ITachographEvent[];
    readonly faults: readonly ITachographFault[];
    readonly warnings: readonly ITachographWarning[];
}

interface INormalizedRecords<TRecord> {
    readonly records: readonly TRecord[];
    readonly warnings: readonly ITachographWarning[];
}

interface IOccurrenceCore {
    readonly code: ITachographEvent['code'];
    readonly end: UtcTimestamp | null;
    readonly purpose: EventFaultRecordPurpose;
    readonly start: UtcTimestamp;
}

interface IOccurrenceCoreNormalization {
    readonly core: IOccurrenceCore | null;
    readonly warnings: readonly ITachographWarning[];
}

interface IOccurrenceValues {
    readonly begin: TimeReal;
    readonly beginKey: 'eventBeginTime' | 'faultBeginTime';
    readonly end: TimeReal;
    readonly endKey: 'eventEndTime' | 'faultEndTime';
    readonly purpose: ParserEventFaultRecordPurpose;
    readonly type: EventFaultType;
}

const maximumRecords = 4_096;
const { source, warning } = createNormalizationSourceContext('vehicleUnit');

function normalizeOccurrenceCore(
    value: IOccurrenceValues,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
): IOccurrenceCoreNormalization {
    const warnings: ITachographWarning[] = [];
    const start = normalizeParserUtcTimestamp(value.begin);
    if (start === null || start === 0) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, value.beginKey]));
    }

    const rawEnd = normalizeParserUtcTimestamp(value.end);
    const end = isRecordedParserTimestamp(rawEnd) ? rawEnd : null;
    if (value.end !== null && rawEnd === null) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, value.endKey]));
    }

    if (start === null || start === 0) {
        return {
            core: null,
            warnings: warnings,
        };
    }

    return {
        core: {
            code: normalizeParserEventFaultCode(value.type),
            end,
            purpose: normalizeParserEventFaultPurpose(value.purpose),
            start,
        },
        warnings: warnings,
    };
}

function normalizeEventRecord(
    value: Gen1VuEventRecord | Gen2VuEventRecord,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
): INormalizedRecords<ITachographEvent> {
    if (!Number.isInteger(value.similarEventsNumber) || value.similarEventsNumber < 0 || value.similarEventsNumber > 0xff) {
        return {
            records: [],
            warnings: [warning('invalidValue', generation, pathTokens)],
        };
    }

    const normalizedCore = normalizeOccurrenceCore(
        {
            begin: value.eventBeginTime,
            beginKey: 'eventBeginTime',
            end: value.eventEndTime,
            endKey: 'eventEndTime',
            purpose: value.eventRecordPurpose,
            type: value.eventType,
        },
        generation,
        pathTokens,
    );
    if (normalizedCore.core === null) {
        return {
            records: [],
            warnings: normalizedCore.warnings,
        };
    }

    const event = createTachographEvent({
        code: normalizedCore.core.code,
        end: normalizedCore.core.end,
        recordKind: 'event',
        recordPurpose: normalizedCore.core.purpose,
        registrationMemberState: null,
        registrationNumber: null,
        similarOccurrences: value.similarEventsNumber,
        source: source(generation, pathTokens),
        start: normalizedCore.core.start,
    });
    if (event === null) {
        return {
            records: [],
            warnings: [...normalizedCore.warnings, warning('inconsistentData', generation, pathTokens)],
        };
    }

    return {
        records: [event],
        warnings: normalizedCore.warnings,
    };
}

function normalizeFaultRecord(
    value: Gen1VuFaultRecord | Gen2VuFaultRecord,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
): INormalizedRecords<ITachographFault> {
    const normalizedCore = normalizeOccurrenceCore(
        {
            begin: value.faultBeginTime,
            beginKey: 'faultBeginTime',
            end: value.faultEndTime,
            endKey: 'faultEndTime',
            purpose: value.faultRecordPurpose,
            type: value.faultType,
        },
        generation,
        pathTokens,
    );
    if (normalizedCore.core === null) {
        return {
            records: [],
            warnings: normalizedCore.warnings,
        };
    }

    const fault = createTachographFault({
        code: normalizedCore.core.code,
        end: normalizedCore.core.end,
        recordKind: 'fault',
        recordPurpose: normalizedCore.core.purpose,
        registrationMemberState: null,
        registrationNumber: null,
        similarOccurrences: null,
        source: source(generation, pathTokens),
        start: normalizedCore.core.start,
    });
    if (fault === null) {
        return {
            records: [],
            warnings: [...normalizedCore.warnings, warning('inconsistentData', generation, pathTokens)],
        };
    }

    return {
        records: [fault],
        warnings: normalizedCore.warnings,
    };
}

// Normalizes a decoded record list; a list that failed decoding (null) yields one inconsistentData warning at `listPath`.
function normalizeRecordList<TRawRecord, TRecord>(
    records: readonly TRawRecord[] | null,
    generation: TachographGeneration,
    listPath: readonly (number | string)[],
    recordsKey: string,
    normalizeRecord: (
        record: TRawRecord,
        generation: TachographGeneration,
        pathTokens: readonly (number | string)[],
    ) => INormalizedRecords<TRecord>,
): INormalizedRecords<TRecord> {
    if (records === null) {
        return { records: [], warnings: [warning('inconsistentData', generation, listPath)] };
    }
    const normalizedRecords: TRecord[] = [];
    const warnings: ITachographWarning[] = [];
    for (const [index, record] of records.entries()) {
        const normalized = normalizeRecord(record, generation, [...listPath, recordsKey, index]);
        normalizedRecords.push(...normalized.records);
        warnings.push(...normalized.warnings);
    }

    return {
        records: normalizedRecords,
        warnings: warnings,
    };
}

function normalizeGen1Root(
    value: Gen1VuEvents,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
): INormalizedVehicleUnitEventFaultData {
    const eventData = value.vuEventData;
    const faultData = value.vuFaultData;
    const eventPath = [...pathTokens, 'vuEventData'];
    const faultPath = [...pathTokens, 'vuFaultData'];
    const events = normalizeRecordList(
        decodeVehicleUnitCountedRecords(eventData.noOfVuEvents, eventData.vuEventRecords, maximumRecords),
        generation,
        eventPath,
        'vuEventRecords',
        normalizeEventRecord,
    );
    const faults = normalizeRecordList(
        decodeVehicleUnitCountedRecords(faultData.noOfVuFaults, faultData.vuFaultRecords, maximumRecords),
        generation,
        faultPath,
        'vuFaultRecords',
        normalizeFaultRecord,
    );

    return {
        events: events.records,
        faults: faults.records,
        warnings: [...events.warnings, ...faults.warnings],
    };
}

function normalizeGen2Root(
    value: Gen2VUEvents,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
): INormalizedVehicleUnitEventFaultData {
    const eventPath = [...pathTokens, 'vuEventRecordArray'];
    const faultPath = [...pathTokens, 'vuFaultRecordArray'];
    const events = normalizeRecordList(
        decodeVehicleUnitRecordArray(value.vuEventRecordArray, maximumRecords, 'VuEventRecord'),
        generation,
        eventPath,
        'records',
        normalizeEventRecord,
    );
    const faults = normalizeRecordList(
        decodeVehicleUnitRecordArray(value.vuFaultRecordArray, maximumRecords, 'VuFaultRecord'),
        generation,
        faultPath,
        'records',
        normalizeFaultRecord,
    );

    return {
        events: events.records,
        faults: faults.records,
        warnings: [...events.warnings, ...faults.warnings],
    };
}

export function normalizeVehicleUnitEventFaultData(
    transferParameters: readonly ParserVehicleUnitTransferParameter[],
    parserVariant: 'vuGen1' | 'vuGen2',
): INormalizedVehicleUnitEventFaultData {
    const events: ITachographEvent[] = [];
    const faults: ITachographFault[] = [];
    const warnings: ITachographWarning[] = [];
    const sourcesResult = iterateVehicleUnitEventsSources(transferParameters, parserVariant);
    warnings.push(...sourcesResult.warnings);

    for (const source of sourcesResult.sources) {
        const normalized =
            source.gen1 !== null
                ? normalizeGen1Root(source.gen1, source.generation, source.rootPath)
                : normalizeGen2Root(source.gen2, source.generation, source.rootPath);
        events.push(...normalized.events);
        faults.push(...normalized.faults);
        warnings.push(...normalized.warnings);
    }

    appendSameGenerationDuplicateEventFaultWarnings([...events, ...faults], warnings);

    return {
        events: events,
        faults: faults,
        warnings: warnings,
    };
}
