import {
    createVehicleUnitCalibrationTechnicalRecord,
    createVehicleUnitCardSlotStatusTechnicalRecord,
    createVehicleUnitDownloadActivityTechnicalRecord,
    createVehicleUnitDownloadPeriodTechnicalRecord,
    createVehicleUnitEmbeddedCardSnapshotTechnicalRecord,
    createVehicleUnitEmbeddedCardTechnicalRecord,
    createVehicleUnitGnssCoupledTechnicalRecord,
    createVehicleUnitIdentificationTechnicalRecord,
    createVehicleUnitItsConsentTechnicalRecord,
    createVehicleUnitPowerSupplyInterruptionTechnicalRecord,
    createVehicleUnitSensorPairedTechnicalRecord,
    isTechnicalByte,
    isTechnicalUnsignedShort,
    isVehicleIdentificationNumber,
    isCardNumber,
    type CardNumber,
    type InsertedCardType,
    type ITachographWarning,
    type ITechnicalExtendedSerialNumber,
    type RecordedIssuingMemberState,
    type TachographGeneration,
    type UtcTimestamp,
    type VehicleUnitTechnicalRecord,
} from '#viewer-domain';

import { normalizeVehicleRegistration } from '../card/card-vehicle-registration-normalizer.js';
import { normalizeRecordedCardReference } from '../card/full-card-identity-normalizer.js';
import type {
    CardSlotStatus,
    CompanyCardIdentification,
    ControlCardIdentification,
    DriverCardIdentification,
    ExtendedSerialNumber,
    FullCardNumber,
    Gen1SensorPaired,
    Gen1VUIdentification,
    Gen1VuCalibrationRecord,
    Gen1VuDownloadActivityData,
    Gen1VuDownloadablePeriod,
    Gen1VuOverview,
    Gen1VuTechnicalData,
    Gen2DataInfoGenericRecordArray,
    Gen2SensorExternalGNSSCoupledRecord,
    Gen2SensorPairedRecord,
    Gen2VUOverview,
    Gen2VUTechnicalData,
    Gen2VuCalibrationRecord,
    Gen2VuCardRecord,
    Gen2VuDownloadActivityData,
    Gen2VuDownloadablePeriod,
    Gen2VuIdentification,
    Gen2VuItsConsentRecord,
    Gen2VuPowerSupplyInterruptionRecord,
    RecordType,
    VUTransferResponseParameterID,
    WorkshopCardIdentification,
} from '../generated/esm_parser.js';
import { createNormalizationSourceContext } from '../normalization-source.js';
import { normalizeParserCalibrationPurpose, normalizeParserInsertedCardType } from '../normalizers/parser-enum-normalizer.js';
import type {
    IParserEmbeddedCardSnapshot,
    IParserEmbeddedCardSnapshotApplication,
    ParserVehicleUnitTransferParameter,
} from '../decoders/parser-result-types.js';
import {
    isRecordedParserTimestamp,
    normalizeParserNation,
    normalizeParserOdometerWithWarning,
    normalizeParserUtcTimestamp,
    type ParserNationAlphaCodes,
} from '../normalizers/parser-value-normalizer.js';
import { normalizeTechnicalExtendedSerialNumber, normalizeTechnicalText } from '../normalizers/technical-value-normalizer.js';
import { decodeVehicleUnitCountedRecords, decodeVehicleUnitRecordArray } from './vehicle-unit-record-array.js';
import { vehicleUnitTypeIdGeneration } from './vehicle-unit-generation.js';
import { optionalTimestamp, requiredTimestamp } from './vehicle-unit-timestamps.js';

export interface INormalizedVehicleUnitTechnicalData {
    readonly records: readonly VehicleUnitTechnicalRecord[];
    readonly warnings: readonly ITachographWarning[];
}

const maximumTechnicalRecordsPerArray = 4_096;
const overviewTypeIds: ReadonlySet<VUTransferResponseParameterID> = new Set(['Gen2Overview', 'Gen2v2Overview', 'Overview']);
const technicalTypeIds: ReadonlySet<VUTransferResponseParameterID> = new Set([
    'Gen2TechnicalData',
    'Gen2v2TechnicalData',
    'TechnicalData',
]);

const { source, warning } = createNormalizationSourceContext('vehicleUnit');

function requiredText(
    value: string,
    maximumLength: number,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    warnings: ITachographWarning[],
): string | null {
    const text = normalizeTechnicalText(value, maximumLength);
    if (text === null) {
        warnings.push(warning('invalidValue', generation, pathTokens));
    }
    return text;
}

function optionalText(
    value: string,
    maximumLength: number,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    warnings: ITachographWarning[],
): string | null {
    return value.trim() === '' ? null : requiredText(value, maximumLength, generation, pathTokens, warnings);
}

function inconsistentGenerationResult(
    value: Record<string, unknown>,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
): INormalizedVehicleUnitTechnicalData | null {
    const gen2 = 'isGen2V2' in value;
    if ((generation === 'g1') === gen2) {
        return {
            records: [],
            warnings: [warning('inconsistentData', generation, pathTokens)],
        };
    }
    if (gen2 && value['isGen2V2'] !== (generation === 'g2v2')) {
        return {
            records: [],
            warnings: [warning('inconsistentData', generation, pathTokens)],
        };
    }
    return null;
}

function normalizeIdentification(
    value: Gen1VUIdentification | Gen2VuIdentification,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
): INormalizedVehicleUnitTechnicalData {
    const generationError = inconsistentGenerationResult(value, generation, pathTokens);
    if (generationError !== null) return generationError;

    const gen2 = 'isGen2V2' in value;
    const warnings: ITachographWarning[] = [];
    const manufacturerName = requiredText(
        value.vuManufacturerName,
        35,
        generation,
        [...pathTokens, 'vuManufacturerName'],
        warnings,
    );
    const manufacturerAddress = requiredText(
        value.vuManufacturerAddress,
        35,
        generation,
        [...pathTokens, 'vuManufacturerAddress'],
        warnings,
    );
    const partNumber = requiredText(value.vuPartNumber, 16, generation, [...pathTokens, 'vuPartNumber'], warnings);
    const serialNumber = normalizeTechnicalExtendedSerialNumber(value.vuSerialNumber);
    if (serialNumber === null) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'vuSerialNumber']));
    }
    const softwareVersion = requiredText(
        value.vuSoftwareIdentification.vuSoftwareVersion,
        4,
        generation,
        [...pathTokens, 'vuSoftwareIdentification', 'vuSoftwareVersion'],
        warnings,
    );
    const softwareInstalledAt = requiredTimestamp(
        value.vuSoftwareIdentification.vuSoftInstallationDate,
        generation,
        [...pathTokens, 'vuSoftwareIdentification', 'vuSoftInstallationDate'],
        warnings,
    );
    const manufacturedAt = requiredTimestamp(
        value.vuManufacturingDate,
        generation,
        [...pathTokens, 'vuManufacturingDate'],
        warnings,
    );
    const approvalNumber = requiredText(
        value.vuApprovalNumber,
        gen2 ? 16 : 8,
        generation,
        [...pathTokens, 'vuApprovalNumber'],
        warnings,
    );
    const vehicleUnitGeneration = gen2 && isTechnicalByte(value.vuGeneration) ? value.vuGeneration : null;
    const ability = gen2 && isTechnicalByte(value.vuAbility) ? value.vuAbility : null;
    if (gen2 && vehicleUnitGeneration === null) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'vuGeneration']));
    }
    if (gen2 && ability === null) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'vuAbility']));
    }

    if (
        manufacturerName === null ||
        manufacturerAddress === null ||
        partNumber === null ||
        serialNumber === null ||
        softwareVersion === null ||
        softwareInstalledAt === null ||
        manufacturedAt === null ||
        approvalNumber === null ||
        (gen2 && (vehicleUnitGeneration === null || ability === null))
    ) {
        return {
            records: [],
            warnings: warnings,
        };
    }

    return {
        records: [
            createVehicleUnitIdentificationTechnicalRecord({
                ability,
                approvalNumber,
                manufacturerAddress,
                manufacturerName,
                manufacturedAt,
                partNumber,
                serialNumber,
                softwareInstalledAt,
                softwareVersion,
                source: source(generation, pathTokens),
                vehicleUnitGeneration,
            }),
        ],
        warnings: warnings,
    };
}

interface ISensorIdentity {
    readonly sensorApprovalNumber: string;
    readonly sensorSerialNumber: ITechnicalExtendedSerialNumber;
}

// A paired motion sensor and a coupled external GNSS receiver are identified by the same approval and serial number.
function normalizeSensorIdentity(
    input: { readonly approvalNumber: string; readonly serialNumber: ExtendedSerialNumber },
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    warnings: ITachographWarning[],
): ISensorIdentity | null {
    const sensorApprovalNumber = requiredText(
        input.approvalNumber,
        16,
        generation,
        [...pathTokens, 'sensorApprovalNumber'],
        warnings,
    );
    if (sensorApprovalNumber === null) {
        return null;
    }

    const sensorSerialNumber = normalizeTechnicalExtendedSerialNumber(input.serialNumber);
    if (sensorSerialNumber === null) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'sensorSerialNumber']));
        return null;
    }
    return { sensorApprovalNumber, sensorSerialNumber };
}

interface ISensorPairedRecordInput {
    readonly approvalNumber: string;
    readonly pairingDate: string | null;
    readonly pairingDatePathTokens: readonly string[];
    readonly serialNumber: ExtendedSerialNumber;
}

function createSensorPairedRecord(
    input: ISensorPairedRecordInput,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    warnings: ITachographWarning[],
): VehicleUnitTechnicalRecord | null {
    const pairedAt = requiredTimestamp(input.pairingDate, generation, [...pathTokens, ...input.pairingDatePathTokens], warnings);
    if (pairedAt === null) {
        return null;
    }
    const identity = normalizeSensorIdentity(input, generation, pathTokens, warnings);
    if (identity === null) {
        return null;
    }

    return createVehicleUnitSensorPairedTechnicalRecord({
        pairedAt,
        ...identity,
        source: source(generation, pathTokens),
    });
}

function normalizeSensorPairedRecord(
    value: Gen1SensorPaired | Gen2SensorPairedRecord,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
): INormalizedVehicleUnitTechnicalData {
    const warnings: ITachographWarning[] = [];
    const isGen1 = 'sensorPairingDateFirst' in value;
    const record = createSensorPairedRecord(
        {
            approvalNumber: value.sensorApprovalNumber,
            pairingDate: isGen1 ? value.sensorPairingDateFirst : value.sensorPairingDate,
            pairingDatePathTokens: [isGen1 ? 'sensorPairingDateFirst' : 'sensorPairingDate'],
            serialNumber: value.sensorSerialNumber,
        },
        generation,
        pathTokens,
        warnings,
    );
    return {
        records: record === null ? [] : [record],
        warnings: warnings,
    };
}

interface IGnssCoupledRecordInput {
    readonly approvalNumber: string;
    readonly couplingDate: string | null;
    readonly couplingDatePathTokens: readonly string[];
    readonly serialNumber: ExtendedSerialNumber;
}

function createGnssCoupledRecord(
    input: IGnssCoupledRecordInput,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    warnings: ITachographWarning[],
): VehicleUnitTechnicalRecord | null {
    const coupledAt = requiredTimestamp(
        input.couplingDate,
        generation,
        [...pathTokens, ...input.couplingDatePathTokens],
        warnings,
    );
    if (coupledAt === null) {
        return null;
    }
    const identity = normalizeSensorIdentity(input, generation, pathTokens, warnings);
    if (identity === null) {
        return null;
    }

    return createVehicleUnitGnssCoupledTechnicalRecord({
        coupledAt,
        ...identity,
        source: source(generation, pathTokens),
    });
}

function normalizeGnssCoupledRecord(
    value: Gen2SensorExternalGNSSCoupledRecord,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
): INormalizedVehicleUnitTechnicalData {
    const warnings: ITachographWarning[] = [];
    const record = createGnssCoupledRecord(
        {
            approvalNumber: value.sensorApprovalNumber,
            couplingDate: value.sensorCouplingDate,
            couplingDatePathTokens: ['sensorCouplingDate'],
            serialNumber: value.sensorSerialNumber,
        },
        generation,
        pathTokens,
        warnings,
    );
    return {
        records: record === null ? [] : [record],
        warnings: warnings,
    };
}

function normalizeEmbeddedCardRecord(
    value: Gen2VuCardRecord,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedVehicleUnitTechnicalData {
    const warnings: ITachographWarning[] = [];
    const card = normalizeRecordedCardReference(
        value.cardNumberAndGenerationInformation.fullcardNumber,
        generation,
        [...pathTokens, 'cardNumberAndGenerationInformation', 'fullcardNumber'],
        nationAlphaCodes,
        warning,
    );
    warnings.push(...card.warnings);

    const extendedSerialNumber = normalizeTechnicalExtendedSerialNumber(value.cardExtendedSerialNumber);
    if (extendedSerialNumber === null) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'cardExtendedSerialNumber']));
    }

    const cardStructureVersion = isTechnicalByte(value.cardStructureVersion.structureVersion)
        ? value.cardStructureVersion.structureVersion
        : null;
    const dataElementUseVersion = isTechnicalByte(value.cardStructureVersion.dataElementUseVersion)
        ? value.cardStructureVersion.dataElementUseVersion
        : null;
    if (cardStructureVersion === null) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'cardStructureVersion', 'structureVersion']));
    }
    if (dataElementUseVersion === null) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'cardStructureVersion', 'dataElementUseVersion']));
    }

    return {
        records: [
            createVehicleUnitEmbeddedCardTechnicalRecord({
                card: card.reference,
                cardStructureVersion,
                dataElementUseVersion,
                extendedSerialNumber,
                source: source(generation, pathTokens),
            }),
        ],
        warnings: warnings,
    };
}

function normalizeItsConsentRecord(
    value: Gen2VuItsConsentRecord,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedVehicleUnitTechnicalData {
    const warnings: ITachographWarning[] = [];
    const card = normalizeRecordedCardReference(
        value.cardNumberAndGen.fullcardNumber,
        generation,
        [...pathTokens, 'cardNumberAndGen', 'fullcardNumber'],
        nationAlphaCodes,
        warning,
    );
    warnings.push(...card.warnings);

    return {
        records: [
            createVehicleUnitItsConsentTechnicalRecord({
                card: card.reference,
                consent: value.consent,
                source: source(generation, pathTokens),
            }),
        ],
        warnings: warnings,
    };
}

function normalizePowerSupplyInterruptionRecord(
    value: Gen2VuPowerSupplyInterruptionRecord,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
): INormalizedVehicleUnitTechnicalData {
    if (!Number.isInteger(value.similarEventsNumber) || value.similarEventsNumber < 0 || value.similarEventsNumber > 0xff) {
        return {
            records: [],
            warnings: [warning('invalidValue', generation, pathTokens)],
        };
    }

    const warnings: ITachographWarning[] = [];
    const begin = requiredTimestamp(value.eventBeginTime, generation, [...pathTokens, 'eventBeginTime'], warnings);
    const rawEnd = normalizeParserUtcTimestamp(value.eventEndTime);
    const end = isRecordedParserTimestamp(rawEnd) ? rawEnd : null;
    if (value.eventEndTime !== null && rawEnd === null) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'eventEndTime']));
    }
    if (begin === null) {
        return {
            records: [],
            warnings: warnings,
        };
    }

    return {
        records: [
            createVehicleUnitPowerSupplyInterruptionTechnicalRecord({
                begin,
                end,
                similarEvents: value.similarEventsNumber,
                source: source(generation, pathTokens),
            }),
        ],
        warnings: warnings,
    };
}

function normalizeCardSlotStatus(
    value: CardSlotStatus,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
): INormalizedVehicleUnitTechnicalData {
    const warnings: ITachographWarning[] = [];
    const driverSlot = normalizeParserInsertedCardType(value.driverSlot);
    const coDriverSlot = normalizeParserInsertedCardType(value.coDriverSlot);
    if (driverSlot === null) {
        warnings.push(warning('unsupportedData', generation, [...pathTokens, 'driverSlot']));
    }
    if (coDriverSlot === null) {
        warnings.push(warning('unsupportedData', generation, [...pathTokens, 'coDriverSlot']));
    }
    if (driverSlot === null || coDriverSlot === null) {
        return {
            records: [],
            warnings: warnings,
        };
    }

    return {
        records: [
            createVehicleUnitCardSlotStatusTechnicalRecord({
                coDriverSlot,
                driverSlot,
                source: source(generation, pathTokens),
            }),
        ],
        warnings: warnings,
    };
}

function normalizeCalibration(
    value: Gen1VuCalibrationRecord | Gen2VuCalibrationRecord,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedVehicleUnitTechnicalData {
    const generationError = inconsistentGenerationResult(value, generation, pathTokens);
    if (generationError !== null) return generationError;

    const warnings: ITachographWarning[] = [];
    const purpose = normalizeParserCalibrationPurpose(value.calibrationPurpose);
    if (purpose === null) {
        warnings.push(warning('unsupportedData', generation, [...pathTokens, 'calibrationPurpose']));
    }
    const workshopName = requiredText(value.workshopName, 35, generation, [...pathTokens, 'workshopName'], warnings);
    const workshopAddress = requiredText(value.workshopAddress, 35, generation, [...pathTokens, 'workshopAddress'], warnings);
    const workshopCard = normalizeRecordedCardReference(
        value.workshopCardNumber,
        generation,
        [...pathTokens, 'workshopCardNumber'],
        nationAlphaCodes,
        warning,
    );
    warnings.push(...workshopCard.warnings);
    const workshopCardExpiryAt = optionalTimestamp(
        value.workshopCardExpiryDate,
        generation,
        [...pathTokens, 'workshopCardExpiryDate'],
        warnings,
    );
    const vehicleIdentificationNumber = isVehicleIdentificationNumber(value.vehicleIdentificationNumber)
        ? value.vehicleIdentificationNumber
        : null;
    if (vehicleIdentificationNumber === null) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'vehicleIdentificationNumber']));
    }
    const registration = normalizeVehicleRegistration(
        value.vehicleRegistrationIdentification,
        generation,
        [...pathTokens, 'vehicleRegistrationIdentification'],
        nationAlphaCodes,
        warning,
    );
    warnings.push(...registration.warnings);
    const wConstant = isTechnicalUnsignedShort(value.wVehicleCharacteristicConstant)
        ? value.wVehicleCharacteristicConstant
        : null;
    const kConstant = isTechnicalUnsignedShort(value.kConstantOfRecordingEquipment) ? value.kConstantOfRecordingEquipment : null;
    const tyreCircumference = isTechnicalUnsignedShort(value.lTyreCircumference) ? value.lTyreCircumference : null;
    const authorisedSpeed = isTechnicalByte(value.authorisedSpeed) ? value.authorisedSpeed : null;
    for (const [key, normalized] of [
        ['wVehicleCharacteristicConstant', wConstant],
        ['kConstantOfRecordingEquipment', kConstant],
        ['lTyreCircumference', tyreCircumference],
        ['authorisedSpeed', authorisedSpeed],
    ] as const) {
        if (normalized === null) {
            warnings.push(warning('invalidValue', generation, [...pathTokens, key]));
        }
    }
    const tyreSize = requiredText(value.tyreSize, 15, generation, [...pathTokens, 'tyreSize'], warnings);
    const oldOdometer = normalizeParserOdometerWithWarning(
        value.oldOdometerValue,
        generation,
        [...pathTokens, 'oldOdometerValue'],
        warnings,
        warning,
    );
    const newOdometer = normalizeParserOdometerWithWarning(
        value.newOdometerValue,
        generation,
        [...pathTokens, 'newOdometerValue'],
        warnings,
        warning,
    );
    const previousTime = optionalTimestamp(value.oldTimeValue, generation, [...pathTokens, 'oldTimeValue'], warnings);
    const calibratedAt = requiredTimestamp(value.newTimeValue, generation, [...pathTokens, 'newTimeValue'], warnings);
    const nextCalibrationAt = optionalTimestamp(
        value.nextCalibrationDate,
        generation,
        [...pathTokens, 'nextCalibrationDate'],
        warnings,
    );

    if (
        purpose === null ||
        workshopName === null ||
        workshopAddress === null ||
        vehicleIdentificationNumber === null ||
        wConstant === null ||
        kConstant === null ||
        tyreCircumference === null ||
        authorisedSpeed === null ||
        tyreSize === null ||
        calibratedAt === null
    ) {
        return {
            records: [],
            warnings: warnings,
        };
    }

    return {
        records: [
            createVehicleUnitCalibrationTechnicalRecord({
                authorisedSpeedKilometresPerHour: authorisedSpeed,
                calibratedAt,
                kConstantPulsesPerKilometre: kConstant,
                lTyreCircumferenceMillimetres: tyreCircumference,
                newOdometer,
                nextCalibrationAt,
                oldOdometer,
                previousTime,
                purpose,
                registrationMemberState: registration.memberState,
                registrationNumber: registration.number,
                source: source(generation, pathTokens),
                tyreSize,
                vehicleIdentificationNumber,
                wVehicleCharacteristicPulsesPerKilometre: wConstant,
                workshopAddress,
                workshopCard: workshopCard.reference,
                workshopCardExpiryAt,
                workshopName,
            }),
        ],
        warnings: warnings,
    };
}

function normalizeDownloadPeriod(
    value: Gen1VuDownloadablePeriod | Gen2VuDownloadablePeriod,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
): INormalizedVehicleUnitTechnicalData {
    const warnings: ITachographWarning[] = [];
    const periodBegin = requiredTimestamp(
        value.minDownloadableTime,
        generation,
        [...pathTokens, 'minDownloadableTime'],
        warnings,
    );
    const periodEnd = requiredTimestamp(value.maxDownloadableTime, generation, [...pathTokens, 'maxDownloadableTime'], warnings);
    if (periodBegin === null || periodEnd === null) {
        return {
            records: [],
            warnings: warnings,
        };
    }
    const record = createVehicleUnitDownloadPeriodTechnicalRecord({
        periodBegin,
        periodEnd,
        source: source(generation, pathTokens),
    });
    if (record === null) {
        warnings.push(warning('inconsistentData', generation, pathTokens));
        return {
            records: [],
            warnings: warnings,
        };
    }

    return {
        records: [record],
        warnings: warnings,
    };
}

function normalizeDownloadActivity(
    value: Gen1VuDownloadActivityData | Gen2VuDownloadActivityData,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedVehicleUnitTechnicalData {
    const warnings: ITachographWarning[] = [];
    const downloadedAt = optionalTimestamp(value.downloadingTime, generation, [...pathTokens, 'downloadingTime'], warnings);
    const operatorName = optionalText(
        value.companyOrWorkshopName,
        35,
        generation,
        [...pathTokens, 'companyOrWorkshopName'],
        warnings,
    );

    const gen2 = 'fullCardNumberAndGeneration' in value;
    if ((generation === 'g1') === gen2) {
        return {
            records: [],
            warnings: [...warnings, warning('inconsistentData', generation, pathTokens)],
        };
    }
    let rawCard: FullCardNumber;
    let cardPath: readonly (number | string)[];
    if (gen2) {
        const wrappedCard = value.fullCardNumberAndGeneration;
        if (!Number.isInteger(wrappedCard.generation) || wrappedCard.generation < 0 || wrappedCard.generation > 0xff) {
            warnings.push(warning('invalidValue', generation, [...pathTokens, 'fullCardNumberAndGeneration', 'generation']));
        }
        rawCard = wrappedCard.fullcardNumber;
        cardPath = [...pathTokens, 'fullCardNumberAndGeneration', 'fullcardNumber'];
    } else {
        rawCard = value.fullCardNumber;
        cardPath = [...pathTokens, 'fullCardNumber'];
    }
    const card = normalizeRecordedCardReference(rawCard, generation, cardPath, nationAlphaCodes, warning);
    warnings.push(...card.warnings);

    if (downloadedAt === null && (card.reference !== null || operatorName !== null)) {
        warnings.push(warning('inconsistentData', generation, pathTokens));
    }

    return {
        records: [
            createVehicleUnitDownloadActivityTechnicalRecord({
                card: card.reference,
                downloadedAt,
                operatorName,
                source: source(generation, pathTokens),
            }),
        ],
        warnings: warnings,
    };
}

function normalizeGen1Overview(
    overview: Gen1VuOverview,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedVehicleUnitTechnicalData {
    const period = normalizeDownloadPeriod(overview.vuDownloadablePeriod, generation, [...pathTokens, 'vuDownloadablePeriod']);
    const activity = normalizeDownloadActivity(
        overview.vuDownloadActivityData,
        generation,
        [...pathTokens, 'vuDownloadActivityData'],
        nationAlphaCodes,
    );
    const slotStatus = normalizeCardSlotStatus(overview.cardSlotStatus, generation, [...pathTokens, 'cardSlotStatus']);

    return {
        records: [...period.records, ...activity.records, ...slotStatus.records],
        warnings: [...period.warnings, ...activity.warnings, ...slotStatus.warnings],
    };
}

function normalizeGen2Overview(
    overview: Gen2VUOverview,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedVehicleUnitTechnicalData {
    const warnings: ITachographWarning[] = [];
    const records: VehicleUnitTechnicalRecord[] = [];
    const periodPath = [...pathTokens, 'vuDownloadablePeriodRecordArray'];
    const periods = decodeVehicleUnitRecordArray(
        overview.vuDownloadablePeriodRecordArray,
        maximumTechnicalRecordsPerArray,
        'VuDownloadablePeriod',
    );
    if (periods === null) {
        warnings.push(warning('inconsistentData', generation, periodPath));
    } else {
        for (const [index, period] of periods.entries()) {
            const normalized = normalizeDownloadPeriod(period, generation, [...periodPath, 'records', index]);
            records.push(...normalized.records);
            warnings.push(...normalized.warnings);
        }
    }

    const activityPath = [...pathTokens, 'vuDownloadActivityDataRecordArray'];
    const activities = decodeVehicleUnitRecordArray(
        overview.vuDownloadActivityDataRecordArray,
        maximumTechnicalRecordsPerArray,
        'VuDownloadActivityData',
    );
    if (activities === null) {
        warnings.push(warning('inconsistentData', generation, activityPath));
    } else {
        for (const [index, activity] of activities.entries()) {
            const normalized = normalizeDownloadActivity(
                activity,
                generation,
                [...activityPath, 'records', index],
                nationAlphaCodes,
            );
            records.push(...normalized.records);
            warnings.push(...normalized.warnings);
        }
    }

    const slotStatusPath = [...pathTokens, 'cardSlotsStatusRecordArray'];
    const slotStatuses = decodeVehicleUnitRecordArray(
        overview.cardSlotsStatusRecordArray,
        maximumTechnicalRecordsPerArray,
        'CardSlotStatus',
    );
    if (slotStatuses === null) {
        warnings.push(warning('inconsistentData', generation, slotStatusPath));
    } else {
        for (const [index, slotStatus] of slotStatuses.entries()) {
            const normalized = normalizeCardSlotStatus(slotStatus, generation, [...slotStatusPath, 'records', index]);
            records.push(...normalized.records);
            warnings.push(...normalized.warnings);
        }
    }

    return {
        records: records,
        warnings: warnings,
    };
}

function normalizeGen1Technical(
    technical: Gen1VuTechnicalData,
    typeId: VUTransferResponseParameterID,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedVehicleUnitTechnicalData {
    const identification = normalizeIdentification(technical.identification, generation, [...pathTokens, 'identification']);
    const sensorPaired = normalizeSensorPairedRecord(technical.sensorPaired, generation, [...pathTokens, 'sensorPaired']);
    const calibrationPath = [...pathTokens, 'vuCalibrationData'];
    const calibrationData = technical.vuCalibrationData;
    if (
        technical.trepId !== typeId ||
        decodeVehicleUnitCountedRecords(
            calibrationData.no_of_vu_calibrations,
            calibrationData.calibrations,
            maximumTechnicalRecordsPerArray,
        ) === null
    ) {
        return {
            records: [...identification.records, ...sensorPaired.records],
            warnings: [
                ...identification.warnings,
                ...sensorPaired.warnings,
                warning('inconsistentData', generation, calibrationPath),
            ],
        };
    }

    const records: VehicleUnitTechnicalRecord[] = [...identification.records, ...sensorPaired.records];
    const warnings: ITachographWarning[] = [...identification.warnings, ...sensorPaired.warnings];
    for (const [index, calibration] of calibrationData.calibrations.entries()) {
        const normalized = normalizeCalibration(
            calibration,
            generation,
            [...calibrationPath, 'calibrations', index],
            nationAlphaCodes,
        );
        records.push(...normalized.records);
        warnings.push(...normalized.warnings);
    }

    return {
        records: records,
        warnings: warnings,
    };
}

// Shared helper for decoding, validating, and normalizing Gen2 technical-data record arrays.
function normalizeGen2RecordArraySection<TRecord>(
    rawArray: Gen2DataInfoGenericRecordArray<TRecord>,
    expectedRecordType: RecordType,
    generation: TachographGeneration,
    sectionPath: readonly (number | string)[],
    normalizeRecord: (
        record: TRecord,
        generation: TachographGeneration,
        recordPath: readonly (number | string)[],
    ) => INormalizedVehicleUnitTechnicalData,
): INormalizedVehicleUnitTechnicalData {
    const records: VehicleUnitTechnicalRecord[] = [];
    const warnings: ITachographWarning[] = [];
    const decoded = decodeVehicleUnitRecordArray(rawArray, maximumTechnicalRecordsPerArray, expectedRecordType);
    if (decoded === null) {
        warnings.push(warning('inconsistentData', generation, sectionPath));
        return { records, warnings };
    }
    for (const [index, record] of decoded.entries()) {
        const normalized = normalizeRecord(record, generation, [...sectionPath, 'records', index]);
        records.push(...normalized.records);
        warnings.push(...normalized.warnings);
    }
    return { records, warnings };
}

function normalizeGen2Technical(
    technical: Gen2VUTechnicalData,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedVehicleUnitTechnicalData {
    const sections: INormalizedVehicleUnitTechnicalData[] = [
        normalizeGen2RecordArraySection(
            technical.vuIdentificationRecordArray,
            'VuIdentification',
            generation,
            [...pathTokens, 'vuIdentificationRecordArray'],
            normalizeIdentification,
        ),
        normalizeGen2RecordArraySection(
            technical.vuCalibrationRecordArray,
            'VuCalibrationRecord',
            generation,
            [...pathTokens, 'vuCalibrationRecordArray'],
            (record, recordGeneration, recordPath) =>
                normalizeCalibration(record, recordGeneration, recordPath, nationAlphaCodes),
        ),
        normalizeGen2RecordArraySection(
            technical.vuSensorPairedRecordArray,
            'SensorPairedRecord',
            generation,
            [...pathTokens, 'vuSensorPairedRecordArray'],
            normalizeSensorPairedRecord,
        ),
        normalizeGen2RecordArraySection(
            technical.vuSensorExternalGnssCoupledRecordArray,
            'SensorExternalGNSSCoupledRecord',
            generation,
            [...pathTokens, 'vuSensorExternalGnssCoupledRecordArray'],
            normalizeGnssCoupledRecord,
        ),
        normalizeGen2RecordArraySection(
            technical.vuCardRecordArray,
            'VuCardRecord',
            generation,
            [...pathTokens, 'vuCardRecordArray'],
            (record, recordGeneration, recordPath) =>
                normalizeEmbeddedCardRecord(record, recordGeneration, recordPath, nationAlphaCodes),
        ),
        normalizeGen2RecordArraySection(
            technical.vuItsConsentRecordArray,
            'VuITSConsentRecord',
            generation,
            [...pathTokens, 'vuItsConsentRecordArray'],
            (record, recordGeneration, recordPath) =>
                normalizeItsConsentRecord(record, recordGeneration, recordPath, nationAlphaCodes),
        ),
        normalizeGen2RecordArraySection(
            technical.vuPowerSupplyInterruptionRecordArray,
            'VuPowerSupplyInterruptionRecord',
            generation,
            [...pathTokens, 'vuPowerSupplyInterruptionRecordArray'],
            normalizePowerSupplyInterruptionRecord,
        ),
    ];

    return {
        records: sections.flatMap((section) => section.records),
        warnings: sections.flatMap((section) => section.warnings),
    };
}

interface INormalizedEmbeddedCardSnapshotIdentity {
    readonly cardExpiryDate: UtcTimestamp | null;
    readonly cardNumber: CardNumber | null;
    readonly cardType: InsertedCardType | null;
    readonly holderName: string | null;
    readonly issuingMemberState: RecordedIssuingMemberState | null;
    readonly warnings: readonly ITachographWarning[];
}

function readEmbeddedCardSnapshotHolderName(
    identity: CompanyCardIdentification | ControlCardIdentification | DriverCardIdentification | WorkshopCardIdentification,
): string | null {
    if ('driverCardHolderIdentification' in identity) {
        const holder = identity.driverCardHolderIdentification.cardHolderName;
        const parts = [holder.holderFirstNames, holder.holderSurname].filter((part) => part !== '');
        return parts.length === 0 ? null : parts.join(' ');
    }
    if ('workshopCardHolderIdentification' in identity) {
        const name = identity.workshopCardHolderIdentification.workshopName;
        return name === '' ? null : name;
    }
    const holder = identity.companyCardHolderIdentification;
    const name = 'companyName' in holder ? holder.companyName : holder.controlBodyName;
    return name === '' ? null : name;
}

function normalizeEmbeddedCardSnapshotIdentity(
    application: IParserEmbeddedCardSnapshotApplication,
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedEmbeddedCardSnapshotIdentity {
    const warnings: ITachographWarning[] = [];
    const identityPath = [...application.pathTokens, 'identification'];
    const cardType: InsertedCardType | null = application.cardType === 'unsupportedCard' ? 'unknown' : application.cardType;
    const rawIdentity = application.value.identification;
    if (rawIdentity === null) {
        warnings.push(warning('missingValue', application.generation, identityPath));
        return {
            cardExpiryDate: null,
            cardNumber: null,
            cardType,
            holderName: null,
            issuingMemberState: null,
            warnings,
        };
    }

    const cardIdentification = rawIdentity.cardIdentification;
    const rawCardNumber = cardIdentification.cardNumber.number;
    const cardNumber: CardNumber | null = isCardNumber(rawCardNumber) ? rawCardNumber : null;
    if (cardNumber === null) {
        warnings.push(
            warning('invalidValue', application.generation, [...identityPath, 'cardIdentification', 'cardNumber', 'number']),
        );
    }

    const issuingMemberState = normalizeParserNation(cardIdentification.cardIssuingMemberState, nationAlphaCodes);
    if (issuingMemberState === null) {
        warnings.push(
            warning('unsupportedData', application.generation, [...identityPath, 'cardIdentification', 'cardIssuingMemberState']),
        );
    }

    const cardExpiryDate = normalizeParserUtcTimestamp(cardIdentification.cardExpiryDate);
    if (cardExpiryDate === null) {
        warnings.push(warning('invalidValue', application.generation, [...identityPath, 'cardIdentification', 'cardExpiryDate']));
    }

    return {
        cardExpiryDate,
        cardNumber,
        cardType,
        holderName: readEmbeddedCardSnapshotHolderName(rawIdentity),
        issuingMemberState,
        warnings,
    };
}

function normalizeEmbeddedCardSnapshotRecords(
    snapshot: IParserEmbeddedCardSnapshot | null,
    nationAlphaCodes: ParserNationAlphaCodes,
): { readonly records: VehicleUnitTechnicalRecord[]; readonly warnings: ITachographWarning[] } {
    if (snapshot === null) {
        return { records: [], warnings: [] };
    }
    const records: VehicleUnitTechnicalRecord[] = [];
    const warnings: ITachographWarning[] = [];
    if (snapshot.applications === null || snapshot.state !== 'parsed') {
        records.push(
            createVehicleUnitEmbeddedCardSnapshotTechnicalRecord({
                cardExpiryDate: null,
                cardNumber: null,
                cardType: null,
                hasSignature: snapshot.hasSignature,
                holderName: null,
                issuingMemberState: null,
                snapshotState: snapshot.applications === null ? 'unsupported' : snapshot.state,
                source: source(snapshot.generation, snapshot.pathTokens),
            }),
        );
        return { records, warnings };
    }
    for (const application of snapshot.applications) {
        const identity = normalizeEmbeddedCardSnapshotIdentity(application, nationAlphaCodes);
        records.push(
            createVehicleUnitEmbeddedCardSnapshotTechnicalRecord({
                cardExpiryDate: identity.cardExpiryDate,
                cardNumber: identity.cardNumber,
                cardType: identity.cardType,
                hasSignature: snapshot.hasSignature,
                holderName: identity.holderName,
                issuingMemberState: identity.issuingMemberState,
                snapshotState: 'parsed',
                source: source(application.generation, application.pathTokens),
            }),
        );
        warnings.push(...identity.warnings);
    }
    return { records, warnings };
}

export function normalizeVehicleUnitTechnicalData(
    transferParameters: readonly ParserVehicleUnitTransferParameter[],
    nationAlphaCodes: ParserNationAlphaCodes,
    embeddedCardSnapshot: IParserEmbeddedCardSnapshot | null,
): INormalizedVehicleUnitTechnicalData {
    const records: VehicleUnitTechnicalRecord[] = [];
    const warnings: ITachographWarning[] = [];

    for (const [index, parameter] of transferParameters.entries()) {
        if (!overviewTypeIds.has(parameter.typeId) && !technicalTypeIds.has(parameter.typeId)) {
            continue;
        }

        const generation = vehicleUnitTypeIdGeneration(parameter.typeId);
        const dataPath = ['transferResParams', index, 'data'] as const;
        const overview = overviewTypeIds.has(parameter.typeId);
        const dataKey = overview ? 'Control' : 'Calibration';
        if (typeof parameter.data !== 'object') {
            warnings.push(warning('invalidValue', generation, dataPath));
            continue;
        }

        if (overview && 'Control' in parameter.data) {
            const recordPath = [...dataPath, 'Control'];
            const value = parameter.data.Control;
            const isGen1 = 'vehicleIdentificationNumber' in value;
            if ((generation === 'g1') !== isGen1) {
                warnings.push(warning('inconsistentData', generation, recordPath));
                continue;
            }
            const normalized = isGen1
                ? normalizeGen1Overview(value, generation, recordPath, nationAlphaCodes)
                : normalizeGen2Overview(value, generation, recordPath, nationAlphaCodes);
            records.push(...normalized.records);
            warnings.push(...normalized.warnings);
            continue;
        }

        if (!overview && 'Calibration' in parameter.data) {
            const recordPath = [...dataPath, 'Calibration'];
            const value = parameter.data.Calibration;
            const isGen1 = 'identification' in value;
            if ((generation === 'g1') !== isGen1) {
                warnings.push(warning('inconsistentData', generation, recordPath));
                continue;
            }
            const normalized = isGen1
                ? normalizeGen1Technical(value, parameter.typeId, generation, recordPath, nationAlphaCodes)
                : normalizeGen2Technical(value, generation, recordPath, nationAlphaCodes);
            records.push(...normalized.records);
            warnings.push(...normalized.warnings);
            continue;
        }

        warnings.push(warning('invalidValue', generation, [...dataPath, dataKey]));
    }

    const snapshot = normalizeEmbeddedCardSnapshotRecords(embeddedCardSnapshot, nationAlphaCodes);
    records.push(...snapshot.records);
    warnings.push(...snapshot.warnings);

    return {
        records: records,
        warnings: warnings,
    };
}
