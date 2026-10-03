import { describe, expect, it } from 'vitest';

import type {
    Gen1VuControlActivityRecord,
    Gen1VuOverview,
    Gen2VuControlActivityRecord,
    Gen2VUOverview,
} from '../generated/esm_parser.js';
import type {
    ParserGen1VehicleUnitTransferParameter,
    ParserGen2VehicleUnitTransferParameter,
} from '../decoders/parser-result-types.js';
import { decodeParserNationAlphaCodes, type ParserNationAlphaCodes } from '../normalizers/parser-value-normalizer.js';
import { fullCardNumber } from './parser-fixtures.js';
import { normalizeVehicleUnitControlActivity } from '../vehicle-unit/vehicle-unit-control-activity-normalizer.js';

function nationAlphaCodes(): ParserNationAlphaCodes {
    const decoded = decodeParserNationAlphaCodes({
        Germany: 'D',
    });
    if (!decoded.ok) {
        throw new TypeError('The control-activity nation fixture must be valid.');
    }
    return decoded.value;
}

const nations = nationAlphaCodes();

function gen1Overview(controls: Gen1VuControlActivityRecord[]): Gen1VuOverview {
    return {
        cardSlotStatus: {
            coDriverSlot: 'Unknown',
            data: 0,
            driverSlot: 'Unknown',
        },
        currentDateTime: '2025-01-01 08:00:00 UTC',
        memberStateCertificate: [],
        signature: null,
        vehicleIdentificationNumber: 'WVWZZZ1JZXW000001',
        vehicleRegistrationIdentification: {
            vehicleRegistrationNation: 'Spain',
            vehicleRegistrationNumber: '1234ABC',
        },
        vuCertificate: [],
        vuCompanyLocksData: {
            company_locks: [],
            no_of_locks: 0,
        },
        vuControlActivity: {
            noOfControls: controls.length,
            vuControlActivities: controls,
        },
        vuDownloadActivityData: {
            companyOrWorkshopName: '',
            downloadingTime: null,
            fullCardNumber: {
                cardIssuingMemberState: 'Spain',
                cardNumber: '',
                cardType: 'CompanyCard',
            },
        },
        vuDownloadablePeriod: {
            maxDownloadableTime: null,
            minDownloadableTime: null,
        },
    };
}

function gen1Control(overrides: Partial<Gen1VuControlActivityRecord> = {}): Gen1VuControlActivityRecord {
    return {
        controlCardNumber: fullCardNumber(),
        controlTime: '2025-01-01 10:00:00 UTC',
        controlType: 'CardDownloaded',
        downloadPeriodBeginTime: '2024-12-15 00:00:00 UTC',
        downloadPeriodEndTime: '2024-12-20 00:00:00 UTC',
        ...overrides,
    };
}

function gen2Overview(controls: Gen2VuControlActivityRecord[]): Gen2VUOverview {
    return {
        trepId: 'Gen2v2Overview',
        CurrentDateTimeRecordArray: {
            noOfRecords: 1,
            recordSize: 4,
            recordType: 'CurrentDateTime',
            records: ['2025-01-01 08:00:00 UTC'],
        },
        cardSlotsStatusRecordArray: {
            noOfRecords: 1,
            recordSize: 2,
            recordType: 'CardSlotStatus',
            records: [
                {
                    coDriverSlot: 'Unknown',
                    data: 0,
                    driverSlot: 'Unknown',
                },
            ],
        },
        memberStateCertificateRaw: [],
        memberStateCertificateRecordArray: {
            noOfRecords: 0,
            recordSize: 0,
            recordType: 'MemberStateCertificate',
            records: [],
        },
        signatureRecordArray: {
            noOfRecords: 0,
            recordSize: 0,
            recordType: 'Signature',
            records: [],
        },
        vehicleIdentificationNumberRecordArray: {
            noOfRecords: 1,
            recordSize: 17,
            recordType: 'VehicleIdentificationNumber',
            records: ['WVWZZZ1JZXW000001'],
        },
        vehicleRegistrationNumberRecordArray: {
            noOfRecords: 1,
            recordSize: 15,
            recordType: 'VehicleRegistrationNumber',
            records: ['1234ABC'],
        },
        vuCertificateRaw: [],
        vuCertificateRecordArray: {
            noOfRecords: 0,
            recordSize: 0,
            recordType: 'VuCertificate',
            records: [],
        },
        vuCompanyLocksRecordArray: {
            noOfRecords: 0,
            recordSize: 0,
            recordType: 'VuCompanyLocksRecord',
            records: [],
        },
        vuControlActivityRecordArray: {
            noOfRecords: controls.length,
            recordSize: 47,
            recordType: 'VuControlActivityRecord',
            records: controls,
        },
        vuDownloadActivityDataRecordArray: {
            noOfRecords: 1,
            recordSize: 0,
            recordType: 'VuDownloadActivityData',
            records: [
                {
                    companyOrWorkshopName: '',
                    downloadingTime: null,
                    fullCardNumberAndGeneration: {
                        fullcardNumber: fullCardNumber(),
                        generation: 2,
                    },
                },
            ],
        },
        vuDownloadablePeriodRecordArray: {
            noOfRecords: 1,
            recordSize: 8,
            recordType: 'VuDownloadablePeriod',
            records: [
                {
                    maxDownloadableTime: null,
                    minDownloadableTime: null,
                },
            ],
        },
    };
}

function gen2Control(overrides: Partial<Gen2VuControlActivityRecord> = {}): Gen2VuControlActivityRecord {
    return {
        controlCardNumberAndGeneration: {
            fullcardNumber: fullCardNumber(),
            generation: 2,
        },
        controlTime: '2025-01-02 11:00:00 UTC',
        controlType: 'VUDownloaded',
        downloadPeriodBeginTime: '2024-12-21 00:00:00 UTC',
        downloadPeriodEndTime: '2024-12-22 00:00:00 UTC',
        ...overrides,
    };
}

describe('normalizeVehicleUnitControlActivity', () => {
    it('normalizes Gen1 control activity records with canonical source evidence', () => {
        const parameter: ParserGen1VehicleUnitTransferParameter = {
            data: {
                Control: gen1Overview([
                    gen1Control({
                        controlType: 'CalibrationParameters',
                    }),
                ]),
            },
            position: 0,
            typeId: 'Overview',
        };

        const result = normalizeVehicleUnitControlActivity([parameter], nations);

        expect(result.warnings).toHaveLength(0);
        expect(result.records).toHaveLength(1);
        const record = result.records[0];
        expect(record?.kind).toBe('vehicleUnitControlActivityTechnicalRecord');
        if (record?.kind === 'vehicleUnitControlActivityTechnicalRecord') {
            expect(record.controlType).toBe('calibrationParameters');
            expect(record.controlledAt).toBe(1_735_725_600_000);
            expect(record.downloadPeriodBegin).toBe(1_734_220_800_000);
            expect(record.downloadPeriodEnd).toBe(1_734_652_800_000);
            expect(record.controlCard?.cardNumber).toBe('SYNTHETIC0000001');
            expect(record.generation).toBe('g1');
            expect(record.source.path).toMatch(
                /^\/transferResParams\/0\/data\/Control\/vuControlActivity\/vuControlActivities\/0$/u,
            );
        }
    });

    it('normalizes Gen2 control activity records from the record array', () => {
        const parameter: ParserGen2VehicleUnitTransferParameter = {
            data: {
                Control: gen2Overview([
                    gen2Control({
                        controlType: 'PrintingDone',
                    }),
                ]),
            },
            position: 0,
            typeId: 'Gen2Overview',
        };

        const result = normalizeVehicleUnitControlActivity([parameter], nations);

        expect(result.warnings).toHaveLength(0);
        expect(result.records).toHaveLength(1);
        const record = result.records[0];
        expect(record?.kind).toBe('vehicleUnitControlActivityTechnicalRecord');
        if (record?.kind === 'vehicleUnitControlActivityTechnicalRecord') {
            expect(record.controlType).toBe('printingDone');
            expect(record.controlledAt).toBe(1_735_815_600_000);
            expect(record.controlCard?.cardNumber).toBe('SYNTHETIC0000001');
            expect(record.generation).toBe('g2');
            expect(record.source.path).toMatch(
                /^\/transferResParams\/0\/data\/Control\/vuControlActivityRecordArray\/records\/0$/u,
            );
        }
    });

    it('emits invalidValue warnings when the control time is missing', () => {
        const parameter: ParserGen1VehicleUnitTransferParameter = {
            data: {
                Control: gen1Overview([
                    gen1Control({
                        controlTime: null,
                    }),
                ]),
            },
            position: 0,
            typeId: 'Overview',
        };

        const result = normalizeVehicleUnitControlActivity([parameter], nations);

        expect(result.records).toHaveLength(0);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]?.code).toBe('invalidValue');
    });
});
