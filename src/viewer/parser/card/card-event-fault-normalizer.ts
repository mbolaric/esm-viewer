import {
    createTachographEvent,
    createTachographFault,
    type ITachographEvent,
    type ITachographFault,
    type ITachographWarning,
    type TachographGeneration,
    type UtcTimestamp,
} from '#viewer-domain';

import { normalizeCardVehicleRegistration } from './card-vehicle-registration-normalizer.js';
import { normalizeParserEventFaultCode } from '../normalizers/event-fault-value-normalizer.js';
import type {
    CardEventRecord,
    CardFaultRecord,
    EventFaultType,
    TimeReal,
    VehicleRegistrationIdentification,
} from '../generated/esm_parser.js';
import { createNormalizationSourceContext } from '../normalization-source.js';
import type { ParserDriverCardApplication } from '../decoders/parser-result-types.js';
import {
    isRecordedParserTimestamp,
    normalizeParserUtcTimestamp,
    type ParserNationAlphaCodes,
} from '../normalizers/parser-value-normalizer.js';
import { appendSameGenerationDuplicateEventFaultWarnings } from '../normalizers/duplicate-evidence-normalizer.js';

export interface INormalizedCardEventFaultData {
    readonly events: readonly ITachographEvent[];
    readonly faults: readonly ITachographFault[];
    readonly warnings: readonly ITachographWarning[];
}

interface INormalizedOccurrenceRecords<TRecord> {
    readonly records: readonly TRecord[];
    readonly warnings: readonly ITachographWarning[];
}

interface IOccurrenceFields {
    readonly code: ITachographEvent['code'];
    readonly end: UtcTimestamp | null;
    readonly registration: ReturnType<typeof normalizeCardVehicleRegistration>;
    readonly start: UtcTimestamp;
    readonly warnings: readonly ITachographWarning[];
}

interface IOccurrenceFieldsNormalization {
    readonly fields: IOccurrenceFields | null;
    readonly warnings: readonly ITachographWarning[];
}

interface IOccurrenceValues {
    readonly begin: TimeReal;
    readonly beginKey: 'eventBeginTime' | 'faultBeginTime';
    readonly end: TimeReal;
    readonly endKey: 'eventEndTime' | 'faultEndTime';
    readonly type: EventFaultType;
    readonly vehicle: VehicleRegistrationIdentification;
    readonly vehicleKey: 'eventVehicleRegistration' | 'faultVehicleRegistration';
}

const maximumOccurrenceGroups = 256;
const maximumOccurrencesPerGroup = 256;
const maximumOccurrences = 4_096;

const { source, warning } = createNormalizationSourceContext('driverCard');

function isUnsignedByte(value: number): boolean {
    return Number.isInteger(value) && value >= 0 && value <= 0xff;
}

function normalizeOccurrenceFields(
    value: IOccurrenceValues,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
): IOccurrenceFieldsNormalization {
    const code = normalizeParserEventFaultCode(value.type);
    const start = normalizeParserUtcTimestamp(value.begin);
    if (start === null || start === 0) {
        return {
            fields: null,
            warnings: [warning('invalidValue', generation, [...pathTokens, value.beginKey])],
        };
    }

    const rawEnd = normalizeParserUtcTimestamp(value.end);
    const end = isRecordedParserTimestamp(rawEnd) ? rawEnd : null;
    const warnings: ITachographWarning[] =
        value.end !== null && rawEnd === null ? [warning('invalidValue', generation, [...pathTokens, value.endKey])] : [];
    const registration = normalizeCardVehicleRegistration(
        value.vehicle,
        generation,
        [...pathTokens, value.vehicleKey],
        nationAlphaCodes,
    );
    const normalizedWarnings = [...warnings, ...registration.warnings];

    return {
        fields: {
            code,
            end,
            registration,
            start,
            warnings: normalizedWarnings,
        },
        warnings: normalizedWarnings,
    };
}

function normalizeEventRecord(
    value: CardEventRecord,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedOccurrenceRecords<ITachographEvent> {
    const normalizedFields = normalizeOccurrenceFields(
        {
            begin: value.eventBeginTime,
            beginKey: 'eventBeginTime',
            end: value.eventEndTime,
            endKey: 'eventEndTime',
            type: value.eventType,
            vehicle: value.eventVehicleRegistration,
            vehicleKey: 'eventVehicleRegistration',
        },
        generation,
        pathTokens,
        nationAlphaCodes,
    );
    if (normalizedFields.fields === null) {
        return {
            records: [],
            warnings: normalizedFields.warnings,
        };
    }
    const fields = normalizedFields.fields;

    const event = createTachographEvent({
        code: fields.code,
        end: fields.end,
        recordKind: 'event',
        recordPurpose: null,
        registrationMemberState: fields.registration.memberState,
        registrationNumber: fields.registration.number,
        similarOccurrences: null,
        source: source(generation, pathTokens),
        start: fields.start,
    });
    if (event === null) {
        return {
            records: [],
            warnings: [...fields.warnings, warning('inconsistentData', generation, pathTokens)],
        };
    }

    return {
        records: [event],
        warnings: fields.warnings,
    };
}

function normalizeFaultRecord(
    value: CardFaultRecord,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedOccurrenceRecords<ITachographFault> {
    const normalizedFields = normalizeOccurrenceFields(
        {
            begin: value.faultBeginTime,
            beginKey: 'faultBeginTime',
            end: value.faultEndTime,
            endKey: 'faultEndTime',
            type: value.faultType,
            vehicle: value.faultVehicleRegistration,
            vehicleKey: 'faultVehicleRegistration',
        },
        generation,
        pathTokens,
        nationAlphaCodes,
    );
    if (normalizedFields.fields === null) {
        return {
            records: [],
            warnings: normalizedFields.warnings,
        };
    }
    const fields = normalizedFields.fields;

    const fault = createTachographFault({
        code: fields.code,
        end: fields.end,
        recordKind: 'fault',
        recordPurpose: null,
        registrationMemberState: fields.registration.memberState,
        registrationNumber: fields.registration.number,
        similarOccurrences: null,
        source: source(generation, pathTokens),
        start: fields.start,
    });
    if (fault === null) {
        return {
            records: [],
            warnings: [...fields.warnings, warning('inconsistentData', generation, pathTokens)],
        };
    }

    return {
        records: [fault],
        warnings: fields.warnings,
    };
}

function normalizeOccurrenceData<TRawRecord, TRecord>(
    count: number,
    groups: readonly (readonly TRawRecord[])[],
    generation: TachographGeneration,
    rootPath: readonly (number | string)[],
    groupsKey: 'cardEventRecords' | 'cardFaultRecords',
    isConsistent: (count: number, groups: readonly (readonly TRawRecord[])[]) => boolean,
    normalizeRecord: (
        value: TRawRecord,
        generation: TachographGeneration,
        pathTokens: readonly (number | string)[],
        nationAlphaCodes: ParserNationAlphaCodes,
    ) => INormalizedOccurrenceRecords<TRecord>,
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedOccurrenceRecords<TRecord> {
    if (!isUnsignedByte(count)) {
        return {
            records: [],
            warnings: [warning('invalidValue', generation, rootPath)],
        };
    }
    if (
        groups.length > maximumOccurrenceGroups ||
        !isConsistent(count, groups) ||
        groups.reduce((total, group) => total + group.length, 0) > maximumOccurrences
    ) {
        return {
            records: [],
            warnings: [warning('inconsistentData', generation, rootPath)],
        };
    }

    const records: TRecord[] = [];
    const warnings: ITachographWarning[] = [];
    for (const [groupIndex, group] of groups.entries()) {
        const groupPath = [...rootPath, groupsKey, groupIndex];
        if (group.length > maximumOccurrencesPerGroup) {
            warnings.push(warning('unsupportedData', generation, groupPath));
            continue;
        }

        for (const [recordIndex, record] of group.entries()) {
            const normalized = normalizeRecord(record, generation, [...groupPath, recordIndex], nationAlphaCodes);
            records.push(...normalized.records);
            warnings.push(...normalized.warnings);
        }
    }

    return {
        records: records,
        warnings: warnings,
    };
}

export function normalizeCardEventFaultData(
    application: ParserDriverCardApplication,
    generation: TachographGeneration,
    pathTokens: readonly string[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedCardEventFaultData {
    const events =
        application.eventsData === null
            ? {
                  records: [],
                  warnings: [],
              }
            : normalizeOccurrenceData(
                  application.eventsData.noOfRecords,
                  application.eventsData.cardEventRecords,
                  generation,
                  [...pathTokens, 'eventsData'],
                  'cardEventRecords',
                  (count, groups) => groups.length <= count,
                  normalizeEventRecord,
                  nationAlphaCodes,
              );
    const faults =
        application.faultsData === null
            ? {
                  records: [],
                  warnings: [],
              }
            : normalizeOccurrenceData(
                  application.faultsData.noFaultsPerType,
                  application.faultsData.cardFaultRecords,
                  generation,
                  [...pathTokens, 'faultsData'],
                  'cardFaultRecords',
                  (count, groups) => groups.length <= 2 && groups.every((group) => group.length <= count),
                  normalizeFaultRecord,
                  nationAlphaCodes,
              );

    const warnings = [...events.warnings, ...faults.warnings];
    appendSameGenerationDuplicateEventFaultWarnings([...events.records, ...faults.records], warnings);

    return {
        events: events.records,
        faults: faults.records,
        warnings,
    };
}
