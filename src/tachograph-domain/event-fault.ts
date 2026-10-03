import type { RecordedIssuingMemberState, VehicleRegistrationNumber } from './identity.js';
import type { ISourceReference } from './source-reference.js';
import type { UtcTimestamp } from './time.js';

export type EventFaultCode =
    | 'cardConflict'
    | 'cardInsertionWhileDriving'
    | 'cardNoFurtherDetails'
    | 'drivingWithoutAppropriateCard'
    | 'gnssExternalCommunicationFault'
    | 'gnssExternalFacilityCertificateExpired'
    | 'gnssExternalReceiverFault'
    | 'gnssInternalReceiverFault'
    | 'gnssNoFurtherDetails'
    | 'gnssNoPositionData'
    | 'gnssTamperDetected'
    | 'insertionOfNonValidCard'
    | 'itsNoFurtherDetails'
    | 'lastCardSessionNotCorrectlyClosed'
    | 'motionDataError'
    | 'noFurtherDetails'
    | 'overSpeeding'
    | 'powerSupplyInterruption'
    | 'recordingEquipmentDisplayFault'
    | 'recordingEquipmentDownloadingFault'
    | 'recordingEquipmentNoFurtherDetails'
    | 'recordingEquipmentPrinterFault'
    | 'recordingEquipmentSensorFault'
    | 'recordingEquipmentVuInternalFault'
    | 'remoteCommunicationModuleCommunicationFault'
    | 'remoteCommunicationModuleFault'
    | 'remoteCommunicationNoFurtherDetails'
    | 'sensorAuthenticationFailure'
    | 'sensorHardwareSabotage'
    | 'sensorInternalDataTransferError'
    | 'sensorNoFurtherDetails'
    | 'sensorStoredDataIntegrityError'
    | 'sensorUnauthorisedCaseOpening'
    | 'timeConflict'
    | 'timeOverlap'
    | 'unknown'
    | 'vehicleMotionConflict'
    | 'vuCardDataInputIntegrityError'
    | 'vuHardwareSabotage'
    | 'vuInternalDataTransferError'
    | 'vuMotionSensorAuthenticationFailure'
    | 'vuNoFurtherDetails'
    | 'vuStoredUserDataIntegrityError'
    | 'vuTachographCardAuthenticationFailure'
    | 'vuUnauthorisedCaseOpening'
    | 'vuUnauthorisedChangeOfMotionSensor';

export type EventFaultRecordPurpose =
    | 'active'
    | 'firstAfterLastCalibration'
    | 'lastForOneOfLast10Days'
    | 'longestForOneOfLast10Days'
    | 'mostSeriousForOneOfLast10Days'
    | 'oneOf10MostRecentOrLast'
    | 'oneOf5LongestOverLast365Days'
    | 'oneOf5MostSeriousOverLast365Days'
    | 'unknown';

interface ITachographEventFaultBase {
    readonly code: EventFaultCode;
    readonly end: UtcTimestamp | null;
    readonly recordPurpose: EventFaultRecordPurpose | null;
    readonly registrationMemberState: RecordedIssuingMemberState | null;
    readonly registrationNumber: VehicleRegistrationNumber | null;
    readonly similarOccurrences: number | null;
    readonly source: ISourceReference;
    readonly start: UtcTimestamp;
}

export interface ITachographEvent extends ITachographEventFaultBase {
    readonly recordKind: 'event';
}

export interface ITachographFault extends ITachographEventFaultBase {
    readonly recordKind: 'fault';
}

export type TachographEventFault = ITachographEvent | ITachographFault;

interface ITachographEventFaultInput extends Omit<ITachographEventFaultBase, 'similarOccurrences'> {
    readonly similarOccurrences: number | null;
}

export interface ITachographEventInput extends ITachographEventFaultInput {
    readonly recordKind: 'event';
}

export interface ITachographFaultInput extends ITachographEventFaultInput {
    readonly recordKind: 'fault';
}

function hasValidOccurrenceCount(value: number | null): boolean {
    return value === null || (Number.isInteger(value) && value >= 0 && value <= 0xff);
}

function createEventFaultBase(input: ITachographEventFaultInput): ITachographEventFaultBase | null {
    if ((input.end !== null && input.end < input.start) || !hasValidOccurrenceCount(input.similarOccurrences)) {
        return null;
    }

    return {
        code: input.code,
        end: input.end,
        recordPurpose: input.recordPurpose,
        registrationMemberState: input.registrationMemberState,
        registrationNumber: input.registrationNumber,
        similarOccurrences: input.similarOccurrences,
        source: input.source,
        start: input.start,
    };
}

export function createTachographEvent(input: ITachographEventInput): ITachographEvent | null {
    const base = createEventFaultBase(input);

    return base === null
        ? null
        : {
              ...base,
              recordKind: 'event',
          };
}

export function createTachographFault(input: ITachographFaultInput): ITachographFault | null {
    const base = createEventFaultBase(input);

    return base === null
        ? null
        : {
              ...base,
              recordKind: 'fault',
          };
}
