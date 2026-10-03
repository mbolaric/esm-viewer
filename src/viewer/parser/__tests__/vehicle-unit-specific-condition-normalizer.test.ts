import { describe, expect, it } from 'vitest';

import type { Gen1VUActivity, Gen2VUActivity, SpecificConditionRecord } from '../generated/esm_parser.js';
import type {
    ParserGen1VehicleUnitTransferParameter,
    ParserGen2VehicleUnitTransferParameter,
} from '../decoders/parser-result-types.js';
import { normalizeVehicleUnitSpecificConditions } from '../vehicle-unit/vehicle-unit-specific-condition-normalizer.js';

function gen1Activity(records: SpecificConditionRecord[]): Gen1VUActivity {
    return {
        dateOfDayDownloaded: '2025-01-01 00:00:00 UTC',
        odometerValueMidnight: 0,
        signature: null,
        vuActivityDailyData: {
            activityChangeInfos: [],
            noOfActivityChanges: 0,
        },
        vuCardIWData: {
            no_of_iw_records: 0,
            vu_card_iw_records: [],
        },
        vuPlaceDailyWorkPeriodData: {
            noOfPlaceRecords: 0,
            vuPlaceDailyWorkPeriodRecords: [],
        },
        vuSpecificConditionData: {
            noOfSpecificConditionRecords: records.length,
            specificConditionRecords: records,
        },
    };
}

function gen1Condition(overrides: Partial<SpecificConditionRecord> = {}): SpecificConditionRecord {
    return {
        entryTime: '2025-01-01 06:30:00 UTC',
        specificConditionType: 'FerryTrainCrossing',
        ...overrides,
    };
}

function gen2Activity(records: SpecificConditionRecord[]): Gen2VUActivity {
    return {
        dateOfDayDownloadedRecordArray: {
            noOfRecords: 0,
            recordSize: 0,
            recordType: 'DateOfDayDownloaded',
            records: [],
        },
        odometerValueMidnightRecordArray: {
            noOfRecords: 0,
            recordSize: 0,
            recordType: 'OdometerValueMidnight',
            records: [],
        },
        signatureRecordArray: null,
        vuActivityDailyRecordArray: {
            noOfRecords: 0,
            recordSize: 0,
            recordType: 'ActivityChangeInfo',
            records: [],
        },
        vuCardIWRecordArray: {
            noOfRecords: 0,
            recordSize: 0,
            recordType: 'VuCardIWRecord',
            records: [],
        },
        vuGnssadRecordArray: {
            noOfRecords: 0,
            recordSize: 0,
            recordType: 'VuGNSSADRecord',
            records: [],
        },
        vuPlaceDailyWorkPeriodRecordArray: {
            isGen2V2: false,
            noOfRecords: 0,
            recordSize: 0,
            recordType: 'VuPlaceDailyWorkPeriodRecord',
            records: [],
        },
        vuSpecificConditionRecordArray: {
            noOfRecords: records.length,
            recordSize: 5,
            recordType: 'SpecificConditionRecord',
            records,
        },
    };
}

describe('normalizeVehicleUnitSpecificConditions', () => {
    it('normalizes Gen1 specific-condition records with canonical source evidence', () => {
        const parameter: ParserGen1VehicleUnitTransferParameter = {
            data: {
                Activity: gen1Activity([gen1Condition()]),
            },
            position: 0,
            typeId: 'Activities',
        };

        const result = normalizeVehicleUnitSpecificConditions([parameter], 'g1');

        expect(result.warnings).toEqual([]);
        expect(result.records).toMatchObject([
            {
                conditionType: 'ferryTrainCrossing',
                enteredAt: 1_735_713_000_000,
                generation: 'g1',
                kind: 'vehicleUnitSpecificConditionTechnicalRecord',
            },
        ]);
        for (const record of result.records) {
            expect(record.source.path).toMatch(
                /^\/transferResParams\/0\/data\/Activity\/vuSpecificConditionData\/specificConditionRecords\/0$/u,
            );
        }
    });

    it('normalizes Gen2 specific-condition records from the record array', () => {
        const parameter: ParserGen2VehicleUnitTransferParameter = {
            data: {
                Activity: gen2Activity([
                    gen1Condition({
                        entryTime: '2025-02-01 08:00:00 UTC',
                        specificConditionType: 'OutOfScopeBegin',
                    }),
                ]),
            },
            position: 0,
            typeId: 'Gen2Activities',
        };

        const result = normalizeVehicleUnitSpecificConditions([parameter], 'g2');

        expect(result.warnings).toEqual([]);
        expect(result.records).toMatchObject([
            {
                conditionType: 'outOfScopeBegin',
                enteredAt: 1_738_396_800_000,
                generation: 'g2',
                kind: 'vehicleUnitSpecificConditionTechnicalRecord',
            },
        ]);
    });

    it('skips Gen1 records with invalid entry times and warns', () => {
        const parameter: ParserGen1VehicleUnitTransferParameter = {
            data: {
                Activity: gen1Activity([
                    gen1Condition({
                        entryTime: null,
                    }),
                ]),
            },
            position: 0,
            typeId: 'Activities',
        };

        const result = normalizeVehicleUnitSpecificConditions([parameter], 'g1');

        expect(result.records).toHaveLength(0);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]?.code).toBe('invalidValue');
    });
});
