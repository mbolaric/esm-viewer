import {
    translateInfringementRule,
    translateInfringementSeverity,
    translateRuleProfileName,
    type CrewQualificationStatus,
} from '#compliance';
import type { ParseError, ParseErrorCategory } from '#contracts';
import type { ITranslationService } from '#localization';
import type { DocumentWorkspaceSection } from '#viewer-application';
import type {
    ActivityKind,
    CalibrationPurpose,
    CardControlActivityType,
    CardGeneration,
    CardSlot,
    CrewPresence,
    DailyWorkPeriodEntryType,
    DocumentKind,
    EventFaultCode,
    EventFaultRecordPurpose,
    IRecordedCardReference,
    InsertedCardType,
    IntegrityAssessment,
    IntegrityChainStatus,
    IntegrityNotCheckedReason,
    LoadTypeKind,
    LoadUnloadOperationType,
    SpecificConditionType,
    VerificationLimitation,
} from '#viewer-domain';
import type { IconName } from '#ui';
import type {
    InspectorLabelKey,
    InspectorRowValue,
    ITechnicalFieldViewModel,
    TechnicalFieldKey,
    TechnicalFieldValue,
    TechnicalRecordKind,
} from '#viewer-presentation';

import type { IMessageParams, TranslationKey } from '#i18n-locales';

// Avoids circular dependency by defining translation service type locally.
type ViewerTranslationService = ITranslationService<TranslationKey, IMessageParams>;

export const sectionIcons: Readonly<Record<DocumentWorkspaceSection, IconName>> = {
    activities: 'bed',
    associations: 'creditCard',
    comparison: 'columns',
    compliance: 'layers',
    eventsAndFaults: 'triangleAlert',
    integrity: 'circleCheck',
    overview: 'columns',
    places: 'mapPin',
    rawData: 'diff',
    speed: 'circleGauge',
    technical: 'truck',
};

const documentKindTranslationKeys = {
    driverCard: 'document.kind.driverCard',
    vehicleUnit: 'document.kind.vehicleUnit',
} satisfies Readonly<Record<DocumentKind, TranslationKey>>;

const generationTranslationKeys = {
    combined: 'document.generation.combined',
    g1: 'document.generation.g1',
    g2: 'document.generation.g2',
    g2v2: 'document.generation.g2v2',
} satisfies Readonly<Record<CardGeneration, TranslationKey>>;

const integrityStatusTranslationKeys = {
    chainVerified: 'document.integrity.chainVerified',
    failed: 'document.integrity.failed',
    invalid: 'document.integrity.invalid',
    notChecked: 'document.integrity.notChecked',
    partiallyValid: 'document.integrity.partiallyValid',
    unsupported: 'document.integrity.unsupported',
    valid: 'document.integrity.valid',
} satisfies Readonly<Record<IntegrityAssessment['status'], TranslationKey>>;

export function documentKindIcon(kind: DocumentKind): IconName {
    switch (kind) {
        case 'driverCard':
            return 'creditCard';
        case 'vehicleUnit':
            return 'truck';
    }
}

export function generationIcon(generation: CardGeneration): IconName {
    switch (generation) {
        case 'combined':
            return 'layers';
        case 'g1':
        case 'g2':
        case 'g2v2':
            return 'layers';
    }
}

const integrityFailureDescriptionTranslationKeys = {
    invalidVerificationResult: 'overview.integrity.description.failed.invalidVerificationResult',
    verificationFailed: 'overview.integrity.description.failed.verificationFailed',
} satisfies Readonly<Record<'invalidVerificationResult' | 'verificationFailed', TranslationKey>>;

const integrityNotCheckedDescriptionTranslationKeys = {
    missingRootCertificate: 'overview.integrity.description.notChecked.missingRootCertificate',
    notRequested: 'overview.integrity.description.notChecked.notRequested',
} satisfies Readonly<Record<IntegrityNotCheckedReason, TranslationKey>>;

const integrityUnsupportedDescriptionTranslationKeys = {
    missingVehicleUnitOverview: 'overview.integrity.description.unsupported.missingVehicleUnitOverview',
    unsupportedCardApplication: 'overview.integrity.description.unsupported.unsupportedCardApplication',
    unsupportedCertificateChain: 'overview.integrity.description.unsupported.unsupportedCertificateChain',
    unsupportedCertificateProfile: 'overview.integrity.description.unsupported.unsupportedCertificateProfile',
} satisfies Readonly<Record<VerificationLimitation, TranslationKey>>;

const integrityChainVerifiedDescriptionTranslationKeys = {
    invalid: 'overview.integrity.description.chainVerified.invalid',
    partiallyValid: 'overview.integrity.description.chainVerified.partiallyValid',
    valid: 'overview.integrity.description.chainVerified.valid',
} satisfies Readonly<Record<IntegrityChainStatus, TranslationKey>>;

const integrityFailureLimitationTranslationKeys = {
    invalidVerificationResult: 'integrity.limitation.failed.invalidVerificationResult',
    verificationFailed: 'integrity.limitation.failed.verificationFailed',
} satisfies Readonly<Record<'invalidVerificationResult' | 'verificationFailed', TranslationKey>>;

const integrityNotCheckedLimitationTranslationKeys = {
    missingRootCertificate: 'integrity.limitation.notChecked.missingRootCertificate',
    notRequested: 'integrity.limitation.notChecked.notRequested',
} satisfies Readonly<Record<IntegrityNotCheckedReason, TranslationKey>>;

const integrityUnsupportedLimitationTranslationKeys = {
    missingVehicleUnitOverview: 'integrity.limitation.unsupported.missingVehicleUnitOverview',
    unsupportedCardApplication: 'integrity.limitation.unsupported.unsupportedCardApplication',
    unsupportedCertificateChain: 'integrity.limitation.unsupported.unsupportedCertificateChain',
    unsupportedCertificateProfile: 'integrity.limitation.unsupported.unsupportedCertificateProfile',
} satisfies Readonly<Record<VerificationLimitation, TranslationKey>>;

export function translateDocumentKind(documentKind: DocumentKind, translationService: ViewerTranslationService): string {
    return translationService.translate(documentKindTranslationKeys[documentKind]);
}

export function translateGeneration(generation: CardGeneration, translationService: ViewerTranslationService): string {
    return translationService.translate(generationTranslationKeys[generation]);
}

export function translateIntegrityStatus(
    status: IntegrityAssessment['status'],
    translationService: ViewerTranslationService,
): string {
    return translationService.translate(integrityStatusTranslationKeys[status]);
}

const parseErrorDescriptionTranslationKeys = {
    // Cancellation reuses platform failure translation.
    cancellation: 'failure.description.platformFailure',
    integrityLimitation: 'failure.description.integrityLimitation',
    internalDefect: 'failure.description.internalDefect',
    parserFailure: 'failure.description.parserFailure',
    platformFailure: 'failure.description.platformFailure',
    unsupportedData: 'failure.description.unsupportedData',
    userCorrectable: 'failure.description.userCorrectable',
} satisfies Readonly<Record<ParseErrorCategory, TranslationKey>>;

// Translates parse error descriptions, prioritizing specific user-correctable codes.
export function translateParseErrorDescription(error: ParseError, translationService: ViewerTranslationService): string {
    if (error.code === 'multipleFilesDropped') {
        return translationService.translate('failure.description.multipleFilesDropped');
    }
    if (error.code === 'fileNotFound') {
        return translationService.translate('failure.description.fileNotFound');
    }
    return translationService.translate(parseErrorDescriptionTranslationKeys[error.category]);
}

export { translateInfringementRule, translateInfringementSeverity, translateRuleProfileName };

export function integrityStatusIcon(status: IntegrityAssessment['status']): IconName {
    switch (status) {
        case 'failed':
        case 'invalid':
            return 'circleX';
        case 'notChecked':
        case 'unsupported':
            return 'circleHelp';
        case 'partiallyValid':
            return 'circleAlert';
        case 'valid':
            return 'circleCheck';
        case 'chainVerified':
            // VU verification has reduced assurance because raw data is unverified.
            return 'circleAlert';
    }
}

export function translateIntegrityDescription(
    assessment: IntegrityAssessment,
    translationService: ViewerTranslationService,
): string {
    switch (assessment.status) {
        case 'failed': {
            const failureKey =
                assessment.code === 'invalidVerificationResult' ? 'invalidVerificationResult' : 'verificationFailed';
            const baseText = translationService.translate(integrityFailureDescriptionTranslationKeys[failureKey]);
            if (assessment.code !== 'verificationFailed' && assessment.code !== 'invalidVerificationResult') {
                return `${baseText} (${translationService.translate('failure.errorCode')} ${assessment.code})`;
            }
            return baseText;
        }
        case 'invalid':
            return translationService.translate('overview.integrity.description.invalid');
        case 'notChecked':
            return translationService.translate(integrityNotCheckedDescriptionTranslationKeys[assessment.reason]);
        case 'partiallyValid':
            return translationService.translate('overview.integrity.description.partiallyValid');
        case 'unsupported':
            return translationService.translate(integrityUnsupportedDescriptionTranslationKeys[assessment.reason]);
        case 'valid':
            return translationService.translate('overview.integrity.description.valid');
        case 'chainVerified':
            return translationService.translate(integrityChainVerifiedDescriptionTranslationKeys[assessment.chainStatus]);
    }
}

export function translateIntegrityLimitation(
    assessment: IntegrityAssessment,
    translationService: ViewerTranslationService,
): string | null {
    switch (assessment.status) {
        case 'failed': {
            const failureKey =
                assessment.code === 'invalidVerificationResult' ? 'invalidVerificationResult' : 'verificationFailed';
            const baseText = translationService.translate(integrityFailureLimitationTranslationKeys[failureKey]);
            if (assessment.code !== 'verificationFailed' && assessment.code !== 'invalidVerificationResult') {
                return `${baseText} (${translationService.translate('failure.errorCode')} ${assessment.code})`;
            }
            return baseText;
        }
        case 'notChecked':
            return translationService.translate(integrityNotCheckedLimitationTranslationKeys[assessment.reason]);
        case 'unsupported':
            return translationService.translate(integrityUnsupportedLimitationTranslationKeys[assessment.reason]);
        case 'invalid':
        case 'partiallyValid':
        case 'valid':
            return null;
        case 'chainVerified':
            // Permanent scope limitation of vehicle unit verification.
            return translationService.translate('integrity.limitation.chainVerified');
    }
}

const technicalFieldTranslationKeys = {
    activityStructureLength: 'technical.field.activityStructureLength',
    ability: 'technical.field.ability',
    authorisedSpeed: 'technical.field.authorisedSpeed',
    approvalNumber: 'technical.field.approvalNumber',
    companyAddress: 'technical.field.companyAddress',
    companyCardNumber: 'technical.field.companyCardNumber',
    companyName: 'technical.field.companyName',
    lockInTime: 'technical.field.lockInTime',
    lockOutTime: 'technical.field.lockOutTime',
    borderCrossingRecords: 'technical.field.borderCrossingRecords',
    chipManufacturingReference: 'technical.field.chipManufacturingReference',
    chipSerialNumber: 'technical.field.chipSerialNumber',
    clockStop: 'technical.field.clockStop',
    calibrationPurpose: 'technical.field.calibrationPurpose',
    downloadCardIssuingMemberState: 'technical.field.downloadCardIssuingMemberState',
    downloadCardNumber: 'technical.field.downloadCardNumber',
    downloadCardType: 'technical.field.downloadCardType',
    embeddedCardIssuingMemberState: 'technical.field.embeddedCardIssuingMemberState',
    embeddedCardNumber: 'technical.field.embeddedCardNumber',
    embeddedCardSnapshotCardType: 'technical.field.embeddedCardSnapshotCardType',
    embeddedCardSnapshotExpiry: 'technical.field.embeddedCardSnapshotExpiry',
    embeddedCardSnapshotHolder: 'technical.field.embeddedCardSnapshotHolder',
    embeddedCardSnapshotSignature: 'technical.field.embeddedCardSnapshotSignature',
    embeddedCardSnapshotState: 'technical.field.embeddedCardSnapshotState',
    embeddedCardType: 'technical.field.embeddedCardType',
    controlCardIssuingMemberState: 'technical.field.controlCardIssuingMemberState',
    controlCardNumber: 'technical.field.controlCardNumber',
    controlCardType: 'technical.field.controlCardType',
    controlType: 'technical.field.controlType',
    coDriverSlot: 'technical.field.coDriverSlot',
    driverSlot: 'technical.field.driverSlot',
    dataElementUseVersion: 'technical.field.dataElementUseVersion',
    downloadPeriodBegin: 'technical.field.downloadPeriodBegin',
    downloadPeriodEnd: 'technical.field.downloadPeriodEnd',
    embedderCountryCode: 'technical.field.embedderCountryCode',
    eventsPerType: 'technical.field.eventsPerType',
    extendedSerialNumber: 'technical.field.extendedSerialNumber',
    faultsPerType: 'technical.field.faultsPerType',
    followingDataLength: 'technical.field.followingDataLength',
    gnssRecords: 'technical.field.gnssRecords',
    icIdentifier: 'technical.field.icIdentifier',
    itsConsent: 'technical.field.itsConsent',
    itsConsentCardIssuingMemberState: 'technical.field.itsConsentCardIssuingMemberState',
    itsConsentCardNumber: 'technical.field.itsConsentCardNumber',
    itsConsentCardType: 'technical.field.itsConsentCardType',
    licenceIssuingAuthority: 'technical.field.licenceIssuingAuthority',
    licenceIssuingMemberState: 'technical.field.licenceIssuingMemberState',
    licenceNumber: 'technical.field.licenceNumber',
    loadTypeEntryRecords: 'technical.field.loadTypeEntryRecords',
    loadUnloadRecords: 'technical.field.loadUnloadRecords',
    manufacturerAddress: 'technical.field.manufacturerAddress',
    manufacturerCode: 'technical.field.manufacturerCode',
    manufacturerName: 'technical.field.manufacturerName',
    manufacturerInformation: 'technical.field.manufacturerInformation',
    manufacturedAt: 'technical.field.manufacturedAt',
    moduleEmbedder: 'technical.field.moduleEmbedder',
    monthYear: 'technical.field.monthYear',
    newOdometer: 'technical.field.newOdometer',
    nextCalibrationAt: 'technical.field.nextCalibrationAt',
    odometerMidnight: 'technical.field.odometerMidnight',
    odometerMidnightDay: 'technical.field.odometerMidnightDay',
    oldOdometer: 'technical.field.oldOdometer',
    operatorName: 'technical.field.operatorName',
    personaliserId: 'technical.field.personaliserId',
    partNumber: 'technical.field.partNumber',
    placeRecords: 'technical.field.placeRecords',
    powerSupplyInterruptionBegin: 'technical.field.powerSupplyInterruptionBegin',
    powerSupplyInterruptionEnd: 'technical.field.powerSupplyInterruptionEnd',
    previousTime: 'technical.field.previousTime',
    recordingEquipmentConstant: 'technical.field.recordingEquipmentConstant',
    sensorApprovalNumber: 'technical.field.sensorApprovalNumber',
    sensorCouplingDate: 'technical.field.sensorCouplingDate',
    sensorPairingDate: 'technical.field.sensorPairingDate',
    serialType: 'technical.field.serialType',
    similarEvents: 'technical.field.similarEvents',
    softwareInstalledAt: 'technical.field.softwareInstalledAt',
    softwareVersion: 'technical.field.softwareVersion',
    specificConditionRecords: 'technical.field.specificConditionRecords',
    specificConditionType: 'technical.field.specificConditionType',
    structureVersion: 'technical.field.structureVersion',
    timeAdjustmentOldTime: 'technical.field.timeAdjustmentOldTime',
    timeAdjustmentNewTime: 'technical.field.timeAdjustmentNewTime',
    tyreCircumference: 'technical.field.tyreCircumference',
    tyreSize: 'technical.field.tyreSize',
    vehicleCharacteristicConstant: 'technical.field.vehicleCharacteristicConstant',
    vehicleIdentificationNumber: 'overview.identity.vehicleIdentificationNumber',
    vehicleRecords: 'technical.field.vehicleRecords',
    vehicleRegistrationMemberState: 'technical.field.vehicleRegistrationMemberState',
    vehicleRegistrationNumber: 'technical.field.vehicleRegistrationNumber',
    vehicleUnitConfigurationLength: 'technical.field.vehicleUnitConfigurationLength',
    vehicleUnitGeneration: 'technical.field.vehicleUnitGeneration',
    vehicleUnitRecords: 'technical.field.vehicleUnitRecords',
    workshopAddress: 'technical.field.workshopAddress',
    workshopCardExpiryAt: 'technical.field.workshopCardExpiryAt',
    workshopCardIssuingMemberState: 'technical.field.workshopCardIssuingMemberState',
    workshopCardNumber: 'technical.field.workshopCardNumber',
    workshopCardType: 'technical.field.workshopCardType',
    workshopName: 'technical.field.workshopName',
} satisfies Readonly<Record<TechnicalFieldKey, TranslationKey>>;

const technicalRecordKindTranslationKeys = {
    application: 'technical.recordKind.application',
    applicationV2: 'technical.recordKind.applicationV2',
    chip: 'technical.recordKind.chip',
    controlActivity: 'technical.recordKind.controlActivity',
    currentUsage: 'technical.recordKind.currentUsage',
    download: 'technical.recordKind.download',
    drivingLicence: 'technical.recordKind.drivingLicence',
    icc: 'technical.recordKind.icc',
    specificCondition: 'technical.recordKind.specificCondition',
    vehicleUnitCalibration: 'technical.recordKind.vehicleUnitCalibration',
    vehicleUnitCardSlotStatus: 'technical.recordKind.vehicleUnitCardSlotStatus',
    vehicleUnitCompanyLock: 'technical.recordKind.vehicleUnitCompanyLock',
    vehicleUnitControlActivity: 'technical.recordKind.vehicleUnitControlActivity',
    vehicleUnitDailyOdometer: 'technical.recordKind.vehicleUnitDailyOdometer',
    vehicleUnitDownloadActivity: 'technical.recordKind.vehicleUnitDownloadActivity',
    vehicleUnitDownloadPeriod: 'technical.recordKind.vehicleUnitDownloadPeriod',
    vehicleUnitEmbeddedCard: 'technical.recordKind.vehicleUnitEmbeddedCard',
    vehicleUnitEmbeddedCardSnapshot: 'technical.recordKind.vehicleUnitEmbeddedCardSnapshot',
    vehicleUnitGnssCoupled: 'technical.recordKind.vehicleUnitGnssCoupled',
    vehicleUnitIdentification: 'technical.recordKind.vehicleUnitIdentification',
    vehicleUnitItsConsent: 'technical.recordKind.vehicleUnitItsConsent',
    vehicleUnitPowerSupplyInterruption: 'technical.recordKind.vehicleUnitPowerSupplyInterruption',
    vehicleUnitSensorPaired: 'technical.recordKind.vehicleUnitSensorPaired',
    vehicleUnitSpecificCondition: 'technical.recordKind.vehicleUnitSpecificCondition',
    vehicleUnitTimeAdjustment: 'technical.recordKind.vehicleUnitTimeAdjustment',
} satisfies Readonly<Record<TechnicalRecordKind, TranslationKey>>;

const calibrationPurposeTranslationKeys = {
    activation: 'technical.calibrationPurpose.activation',
    firstInstallation: 'technical.calibrationPurpose.firstInstallation',
    installation: 'technical.calibrationPurpose.installation',
    periodicInspection: 'technical.calibrationPurpose.periodicInspection',
    reserved: 'technical.calibrationPurpose.reserved',
    timeAdjustmentWithoutCalibration: 'technical.calibrationPurpose.timeAdjustmentWithoutCalibration',
    unknown: 'technical.calibrationPurpose.unknown',
    vehicleRegistrationNumberEntryByCompany: 'technical.calibrationPurpose.vehicleRegistrationNumberEntryByCompany',
} satisfies Readonly<Record<CalibrationPurpose, TranslationKey>>;

const controlTypeTranslationKeys = {
    calibrationParameters: 'technical.controlType.calibrationParameters',
    cardDownloaded: 'technical.controlType.cardDownloaded',
    displayUsed: 'technical.controlType.displayUsed',
    printingDone: 'technical.controlType.printingDone',
    unknown: 'technical.controlType.unknown',
    vehicleUnitDownloaded: 'technical.controlType.vehicleUnitDownloaded',
} satisfies Readonly<Record<CardControlActivityType, TranslationKey>>;

const specificConditionTranslationKeys = {
    ferryTrainCrossing: 'technical.specificCondition.ferryTrainCrossing',
    ferryTrainCrossingEnd: 'technical.specificCondition.ferryTrainCrossingEnd',
    outOfScopeBegin: 'technical.specificCondition.outOfScopeBegin',
    outOfScopeEnd: 'technical.specificCondition.outOfScopeEnd',
    unknown: 'technical.specificCondition.unknown',
} satisfies Readonly<Record<SpecificConditionType, TranslationKey>>;

export function translateTechnicalField(field: TechnicalFieldKey, translationService: ViewerTranslationService): string {
    return translationService.translate(technicalFieldTranslationKeys[field]);
}

export function translateTechnicalRecordKind(kind: TechnicalRecordKind, translationService: ViewerTranslationService): string {
    return translationService.translate(technicalRecordKindTranslationKeys[kind]);
}

export function translateCalibrationPurpose(purpose: CalibrationPurpose, translationService: ViewerTranslationService): string {
    return translationService.translate(calibrationPurposeTranslationKeys[purpose]);
}

export function translateControlType(controlType: CardControlActivityType, translationService: ViewerTranslationService): string {
    return translationService.translate(controlTypeTranslationKeys[controlType]);
}

export function translateSpecificConditionType(
    conditionType: SpecificConditionType,
    translationService: ViewerTranslationService,
): string {
    return translationService.translate(specificConditionTranslationKeys[conditionType]);
}

const consentTranslationKeys = {
    no: 'technical.consent.no',
    yes: 'technical.consent.yes',
} satisfies Readonly<Record<'no' | 'yes', TranslationKey>>;

export function translateConsent(consent: boolean, translationService: ViewerTranslationService): string {
    return translationService.translate(consentTranslationKeys[consent ? 'yes' : 'no']);
}

export type EmbeddedCardSnapshotState = 'noCard' | 'parsed' | 'unsupported';

const snapshotStateTranslationKeys = {
    noCard: 'technical.snapshotState.noCard',
    parsed: 'technical.snapshotState.parsed',
    unsupported: 'technical.snapshotState.unsupported',
} satisfies Readonly<Record<EmbeddedCardSnapshotState, TranslationKey>>;

export function translateSnapshotState(state: EmbeddedCardSnapshotState, translationService: ViewerTranslationService): string {
    return translationService.translate(snapshotStateTranslationKeys[state]);
}

const activityTranslationKeys = {
    availability: 'activities.activity.availability',
    breakOrRest: 'activities.activity.breakOrRest',
    driving: 'activities.activity.driving',
    unknown: 'activities.activity.unknown',
    work: 'activities.activity.work',
} satisfies Readonly<Record<ActivityKind, TranslationKey>>;

export function translateActivityKind(activity: ActivityKind, translationService: ViewerTranslationService): string {
    return translationService.translate(activityTranslationKeys[activity]);
}

const insertedCardTypeTranslationKeys = {
    companyCard: 'associations.cardType.companyCard',
    controlCard: 'associations.cardType.controlCard',
    driverCard: 'document.kind.driverCard',
    unknown: 'associations.cardType.unknown',
    workshopCard: 'associations.cardType.workshopCard',
} satisfies Readonly<Record<InsertedCardType, TranslationKey>>;

const cardSlotTranslationKeys = {
    CoDriver: 'associations.slot.coDriver',
    Driver: 'associations.slot.driver',
    Unknown: 'associations.slot.unknown',
} satisfies Readonly<Record<CardSlot, TranslationKey>>;

export function translateInsertedCardType(cardType: InsertedCardType, translationService: ViewerTranslationService): string {
    return translationService.translate(insertedCardTypeTranslationKeys[cardType]);
}

export function translateCardSlot(slot: CardSlot, translationService: ViewerTranslationService): string {
    return translationService.translate(cardSlotTranslationKeys[slot]);
}

const crewPresenceTranslationKeys = {
    crew: 'activities.crew.presence.crew',
    single: 'activities.crew.presence.single',
    unknown: 'activities.crew.presence.unknown',
} satisfies Readonly<Record<CrewPresence, TranslationKey>>;

export function translateCrewPresence(crewPresence: CrewPresence, translationService: ViewerTranslationService): string {
    return translationService.translate(crewPresenceTranslationKeys[crewPresence]);
}

// A single-driver shift has no badge: the ordinary rule needs no explanation.
export function translateCrewBadge(status: CrewQualificationStatus, translationService: ViewerTranslationService): string | null {
    switch (status) {
        case 'crew':
            return translationService.translate('activities.crew.badge.crew');
        case 'crewFailed':
            return translationService.translate('activities.crew.badge.crewFailed');
        case 'single':
            return null;
        case 'unknown':
            return translationService.translate('activities.crew.badge.unknown');
    }
}

const sectionTranslationKeys = {
    activities: {
        driverCard: 'navigator.section.activities',
        vehicleUnit: 'navigator.section.activities',
    },
    associations: {
        driverCard: 'common.vehicles',
        vehicleUnit: 'navigator.section.associations.vehicleUnit',
    },
    comparison: {
        driverCard: 'navigator.section.comparison',
        vehicleUnit: 'navigator.section.comparison',
    },
    compliance: {
        driverCard: 'navigator.section.compliance',
        vehicleUnit: 'navigator.section.compliance',
    },
    eventsAndFaults: {
        driverCard: 'navigator.section.eventsAndFaults',
        vehicleUnit: 'navigator.section.eventsAndFaults',
    },
    integrity: {
        driverCard: 'overview.integrity',
        vehicleUnit: 'overview.integrity',
    },
    overview: {
        driverCard: 'overview.heading',
        vehicleUnit: 'overview.heading',
    },
    places: {
        driverCard: 'navigator.section.places.driverCard',
        vehicleUnit: 'navigator.section.places.vehicleUnit',
    },
    rawData: {
        driverCard: 'navigator.section.rawData',
        vehicleUnit: 'navigator.section.rawData',
    },
    speed: {
        driverCard: 'navigator.section.speed',
        vehicleUnit: 'navigator.section.speed',
    },
    technical: {
        driverCard: 'navigator.section.technical',
        vehicleUnit: 'navigator.section.technical',
    },
} satisfies Readonly<Record<DocumentWorkspaceSection, Readonly<Record<DocumentKind, TranslationKey>>>>;

export function translateDocumentSection(
    section: DocumentWorkspaceSection,
    documentKind: DocumentKind | undefined,
    translationService: ViewerTranslationService,
): string {
    const kind = documentKind ?? 'driverCard';
    return translationService.translate(sectionTranslationKeys[section][kind]);
}

const eventFaultCodeTranslationKeys = {
    cardConflict: 'eventsFaults.code.cardConflict',
    cardInsertionWhileDriving: 'eventsFaults.code.cardInsertionWhileDriving',
    cardNoFurtherDetails: 'eventsFaults.code.cardNoFurtherDetails',
    drivingWithoutAppropriateCard: 'eventsFaults.code.drivingWithoutAppropriateCard',
    gnssExternalCommunicationFault: 'eventsFaults.code.gnssExternalCommunicationFault',
    gnssExternalFacilityCertificateExpired: 'eventsFaults.code.gnssExternalFacilityCertificateExpired',
    gnssExternalReceiverFault: 'eventsFaults.code.gnssExternalReceiverFault',
    gnssInternalReceiverFault: 'eventsFaults.code.gnssInternalReceiverFault',
    gnssNoFurtherDetails: 'eventsFaults.code.gnssNoFurtherDetails',
    gnssNoPositionData: 'eventsFaults.code.gnssNoPositionData',
    gnssTamperDetected: 'eventsFaults.code.gnssTamperDetected',
    insertionOfNonValidCard: 'eventsFaults.code.insertionOfNonValidCard',
    itsNoFurtherDetails: 'eventsFaults.code.itsNoFurtherDetails',
    lastCardSessionNotCorrectlyClosed: 'eventsFaults.code.lastCardSessionNotCorrectlyClosed',
    motionDataError: 'eventsFaults.code.motionDataError',
    noFurtherDetails: 'eventsFaults.code.noFurtherDetails',
    overSpeeding: 'eventsFaults.code.overSpeeding',
    powerSupplyInterruption: 'eventsFaults.code.powerSupplyInterruption',
    recordingEquipmentDisplayFault: 'eventsFaults.code.recordingEquipmentDisplayFault',
    recordingEquipmentDownloadingFault: 'eventsFaults.code.recordingEquipmentDownloadingFault',
    recordingEquipmentNoFurtherDetails: 'eventsFaults.code.recordingEquipmentNoFurtherDetails',
    recordingEquipmentPrinterFault: 'eventsFaults.code.recordingEquipmentPrinterFault',
    recordingEquipmentSensorFault: 'eventsFaults.code.recordingEquipmentSensorFault',
    recordingEquipmentVuInternalFault: 'eventsFaults.code.recordingEquipmentVuInternalFault',
    remoteCommunicationModuleCommunicationFault: 'eventsFaults.code.remoteCommunicationModuleCommunicationFault',
    remoteCommunicationModuleFault: 'eventsFaults.code.remoteCommunicationModuleFault',
    remoteCommunicationNoFurtherDetails: 'eventsFaults.code.remoteCommunicationNoFurtherDetails',
    sensorAuthenticationFailure: 'eventsFaults.code.sensorAuthenticationFailure',
    sensorHardwareSabotage: 'eventsFaults.code.sensorHardwareSabotage',
    sensorInternalDataTransferError: 'eventsFaults.code.sensorInternalDataTransferError',
    sensorNoFurtherDetails: 'eventsFaults.code.sensorNoFurtherDetails',
    sensorStoredDataIntegrityError: 'eventsFaults.code.sensorStoredDataIntegrityError',
    sensorUnauthorisedCaseOpening: 'eventsFaults.code.sensorUnauthorisedCaseOpening',
    timeConflict: 'eventsFaults.code.timeConflict',
    timeOverlap: 'eventsFaults.code.timeOverlap',
    unknown: 'eventsFaults.code.unknown',
    vehicleMotionConflict: 'eventsFaults.code.vehicleMotionConflict',
    vuCardDataInputIntegrityError: 'eventsFaults.code.vuCardDataInputIntegrityError',
    vuHardwareSabotage: 'eventsFaults.code.vuHardwareSabotage',
    vuInternalDataTransferError: 'eventsFaults.code.vuInternalDataTransferError',
    vuMotionSensorAuthenticationFailure: 'eventsFaults.code.vuMotionSensorAuthenticationFailure',
    vuNoFurtherDetails: 'eventsFaults.code.vuNoFurtherDetails',
    vuStoredUserDataIntegrityError: 'eventsFaults.code.vuStoredUserDataIntegrityError',
    vuTachographCardAuthenticationFailure: 'eventsFaults.code.vuTachographCardAuthenticationFailure',
    vuUnauthorisedCaseOpening: 'eventsFaults.code.vuUnauthorisedCaseOpening',
    vuUnauthorisedChangeOfMotionSensor: 'eventsFaults.code.vuUnauthorisedChangeOfMotionSensor',
} satisfies Readonly<Record<EventFaultCode, TranslationKey>>;

const eventFaultPurposeTranslationKeys = {
    active: 'eventsFaults.purpose.active',
    firstAfterLastCalibration: 'eventsFaults.purpose.firstAfterLastCalibration',
    lastForOneOfLast10Days: 'eventsFaults.purpose.lastForOneOfLast10Days',
    longestForOneOfLast10Days: 'eventsFaults.purpose.longestForOneOfLast10Days',
    mostSeriousForOneOfLast10Days: 'eventsFaults.purpose.mostSeriousForOneOfLast10Days',
    oneOf10MostRecentOrLast: 'eventsFaults.purpose.oneOf10MostRecentOrLast',
    oneOf5LongestOverLast365Days: 'eventsFaults.purpose.oneOf5LongestOverLast365Days',
    oneOf5MostSeriousOverLast365Days: 'eventsFaults.purpose.oneOf5MostSeriousOverLast365Days',
    unknown: 'eventsFaults.purpose.unknown',
} satisfies Readonly<Record<EventFaultRecordPurpose, TranslationKey>>;

export function translateEventFaultCode(code: EventFaultCode, translationService: ViewerTranslationService): string {
    return translationService.translate(eventFaultCodeTranslationKeys[code]);
}

export function translateEventFaultPurpose(
    purpose: EventFaultRecordPurpose,
    translationService: ViewerTranslationService,
): string {
    return translationService.translate(eventFaultPurposeTranslationKeys[purpose]);
}

const entryTypeTranslationKeys = {
    beginAssumedByVehicleUnit: 'places.entryType.beginAssumedByVehicleUnit',
    beginCardInsertion: 'places.entryType.beginCardInsertion',
    beginGnss: 'places.entryType.beginGnss',
    beginManual: 'places.entryType.beginManual',
    endAssumedByVehicleUnit: 'places.entryType.endAssumedByVehicleUnit',
    endCardWithdrawal: 'places.entryType.endCardWithdrawal',
    endGnss: 'places.entryType.endGnss',
    endManual: 'places.entryType.endManual',
    unknown: 'places.entryType.unknown',
} satisfies Readonly<Record<DailyWorkPeriodEntryType, TranslationKey>>;

export function translateDailyWorkPeriodEntryType(
    entryType: DailyWorkPeriodEntryType,
    translationService: ViewerTranslationService,
): string {
    return translationService.translate(entryTypeTranslationKeys[entryType]);
}

const operationTypeTranslationKeys = {
    load: 'places.operationType.load',
    reserved: 'places.operationType.reserved',
    simultaneous: 'places.operationType.simultaneous',
    unload: 'places.operationType.unload',
    unknown: 'places.operationType.unknown',
} satisfies Readonly<Record<LoadUnloadOperationType, TranslationKey>>;

const loadTypeTranslationKeys = {
    goods: 'places.loadType.goods',
    passengers: 'places.loadType.passengers',
    undefined: 'places.loadType.undefined',
    unknown: 'places.loadType.unknown',
} satisfies Readonly<Record<LoadTypeKind, TranslationKey>>;

export function translateOperationType(
    operationType: LoadUnloadOperationType,
    translationService: ViewerTranslationService,
): string {
    return translationService.translate(operationTypeTranslationKeys[operationType]);
}

export function translateLoadType(loadType: LoadTypeKind, translationService: ViewerTranslationService): string {
    return translationService.translate(loadTypeTranslationKeys[loadType]);
}

const eventFaultRecordKindTranslationKeys = {
    event: 'eventsFaults.kind.event',
    fault: 'eventsFaults.kind.fault',
} satisfies Readonly<Record<'event' | 'fault', TranslationKey>>;

const activityOriginTranslationKeys = {
    recorded: 'activities.origin.recorded',
    inferredGap: 'activities.origin.inferredGap',
} satisfies Readonly<Record<'recorded' | 'inferredGap', TranslationKey>>;

const inspectorLabelTranslationKeys = {
    accuracy: 'places.accuracy',
    activity: 'activities.activityColumn',
    allowedValue: 'inspector.field.allowedValue',
    article: 'inspector.field.article',
    authenticationStatus: 'places.authenticationStatus',
    cardContext: 'places.cardContext',
    cardExpiry: 'overview.identity.cardExpiryDate',
    cardHolderBirthDate: 'overview.identity.cardHolderBirthDate',
    cardIssueDate: 'overview.identity.cardIssueDate',
    cardIssuingAuthorityName: 'overview.identity.cardIssuingAuthorityName',
    cardNumber: 'overview.identity.cardNumber',
    cardType: 'inspector.field.cardType',
    cardValidityBegin: 'overview.identity.cardValidityBegin',
    category: 'inspector.field.category',
    coDriverCard: 'places.coDriver',
    code: 'eventsFaults.code',
    country: 'places.country',
    countryEntered: 'places.countryEntered',
    countryLeft: 'places.countryLeft',
    description: 'inspector.field.description',
    determinedAt: 'places.determinedAt',
    deviceId: 'inspector.field.deviceId',
    distance: 'associations.distance',
    driverCard: 'document.kind.driverCard',
    duration: 'activities.duration',
    end: 'activities.end',
    entryType: 'inspector.field.entryType',
    excessOrDeficit: 'inspector.field.excessOrDeficit',
    firstNames: 'overview.identity.firstNames',
    firstUse: 'associations.firstUse',
    inserted: 'associations.inserted',
    issuingMemberState: 'overview.identity.issuingMemberState',
    lastUse: 'associations.lastUse',
    latitude: 'inspector.field.latitude',
    loadType: 'inspector.field.loadType',
    longitude: 'inspector.field.longitude',
    manufacturerCode: 'inspector.field.manufacturerCode',
    measuredValue: 'inspector.field.measuredValue',
    odometer: 'associations.odometer',
    odometerAtInsertion: 'report.associations.odometerInsertion',
    odometerAtWithdrawal: 'report.associations.odometerWithdrawal',
    odometerBegin: 'inspector.field.odometerBegin',
    odometerEnd: 'inspector.field.odometerEnd',
    operationType: 'inspector.field.operationType',
    origin: 'inspector.field.origin',
    position: 'inspector.field.position',
    purpose: 'eventsFaults.purpose',
    recordedTime: 'places.recordedTime',
    region: 'places.region',
    registrationMemberState: 'overview.identity.registrationMemberState',
    registrationNumber: 'overview.identity.registrationNumber',
    regulation: 'inspector.field.regulation',
    rule: 'inspector.field.rule',
    severity: 'inspector.field.severity',
    similarOccurrences: 'eventsFaults.similarOccurrences',
    slot: 'associations.slot',
    softwareVersion: 'inspector.field.softwareVersion',
    speed: 'speed.chart.seriesLabel',
    start: 'activities.start',
    surname: 'overview.identity.surname',
    type: 'eventsFaults.type',
    usedAt: 'inspector.field.usedAt',
    vehicleIdentificationNumber: 'overview.identity.vehicleIdentificationNumber',
    withdrawn: 'associations.withdrawn',
} satisfies Readonly<Record<InspectorLabelKey, TranslationKey>>;

function isInspectorLabelKey(labelKey: InspectorLabelKey | TechnicalFieldKey): labelKey is InspectorLabelKey {
    return labelKey in inspectorLabelTranslationKeys;
}

function notRecorded(translationService: ViewerTranslationService): string {
    return translationService.translate('overview.identity.missing');
}

function translateCardReference(card: IRecordedCardReference | null, translationService: ViewerTranslationService): string {
    if (card === null) {
        return notRecorded(translationService);
    }

    const parts = [translateInsertedCardType(card.cardType, translationService)];
    if (card.cardNumber !== null) {
        parts.push(card.cardNumber);
    }
    if (card.issuingMemberState !== null) {
        parts.push(card.issuingMemberState);
    }

    return parts.join(' · ');
}

export function translateInspectorValue(
    value: InspectorRowValue | TechnicalFieldValue,
    translationService: ViewerTranslationService,
): string {
    switch (value.kind) {
        case 'activity':
            return translateActivityKind(value.value, translationService);
        case 'calibrationPurpose':
            return translateCalibrationPurpose(value.value, translationService);
        case 'cardType':
            return translateInsertedCardType(value.value, translationService);
        case 'cardReference':
            return translateCardReference(value.value, translationService);
        case 'consent':
            return translateConsent(value.value, translationService);
        case 'controlType':
            return translateControlType(value.value, translationService);
        case 'display':
            return value.display ?? notRecorded(translationService);
        case 'entryType':
            return translateDailyWorkPeriodEntryType(value.value, translationService);
        case 'eventFaultCode':
            return translateEventFaultCode(value.value, translationService);
        case 'eventFaultRecordKind':
            return translationService.translate(eventFaultRecordKindTranslationKeys[value.value]);
        case 'infringementRule':
            return translateInfringementRule(value.value, translationService);
        case 'infringementSeverity':
            return translateInfringementSeverity(value.value, translationService);
        case 'loadType':
            return translateLoadType(value.value, translationService);
        case 'operationType':
            return translateOperationType(value.value, translationService);
        case 'origin':
            return translationService.translate(activityOriginTranslationKeys[value.value]);
        case 'recordPurpose':
            return translateEventFaultPurpose(value.value, translationService);
        case 'slot':
            return translateCardSlot(value.value, translationService);
        case 'specificConditionType':
            return translateSpecificConditionType(value.value, translationService);
        case 'snapshotState':
            return translateSnapshotState(value.value, translationService);
        case 'technicalKind':
            return translateTechnicalRecordKind(value.value, translationService);
    }
}

export function translateInspectorLabelKey(
    labelKey: InspectorLabelKey | TechnicalFieldKey,
    translationService: ViewerTranslationService,
): string {
    if (isInspectorLabelKey(labelKey)) {
        return translationService.translate(inspectorLabelTranslationKeys[labelKey]);
    }

    return translateTechnicalField(labelKey, translationService);
}

export function translateInspectorHeading(
    emphasis: InspectorRowValue,
    detail: string | null,
    translationService: ViewerTranslationService,
): string {
    const heading = translateInspectorValue(emphasis, translationService);
    return detail === null ? heading : `${heading} · ${detail}`;
}

export function translateTechnicalFieldValue(
    field: ITechnicalFieldViewModel,
    translationService: ViewerTranslationService,
): string {
    switch (field.value.kind) {
        case 'calibrationPurpose':
            return translateCalibrationPurpose(field.value.value, translationService);
        case 'consent':
            return translateConsent(field.value.value, translationService);
        case 'cardType':
            return translateInsertedCardType(field.value.value, translationService);
        case 'controlType':
            return translateControlType(field.value.value, translationService);
        case 'specificConditionType':
            return translateSpecificConditionType(field.value.value, translationService);
        case 'snapshotState':
            return translateSnapshotState(field.value.value, translationService);
        case 'display':
            return field.value.display ?? translationService.translate('overview.identity.missing');
    }
}
