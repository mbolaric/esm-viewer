import { describe, expect, it } from 'vitest';

import type { Gen1VUActivity, Gen2VUActivity } from '../generated/esm_parser.js';
import type { IVehicleUnitActivitySection } from '../vehicle-unit/vehicle-unit-activity-normalizer.js';
import { normalizeVehicleUnitDailyOdometerRecords } from '../vehicle-unit/vehicle-unit-daily-odometer-normalizer.js';

function gen1Activity(overrides: Partial<Gen1VUActivity> = {}): Gen1VUActivity {
    return {
        dateOfDayDownloaded: '2024-06-01 23:59:59 UTC',
        odometerValueMidnight: 1_000,
        signature: null,
        vuActivityDailyData: { activityChangeInfos: [], noOfActivityChanges: 0 },
        vuCardIWData: { no_of_iw_records: 0, vu_card_iw_records: [] },
        vuPlaceDailyWorkPeriodData: { noOfPlaceRecords: 0, vuPlaceDailyWorkPeriodRecords: [] },
        vuSpecificConditionData: { noOfSpecificConditionRecords: 0, specificConditionRecords: [] },
        ...overrides,
    };
}

function gen2Activity(overrides: Partial<Gen2VUActivity> = {}): Gen2VUActivity {
    return {
        dateOfDayDownloadedRecordArray: {
            noOfRecords: 1,
            recordSize: 4,
            recordType: 'DateOfDayDownloaded',
            records: ['2024-06-01 23:59:59 UTC'],
        },
        odometerValueMidnightRecordArray: {
            noOfRecords: 1,
            recordSize: 3,
            recordType: 'OdometerValueMidnight',
            records: [1_000],
        },
        signatureRecordArray: null,
        vuActivityDailyRecordArray: {
            noOfRecords: 0,
            recordSize: 2,
            recordType: 'ActivityChangeInfo',
            records: [],
        },
        vuCardIWRecordArray: {
            noOfRecords: 0,
            recordSize: 131,
            recordType: 'VuCardIWRecord',
            records: [],
        },
        vuGnssadRecordArray: {
            noOfRecords: 0,
            recordSize: 56,
            recordType: 'VuGNSSADRecord',
            records: [],
        },
        vuPlaceDailyWorkPeriodRecordArray: {
            isGen2V2: false,
            noOfRecords: 0,
            recordSize: 40,
            recordType: 'VuPlaceDailyWorkPeriodRecord',
            records: [],
        },
        vuSpecificConditionRecordArray: {
            noOfRecords: 0,
            recordSize: 5,
            recordType: 'SpecificConditionRecord',
            records: [],
        },
        ...overrides,
    };
}

const rootPath = ['transferResParams', 0, 'data', 'Activity'] as const;

function gen1Section(activity: Gen1VUActivity): IVehicleUnitActivitySection {
    return { activity, generation: 'g1', rootPath };
}

function gen2Section(activity: Gen2VUActivity): IVehicleUnitActivitySection {
    return { activity, generation: 'g2', rootPath };
}

describe('normalizeVehicleUnitDailyOdometerRecords', () => {
    it('decodes a Gen1 section into one daily odometer record with no warnings', () => {
        const result = normalizeVehicleUnitDailyOdometerRecords([gen1Section(gen1Activity())]);

        expect(result.warnings).toEqual([]);
        expect(result.records).toHaveLength(1);
        expect(result.records[0]).toMatchObject({
            generation: 'g1',
            kind: 'vehicleUnitDailyOdometerTechnicalRecord',
            odometerKm: 1_000,
        });
    });

    it('drops the record and warns when the Gen1 day timestamp is invalid', () => {
        const result = normalizeVehicleUnitDailyOdometerRecords([
            gen1Section(gen1Activity({ dateOfDayDownloaded: 'not-a-timestamp' })),
        ]);

        expect(result.records).toEqual([]);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toMatchObject({ code: 'invalidValue' });
    });

    it('keeps the record with a null odometer and warns when the Gen1 odometer value is out of range', () => {
        const result = normalizeVehicleUnitDailyOdometerRecords([gen1Section(gen1Activity({ odometerValueMidnight: -1 }))]);

        expect(result.records).toHaveLength(1);
        expect(result.records[0]?.odometerKm).toBeNull();
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toMatchObject({ code: 'invalidValue' });
    });

    it('keeps the record with a null odometer and does not warn when the Gen1 odometer value is legitimately absent', () => {
        const result = normalizeVehicleUnitDailyOdometerRecords([gen1Section(gen1Activity({ odometerValueMidnight: null }))]);

        expect(result.records).toHaveLength(1);
        expect(result.records[0]?.odometerKm).toBeNull();
        expect(result.warnings).toEqual([]);
    });

    it('decodes a Gen2 section into one daily odometer record with no warnings', () => {
        const result = normalizeVehicleUnitDailyOdometerRecords([gen2Section(gen2Activity())]);

        expect(result.warnings).toEqual([]);
        expect(result.records).toHaveLength(1);
        expect(result.records[0]).toMatchObject({
            generation: 'g2',
            kind: 'vehicleUnitDailyOdometerTechnicalRecord',
            odometerKm: 1_000,
        });
    });

    it('drops the record and warns when the Gen2 day record array is malformed', () => {
        const result = normalizeVehicleUnitDailyOdometerRecords([
            gen2Section(
                gen2Activity({
                    dateOfDayDownloadedRecordArray: {
                        noOfRecords: 0,
                        recordSize: 4,
                        recordType: 'DateOfDayDownloaded',
                        records: [],
                    },
                }),
            ),
        ]);

        expect(result.records).toEqual([]);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toMatchObject({ code: 'inconsistentData' });
    });

    it('keeps the record with a null odometer and warns when the Gen2 odometer record array is malformed, without dropping the valid day', () => {
        const result = normalizeVehicleUnitDailyOdometerRecords([
            gen2Section(
                gen2Activity({
                    odometerValueMidnightRecordArray: {
                        noOfRecords: 2,
                        recordSize: 3,
                        recordType: 'OdometerValueMidnight',
                        records: [1_000, 1_001],
                    },
                }),
            ),
        ]);

        expect(result.records).toHaveLength(1);
        expect(result.records[0]?.odometerKm).toBeNull();
        expect(result.records[0]?.day).not.toBeNull();
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toMatchObject({ code: 'inconsistentData' });
    });

    it('aggregates records and warnings across multiple sections', () => {
        const result = normalizeVehicleUnitDailyOdometerRecords([
            gen1Section(gen1Activity()),
            gen1Section(gen1Activity({ dateOfDayDownloaded: 'not-a-timestamp' })),
            gen2Section(
                gen2Activity({
                    odometerValueMidnightRecordArray: {
                        noOfRecords: 1,
                        recordSize: 3,
                        recordType: 'OdometerValueMidnight',
                        records: [2_000],
                    },
                }),
            ),
        ]);

        expect(result.records).toHaveLength(2);
        expect(result.warnings).toHaveLength(1);
    });

    it('returns no records for an empty section list', () => {
        const result = normalizeVehicleUnitDailyOdometerRecords([]);

        expect(result.records).toEqual([]);
        expect(result.warnings).toEqual([]);
    });
});
