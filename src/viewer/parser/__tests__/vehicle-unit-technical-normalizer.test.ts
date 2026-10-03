import { describe, expect, it } from 'vitest';

import { resolveJsonPointer } from '#viewer-application';
import { isBoundaryRecord } from '#contracts';

import type {
    CardIdentification,
    CardSlotStatus,
    FullCardNumber,
    Gen1VUIdentification,
    Gen1VuOverview,
    Gen1VuCalibrationRecord,
    Gen2DataInfoGenericRecordArray,
    Gen2VUOverview,
    Gen2VUTechnicalData,
    Gen2VuCalibrationRecord,
    Gen2VuCardRecord,
    Gen2VuIdentification,
    Gen2VuItsConsentRecord,
    Gen2VuPowerSupplyInterruptionRecord,
    RecordType,
} from '../generated/esm_parser.js';
import type {
    ParserGen1VehicleUnitTransferParameter,
    ParserGen2VehicleUnitTransferParameter,
} from '../decoders/parser-result-types.js';
import { decodeParserNationAlphaCodes, type ParserNationAlphaCodes } from '../normalizers/parser-value-normalizer.js';
import { normalizeVehicleUnitTechnicalData } from '../vehicle-unit/vehicle-unit-technical-normalizer.js';
import type {
    IParserEmbeddedCardSnapshot,
    IParserEmbeddedCardSnapshotApplication,
    ParserCardApplication,
} from '../decoders/parser-result-types.js';
import type { ParsedCardType } from '#viewer-application';
import type { TachographGeneration } from '#viewer-domain';
import { gen1CompanyCard, gen1DriverCard, gen2DriverCard } from './parser-fixtures.js';

function nationAlphaCodes(): ParserNationAlphaCodes {
    const decoded = decodeParserNationAlphaCodes({
        Germany: 'D',
    });
    if (!decoded.ok) {
        throw new TypeError('The technical normalizer nation fixture must be valid.');
    }
    return decoded.value;
}

const nations = nationAlphaCodes();

function fullCardNumber(): FullCardNumber {
    return {
        cardIssuingMemberState: 'Germany',
        cardNumber: 'SYNTHETIC0000001',
        cardType: 'WorkshopCard',
    };
}

function gen1Overview(
    cardSlotStatus: CardSlotStatus = { coDriverSlot: 'Unknown', data: 0, driverSlot: 'Unknown' },
): Gen1VuOverview {
    return {
        cardSlotStatus,
        currentDateTime: '2025-01-01 08:00:00 UTC',
        memberStateCertificate: [],
        signature: null,
        vehicleIdentificationNumber: 'WVWZZZ1JZXW000001',
        vehicleRegistrationIdentification: {
            vehicleRegistrationNation: 'Germany',
            vehicleRegistrationNumber: 'TEST-123',
        },
        vuCertificate: [],
        vuCompanyLocksData: {
            company_locks: [],
            no_of_locks: 0,
        },
        vuControlActivity: {
            noOfControls: 0,
            vuControlActivities: [],
        },
        vuDownloadActivityData: {
            companyOrWorkshopName: 'Synthetic workshop',
            downloadingTime: '2026-06-18 11:00:00 UTC',
            fullCardNumber: fullCardNumber(),
        },
        vuDownloadablePeriod: {
            maxDownloadableTime: '2026-06-18 10:00:00 UTC',
            minDownloadableTime: '2026-06-01 00:00:00 UTC',
        },
    };
}

function gen1Calibration(): Gen1VuCalibrationRecord {
    return {
        authorisedSpeed: 90,
        calibrationPurpose: 'PeriodicInspection',
        kConstantOfRecordingEquipment: 8_000,
        lTyreCircumference: 3_150,
        newOdometerValue: 125_100,
        newTimeValue: '2026-06-18 10:00:00 UTC',
        nextCalibrationDate: '2028-06-18 00:00:00 UTC',
        oldOdometerValue: 125_000,
        oldTimeValue: '2026-06-18 09:58:00 UTC',
        tyreSize: '315/70 R22.5',
        vehicleIdentificationNumber: 'WVWZZZ1JZXW000001',
        vehicleRegistrationIdentification: {
            vehicleRegistrationNation: 'Germany',
            vehicleRegistrationNumber: 'TEST-123',
        },
        wVehicleCharacteristicConstant: 8_100,
        workshopAddress: 'Synthetic street 1',
        workshopCardExpiryDate: '2030-01-02 00:00:00 UTC',
        workshopCardNumber: fullCardNumber(),
        workshopName: 'Synthetic workshop',
    };
}

function gen2Calibration(): Gen2VuCalibrationRecord {
    return {
        ...gen1Calibration(),
        isGen2V2: true,
        sealDataVu: {
            sealRecords: [],
        },
    };
}

function gen1Identification(): Gen1VUIdentification {
    return {
        vuApprovalNumber: 'APPROVAL',
        vuManufacturerAddress: 'Synthetic street 2',
        vuManufacturerName: 'Synthetic VU',
        vuManufacturingDate: '2026-05-10 08:00:00 UTC',
        vuPartNumber: 'VU-2000',
        vuSerialNumber: {
            manufacturerCode: 32,
            monthYear: '0526',
            serialNumber: 123_456,
            type: 1,
        },
        vuSoftwareIdentification: {
            vuSoftInstallationDate: '2026-05-11 08:00:00 UTC',
            vuSoftwareVersion: '4.3',
        },
    };
}

function gen2Identification(): Gen2VuIdentification {
    return {
        ...gen1Identification(),
        isGen2V2: true,
        vuAbility: 2,
        vuGeneration: 2,
    };
}

function recordArray<TRecord>(
    recordType: RecordType,
    records: TRecord[],
    recordSize = 100,
): Gen2DataInfoGenericRecordArray<TRecord> {
    return {
        noOfRecords: records.length,
        recordSize,
        recordType,
        records,
    };
}

function gen2Overview(): Gen2VUOverview {
    return {
        CurrentDateTimeRecordArray: recordArray('CurrentDateTime', []),
        cardSlotsStatusRecordArray: recordArray('CardSlotStatus', []),
        memberStateCertificateRaw: [],
        memberStateCertificateRecordArray: recordArray('MemberStateCertificate', []),
        signatureRecordArray: recordArray('Signature', []),
        trepId: 'Gen2v2Overview',
        vehicleIdentificationNumberRecordArray: recordArray('VehicleIdentificationNumber', []),
        vehicleRegistrationNumberRecordArray: recordArray('VehicleRegistrationNumber', []),
        vuCertificateRaw: [],
        vuCertificateRecordArray: recordArray('VuCertificate', []),
        vuCompanyLocksRecordArray: recordArray('VuCompanyLocksRecord', []),
        vuControlActivityRecordArray: recordArray('VuControlActivityRecord', []),
        vuDownloadActivityDataRecordArray: recordArray('VuDownloadActivityData', [
            {
                companyOrWorkshopName: 'Synthetic workshop',
                downloadingTime: '2026-06-18 11:00:00 UTC',
                fullCardNumberAndGeneration: {
                    fullcardNumber: fullCardNumber(),
                    generation: 2,
                },
            },
        ]),
        vuDownloadablePeriodRecordArray: recordArray('VuDownloadablePeriod', [
            {
                maxDownloadableTime: '2026-06-18 10:00:00 UTC',
                minDownloadableTime: '2026-06-01 00:00:00 UTC',
            },
            {
                maxDownloadableTime: '2026-06-01 00:00:00 UTC',
                minDownloadableTime: '2026-06-18 10:00:00 UTC',
            },
        ]),
    };
}

function gen2Technical(): Gen2VUTechnicalData {
    return {
        signatureRecordArray: null,
        vuCalibrationRecordArray: recordArray('VuCalibrationRecord', [gen2Calibration()]),
        vuCardRecordArray: recordArray('VuCardRecord', []),
        vuIdentificationRecordArray: recordArray('VuIdentification', [gen2Identification()]),
        vuItsConsentRecordArray: recordArray('VuITSConsentRecord', []),
        vuPowerSupplyInterruptionRecordArray: recordArray('VuPowerSupplyInterruptionRecord', []),
        vuSensorExternalGnssCoupledRecordArray: recordArray('SensorExternalGNSSCoupledRecord', []),
        vuSensorPairedRecordArray: recordArray('SensorPairedRecord', []),
    };
}

function powerSupplyInterruptionRecord(similarEvents = 1): Gen2VuPowerSupplyInterruptionRecord {
    return {
        cardNumberAndGenCodriverSlotBegin: { fullcardNumber: fullCardNumber(), generation: 2 },
        cardNumberAndGenCodriverSlotEnd: { fullcardNumber: fullCardNumber(), generation: 2 },
        cardNumberAndGenDriverSlotBegin: { fullcardNumber: fullCardNumber(), generation: 2 },
        cardNumberAndGenDriverSlotEnd: { fullcardNumber: fullCardNumber(), generation: 2 },
        eventBeginTime: '2026-06-16 10:00:00 UTC',
        eventEndTime: '2026-06-16 11:00:00 UTC',
        eventRecordPurpose: 'OneOf10MostRecentOrLast',
        eventType: 'PowerSupplyInterruption',
        similarEventsNumber: similarEvents,
    };
}

function itsConsentRecord(consent = true): Gen2VuItsConsentRecord {
    return {
        cardNumberAndGen: {
            fullcardNumber: {
                cardIssuingMemberState: 'Germany',
                cardNumber: 'SYNTHETIC0000007',
                cardType: 'DriverCard',
            },
            generation: 2,
        },
        consent,
    };
}

function embeddedCardRecord(structureVersion = 2): Gen2VuCardRecord {
    return {
        cardExtendedSerialNumber: {
            manufacturerCode: 34,
            monthYear: '0526',
            serialNumber: 654_323,
            type: 4,
        },
        cardNumber: {
            cardConsecutiveindex: '',
            cardIssuingMemberState: 'DriverCard',
            cardReplacementindex: '',
            cardRenewalindex: '',
            identification: '',
            number: 'SYNTHETIC0006',
        },
        cardNumberAndGenerationInformation: {
            fullcardNumber: {
                cardIssuingMemberState: 'Germany',
                cardNumber: 'SYNTHETIC0000006',
                cardType: 'DriverCard',
            },
            generation: 2,
        },
        cardStructureVersion: {
            dataElementUseVersion: 1,
            structureVersion,
        },
    };
}

describe('normalizeVehicleUnitTechnicalData', () => {
    it('normalizes Gen1 identification and calibration with canonical source evidence', () => {
        const parameter: ParserGen1VehicleUnitTransferParameter = {
            data: {
                Calibration: {
                    identification: gen1Identification(),
                    sensorPaired: {
                        sensorApprovalNumber: 'SENSOR',
                        sensorPairingDateFirst: '2026-05-11 08:00:00 UTC',
                        sensorSerialNumber: {
                            manufacturerCode: 32,
                            monthYear: '0526',
                            serialNumber: 654_321,
                            type: 2,
                        },
                    },
                    signature: [],
                    trepId: 'TechnicalData',
                    vuCalibrationData: {
                        calibrations: [gen1Calibration()],
                        no_of_vu_calibrations: 1,
                    },
                },
            },
            position: 0,
            typeId: 'TechnicalData',
        };
        const raw = {
            transferResParams: [parameter],
        };
        const result = normalizeVehicleUnitTechnicalData(raw.transferResParams, nations, null);

        expect(result.warnings).toEqual([]);
        expect(result.records).toMatchObject([
            {
                generation: 'g1',
                kind: 'vehicleUnitIdentificationTechnicalRecord',
                manufacturerName: 'Synthetic VU',
                softwareVersion: '4.3',
            },
            {
                generation: 'g1',
                kind: 'vehicleUnitSensorPairedTechnicalRecord',
                pairedAt: Date.UTC(2026, 4, 11, 8),
                sensorApprovalNumber: 'SENSOR',
                sensorSerialNumber: {
                    manufacturerCode: 32,
                    monthYear: '0526',
                    serialNumber: 654_321,
                    type: 2,
                },
            },
            {
                calibratedAt: Date.UTC(2026, 5, 18, 10),
                generation: 'g1',
                kind: 'vehicleUnitCalibrationTechnicalRecord',
                purpose: 'periodicInspection',
                registrationMemberState: 'D',
                registrationNumber: 'TEST-123',
                workshopCard: {
                    cardNumber: 'SYNTHETIC0000001',
                    cardType: 'workshopCard',
                    issuingMemberState: 'D',
                },
            },
        ]);
        if (!isBoundaryRecord(raw)) {
            throw new TypeError('The technical fixture must be bounded JSON.');
        }
        for (const record of result.records) {
            expect(resolveJsonPointer(raw, record.source.path).ok).toBe(true);
        }
    });

    it('normalizes Gen2v2 record arrays and rejects an inverted download period', () => {
        const parameters: ParserGen2VehicleUnitTransferParameter[] = [
            {
                data: {
                    Control: gen2Overview(),
                },
                position: 0,
                typeId: 'Gen2v2Overview',
            },
            {
                data: {
                    Calibration: gen2Technical(),
                },
                position: 1,
                typeId: 'Gen2v2TechnicalData',
            },
        ];
        const result = normalizeVehicleUnitTechnicalData(parameters, nations, null);

        expect(result.records.map((record) => record.kind)).toEqual([
            'vehicleUnitDownloadPeriodTechnicalRecord',
            'vehicleUnitDownloadActivityTechnicalRecord',
            'vehicleUnitIdentificationTechnicalRecord',
            'vehicleUnitCalibrationTechnicalRecord',
        ]);
        expect(result.warnings).toEqual([
            {
                code: 'inconsistentData',
                source: {
                    documentKind: 'vehicleUnit',
                    generation: 'g2v2',
                    path: '/transferResParams/0/data/Control/vuDownloadablePeriodRecordArray/records/1',
                },
            },
        ]);
    });

    it('normalizes Gen2 sensor-paired record arrays with canonical source evidence', () => {
        const parameters: ParserGen2VehicleUnitTransferParameter[] = [
            {
                data: {
                    Calibration: {
                        ...gen2Technical(),
                        vuSensorPairedRecordArray: recordArray('SensorPairedRecord', [
                            {
                                sensorApprovalNumber: 'SENSOR-G2',
                                sensorPairingDate: '2026-06-01 06:00:00 UTC',
                                sensorSerialNumber: {
                                    manufacturerCode: 33,
                                    monthYear: '0426',
                                    serialNumber: 987_654,
                                    type: 3,
                                },
                            },
                        ]),
                    },
                },
                position: 0,
                typeId: 'Gen2v2TechnicalData',
            },
        ];
        const raw = {
            transferResParams: parameters,
        };
        const result = normalizeVehicleUnitTechnicalData(parameters, nations, null);

        expect(result.warnings).toEqual([]);
        const sensorPaired = result.records.find((record) => record.kind === 'vehicleUnitSensorPairedTechnicalRecord');
        expect(sensorPaired).toMatchObject({
            generation: 'g2v2',
            pairedAt: Date.UTC(2026, 5, 1, 6),
            sensorApprovalNumber: 'SENSOR-G2',
            sensorSerialNumber: {
                manufacturerCode: 33,
                monthYear: '0426',
                serialNumber: 987_654,
                type: 3,
            },
        });
        if (!isBoundaryRecord(raw)) {
            throw new TypeError('The technical fixture must be bounded JSON.');
        }
        for (const record of result.records) {
            expect(resolveJsonPointer(raw, record.source.path).ok).toBe(true);
        }
    });

    it('skips Gen1 sensor pairing with an invalid serial number and warns', () => {
        const parameter: ParserGen1VehicleUnitTransferParameter = {
            data: {
                Calibration: {
                    identification: gen1Identification(),
                    sensorPaired: {
                        sensorApprovalNumber: 'SENSOR',
                        sensorPairingDateFirst: '2026-05-11 08:00:00 UTC',
                        sensorSerialNumber: {
                            manufacturerCode: 32,
                            monthYear: 'bad',
                            serialNumber: 654_321,
                            type: 2,
                        },
                    },
                    signature: [],
                    trepId: 'TechnicalData',
                    vuCalibrationData: {
                        calibrations: [],
                        no_of_vu_calibrations: 0,
                    },
                },
            },
            position: 0,
            typeId: 'TechnicalData',
        };
        const result = normalizeVehicleUnitTechnicalData([parameter], nations, null);

        expect(result.records.some((record) => record.kind === 'vehicleUnitSensorPairedTechnicalRecord')).toBe(false);
        expect(result.warnings).toContainEqual({
            code: 'invalidValue',
            source: {
                documentKind: 'vehicleUnit',
                generation: 'g1',
                path: '/transferResParams/0/data/Calibration/sensorPaired/sensorSerialNumber',
            },
        });
    });

    it('normalizes Gen2v2 external GNSS coupling record arrays with canonical source evidence', () => {
        const parameters: ParserGen2VehicleUnitTransferParameter[] = [
            {
                data: {
                    Calibration: {
                        ...gen2Technical(),
                        vuSensorExternalGnssCoupledRecordArray: recordArray('SensorExternalGNSSCoupledRecord', [
                            {
                                sensorApprovalNumber: 'GNSS-APPROVAL',
                                sensorCouplingDate: '2026-06-02 08:00:00 UTC',
                                sensorSerialNumber: {
                                    manufacturerCode: 34,
                                    monthYear: '0626',
                                    serialNumber: 555_555,
                                    type: 4,
                                },
                            },
                        ]),
                    },
                },
                position: 0,
                typeId: 'Gen2v2TechnicalData',
            },
        ];
        const raw = {
            transferResParams: parameters,
        };
        const result = normalizeVehicleUnitTechnicalData(parameters, nations, null);

        expect(result.warnings).toEqual([]);
        const gnssCoupled = result.records.find((record) => record.kind === 'vehicleUnitGnssCoupledTechnicalRecord');
        expect(gnssCoupled).toMatchObject({
            coupledAt: Date.UTC(2026, 5, 2, 8),
            generation: 'g2v2',
            sensorApprovalNumber: 'GNSS-APPROVAL',
            sensorSerialNumber: {
                manufacturerCode: 34,
                monthYear: '0626',
                serialNumber: 555_555,
                type: 4,
            },
        });
        if (!isBoundaryRecord(raw)) {
            throw new TypeError('The technical fixture must be bounded JSON.');
        }
        for (const record of result.records) {
            expect(resolveJsonPointer(raw, record.source.path).ok).toBe(true);
        }
    });

    function createGnssCoupledRecordFixture(sensorCouplingDate: string | null = null): {
        sensorApprovalNumber: string;
        sensorCouplingDate: string | null;
        sensorSerialNumber: {
            manufacturerCode: number;
            monthYear: string;
            serialNumber: number;
            type: number;
        };
    } {
        return {
            sensorApprovalNumber: 'GNSS-APPROVAL',
            sensorCouplingDate,
            sensorSerialNumber: {
                manufacturerCode: 34,
                monthYear: '0626',
                serialNumber: 555_555,
                type: 4,
            },
        };
    }

    it('skips external GNSS coupling records with an invalid coupling date and warns', () => {
        const parameter: ParserGen2VehicleUnitTransferParameter = {
            data: {
                Calibration: {
                    ...gen2Technical(),
                    vuSensorExternalGnssCoupledRecordArray: recordArray('SensorExternalGNSSCoupledRecord', [
                        createGnssCoupledRecordFixture(null),
                    ]),
                },
            },
            position: 0,
            typeId: 'Gen2v2TechnicalData',
        };
        const result = normalizeVehicleUnitTechnicalData([parameter], nations, null);

        expect(result.records.some((record) => record.kind === 'vehicleUnitGnssCoupledTechnicalRecord')).toBe(false);
        expect(result.warnings).toContainEqual({
            code: 'invalidValue',
            source: {
                documentKind: 'vehicleUnit',
                generation: 'g2v2',
                path: '/transferResParams/0/data/Calibration/vuSensorExternalGnssCoupledRecordArray/records/0/sensorCouplingDate',
            },
        });
    });

    it('warns when the external GNSS coupling record array has a mismatched record type', () => {
        const parameter: ParserGen2VehicleUnitTransferParameter = {
            data: {
                Calibration: {
                    ...gen2Technical(),
                    vuSensorExternalGnssCoupledRecordArray: recordArray('SensorPairedRecord', [
                        createGnssCoupledRecordFixture('2026-06-02 08:00:00 UTC'),
                    ]),
                },
            },
            position: 0,
            typeId: 'Gen2v2TechnicalData',
        };
        const result = normalizeVehicleUnitTechnicalData([parameter], nations, null);

        expect(result.records.some((record) => record.kind === 'vehicleUnitGnssCoupledTechnicalRecord')).toBe(false);
        expect(result.warnings).toContainEqual({
            code: 'inconsistentData',
            source: {
                documentKind: 'vehicleUnit',
                generation: 'g2v2',
                path: '/transferResParams/0/data/Calibration/vuSensorExternalGnssCoupledRecordArray',
            },
        });
    });

    it('normalizes Gen2v2 embedded-card identity records with canonical source evidence', () => {
        const parameters: ParserGen2VehicleUnitTransferParameter[] = [
            {
                data: {
                    Calibration: {
                        ...gen2Technical(),
                        vuCardRecordArray: recordArray('VuCardRecord', [embeddedCardRecord()]),
                    },
                },
                position: 0,
                typeId: 'Gen2v2TechnicalData',
            },
        ];
        const raw = {
            transferResParams: parameters,
        };
        const result = normalizeVehicleUnitTechnicalData(parameters, nations, null);

        expect(result.warnings).toEqual([]);
        const embeddedCard = result.records.find((record) => record.kind === 'vehicleUnitEmbeddedCardTechnicalRecord');
        expect(embeddedCard).toMatchObject({
            card: {
                cardNumber: 'SYNTHETIC0000006',
                cardType: 'driverCard',
                issuingMemberState: 'D',
            },
            cardStructureVersion: 2,
            dataElementUseVersion: 1,
            extendedSerialNumber: {
                manufacturerCode: 34,
                monthYear: '0526',
                serialNumber: 654_323,
                type: 4,
            },
            generation: 'g2v2',
        });
        if (!isBoundaryRecord(raw)) {
            throw new TypeError('The technical fixture must be bounded JSON.');
        }
        for (const record of result.records) {
            expect(resolveJsonPointer(raw, record.source.path).ok).toBe(true);
        }
    });

    it('keeps embedded-card records with an invalid structure version and warns', () => {
        const parameter: ParserGen2VehicleUnitTransferParameter = {
            data: {
                Calibration: {
                    ...gen2Technical(),
                    vuCardRecordArray: recordArray('VuCardRecord', [embeddedCardRecord(300)]),
                },
            },
            position: 0,
            typeId: 'Gen2v2TechnicalData',
        };
        const result = normalizeVehicleUnitTechnicalData([parameter], nations, null);

        const embeddedCard = result.records.find((record) => record.kind === 'vehicleUnitEmbeddedCardTechnicalRecord');
        expect(embeddedCard).toMatchObject({
            cardStructureVersion: null,
            dataElementUseVersion: 1,
        });
        expect(result.warnings).toContainEqual({
            code: 'invalidValue',
            source: {
                documentKind: 'vehicleUnit',
                generation: 'g2v2',
                path: '/transferResParams/0/data/Calibration/vuCardRecordArray/records/0/cardStructureVersion/structureVersion',
            },
        });
    });

    it('normalizes Gen2v2 ITS consent records with canonical source evidence', () => {
        const parameters: ParserGen2VehicleUnitTransferParameter[] = [
            {
                data: {
                    Calibration: {
                        ...gen2Technical(),
                        vuItsConsentRecordArray: recordArray('VuITSConsentRecord', [
                            itsConsentRecord(true),
                            itsConsentRecord(false),
                        ]),
                    },
                },
                position: 0,
                typeId: 'Gen2v2TechnicalData',
            },
        ];
        const raw = {
            transferResParams: parameters,
        };
        const result = normalizeVehicleUnitTechnicalData(parameters, nations, null);

        expect(result.warnings).toEqual([]);
        const consents = result.records.filter((record) => record.kind === 'vehicleUnitItsConsentTechnicalRecord');
        expect(consents).toMatchObject([
            {
                card: {
                    cardNumber: 'SYNTHETIC0000007',
                    cardType: 'driverCard',
                    issuingMemberState: 'D',
                },
                consent: true,
                generation: 'g2v2',
            },
            {
                consent: false,
            },
        ]);
        if (!isBoundaryRecord(raw)) {
            throw new TypeError('The technical fixture must be bounded JSON.');
        }
        for (const record of result.records) {
            expect(resolveJsonPointer(raw, record.source.path).ok).toBe(true);
        }
    });

    it('normalizes Gen2v2 power-supply interruption records with canonical source evidence', () => {
        const parameters: ParserGen2VehicleUnitTransferParameter[] = [
            {
                data: {
                    Calibration: {
                        ...gen2Technical(),
                        vuPowerSupplyInterruptionRecordArray: recordArray('VuPowerSupplyInterruptionRecord', [
                            powerSupplyInterruptionRecord(2),
                            powerSupplyInterruptionRecord(),
                        ]),
                    },
                },
                position: 0,
                typeId: 'Gen2v2TechnicalData',
            },
        ];
        const raw = {
            transferResParams: parameters,
        };
        const result = normalizeVehicleUnitTechnicalData(parameters, nations, null);

        expect(result.warnings).toEqual([]);
        const interruptions = result.records.filter(
            (record) => record.kind === 'vehicleUnitPowerSupplyInterruptionTechnicalRecord',
        );
        expect(interruptions).toMatchObject([
            {
                begin: Date.UTC(2026, 5, 16, 10),
                end: Date.UTC(2026, 5, 16, 11),
                generation: 'g2v2',
                similarEvents: 2,
            },
            {
                similarEvents: 1,
            },
        ]);
        if (!isBoundaryRecord(raw)) {
            throw new TypeError('The technical fixture must be bounded JSON.');
        }
        for (const record of result.records) {
            expect(resolveJsonPointer(raw, record.source.path).ok).toBe(true);
        }
    });

    it('drops power-supply interruption records with an invalid similar-events count and warns', () => {
        const parameter: ParserGen2VehicleUnitTransferParameter = {
            data: {
                Calibration: {
                    ...gen2Technical(),
                    vuPowerSupplyInterruptionRecordArray: recordArray('VuPowerSupplyInterruptionRecord', [
                        powerSupplyInterruptionRecord(300),
                    ]),
                },
            },
            position: 0,
            typeId: 'Gen2v2TechnicalData',
        };
        const result = normalizeVehicleUnitTechnicalData([parameter], nations, null);

        expect(result.records.some((record) => record.kind === 'vehicleUnitPowerSupplyInterruptionTechnicalRecord')).toBe(false);
        expect(result.warnings).toContainEqual({
            code: 'invalidValue',
            source: {
                documentKind: 'vehicleUnit',
                generation: 'g2v2',
                path: '/transferResParams/0/data/Calibration/vuPowerSupplyInterruptionRecordArray/records/0',
            },
        });
    });

    it('normalizes Gen1 card-slot status with canonical source evidence', () => {
        const parameter: ParserGen1VehicleUnitTransferParameter = {
            data: {
                Control: gen1Overview({
                    coDriverSlot: 'WorkshopCard',
                    data: 0,
                    driverSlot: 'DriverCard',
                }),
            },
            position: 0,
            typeId: 'Overview',
        };
        const raw = {
            transferResParams: [parameter],
        };
        const result = normalizeVehicleUnitTechnicalData([parameter], nations, null);

        expect(result.warnings).toEqual([]);
        const slotStatus = result.records.find((record) => record.kind === 'vehicleUnitCardSlotStatusTechnicalRecord');
        expect(slotStatus).toMatchObject({
            coDriverSlot: 'workshopCard',
            driverSlot: 'driverCard',
            generation: 'g1',
        });
        if (!isBoundaryRecord(raw)) {
            throw new TypeError('The technical fixture must be bounded JSON.');
        }
        for (const record of result.records) {
            expect(resolveJsonPointer(raw, record.source.path).ok).toBe(true);
        }
    });

    it('normalizes Gen2v2 card-slot status record arrays with canonical source evidence', () => {
        const parameters: ParserGen2VehicleUnitTransferParameter[] = [
            {
                data: {
                    Control: {
                        ...gen2Overview(),
                        cardSlotsStatusRecordArray: recordArray('CardSlotStatus', [
                            {
                                coDriverSlot: 'CompanyCard',
                                data: 0,
                                driverSlot: 'DriverCard',
                            },
                            {
                                coDriverSlot: 'Unknown',
                                data: 0,
                                driverSlot: 'ControlCard',
                            },
                        ]),
                        vuDownloadActivityDataRecordArray: recordArray('VuDownloadActivityData', []),
                        vuDownloadablePeriodRecordArray: recordArray('VuDownloadablePeriod', []),
                    },
                },
                position: 0,
                typeId: 'Gen2v2Overview',
            },
        ];
        const raw = {
            transferResParams: parameters,
        };
        const result = normalizeVehicleUnitTechnicalData(parameters, nations, null);

        expect(result.warnings).toEqual([]);
        const slotStatuses = result.records.filter((record) => record.kind === 'vehicleUnitCardSlotStatusTechnicalRecord');
        expect(slotStatuses).toMatchObject([
            {
                coDriverSlot: 'companyCard',
                driverSlot: 'driverCard',
                generation: 'g2v2',
            },
            {
                coDriverSlot: 'unknown',
                driverSlot: 'controlCard',
            },
        ]);
        if (!isBoundaryRecord(raw)) {
            throw new TypeError('The technical fixture must be bounded JSON.');
        }
        for (const record of result.records) {
            expect(resolveJsonPointer(raw, record.source.path).ok).toBe(true);
        }
    });

    function embeddedCardIdentityParameter(
        cardNumberAndGenerationInformation: Gen2VuCardRecord['cardNumberAndGenerationInformation'],
    ): ParserGen2VehicleUnitTransferParameter {
        return {
            data: {
                Calibration: {
                    ...gen2Technical(),
                    vuCardRecordArray: recordArray('VuCardRecord', [
                        {
                            ...embeddedCardRecord(),
                            cardNumberAndGenerationInformation,
                        },
                    ]),
                },
            },
            position: 0,
            typeId: 'Gen2v2TechnicalData',
        };
    }

    it('keeps unmappable card member states as the raw formatted value without warnings', () => {
        const parameter = embeddedCardIdentityParameter({
            fullcardNumber: {
                cardIssuingMemberState: 'Unknown',
                cardNumber: 'SYNTHETIC0000006',
                cardType: 'DriverCard',
            },
            generation: 2,
        });
        const result = normalizeVehicleUnitTechnicalData([parameter], nations, null);

        expect(result.warnings).toEqual([]);
        const embeddedCard = result.records.find((record) => record.kind === 'vehicleUnitEmbeddedCardTechnicalRecord');
        expect(embeddedCard).toMatchObject({
            card: {
                cardNumber: 'SYNTHETIC0000006',
                cardType: 'driverCard',
                issuingMemberState: 'Unknown',
            },
        });
    });

    it('keeps the empty-card member state absent without warnings', () => {
        const parameter = embeddedCardIdentityParameter({
            fullcardNumber: {
                cardIssuingMemberState: 'Unknown',
                cardNumber: '',
                cardType: 'Unknown',
            },
            generation: 2,
        });
        const result = normalizeVehicleUnitTechnicalData([parameter], nations, null);

        expect(result.warnings).toEqual([]);
        const embeddedCard = result.records.find((record) => record.kind === 'vehicleUnitEmbeddedCardTechnicalRecord');
        expect(embeddedCard).toMatchObject({
            card: null,
            cardStructureVersion: 2,
        });
    });
});

describe('embedded card snapshot normalization', () => {
    function snapshotCardIdentification(overrides: Partial<CardIdentification> = {}): CardIdentification {
        return {
            cardExpiryDate: '2030-01-02 00:00:00 UTC',
            cardIssueDate: '2024-01-02 00:00:00 UTC',
            cardIssuingAuthorityName: 'Synthetic Authority',
            cardIssuingMemberState: 'Germany',
            cardNumber: {
                cardConsecutiveindex: '',
                cardIssuingMemberState: 'DriverCard',
                cardRenewalindex: '1',
                cardReplacementindex: '0',
                identification: 'SYNTHETIC00000',
                number: 'SYNTHETIC0000001',
            },
            cardValidityBegin: '2024-01-02 00:00:00 UTC',
            ...overrides,
        };
    }

    function snapshotApplication(
        value: ParserCardApplication,
        generation: TachographGeneration,
        cardType: ParsedCardType = 'driverCard',
    ): IParserEmbeddedCardSnapshotApplication {
        return {
            cardType,
            generation,
            pathTokens: [
                'transferResParams',
                0,
                'data',
                'CardDownload',
                'card',
                'cardDataResponses',
                generation === 'g1' ? 'gen1' : 'gen2',
            ],
            value,
        };
    }

    function parsedSnapshot(applications: readonly IParserEmbeddedCardSnapshotApplication[]): IParserEmbeddedCardSnapshot {
        return {
            applications,
            generation: 'g2',
            hasSignature: true,
            pathTokens: ['transferResParams', 0, 'data', 'CardDownload', 'card'],
            state: 'parsed',
        };
    }

    it('normalizes a parsed Gen2 driver-card snapshot with holder evidence', () => {
        const snapshot = parsedSnapshot([snapshotApplication(gen2DriverCard(), 'g2')]);
        const result = normalizeVehicleUnitTechnicalData([], nations, snapshot);

        expect(result.warnings).toEqual([]);
        expect(result.records).toHaveLength(1);
        expect(result.records[0]).toMatchObject({
            cardExpiryDate: Date.UTC(2030, 0, 2),
            cardNumber: 'SYNTHETIC0000001',
            cardType: 'driverCard',
            hasSignature: true,
            holderName: 'Alex Example',
            issuingMemberState: 'D',
            kind: 'vehicleUnitEmbeddedCardSnapshotTechnicalRecord',
            snapshotState: 'parsed',
        });
        expect(result.records[0]?.source.path).toBe('/transferResParams/0/data/CardDownload/card/cardDataResponses/gen2');
    });

    it('normalizes combined Gen1 and Gen2 driver-card snapshot applications', () => {
        const snapshot = parsedSnapshot([
            snapshotApplication(gen1DriverCard(), 'g1'),
            snapshotApplication(gen2DriverCard(), 'g2'),
        ]);
        const result = normalizeVehicleUnitTechnicalData([], nations, snapshot);

        expect(result.warnings).toEqual([]);
        expect(result.records).toHaveLength(2);
        expect(result.records.map((record) => record.generation)).toEqual(['g1', 'g2']);
        expect(result.records.map((record) => record.source.path)).toEqual([
            '/transferResParams/0/data/CardDownload/card/cardDataResponses/gen1',
            '/transferResParams/0/data/CardDownload/card/cardDataResponses/gen2',
        ]);
    });

    it('normalizes a company-card snapshot holder name', () => {
        const companyCard = gen1CompanyCard({
            identification: {
                cardIdentification: snapshotCardIdentification(),
                companyCardHolderIdentification: {
                    cardHolderPreferredLanguage: '',
                    companyAddress: 'Example Street 1',
                    companyName: 'ACME Ltd',
                },
            },
        });
        const snapshot = parsedSnapshot([snapshotApplication(companyCard, 'g1', 'companyCard')]);
        const result = normalizeVehicleUnitTechnicalData([], nations, snapshot);

        expect(result.warnings).toEqual([]);
        expect(result.records[0]).toMatchObject({
            cardType: 'companyCard',
            holderName: 'ACME Ltd',
            snapshotState: 'parsed',
        });
    });

    function stateSnapshot(state: 'noCard' | 'unsupported', generation: 'g1' | 'g2'): IParserEmbeddedCardSnapshot {
        return {
            applications: [],
            generation,
            hasSignature: false,
            pathTokens:
                generation === 'g1' ? ['transferResParams', 0, 'data'] : ['transferResParams', 0, 'data', 'CardDownload', 'card'],
            state,
        };
    }

    it('normalizes an unsupported snapshot into an explicit state record', () => {
        const result = normalizeVehicleUnitTechnicalData([], nations, stateSnapshot('unsupported', 'g2'));

        expect(result.warnings).toEqual([]);
        expect(result.records[0]).toMatchObject({
            cardNumber: null,
            cardType: null,
            holderName: null,
            kind: 'vehicleUnitEmbeddedCardSnapshotTechnicalRecord',
            snapshotState: 'unsupported',
        });
    });

    it('normalizes an empty card slot into a noCard state record', () => {
        const result = normalizeVehicleUnitTechnicalData([], nations, stateSnapshot('noCard', 'g2'));

        expect(result.records[0]).toMatchObject({
            snapshotState: 'noCard',
        });
    });

    it('normalizes the Gen1 marker-only snapshot as unsupported', () => {
        const result = normalizeVehicleUnitTechnicalData([], nations, stateSnapshot('unsupported', 'g1'));

        expect(result.records[0]).toMatchObject({
            generation: 'g1',
            snapshotState: 'unsupported',
        });
        expect(result.records[0]?.source.path).toBe('/transferResParams/0/data');
    });

    it('reports invalid snapshot identity values with warnings', () => {
        const invalidCard = gen2DriverCard({
            identification: {
                cardIdentification: snapshotCardIdentification({
                    cardExpiryDate: 'not-a-timestamp',
                    cardNumber: {
                        ...snapshotCardIdentification().cardNumber,
                        number: '!!!',
                    },
                }),
                driverCardHolderIdentification: {
                    cardHolderBirthDate: { day: '01', month: '01', year: '1990' },
                    cardHolderName: { holderFirstNames: 'Alex', holderSurname: 'Example' },
                    cardHolderPreferredLanguage: 'en',
                },
            },
        });
        const snapshot = parsedSnapshot([snapshotApplication(invalidCard, 'g2')]);
        const result = normalizeVehicleUnitTechnicalData([], nations, snapshot);

        expect(result.records[0]).toMatchObject({
            cardExpiryDate: null,
            cardNumber: null,
            cardType: 'driverCard',
            holderName: 'Alex Example',
        });
        expect(result.warnings).toContainEqual({
            code: 'invalidValue',
            source: {
                documentKind: 'vehicleUnit',
                generation: 'g2',
                path: '/transferResParams/0/data/CardDownload/card/cardDataResponses/gen2/identification/cardIdentification/cardNumber/number',
            },
        });
        expect(result.warnings).toContainEqual({
            code: 'invalidValue',
            source: {
                documentKind: 'vehicleUnit',
                generation: 'g2',
                path: '/transferResParams/0/data/CardDownload/card/cardDataResponses/gen2/identification/cardIdentification/cardExpiryDate',
            },
        });
    });

    it('reports a missing snapshot identification as missingValue', () => {
        const snapshot = parsedSnapshot([snapshotApplication(gen2DriverCard({ identification: null }), 'g2')]);
        const result = normalizeVehicleUnitTechnicalData([], nations, snapshot);

        expect(result.records[0]).toMatchObject({
            cardNumber: null,
            cardType: 'driverCard',
            holderName: null,
        });
        expect(result.warnings).toContainEqual({
            code: 'missingValue',
            source: {
                documentKind: 'vehicleUnit',
                generation: 'g2',
                path: '/transferResParams/0/data/CardDownload/card/cardDataResponses/gen2/identification',
            },
        });
    });
});
