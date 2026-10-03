import { describe, expect, it } from 'vitest';

import type {
    Gen1VuEvents,
    Gen1VuTimeAdjustmentRecord,
    Gen2VUEvents,
    Gen2VuTimeAdjustmentRecord,
} from '../generated/esm_parser.js';
import type {
    ParserGen1VehicleUnitTransferParameter,
    ParserGen2VehicleUnitTransferParameter,
} from '../decoders/parser-result-types.js';
import { decodeParserNationAlphaCodes, type ParserNationAlphaCodes } from '../normalizers/parser-value-normalizer.js';
import { fullCardNumber } from './parser-fixtures.js';
import { normalizeVehicleUnitTimeAdjustments } from '../vehicle-unit/vehicle-unit-time-adjustments-normalizer.js';

function nationAlphaCodes(): ParserNationAlphaCodes {
    const decoded = decodeParserNationAlphaCodes({
        Germany: 'D',
    });
    if (!decoded.ok) {
        throw new TypeError('The time-adjustment nation fixture must be valid.');
    }
    return decoded.value;
}

const nations = nationAlphaCodes();

function gen1Adjustment(overrides: Partial<Gen1VuTimeAdjustmentRecord> = {}): Gen1VuTimeAdjustmentRecord {
    return {
        newTimeValue: '2026-05-11 09:00:00 UTC',
        oldTimeValue: '2026-05-11 08:00:00 UTC',
        workshopAddress: 'Synthetic street 4',
        workshopCardNumber: fullCardNumber(),
        workshopName: 'Synthetic workshop',
        ...overrides,
    };
}

function gen1Events(records: Gen1VuTimeAdjustmentRecord[]): Gen1VuEvents {
    return {
        signature: null,
        vuEventData: {
            noOfVuEvents: 0,
            vuEventRecords: [],
        },
        vuFaultData: {
            noOfVuFaults: 0,
            vuFaultRecords: [],
        },
        vuOverSpeedingControlData: {
            firstOverspeedSince: null,
            lastOverspeedControlTime: null,
            numberOfOverspeedSince: 0,
        },
        vuOverSpeedingEventData: {
            noOfVuOverSpeedingEvents: 0,
            vuOverSpeedingEventRecords: [],
        },
        vuTimeAdjustmentData: {
            noOfVuTimeAdjRecords: records.length,
            vuTimeAdjustmentRecords: records,
        },
    };
}

function gen2Adjustment(overrides: Partial<Gen2VuTimeAdjustmentRecord> = {}): Gen2VuTimeAdjustmentRecord {
    return {
        newTimeValue: '2026-06-01 07:00:00 UTC',
        oldTimeValue: '2026-06-01 06:00:00 UTC',
        workshopAddress: 'Synthetic street 5',
        workshopCardNumberAndGeneration: {
            fullcardNumber: fullCardNumber(),
            generation: 2,
        },
        workshopName: 'Synthetic Gen2 workshop',
        ...overrides,
    };
}

function gen2Events(records: Gen2VuTimeAdjustmentRecord[]): Gen2VUEvents {
    return {
        signatureRecordArray: null,
        vuEventRecordArray: {
            noOfRecords: 0,
            recordSize: 0,
            recordType: 'VuEventRecord',
            records: [],
        },
        vuFaultRecordArray: {
            noOfRecords: 0,
            recordSize: 0,
            recordType: 'VuFaultRecord',
            records: [],
        },
        vuOverSpeedingControlDataRecordArray: {
            noOfRecords: 0,
            recordSize: 0,
            recordType: 'VuOverSpeedingControlData',
            records: [],
        },
        VuOverSpeedingEventRecordArray: {
            noOfRecords: 0,
            recordSize: 0,
            recordType: 'VuOverSpeedingEventRecord',
            records: [],
        },
        vuTimeAdjustmentRecordArray: {
            noOfRecords: records.length,
            recordSize: 100,
            recordType: 'VuTimeAdjustmentRecord',
            records,
        },
    };
}

describe('normalizeVehicleUnitTimeAdjustments', () => {
    it('normalizes Gen1 time adjustment records with canonical source evidence', () => {
        const parameter: ParserGen1VehicleUnitTransferParameter = {
            data: {
                Events: gen1Events([gen1Adjustment()]),
            },
            position: 0,
            typeId: 'EventsAndFaults',
        };
        const raw = {
            transferResParams: [parameter],
        };

        const result = normalizeVehicleUnitTimeAdjustments([parameter], 'vuGen1', nations);

        expect(result.warnings).toEqual([]);
        expect(result.records).toMatchObject([
            {
                generation: 'g1',
                kind: 'vehicleUnitTimeAdjustmentTechnicalRecord',
                newTime: Date.parse('2026-05-11T09:00:00Z'),
                oldTime: Date.parse('2026-05-11T08:00:00Z'),
                workshopAddress: 'Synthetic street 4',
                workshopCard: {
                    cardNumber: 'SYNTHETIC0000001',
                },
                workshopName: 'Synthetic workshop',
            },
        ]);
        for (const record of result.records) {
            expect(record.source.path).toMatch(
                /^\/transferResParams\/0\/data\/Events\/vuTimeAdjustmentData\/vuTimeAdjustmentRecords\/0$/u,
            );
        }
        expect(raw).toBeDefined();
    });

    it('normalizes Gen2 time adjustment records from the record array', () => {
        const parameter: ParserGen2VehicleUnitTransferParameter = {
            data: {
                Events: gen2Events([gen2Adjustment()]),
            },
            position: 0,
            typeId: 'Gen2EventsAndFaults',
        };

        const result = normalizeVehicleUnitTimeAdjustments([parameter], 'vuGen2', nations);

        expect(result.warnings).toEqual([]);
        expect(result.records).toMatchObject([
            {
                generation: 'g2',
                kind: 'vehicleUnitTimeAdjustmentTechnicalRecord',
                newTime: Date.parse('2026-06-01T07:00:00Z'),
                oldTime: Date.parse('2026-06-01T06:00:00Z'),
                workshopAddress: 'Synthetic street 5',
                workshopCard: {
                    cardNumber: 'SYNTHETIC0000001',
                },
                workshopName: 'Synthetic Gen2 workshop',
            },
        ]);
    });

    it('skips Gen1 time adjustment records with invalid timestamps and warns', () => {
        const parameter: ParserGen1VehicleUnitTransferParameter = {
            data: {
                Events: gen1Events([
                    gen1Adjustment({
                        newTimeValue: null,
                    }),
                ]),
            },
            position: 0,
            typeId: 'EventsAndFaults',
        };

        const result = normalizeVehicleUnitTimeAdjustments([parameter], 'vuGen1', nations);

        expect(result.records).toHaveLength(0);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]?.code).toBe('invalidValue');
    });
});
