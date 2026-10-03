import type { EventFaultCode, EventFaultRecordPurpose } from '#viewer-domain';

import type {
    EventFaultRecordPurpose as ParserEventFaultRecordPurpose,
    EventFaultType as ParserEventFaultType,
} from '../generated/esm_parser.js';

const eventFaultCodes = {
    CardConflict: 'cardConflict',
    CardInsertionWhileDriving: 'cardInsertionWhileDriving',
    CardNoFurtherDetails: 'cardNoFurtherDetails',
    DrivingWithoutAppropriateCard: 'drivingWithoutAppropriateCard',
    GNSSExternalGNSSCommunicationFault: 'gnssExternalCommunicationFault',
    GNSSExternalGNSSFacilityCertificateExpired: 'gnssExternalFacilityCertificateExpired',
    GNSSExternalGNSSReceiverFault: 'gnssExternalReceiverFault',
    GNSSInternalGNSSReceiverFault: 'gnssInternalReceiverFault',
    GNSSNofurtherDetails: 'gnssNoFurtherDetails',
    GNSSNoGNSSPositionData: 'gnssNoPositionData',
    GNSSTamperDetectionOfGNSS: 'gnssTamperDetected',
    InsertionOfNonValidCard: 'insertionOfNonValidCard',
    ITSNoFurtherDetails: 'itsNoFurtherDetails',
    LastCardSessionNotCorrectlyClosed: 'lastCardSessionNotCorrectlyClosed',
    MotionDataError: 'motionDataError',
    NoFurtherDetails: 'noFurtherDetails',
    OverSpeeding: 'overSpeeding',
    PowerSupplyInterruption: 'powerSupplyInterruption',
    REDisplayFault: 'recordingEquipmentDisplayFault',
    REDownloadingFault: 'recordingEquipmentDownloadingFault',
    RENoFurtherDetails: 'recordingEquipmentNoFurtherDetails',
    REPrinterFault: 'recordingEquipmentPrinterFault',
    RESensorFault: 'recordingEquipmentSensorFault',
    REVUInternalFault: 'recordingEquipmentVuInternalFault',
    RCMNoFurtherDetails: 'remoteCommunicationNoFurtherDetails',
    RCMRemoteCommunicationModuleCommunicationFault: 'remoteCommunicationModuleCommunicationFault',
    RCMRemoteCommunicationModuleFault: 'remoteCommunicationModuleFault',
    SensorAuthenticationFailure: 'sensorAuthenticationFailure',
    SensorHardwareSabotage: 'sensorHardwareSabotage',
    SensorInternalDataTransferError: 'sensorInternalDataTransferError',
    SensorNoFurtherDetails: 'sensorNoFurtherDetails',
    SensorStoredDataIntegrityError: 'sensorStoredDataIntegrityError',
    SensorUnauthorisedCaseOpening: 'sensorUnauthorisedCaseOpening',
    TimeConflict: 'timeConflict',
    TimeOverlap: 'timeOverlap',
    Unknown: 'unknown',
    VehicleMotionConflict: 'vehicleMotionConflict',
    VuCardDataInputIntegrityError: 'vuCardDataInputIntegrityError',
    VuHardwareSabotage: 'vuHardwareSabotage',
    VuInternalDataTransferError: 'vuInternalDataTransferError',
    VuMotionSensorAuthenticationFailure: 'vuMotionSensorAuthenticationFailure',
    VuNoFurtherDetails: 'vuNoFurtherDetails',
    VuStoredUserDataIntegrityError: 'vuStoredUserDataIntegrityError',
    VuTachographCardAuthenticationFailure: 'vuTachographCardAuthenticationFailure',
    VuUnauthorisedCaseOpening: 'vuUnauthorisedCaseOpening',
    VuUnauthorisedChangeOfMotionSensor: 'vuUnauthorisedChangeOfMotionSensor',
} satisfies Readonly<Record<ParserEventFaultType, EventFaultCode>>;

const eventFaultPurposes = {
    ActiveEventOrFault: 'active',
    FirstEventorFaultAfterLastCalibration: 'firstAfterLastCalibration',
    LastEventForOneOfLast10Days: 'lastForOneOfLast10Days',
    LongestEventForOneOfLast10Days: 'longestForOneOfLast10Days',
    MostSeriousEventForOneOfLast10Days: 'mostSeriousForOneOfLast10Days',
    OneOf10MostRecentOrLast: 'oneOf10MostRecentOrLast',
    OneOf5LongestEventsOverLast365Days: 'oneOf5LongestOverLast365Days',
    OneOf5MostSeriousEventsOverLast365Days: 'oneOf5MostSeriousOverLast365Days',
    Unknown: 'unknown',
} satisfies Readonly<Record<ParserEventFaultRecordPurpose, EventFaultRecordPurpose>>;

export function normalizeParserEventFaultCode(value: ParserEventFaultType): EventFaultCode {
    return eventFaultCodes[value];
}

export function normalizeParserEventFaultPurpose(value: ParserEventFaultRecordPurpose): EventFaultRecordPurpose {
    return eventFaultPurposes[value];
}
