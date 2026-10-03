import type { EventFaultCode } from '#viewer-domain';
import { describe, expect, it } from 'vitest';

import { classifyEventFaultSecurity, type EventFaultSecurityCategory } from '../view-models/event-fault-view-model.js';

// Exhaustive compile-time mapping: new EventFaultCodes must be classified here.
const eventFaultCodes: readonly EventFaultCode[] = [
    'cardConflict',
    'cardInsertionWhileDriving',
    'cardNoFurtherDetails',
    'drivingWithoutAppropriateCard',
    'gnssExternalCommunicationFault',
    'gnssExternalFacilityCertificateExpired',
    'gnssExternalReceiverFault',
    'gnssInternalReceiverFault',
    'gnssNoFurtherDetails',
    'gnssNoPositionData',
    'gnssTamperDetected',
    'insertionOfNonValidCard',
    'itsNoFurtherDetails',
    'lastCardSessionNotCorrectlyClosed',
    'motionDataError',
    'noFurtherDetails',
    'overSpeeding',
    'powerSupplyInterruption',
    'recordingEquipmentDisplayFault',
    'recordingEquipmentDownloadingFault',
    'recordingEquipmentNoFurtherDetails',
    'recordingEquipmentPrinterFault',
    'recordingEquipmentSensorFault',
    'recordingEquipmentVuInternalFault',
    'remoteCommunicationModuleCommunicationFault',
    'remoteCommunicationModuleFault',
    'remoteCommunicationNoFurtherDetails',
    'sensorAuthenticationFailure',
    'sensorHardwareSabotage',
    'sensorInternalDataTransferError',
    'sensorNoFurtherDetails',
    'sensorStoredDataIntegrityError',
    'sensorUnauthorisedCaseOpening',
    'timeConflict',
    'timeOverlap',
    'unknown',
    'vehicleMotionConflict',
    'vuCardDataInputIntegrityError',
    'vuHardwareSabotage',
    'vuInternalDataTransferError',
    'vuMotionSensorAuthenticationFailure',
    'vuNoFurtherDetails',
    'vuStoredUserDataIntegrityError',
    'vuTachographCardAuthenticationFailure',
    'vuUnauthorisedCaseOpening',
    'vuUnauthorisedChangeOfMotionSensor',
];

const expectedCategory: Readonly<Record<EventFaultCode, EventFaultSecurityCategory>> = {
    cardConflict: 'securityCritical',
    cardInsertionWhileDriving: 'operationalNotice',
    cardNoFurtherDetails: 'operationalNotice',
    drivingWithoutAppropriateCard: 'securityCritical',
    gnssExternalCommunicationFault: 'sensorDiagnostic',
    gnssExternalFacilityCertificateExpired: 'sensorDiagnostic',
    gnssExternalReceiverFault: 'sensorDiagnostic',
    gnssInternalReceiverFault: 'sensorDiagnostic',
    gnssNoFurtherDetails: 'operationalNotice',
    gnssNoPositionData: 'operationalNotice',
    gnssTamperDetected: 'securityCritical',
    insertionOfNonValidCard: 'securityCritical',
    itsNoFurtherDetails: 'operationalNotice',
    lastCardSessionNotCorrectlyClosed: 'operationalNotice',
    motionDataError: 'securityCritical',
    noFurtherDetails: 'operationalNotice',
    overSpeeding: 'operationalNotice',
    powerSupplyInterruption: 'securityCritical',
    recordingEquipmentDisplayFault: 'sensorDiagnostic',
    recordingEquipmentDownloadingFault: 'sensorDiagnostic',
    recordingEquipmentNoFurtherDetails: 'operationalNotice',
    recordingEquipmentPrinterFault: 'sensorDiagnostic',
    recordingEquipmentSensorFault: 'sensorDiagnostic',
    recordingEquipmentVuInternalFault: 'sensorDiagnostic',
    remoteCommunicationModuleCommunicationFault: 'sensorDiagnostic',
    remoteCommunicationModuleFault: 'sensorDiagnostic',
    remoteCommunicationNoFurtherDetails: 'operationalNotice',
    sensorAuthenticationFailure: 'securityCritical',
    sensorHardwareSabotage: 'securityCritical',
    sensorInternalDataTransferError: 'sensorDiagnostic',
    sensorNoFurtherDetails: 'operationalNotice',
    sensorStoredDataIntegrityError: 'sensorDiagnostic',
    sensorUnauthorisedCaseOpening: 'securityCritical',
    timeConflict: 'operationalNotice',
    timeOverlap: 'operationalNotice',
    unknown: 'operationalNotice',
    vehicleMotionConflict: 'securityCritical',
    vuCardDataInputIntegrityError: 'sensorDiagnostic',
    vuHardwareSabotage: 'securityCritical',
    vuInternalDataTransferError: 'sensorDiagnostic',
    vuMotionSensorAuthenticationFailure: 'securityCritical',
    vuNoFurtherDetails: 'operationalNotice',
    vuStoredUserDataIntegrityError: 'sensorDiagnostic',
    vuTachographCardAuthenticationFailure: 'securityCritical',
    vuUnauthorisedCaseOpening: 'securityCritical',
    vuUnauthorisedChangeOfMotionSensor: 'securityCritical',
};

describe('classifyEventFaultSecurity', () => {
    it('classifies every event/fault code into exactly one security category', () => {
        for (const code of eventFaultCodes) {
            expect(classifyEventFaultSecurity(code), code).toBe(expectedCategory[code]);
        }
    });

    it('flags sabotage, tampering, power cuts, and card/motion conflicts as critical', () => {
        expect(classifyEventFaultSecurity('sensorHardwareSabotage')).toBe('securityCritical');
        expect(classifyEventFaultSecurity('vuHardwareSabotage')).toBe('securityCritical');
        expect(classifyEventFaultSecurity('sensorUnauthorisedCaseOpening')).toBe('securityCritical');
        expect(classifyEventFaultSecurity('gnssTamperDetected')).toBe('securityCritical');
        expect(classifyEventFaultSecurity('powerSupplyInterruption')).toBe('securityCritical');
        expect(classifyEventFaultSecurity('motionDataError')).toBe('securityCritical');
        expect(classifyEventFaultSecurity('drivingWithoutAppropriateCard')).toBe('securityCritical');
        expect(classifyEventFaultSecurity('cardConflict')).toBe('securityCritical');
    });

    it('separates hardware/communication diagnostics from operational notices', () => {
        expect(classifyEventFaultSecurity('recordingEquipmentSensorFault')).toBe('sensorDiagnostic');
        expect(classifyEventFaultSecurity('sensorInternalDataTransferError')).toBe('sensorDiagnostic');
        expect(classifyEventFaultSecurity('vuStoredUserDataIntegrityError')).toBe('sensorDiagnostic');
        expect(classifyEventFaultSecurity('timeOverlap')).toBe('operationalNotice');
        expect(classifyEventFaultSecurity('timeConflict')).toBe('operationalNotice');
        expect(classifyEventFaultSecurity('cardInsertionWhileDriving')).toBe('operationalNotice');
        expect(classifyEventFaultSecurity('overSpeeding')).toBe('operationalNotice');
    });
});
