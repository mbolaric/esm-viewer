import { projectDocumentTechnicalRecords, type OpenedTachographDocument } from '#viewer-application';
import type {
    CalibrationPurpose,
    CardControlActivityType,
    DocumentKind,
    InsertedCardType,
    IRecordedCardReference,
    ISourceReference,
    ITechnicalExtendedSerialNumber,
    SpecificConditionType,
    TachographTechnicalRecord,
    TachographGeneration,
    UtcTimestamp,
} from '#viewer-domain';

import type { IFormattedValue } from './document-view-model.js';
import type { ViewerLocalisationService } from '../helpers/view-model-formatting.js';

export type TechnicalFieldKey =
    | 'activityStructureLength'
    | 'ability'
    | 'authorisedSpeed'
    | 'approvalNumber'
    | 'borderCrossingRecords'
    | 'chipManufacturingReference'
    | 'chipSerialNumber'
    | 'clockStop'
    | 'calibrationPurpose'
    | 'downloadCardIssuingMemberState'
    | 'downloadCardNumber'
    | 'downloadCardType'
    | 'embeddedCardIssuingMemberState'
    | 'embeddedCardNumber'
    | 'embeddedCardSnapshotCardType'
    | 'embeddedCardSnapshotExpiry'
    | 'embeddedCardSnapshotHolder'
    | 'embeddedCardSnapshotSignature'
    | 'embeddedCardSnapshotState'
    | 'embeddedCardType'
    | 'controlCardIssuingMemberState'
    | 'controlCardNumber'
    | 'controlCardType'
    | 'controlType'
    | 'coDriverSlot'
    | 'driverSlot'
    | 'dataElementUseVersion'
    | 'downloadPeriodBegin'
    | 'downloadPeriodEnd'
    | 'embedderCountryCode'
    | 'eventsPerType'
    | 'extendedSerialNumber'
    | 'faultsPerType'
    | 'followingDataLength'
    | 'gnssRecords'
    | 'icIdentifier'
    | 'itsConsent'
    | 'itsConsentCardIssuingMemberState'
    | 'itsConsentCardNumber'
    | 'itsConsentCardType'
    | 'licenceIssuingAuthority'
    | 'licenceIssuingMemberState'
    | 'licenceNumber'
    | 'loadTypeEntryRecords'
    | 'loadUnloadRecords'
    | 'manufacturerAddress'
    | 'manufacturerCode'
    | 'manufacturerName'
    | 'manufacturerInformation'
    | 'manufacturedAt'
    | 'moduleEmbedder'
    | 'monthYear'
    | 'newOdometer'
    | 'nextCalibrationAt'
    | 'odometerMidnight'
    | 'odometerMidnightDay'
    | 'oldOdometer'
    | 'operatorName'
    | 'personaliserId'
    | 'partNumber'
    | 'placeRecords'
    | 'powerSupplyInterruptionBegin'
    | 'powerSupplyInterruptionEnd'
    | 'previousTime'
    | 'recordingEquipmentConstant'
    | 'serialType'
    | 'similarEvents'
    | 'softwareInstalledAt'
    | 'softwareVersion'
    | 'specificConditionRecords'
    | 'specificConditionType'
    | 'structureVersion'
    | 'tyreCircumference'
    | 'tyreSize'
    | 'vehicleCharacteristicConstant'
    | 'companyAddress'
    | 'companyCardNumber'
    | 'companyName'
    | 'lockInTime'
    | 'lockOutTime'
    | 'vehicleIdentificationNumber'
    | 'vehicleRecords'
    | 'vehicleRegistrationMemberState'
    | 'vehicleRegistrationNumber'
    | 'vehicleUnitConfigurationLength'
    | 'vehicleUnitGeneration'
    | 'vehicleUnitRecords'
    | 'workshopAddress'
    | 'workshopCardExpiryAt'
    | 'workshopCardIssuingMemberState'
    | 'workshopCardNumber'
    | 'workshopCardType'
    | 'workshopName'
    | 'sensorApprovalNumber'
    | 'sensorCouplingDate'
    | 'sensorPairingDate'
    | 'timeAdjustmentOldTime'
    | 'timeAdjustmentNewTime';

export type TechnicalRecordKind =
    | 'application'
    | 'applicationV2'
    | 'chip'
    | 'controlActivity'
    | 'currentUsage'
    | 'download'
    | 'drivingLicence'
    | 'icc'
    | 'specificCondition'
    | 'vehicleUnitCalibration'
    | 'vehicleUnitCardSlotStatus'
    | 'vehicleUnitDownloadActivity'
    | 'vehicleUnitCompanyLock'
    | 'vehicleUnitControlActivity'
    | 'vehicleUnitDailyOdometer'
    | 'vehicleUnitDownloadPeriod'
    | 'vehicleUnitEmbeddedCard'
    | 'vehicleUnitEmbeddedCardSnapshot'
    | 'vehicleUnitGnssCoupled'
    | 'vehicleUnitIdentification'
    | 'vehicleUnitItsConsent'
    | 'vehicleUnitPowerSupplyInterruption'
    | 'vehicleUnitSensorPaired'
    | 'vehicleUnitSpecificCondition'
    | 'vehicleUnitTimeAdjustment';

export interface ITechnicalDisplayValue {
    readonly code: boolean;
    readonly copyValue: string | null;
    readonly display: string | null;
    readonly kind: 'display';
}

export interface ITechnicalCardTypeValue {
    readonly kind: 'cardType';
    readonly value: InsertedCardType;
}

export interface ITechnicalSnapshotStateValue {
    readonly kind: 'snapshotState';
    readonly value: 'noCard' | 'parsed' | 'unsupported';
}

export interface ITechnicalControlTypeValue {
    readonly kind: 'controlType';
    readonly value: CardControlActivityType;
}

export interface ITechnicalSpecificConditionTypeValue {
    readonly kind: 'specificConditionType';
    readonly value: SpecificConditionType;
}

export interface ITechnicalCalibrationPurposeValue {
    readonly kind: 'calibrationPurpose';
    readonly value: CalibrationPurpose;
}

export interface ITechnicalConsentValue {
    readonly kind: 'consent';
    readonly value: boolean;
}

export type TechnicalFieldValue =
    | ITechnicalCalibrationPurposeValue
    | ITechnicalCardTypeValue
    | ITechnicalConsentValue
    | ITechnicalControlTypeValue
    | ITechnicalDisplayValue
    | ITechnicalSnapshotStateValue
    | ITechnicalSpecificConditionTypeValue;

export interface ITechnicalFieldViewModel {
    readonly key: TechnicalFieldKey;
    readonly value: TechnicalFieldValue;
}

export interface ITechnicalRecordViewModel {
    readonly category: 'identification' | 'operational';
    readonly fields: readonly ITechnicalFieldViewModel[];
    readonly generation: TachographGeneration;
    readonly kind: TechnicalRecordKind;
    readonly record: TachographTechnicalRecord;
    readonly recordedAt: string | null;
    readonly source: ISourceReference;
}

export interface ITechnicalSectionViewModel {
    readonly documentKind: DocumentKind;
    readonly identificationRecords: readonly ITechnicalRecordViewModel[];
    readonly locale: string;
    readonly operationalRecords: readonly ITechnicalRecordViewModel[];
    readonly timeZone: string;
    readonly totalCount: IFormattedValue<number>;
}

function displayValue(display: string | null, code: boolean, copyValue: string | null = null): ITechnicalDisplayValue {
    return {
        code,
        copyValue,
        display,
        kind: 'display',
    };
}

function displayField(
    key: TechnicalFieldKey,
    display: string | null,
    code = false,
    copyValue: string | null = null,
): ITechnicalFieldViewModel {
    return {
        key,
        value: displayValue(display, code, copyValue),
    };
}

function numberField(
    key: TechnicalFieldKey,
    value: number | null,
    localisation: ViewerLocalisationService,
): ITechnicalFieldViewModel {
    return displayField(key, value === null ? null : localisation.formatNumber(value));
}

function enumField(
    key: TechnicalFieldKey,
    value:
        | ITechnicalCardTypeValue
        | ITechnicalControlTypeValue
        | ITechnicalSpecificConditionTypeValue
        | ITechnicalCalibrationPurposeValue
        | ITechnicalSnapshotStateValue,
): ITechnicalFieldViewModel {
    return { key, value };
}

function consentField(key: TechnicalFieldKey, value: boolean): ITechnicalFieldViewModel {
    return { key, value: { kind: 'consent', value } };
}

function formatBytes(value: readonly number[]): string {
    return value.map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join('');
}

function formatDateTime(value: UtcTimestamp | null, localisation: ViewerLocalisationService): string | null {
    return value === null ? null : localisation.formatDateTime(value);
}

function extendedSerialNumberFields(
    serialNumber: ITechnicalExtendedSerialNumber,
    localisation: ViewerLocalisationService,
): ITechnicalFieldViewModel[] {
    return [
        displayField('extendedSerialNumber', String(serialNumber.serialNumber), true, String(serialNumber.serialNumber)),
        displayField('monthYear', serialNumber.monthYear, true),
        numberField('serialType', serialNumber.type, localisation),
        numberField('manufacturerCode', serialNumber.manufacturerCode, localisation),
    ];
}

function sensorRecordFields(
    serialNumber: ITechnicalExtendedSerialNumber,
    approvalNumber: string,
    dateKey: Extract<TechnicalFieldKey, 'sensorCouplingDate' | 'sensorPairingDate'>,
    dateValue: string | null,
    localisation: ViewerLocalisationService,
): ITechnicalFieldViewModel[] {
    return [
        ...extendedSerialNumberFields(serialNumber, localisation),
        displayField('sensorApprovalNumber', approvalNumber, true, approvalNumber),
        displayField(dateKey, dateValue),
    ];
}

function cardReferenceFields(
    cardNumberKey: TechnicalFieldKey,
    cardTypeKey: TechnicalFieldKey,
    issuingMemberStateKey: TechnicalFieldKey,
    card: IRecordedCardReference,
): ITechnicalFieldViewModel[] {
    return [
        displayField(cardNumberKey, card.cardNumber, true, card.cardNumber),
        enumField(cardTypeKey, { kind: 'cardType', value: card.cardType }),
        displayField(issuingMemberStateKey, card.issuingMemberState, true),
    ];
}

function controlActivityFields(
    leadingFields: readonly ITechnicalFieldViewModel[],
    controlType: CardControlActivityType,
    downloadPeriodBegin: UtcTimestamp | null,
    downloadPeriodEnd: UtcTimestamp | null,
    controlCard: IRecordedCardReference | null,
    localisation: ViewerLocalisationService,
): ITechnicalFieldViewModel[] {
    const fields: ITechnicalFieldViewModel[] = [
        enumField('controlType', { kind: 'controlType', value: controlType }),
        ...leadingFields,
        displayField('downloadPeriodBegin', formatDateTime(downloadPeriodBegin, localisation)),
        displayField('downloadPeriodEnd', formatDateTime(downloadPeriodEnd, localisation)),
    ];
    if (controlCard !== null) {
        fields.push(...cardReferenceFields('controlCardNumber', 'controlCardType', 'controlCardIssuingMemberState', controlCard));
    }
    return fields;
}

function identificationRecord(
    record: TachographTechnicalRecord,
    kind: Extract<
        TechnicalRecordKind,
        | 'application'
        | 'applicationV2'
        | 'chip'
        | 'drivingLicence'
        | 'icc'
        | 'vehicleUnitEmbeddedCard'
        | 'vehicleUnitEmbeddedCardSnapshot'
        | 'vehicleUnitIdentification'
    >,
    fields: readonly ITechnicalFieldViewModel[],
): ITechnicalRecordViewModel {
    return {
        category: 'identification',
        fields: fields,
        generation: record.generation,
        kind,
        record,
        recordedAt: null,
        source: record.source,
    };
}

function operationalRecord(
    record: TachographTechnicalRecord,
    kind: Extract<
        TechnicalRecordKind,
        | 'controlActivity'
        | 'currentUsage'
        | 'download'
        | 'specificCondition'
        | 'vehicleUnitCalibration'
        | 'vehicleUnitCardSlotStatus'
        | 'vehicleUnitCompanyLock'
        | 'vehicleUnitControlActivity'
        | 'vehicleUnitDailyOdometer'
        | 'vehicleUnitDownloadActivity'
        | 'vehicleUnitDownloadPeriod'
        | 'vehicleUnitGnssCoupled'
        | 'vehicleUnitItsConsent'
        | 'vehicleUnitPowerSupplyInterruption'
        | 'vehicleUnitSensorPaired'
        | 'vehicleUnitSpecificCondition'
        | 'vehicleUnitTimeAdjustment'
    >,
    recordedAt: UtcTimestamp | null,
    fields: readonly ITechnicalFieldViewModel[],
    localisation: ViewerLocalisationService,
): ITechnicalRecordViewModel {
    return {
        category: 'operational',
        fields: fields,
        generation: record.generation,
        kind,
        record,
        recordedAt: formatDateTime(recordedAt, localisation),
        source: record.source,
    };
}

function mapTechnicalRecord(
    record: TachographTechnicalRecord,
    localisation: ViewerLocalisationService,
): ITechnicalRecordViewModel {
    switch (record.kind) {
        case 'cardApplicationTechnicalData':
            return identificationRecord(record, 'application', [
                numberField('dataElementUseVersion', record.dataElementUseVersion, localisation),
                numberField('structureVersion', record.structureVersion, localisation),
                numberField('eventsPerType', record.eventsPerType, localisation),
                numberField('faultsPerType', record.faultsPerType, localisation),
                numberField('activityStructureLength', record.activityStructureLength, localisation),
                numberField('vehicleRecords', record.vehicleRecords, localisation),
                numberField('placeRecords', record.placeRecords, localisation),
                numberField('gnssRecords', record.gnssRecords, localisation),
                numberField('specificConditionRecords', record.specificConditionRecords, localisation),
                numberField('vehicleUnitRecords', record.vehicleUnitRecords, localisation),
            ]);
        case 'cardApplicationV2TechnicalData':
            return identificationRecord(record, 'applicationV2', [
                numberField('followingDataLength', record.followingDataLength, localisation),
                numberField('borderCrossingRecords', record.borderCrossingRecords, localisation),
                numberField('loadUnloadRecords', record.loadUnloadRecords, localisation),
                numberField('loadTypeEntryRecords', record.loadTypeEntryRecords, localisation),
                numberField('vehicleUnitConfigurationLength', record.vehicleUnitConfigurationLengthRange, localisation),
            ]);
        case 'cardChipTechnicalData':
            return identificationRecord(record, 'chip', [
                displayField('chipSerialNumber', record.serialNumber, true, record.serialNumber),
                displayField('chipManufacturingReference', record.manufacturingReference, true, record.manufacturingReference),
            ]);
        case 'cardIccTechnicalData': {
            const manufacturerInformation = formatBytes(record.embedder.manufacturerInformation);
            const icIdentifier = formatBytes(record.icIdentifier);
            return identificationRecord(record, 'icc', [
                numberField('clockStop', record.clockStop, localisation),
                displayField('approvalNumber', record.approvalNumber, true, record.approvalNumber),
                ...extendedSerialNumberFields(record.extendedSerialNumber, localisation),
                numberField('personaliserId', record.personaliserId, localisation),
                displayField('embedderCountryCode', record.embedder.countryCode, true),
                displayField('moduleEmbedder', record.embedder.moduleEmbedder, true),
                displayField('manufacturerInformation', manufacturerInformation, true, manufacturerInformation),
                displayField('icIdentifier', icIdentifier, true, icIdentifier),
            ]);
        }
        case 'drivingLicenceTechnicalData':
            return identificationRecord(record, 'drivingLicence', [
                displayField('licenceNumber', record.licenceNumber, true, record.licenceNumber),
                displayField('licenceIssuingAuthority', record.issuingAuthority),
                displayField('licenceIssuingMemberState', record.issuingMemberState, true),
            ]);
        case 'cardDownloadTechnicalRecord':
            return operationalRecord(record, 'download', record.downloadedAt, [], localisation);
        case 'cardCurrentUsageTechnicalRecord':
            return operationalRecord(
                record,
                'currentUsage',
                record.sessionOpenedAt,
                [
                    displayField('vehicleRegistrationNumber', record.registrationNumber, true, record.registrationNumber),
                    displayField('vehicleRegistrationMemberState', record.registrationMemberState, true),
                ],
                localisation,
            );
        case 'cardControlActivityTechnicalRecord': {
            const fields = controlActivityFields(
                [
                    displayField('vehicleRegistrationNumber', record.registrationNumber, true, record.registrationNumber),
                    displayField('vehicleRegistrationMemberState', record.registrationMemberState, true),
                ],
                record.controlType,
                record.downloadPeriodBegin,
                record.downloadPeriodEnd,
                record.controlCard,
                localisation,
            );
            return operationalRecord(record, 'controlActivity', record.controlledAt, fields, localisation);
        }
        case 'specificConditionTechnicalRecord':
            return operationalRecord(
                record,
                'specificCondition',
                record.enteredAt,
                [
                    enumField('specificConditionType', {
                        kind: 'specificConditionType',
                        value: record.conditionType,
                    }),
                ],
                localisation,
            );
        case 'vehicleUnitIdentificationTechnicalRecord':
            return identificationRecord(record, 'vehicleUnitIdentification', [
                displayField('manufacturerName', record.manufacturerName),
                displayField('manufacturerAddress', record.manufacturerAddress),
                displayField('partNumber', record.partNumber, true, record.partNumber),
                displayField('approvalNumber', record.approvalNumber, true, record.approvalNumber),
                ...extendedSerialNumberFields(record.serialNumber, localisation),
                displayField('softwareVersion', record.softwareVersion, true),
                displayField('softwareInstalledAt', formatDateTime(record.softwareInstalledAt, localisation)),
                displayField('manufacturedAt', formatDateTime(record.manufacturedAt, localisation)),
                numberField('vehicleUnitGeneration', record.vehicleUnitGeneration, localisation),
                numberField('ability', record.ability, localisation),
            ]);
        case 'vehicleUnitEmbeddedCardTechnicalRecord': {
            const fields: ITechnicalFieldViewModel[] = [];
            if (record.card !== null) {
                fields.push(
                    ...cardReferenceFields(
                        'embeddedCardNumber',
                        'embeddedCardType',
                        'embeddedCardIssuingMemberState',
                        record.card,
                    ),
                );
            }
            if (record.extendedSerialNumber !== null) {
                fields.push(...extendedSerialNumberFields(record.extendedSerialNumber, localisation));
            }
            fields.push(
                numberField('structureVersion', record.cardStructureVersion, localisation),
                numberField('dataElementUseVersion', record.dataElementUseVersion, localisation),
            );
            return identificationRecord(record, 'vehicleUnitEmbeddedCard', fields);
        }
        case 'vehicleUnitEmbeddedCardSnapshotTechnicalRecord': {
            const fields: ITechnicalFieldViewModel[] = [
                enumField('embeddedCardSnapshotState', {
                    kind: 'snapshotState',
                    value: record.snapshotState,
                }),
            ];
            if (record.cardType !== null) {
                fields.push(
                    enumField('embeddedCardSnapshotCardType', {
                        kind: 'cardType',
                        value: record.cardType,
                    }),
                );
            }
            if (record.holderName !== null) {
                fields.push(displayField('embeddedCardSnapshotHolder', record.holderName, true, record.holderName));
            }
            if (record.cardNumber !== null) {
                fields.push(displayField('embeddedCardNumber', record.cardNumber, true, record.cardNumber));
            }
            if (record.issuingMemberState !== null) {
                fields.push(displayField('embeddedCardIssuingMemberState', record.issuingMemberState, true));
            }
            if (record.cardExpiryDate !== null) {
                fields.push(displayField('embeddedCardSnapshotExpiry', formatDateTime(record.cardExpiryDate, localisation)));
            }
            fields.push(consentField('embeddedCardSnapshotSignature', record.hasSignature));
            return identificationRecord(record, 'vehicleUnitEmbeddedCardSnapshot', fields);
        }
        case 'vehicleUnitItsConsentTechnicalRecord': {
            const fields: ITechnicalFieldViewModel[] = [consentField('itsConsent', record.consent)];
            if (record.card !== null) {
                fields.push(
                    ...cardReferenceFields(
                        'itsConsentCardNumber',
                        'itsConsentCardType',
                        'itsConsentCardIssuingMemberState',
                        record.card,
                    ),
                );
            }
            return operationalRecord(record, 'vehicleUnitItsConsent', null, fields, localisation);
        }
        case 'vehicleUnitPowerSupplyInterruptionTechnicalRecord': {
            const fields: ITechnicalFieldViewModel[] = [
                displayField('powerSupplyInterruptionBegin', formatDateTime(record.begin, localisation)),
                displayField('powerSupplyInterruptionEnd', formatDateTime(record.end, localisation)),
                numberField('similarEvents', record.similarEvents, localisation),
            ];
            return operationalRecord(record, 'vehicleUnitPowerSupplyInterruption', record.begin, fields, localisation);
        }
        case 'vehicleUnitDailyOdometerTechnicalRecord':
            return operationalRecord(
                record,
                'vehicleUnitDailyOdometer',
                record.day,
                [
                    displayField('odometerMidnightDay', formatDateTime(record.day, localisation)),
                    numberField('odometerMidnight', record.odometerKm, localisation),
                ],
                localisation,
            );
        case 'vehicleUnitDownloadPeriodTechnicalRecord':
            return operationalRecord(
                record,
                'vehicleUnitDownloadPeriod',
                record.periodEnd,
                [
                    displayField('downloadPeriodBegin', formatDateTime(record.periodBegin, localisation)),
                    displayField('downloadPeriodEnd', formatDateTime(record.periodEnd, localisation)),
                ],
                localisation,
            );
        case 'vehicleUnitDownloadActivityTechnicalRecord': {
            const fields: ITechnicalFieldViewModel[] = [displayField('operatorName', record.operatorName)];
            if (record.card !== null) {
                fields.push(
                    ...cardReferenceFields(
                        'downloadCardNumber',
                        'downloadCardType',
                        'downloadCardIssuingMemberState',
                        record.card,
                    ),
                );
            }
            return operationalRecord(record, 'vehicleUnitDownloadActivity', record.downloadedAt, fields, localisation);
        }
        case 'vehicleUnitCalibrationTechnicalRecord': {
            const fields: ITechnicalFieldViewModel[] = [
                enumField('calibrationPurpose', {
                    kind: 'calibrationPurpose',
                    value: record.purpose,
                }),
                displayField(
                    'vehicleIdentificationNumber',
                    record.vehicleIdentificationNumber,
                    true,
                    record.vehicleIdentificationNumber,
                ),
                displayField('vehicleRegistrationNumber', record.registrationNumber, true, record.registrationNumber),
                displayField('vehicleRegistrationMemberState', record.registrationMemberState, true),
                displayField('workshopName', record.workshopName),
                displayField('workshopAddress', record.workshopAddress),
                displayField('tyreSize', record.tyreSize),
                numberField('vehicleCharacteristicConstant', record.wVehicleCharacteristicPulsesPerKilometre, localisation),
                numberField('recordingEquipmentConstant', record.kConstantPulsesPerKilometre, localisation),
                numberField('tyreCircumference', record.lTyreCircumferenceMillimetres, localisation),
                numberField('authorisedSpeed', record.authorisedSpeedKilometresPerHour, localisation),
                numberField('oldOdometer', record.oldOdometer, localisation),
                numberField('newOdometer', record.newOdometer, localisation),
                displayField('previousTime', formatDateTime(record.previousTime, localisation)),
                displayField('nextCalibrationAt', formatDateTime(record.nextCalibrationAt, localisation)),
                displayField('workshopCardExpiryAt', formatDateTime(record.workshopCardExpiryAt, localisation)),
            ];
            if (record.workshopCard !== null) {
                fields.push(
                    ...cardReferenceFields(
                        'workshopCardNumber',
                        'workshopCardType',
                        'workshopCardIssuingMemberState',
                        record.workshopCard,
                    ),
                );
            }
            return operationalRecord(record, 'vehicleUnitCalibration', record.calibratedAt, fields, localisation);
        }
        case 'vehicleUnitCardSlotStatusTechnicalRecord': {
            const fields: ITechnicalFieldViewModel[] = [
                enumField('driverSlot', { kind: 'cardType', value: record.driverSlot }),
                enumField('coDriverSlot', { kind: 'cardType', value: record.coDriverSlot }),
            ];
            return operationalRecord(record, 'vehicleUnitCardSlotStatus', null, fields, localisation);
        }
        case 'vehicleUnitCompanyLockTechnicalRecord': {
            const fields: ITechnicalFieldViewModel[] = [
                displayField('companyName', record.companyName),
                displayField('companyAddress', record.companyAddress),
                displayField('companyCardNumber', record.companyCardNumber, true, record.companyCardNumber),
                displayField('lockInTime', formatDateTime(record.lockInTime, localisation)),
                displayField('lockOutTime', formatDateTime(record.lockOutTime, localisation)),
            ];
            return operationalRecord(record, 'vehicleUnitCompanyLock', record.lockInTime, fields, localisation);
        }
        case 'vehicleUnitSensorPairedTechnicalRecord': {
            return operationalRecord(
                record,
                'vehicleUnitSensorPaired',
                record.pairedAt,
                sensorRecordFields(
                    record.sensorSerialNumber,
                    record.sensorApprovalNumber,
                    'sensorPairingDate',
                    formatDateTime(record.pairedAt, localisation),
                    localisation,
                ),
                localisation,
            );
        }
        case 'vehicleUnitGnssCoupledTechnicalRecord': {
            return operationalRecord(
                record,
                'vehicleUnitGnssCoupled',
                record.coupledAt,
                sensorRecordFields(
                    record.sensorSerialNumber,
                    record.sensorApprovalNumber,
                    'sensorCouplingDate',
                    formatDateTime(record.coupledAt, localisation),
                    localisation,
                ),
                localisation,
            );
        }
        case 'vehicleUnitTimeAdjustmentTechnicalRecord': {
            const fields: ITechnicalFieldViewModel[] = [
                displayField('workshopName', record.workshopName),
                displayField('workshopAddress', record.workshopAddress),
                displayField('timeAdjustmentOldTime', formatDateTime(record.oldTime, localisation)),
                displayField('timeAdjustmentNewTime', formatDateTime(record.newTime, localisation)),
            ];
            if (record.workshopCard !== null) {
                fields.push(
                    ...cardReferenceFields(
                        'workshopCardNumber',
                        'workshopCardType',
                        'workshopCardIssuingMemberState',
                        record.workshopCard,
                    ),
                );
            }
            return operationalRecord(record, 'vehicleUnitTimeAdjustment', record.newTime, fields, localisation);
        }
        case 'vehicleUnitControlActivityTechnicalRecord': {
            const fields = controlActivityFields(
                [],
                record.controlType,
                record.downloadPeriodBegin,
                record.downloadPeriodEnd,
                record.controlCard,
                localisation,
            );
            return operationalRecord(record, 'vehicleUnitControlActivity', record.controlledAt, fields, localisation);
        }
        case 'vehicleUnitSpecificConditionTechnicalRecord':
            return operationalRecord(
                record,
                'vehicleUnitSpecificCondition',
                record.enteredAt,
                [
                    enumField('specificConditionType', {
                        kind: 'specificConditionType',
                        value: record.conditionType,
                    }),
                ],
                localisation,
            );
    }
}
export function createTechnicalSectionViewModel(
    document: OpenedTachographDocument,
    localisation: ViewerLocalisationService,
): ITechnicalSectionViewModel {
    const records = projectDocumentTechnicalRecords(document).map((record) => mapTechnicalRecord(record, localisation));

    return {
        documentKind: document.content.documentKind,
        identificationRecords: records.filter((record) => record.category === 'identification'),
        locale: localisation.locale,
        operationalRecords: records.filter((record) => record.category === 'operational'),
        timeZone: localisation.timeZone,
        totalCount: {
            display: localisation.formatNumber(records.length),
            value: records.length,
        },
    };
}
