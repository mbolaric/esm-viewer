import { classifyParseError, err, ok } from '#contracts';
import {
    getUtcDuration,
    type DurationMilliseconds,
    type ISourceReference,
    type TachographEventFault,
    type TachographGeneration,
    type UtcTimestamp,
} from '#viewer-domain';
import { projectDocumentEventFaultRecords, type EventFaultTypeFilter, type OpenedTachographDocument } from '#viewer-application';

import {
    type DocumentViewModelResult,
    formatDateTime,
    formatDuration,
    formatNumber,
    type IFormattedValue,
    type ViewerLocalisationService,
} from '../helpers/view-model-formatting.js';

export type EventFaultSecurityCategory = 'operationalNotice' | 'securityCritical' | 'sensorDiagnostic';

const SECURITY_CRITICAL_CODES: ReadonlySet<TachographEventFault['code']> = new Set([
    'cardConflict',
    'drivingWithoutAppropriateCard',
    'gnssTamperDetected',
    'insertionOfNonValidCard',
    'motionDataError',
    'powerSupplyInterruption',
    'sensorAuthenticationFailure',
    'sensorHardwareSabotage',
    'sensorUnauthorisedCaseOpening',
    'vehicleMotionConflict',
    'vuHardwareSabotage',
    'vuMotionSensorAuthenticationFailure',
    'vuTachographCardAuthenticationFailure',
    'vuUnauthorisedCaseOpening',
    'vuUnauthorisedChangeOfMotionSensor',
]);

const SENSOR_DIAGNOSTIC_CODES: ReadonlySet<TachographEventFault['code']> = new Set([
    'gnssExternalCommunicationFault',
    'gnssExternalFacilityCertificateExpired',
    'gnssExternalReceiverFault',
    'gnssInternalReceiverFault',
    'recordingEquipmentDisplayFault',
    'recordingEquipmentDownloadingFault',
    'recordingEquipmentPrinterFault',
    'recordingEquipmentSensorFault',
    'recordingEquipmentVuInternalFault',
    'remoteCommunicationModuleCommunicationFault',
    'remoteCommunicationModuleFault',
    'sensorInternalDataTransferError',
    'sensorStoredDataIntegrityError',
    'vuCardDataInputIntegrityError',
    'vuInternalDataTransferError',
    'vuStoredUserDataIntegrityError',
]);

export function classifyEventFaultSecurity(code: TachographEventFault['code']): EventFaultSecurityCategory {
    if (SECURITY_CRITICAL_CODES.has(code)) {
        return 'securityCritical';
    }
    if (SENSOR_DIAGNOSTIC_CODES.has(code)) {
        return 'sensorDiagnostic';
    }
    return 'operationalNotice';
}

export interface IEventFaultRecordViewModel {
    readonly code: TachographEventFault['code'];
    readonly duration: IFormattedValue<DurationMilliseconds> | null;
    readonly end: IFormattedValue<UtcTimestamp> | null;
    readonly generation: TachographGeneration;
    readonly record: TachographEventFault;
    readonly recordKind: TachographEventFault['recordKind'];
    readonly recordPurpose: TachographEventFault['recordPurpose'];
    readonly registrationMemberState: TachographEventFault['registrationMemberState'];
    readonly registrationNumber: TachographEventFault['registrationNumber'];
    readonly searchValues: readonly string[];
    readonly securityCategory: EventFaultSecurityCategory;
    readonly similarOccurrences: IFormattedValue<number> | null;
    readonly source: ISourceReference;
    readonly start: IFormattedValue<UtcTimestamp>;
}

export interface IEventFaultSectionViewModel {
    readonly allCount: IFormattedValue<number>;
    readonly eventCount: IFormattedValue<number>;
    readonly faultCount: IFormattedValue<number>;
    readonly filter: EventFaultTypeFilter;
    readonly locale: string;
    readonly records: readonly IEventFaultRecordViewModel[];
    readonly securityCriticalCount: IFormattedValue<number>;
    readonly timeZone: string;
    readonly totalCount: IFormattedValue<number>;
}

function createEventFaultRecordViewModel(
    record: TachographEventFault,
    localisation: ViewerLocalisationService,
): DocumentViewModelResult<IEventFaultRecordViewModel> {
    const start = formatDateTime(record.start, localisation);
    const end = record.end === null ? null : formatDateTime(record.end, localisation);
    const similarOccurrences = record.similarOccurrences === null ? null : formatNumber(record.similarOccurrences, localisation);
    let duration: IFormattedValue<DurationMilliseconds> | null = null;
    if (record.end !== null) {
        const durationValue = getUtcDuration(record.start, record.end);
        if (durationValue === null) {
            return err(classifyParseError('projectionFailed'));
        }
        duration = formatDuration(durationValue, localisation);
    }

    return ok({
        code: record.code,
        duration,
        end,
        generation: record.source.generation,
        record,
        recordKind: record.recordKind,
        recordPurpose: record.recordPurpose,
        registrationMemberState: record.registrationMemberState,
        registrationNumber: record.registrationNumber,
        searchValues: [
            start.display,
            end?.display,
            duration?.display,
            record.code,
            record.recordKind,
            record.recordPurpose,
            record.registrationMemberState,
            record.registrationNumber,
            similarOccurrences?.display,
            record.source.path,
        ].filter((value): value is string => value !== undefined && value !== null),
        securityCategory: classifyEventFaultSecurity(record.code),
        similarOccurrences,
        source: record.source,
        start,
    });
}

export function createEventFaultSectionViewModel(
    document: OpenedTachographDocument,
    localisation: ViewerLocalisationService,
    filter: EventFaultTypeFilter = 'all',
): DocumentViewModelResult<IEventFaultSectionViewModel> {
    const allSourceRecords = projectDocumentEventFaultRecords(document);
    const sourceRecords = filter === 'all' ? allSourceRecords : allSourceRecords.filter((record) => record.recordKind === filter);
    const records: IEventFaultRecordViewModel[] = [];
    for (const record of sourceRecords) {
        const mapped = createEventFaultRecordViewModel(record, localisation);
        if (!mapped.ok) {
            return mapped;
        }
        records.push(mapped.value);
    }

    const eventCount = allSourceRecords.filter((record) => record.recordKind === 'event').length;
    const faultCount = allSourceRecords.length - eventCount;
    const securityCriticalCount = allSourceRecords.filter(
        (record) => classifyEventFaultSecurity(record.code) === 'securityCritical',
    ).length;
    return ok({
        allCount: formatNumber(allSourceRecords.length, localisation),
        eventCount: formatNumber(eventCount, localisation),
        faultCount: formatNumber(faultCount, localisation),
        filter,
        locale: localisation.locale,
        records: records,
        securityCriticalCount: formatNumber(securityCriticalCount, localisation),
        timeZone: localisation.timeZone,
        totalCount: formatNumber(records.length, localisation),
    });
}
