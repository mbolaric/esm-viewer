import {
    createCardApplicationTechnicalData,
    createCardApplicationV2TechnicalData,
    createCardChipTechnicalData,
    createCardControlActivityTechnicalRecord,
    createCardCurrentUsageTechnicalRecord,
    createCardDownloadTechnicalRecord,
    createCardIccTechnicalData,
    createDrivingLicenceTechnicalData,
    createSpecificConditionTechnicalRecord,
    isDrivingLicenceNumber,
    isIdentityName,
    isTechnicalByte,
    isTechnicalHexIdentifier,
    isTechnicalUnsignedLong,
    isTechnicalUnsignedShort,
    isRawMemberState,
    type DriverCardTechnicalRecord,
    type IRecordedCardReference,
    type ITachographWarning,
    type RecordedIssuingMemberState,
    type TachographGeneration,
} from '#viewer-domain';

import { normalizeCardVehicleRegistration } from './card-vehicle-registration-normalizer.js';
import { normalizeFullCardIdentity } from './full-card-identity-normalizer.js';
import type { FullCardNumber } from '../generated/esm_parser.js';
import { createNormalizationSourceContext } from '../normalization-source.js';
import {
    normalizeParserCardControlActivityType,
    normalizeParserSpecificConditionType,
} from '../normalizers/parser-enum-normalizer.js';
import { normalizeTechnicalExtendedSerialNumber } from '../normalizers/technical-value-normalizer.js';
import type { ParserDriverCardApplication } from '../decoders/parser-result-types.js';
import {
    isRecordedParserTimestamp,
    normalizeParserNation,
    normalizeParserUtcTimestamp,
    type ParserNationAlphaCodes,
} from '../normalizers/parser-value-normalizer.js';

export interface INormalizedCardTechnicalData {
    readonly records: readonly DriverCardTechnicalRecord[];
    readonly warnings: readonly ITachographWarning[];
}

const maximumSpecificConditionRecords = 4_096;
const { source, warning } = createNormalizationSourceContext('driverCard');

function bytesToHex(value: readonly number[]): string {
    return value.map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join('');
}

function decodeBytes(value: readonly number[], length: number): readonly number[] | null {
    if (value.length !== length || !value.every((entry) => isTechnicalByte(entry))) {
        return null;
    }

    return [...value];
}

function normalizeApplicationTechnicalData(
    application: ParserDriverCardApplication,
    generation: TachographGeneration,
    pathTokens: readonly string[],
): INormalizedCardTechnicalData {
    const recordPath = [...pathTokens, 'applicationIdentification'];
    const value = application.applicationIdentification;
    const isGen2 = 'noOfGnssadRecords' in value;
    if (
        value.typeOfTachographCardId !== 'DriverCard' ||
        (generation === 'g1') === isGen2 ||
        !isTechnicalByte(value.cardStructureVersion.dataElementUseVersion) ||
        !isTechnicalByte(value.cardStructureVersion.structureVersion) ||
        !isTechnicalByte(value.noOfEventsPerType) ||
        !isTechnicalByte(value.noOfFaultsPerType) ||
        !isTechnicalUnsignedLong(value.activityStructureLength) ||
        !isTechnicalUnsignedLong(value.noOfCardVehicleRecords) ||
        !isTechnicalUnsignedLong(value.noOfCardPlaceRecords) ||
        (isGen2 &&
            (!isTechnicalUnsignedLong(value.noOfGnssadRecords) ||
                !isTechnicalUnsignedLong(value.noOfSpecificConditionRecords) ||
                !isTechnicalUnsignedLong(value.noOfCardVehicleUnitRecords)))
    ) {
        return {
            records: [],
            warnings: [warning('invalidValue', generation, recordPath)],
        };
    }

    return {
        records: [
            createCardApplicationTechnicalData({
                activityStructureLength: value.activityStructureLength,
                dataElementUseVersion: value.cardStructureVersion.dataElementUseVersion,
                eventsPerType: value.noOfEventsPerType,
                faultsPerType: value.noOfFaultsPerType,
                gnssRecords: isGen2 ? value.noOfGnssadRecords : null,
                placeRecords: value.noOfCardPlaceRecords,
                source: source(generation, recordPath),
                specificConditionRecords: isGen2 ? value.noOfSpecificConditionRecords : null,
                structureVersion: value.cardStructureVersion.structureVersion,
                vehicleRecords: value.noOfCardVehicleRecords,
                vehicleUnitRecords: isGen2 ? value.noOfCardVehicleUnitRecords : null,
            }),
        ],
        warnings: [],
    };
}

function normalizeApplicationV2TechnicalData(
    application: ParserDriverCardApplication,
    generation: TachographGeneration,
    pathTokens: readonly string[],
): INormalizedCardTechnicalData {
    const recordPath = [...pathTokens, 'applicationIdentificationV2'];
    if (!('applicationIdentificationV2' in application)) {
        return {
            records: [],
            warnings: generation === 'g2v2' ? [warning('missingValue', generation, recordPath)] : [],
        };
    }
    const value = application.applicationIdentificationV2;
    if (value === null) {
        return {
            records: [],
            warnings: generation === 'g2v2' ? [warning('missingValue', generation, recordPath)] : [],
        };
    }
    if (
        generation !== 'g2v2' ||
        !isTechnicalUnsignedShort(value.lengthOfFollowingData) ||
        !isTechnicalUnsignedShort(value.noOfBorderCrossingRecords) ||
        !isTechnicalUnsignedShort(value.noOfLoadTypeEntryRecords) ||
        !isTechnicalUnsignedShort(value.noOfLoadUnloadRecords) ||
        !isTechnicalUnsignedShort(value.vuConfigurationLengthRange)
    ) {
        return {
            records: [],
            warnings: [warning('invalidValue', generation, recordPath)],
        };
    }

    return {
        records: [
            createCardApplicationV2TechnicalData({
                borderCrossingRecords: value.noOfBorderCrossingRecords,
                followingDataLength: value.lengthOfFollowingData,
                loadTypeEntryRecords: value.noOfLoadTypeEntryRecords,
                loadUnloadRecords: value.noOfLoadUnloadRecords,
                source: source('g2v2', recordPath),
                vehicleUnitConfigurationLengthRange: value.vuConfigurationLengthRange,
            }),
        ],
        warnings: [],
    };
}

function normalizeChipTechnicalData(
    application: ParserDriverCardApplication,
    generation: TachographGeneration,
    pathTokens: readonly string[],
): INormalizedCardTechnicalData {
    const recordPath = [...pathTokens, 'cardChipIdentification'];
    const value = application.cardChipIdentification;

    const serialBytes = decodeBytes(value.icSerialNumber, 4);
    const manufacturingBytes = decodeBytes(value.icManufacturingReferences, 4);
    if (
        serialBytes === null ||
        manufacturingBytes === null ||
        !isTechnicalHexIdentifier(value.icSerialNumberHex, 4) ||
        !isTechnicalHexIdentifier(value.icManufacturingReferencesHex, 4) ||
        value.icSerialNumberHex !== bytesToHex(serialBytes) ||
        value.icManufacturingReferencesHex !== bytesToHex(manufacturingBytes)
    ) {
        return {
            records: [],
            warnings: [warning('invalidValue', generation, recordPath)],
        };
    }

    return {
        records: [
            createCardChipTechnicalData({
                manufacturingReference: value.icManufacturingReferencesHex,
                serialNumber: value.icSerialNumberHex,
                source: source(generation, recordPath),
            }),
        ],
        warnings: [],
    };
}

function normalizeIccTechnicalData(
    application: ParserDriverCardApplication,
    generation: TachographGeneration,
    pathTokens: readonly string[],
): INormalizedCardTechnicalData {
    const recordPath = [...pathTokens, 'cardIccIdentification'];
    const value = application.cardIccIdentification;
    const extendedSerialNumber = normalizeTechnicalExtendedSerialNumber(value.cardExtendedSerialNumber);
    if (
        value.cardApprovalNumber.length > 8 ||
        !isTechnicalByte(value.cardPersonaliserID) ||
        !isTechnicalByte(value.clockStop) ||
        extendedSerialNumber === null ||
        value.embedderIcAssemblerId.countryCode.length !== 2 ||
        value.embedderIcAssemblerId.moduleEmbedder.length !== 2
    ) {
        return {
            records: [],
            warnings: [warning('invalidValue', generation, recordPath)],
        };
    }

    const manufacturerInformation = decodeBytes(value.embedderIcAssemblerId.manufacturerInformation, 2);
    const icIdentifier = decodeBytes(value.icIdentifier, 2);
    if (manufacturerInformation === null || icIdentifier === null) {
        return {
            records: [],
            warnings: [warning('invalidValue', generation, recordPath)],
        };
    }

    return {
        records: [
            createCardIccTechnicalData({
                approvalNumber: value.cardApprovalNumber,
                clockStop: value.clockStop,
                embedder: {
                    countryCode: value.embedderIcAssemblerId.countryCode,
                    manufacturerInformation,
                    moduleEmbedder: value.embedderIcAssemblerId.moduleEmbedder,
                },
                extendedSerialNumber,
                icIdentifier,
                personaliserId: value.cardPersonaliserID,
                source: source(generation, recordPath),
            }),
        ],
        warnings: [],
    };
}

function normalizeDrivingLicenceTechnicalData(
    application: ParserDriverCardApplication,
    generation: TachographGeneration,
    pathTokens: readonly string[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedCardTechnicalData {
    const recordPath = [...pathTokens, 'drivingLicenceInformation'];
    const value = application.drivingLicenceInformation;
    if (value === null) {
        return {
            records: [],
            warnings: [],
        };
    }
    const rawAuthority = value.drivingLicenceIssuingAuthority;
    const rawNumber = value.drivingLicenceNumber;
    if (rawAuthority === '' && rawNumber === '') {
        return {
            records: [],
            warnings: [],
        };
    }
    const issuingAuthority = isIdentityName(rawAuthority) ? rawAuthority : null;
    const licenceNumber = isDrivingLicenceNumber(rawNumber) ? rawNumber : null;
    const rawNation = value.drivingLicenceIssuingNation;
    const issuingMemberState: RecordedIssuingMemberState | null =
        normalizeParserNation(rawNation, nationAlphaCodes) ?? (isRawMemberState(rawNation) ? rawNation : null);
    const warnings: ITachographWarning[] = [];
    if (issuingAuthority === null) {
        warnings.push(warning('invalidValue', generation, [...recordPath, 'drivingLicenceIssuingAuthority']));
    }
    if (licenceNumber === null) {
        warnings.push(warning('invalidValue', generation, [...recordPath, 'drivingLicenceNumber']));
    }
    if (licenceNumber === null) {
        return {
            records: [],
            warnings: warnings,
        };
    }

    return {
        records: [
            createDrivingLicenceTechnicalData({
                issuingAuthority,
                issuingMemberState,
                licenceNumber,
                source: source(generation, recordPath),
            }),
        ],
        warnings: warnings,
    };
}

function normalizeDownloadTechnicalRecord(
    application: ParserDriverCardApplication,
    generation: TachographGeneration,
    pathTokens: readonly string[],
): INormalizedCardTechnicalData {
    const recordPath = [...pathTokens, 'cardDownload'];
    const value = application.cardDownload;
    if (value === null) {
        return {
            records: [],
            warnings: [],
        };
    }
    const timestamp = normalizeParserUtcTimestamp(value);
    if (timestamp === null) {
        return {
            records: [],
            warnings: [warning('invalidValue', generation, recordPath)],
        };
    }

    return {
        records: [
            createCardDownloadTechnicalRecord({
                downloadedAt: isRecordedParserTimestamp(timestamp) ? timestamp : null,
                source: source(generation, recordPath),
            }),
        ],
        warnings: [],
    };
}

function normalizeCurrentUsageTechnicalRecord(
    application: ParserDriverCardApplication,
    generation: TachographGeneration,
    pathTokens: readonly string[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedCardTechnicalData {
    const recordPath = [...pathTokens, 'currentUsage'];
    const value = application.currentUsage;
    if (value === null) {
        return {
            records: [],
            warnings: [],
        };
    }
    const timestamp = normalizeParserUtcTimestamp(value.sessionOpenTime);
    const registration = normalizeCardVehicleRegistration(
        value.sessionOpenVehicle,
        generation,
        [...recordPath, 'sessionOpenVehicle'],
        nationAlphaCodes,
    );
    if (timestamp === null) {
        return {
            records: [],
            warnings: [warning('invalidValue', generation, [...recordPath, 'sessionOpenTime']), ...registration.warnings],
        };
    }

    return {
        records: [
            createCardCurrentUsageTechnicalRecord({
                registrationMemberState: registration.memberState,
                registrationNumber: registration.number,
                sessionOpenedAt: timestamp === 0 ? null : timestamp,
                source: source(generation, recordPath),
            }),
        ],
        warnings: registration.warnings,
    };
}

function cardReference(
    value: FullCardNumber,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
    warnings: ITachographWarning[],
): IRecordedCardReference | null {
    const normalized = normalizeFullCardIdentity(value, generation, pathTokens, nationAlphaCodes, warning);
    warnings.push(...normalized.warnings);
    return normalized.cardNumber === null && normalized.cardType === 'unknown' && normalized.issuingMemberState === null
        ? null
        : {
              cardNumber: normalized.cardNumber,
              cardType: normalized.cardType,
              issuingMemberState: normalized.issuingMemberState,
          };
}

function normalizeControlActivityTechnicalRecord(
    application: ParserDriverCardApplication,
    generation: TachographGeneration,
    pathTokens: readonly string[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedCardTechnicalData {
    const recordPath = [...pathTokens, 'controlActivityData'];
    const value = application.controlActivityData;
    if (value === null) {
        return {
            records: [],
            warnings: [],
        };
    }
    const warnings: ITachographWarning[] = [];
    const controlType = normalizeParserCardControlActivityType(value.controlType);
    const controlledAt = normalizeParserUtcTimestamp(value.controlTime);
    if (controlledAt === 0) {
        return {
            records: [],
            warnings: [],
        };
    }
    const rawBegin = normalizeParserUtcTimestamp(value.controlDownloadPeriodBegin);
    const rawEnd = normalizeParserUtcTimestamp(value.controlDownloadPeriodEnd);
    if (controlType === null) {
        warnings.push(warning('unsupportedData', generation, [...recordPath, 'controlType']));
    }
    if (controlledAt === null || controlledAt === 0) {
        warnings.push(warning('invalidValue', generation, [...recordPath, 'controlTime']));
    }
    if (value.controlDownloadPeriodBegin !== null && rawBegin === null) {
        warnings.push(warning('invalidValue', generation, [...recordPath, 'controlDownloadPeriodBegin']));
    }
    if (value.controlDownloadPeriodEnd !== null && rawEnd === null) {
        warnings.push(warning('invalidValue', generation, [...recordPath, 'controlDownloadPeriodEnd']));
    }

    const registration = normalizeCardVehicleRegistration(
        value.controlVehicleRegistration,
        generation,
        [...recordPath, 'controlVehicleRegistration'],
        nationAlphaCodes,
    );
    warnings.push(...registration.warnings);
    const controlCard = cardReference(
        value.controlCardNumber,
        generation,
        [...recordPath, 'controlCardNumber'],
        nationAlphaCodes,
        warnings,
    );
    if (
        controlType === null ||
        controlledAt === null ||
        controlledAt === 0 ||
        (value.controlDownloadPeriodBegin !== null && rawBegin === null) ||
        (value.controlDownloadPeriodEnd !== null && rawEnd === null)
    ) {
        return {
            records: [],
            warnings: warnings,
        };
    }

    const record = createCardControlActivityTechnicalRecord({
        controlCard,
        controlledAt,
        controlType,
        downloadPeriodBegin: isRecordedParserTimestamp(rawBegin) ? rawBegin : null,
        downloadPeriodEnd: isRecordedParserTimestamp(rawEnd) ? rawEnd : null,
        registrationMemberState: registration.memberState,
        registrationNumber: registration.number,
        source: source(generation, recordPath),
    });
    if (record === null) {
        warnings.push(warning('inconsistentData', generation, recordPath));
    }

    return {
        records: record === null ? [] : [record],
        warnings: warnings,
    };
}

function normalizeSpecificConditionRecords(
    application: ParserDriverCardApplication,
    generation: TachographGeneration,
    pathTokens: readonly string[],
): INormalizedCardTechnicalData {
    const rootPath = [...pathTokens, 'specificConditions'];
    const value = application.specificConditions;
    if (value === null) {
        return {
            records: [],
            warnings: [],
        };
    }
    if (
        value.specificConditionRecords.length > maximumSpecificConditionRecords ||
        ('conditionPointerNewestRecord' in value && !isTechnicalUnsignedShort(value.conditionPointerNewestRecord)) ||
        (generation === 'g1') === 'conditionPointerNewestRecord' in value
    ) {
        return {
            records: [],
            warnings: [warning('invalidValue', generation, rootPath)],
        };
    }

    const records: DriverCardTechnicalRecord[] = [];
    const warnings: ITachographWarning[] = [];
    for (const [index, rawRecord] of value.specificConditionRecords.entries()) {
        const recordPath = [...rootPath, 'specificConditionRecords', index];
        const enteredAt = normalizeParserUtcTimestamp(rawRecord.entryTime);
        const conditionType = normalizeParserSpecificConditionType(rawRecord.specificConditionType);
        if (!isRecordedParserTimestamp(enteredAt)) {
            warnings.push(warning('invalidValue', generation, [...recordPath, 'entryTime']));
        }
        if (conditionType === null) {
            warnings.push(warning('unsupportedData', generation, [...recordPath, 'specificConditionType']));
        }
        if (!isRecordedParserTimestamp(enteredAt) || conditionType === null) {
            continue;
        }

        records.push(
            createSpecificConditionTechnicalRecord({
                conditionType,
                enteredAt,
                source: source(generation, recordPath),
            }),
        );
    }

    return {
        records: records,
        warnings: warnings,
    };
}

export function normalizeCardTechnicalData(
    application: ParserDriverCardApplication,
    generation: TachographGeneration,
    pathTokens: readonly string[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedCardTechnicalData {
    const normalized = [
        normalizeApplicationTechnicalData(application, generation, pathTokens),
        normalizeApplicationV2TechnicalData(application, generation, pathTokens),
        normalizeChipTechnicalData(application, generation, pathTokens),
        normalizeIccTechnicalData(application, generation, pathTokens),
        normalizeDrivingLicenceTechnicalData(application, generation, pathTokens, nationAlphaCodes),
        normalizeDownloadTechnicalRecord(application, generation, pathTokens),
        normalizeCurrentUsageTechnicalRecord(application, generation, pathTokens, nationAlphaCodes),
        normalizeControlActivityTechnicalRecord(application, generation, pathTokens, nationAlphaCodes),
        normalizeSpecificConditionRecords(application, generation, pathTokens),
    ];

    return {
        records: normalized.flatMap((item) => item.records),
        warnings: normalized.flatMap((item) => item.warnings),
    };
}
