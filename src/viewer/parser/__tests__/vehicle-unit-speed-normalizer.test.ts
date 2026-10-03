import { describe, expect, it } from 'vitest';

import type {
    ParserGen1VehicleUnitTransferParameter,
    ParserGen2VehicleUnitTransferParameter,
} from '../decoders/parser-result-types.js';
import { normalizeVehicleUnitSpeedData } from '../vehicle-unit/vehicle-unit-speed-normalizer.js';

function speeds(first: number): number[] {
    return Array.from({ length: 60 }, (_, index) => (first + index) % 256);
}

function gen2SpeedParameter(
    blockCount: number,
    minuteOffset: number,
    typeId: 'Gen2Speed' | 'Gen2v2Speed' = 'Gen2Speed',
): ParserGen2VehicleUnitTransferParameter {
    return {
        data: {
            Speed: {
                signatureRecordArray: null,
                vuDetailedSpeedBlockRecordArray: {
                    noOfRecords: blockCount,
                    recordSize: 64,
                    recordType: 'VuDetailedSpeedBlock',
                    records: Array.from({ length: blockCount }, (_, index) => ({
                        speedBlockBeginDate: new Date(Date.UTC(2026, 5, 18, 0, minuteOffset + index))
                            .toISOString()
                            .replace('T', ' ')
                            .replace('.000Z', ' UTC'),
                        speedsPerSecond: speeds(index),
                    })),
                },
            },
        },
        position: 0,
        typeId,
    };
}

function gen1SpeedParameter(speedValues: number[]): ParserGen1VehicleUnitTransferParameter {
    return {
        data: {
            Speed: {
                signature: [],
                vuDetailedSpeedData: {
                    noOfSpeedBlocks: 1,
                    vuDetailedSpeedBlocks: [
                        {
                            speedBlockBeginDate: '2026-06-18 08:42:00 UTC',
                            speedsPerSecond: speedValues,
                        },
                    ],
                },
            },
        },
        position: 0,
        typeId: 'Speed',
    };
}

describe('Vehicle Unit speed normalization', () => {
    it('normalizes Gen1 one-second samples with exact scalar source paths', () => {
        const result = normalizeVehicleUnitSpeedData([gen1SpeedParameter(speeds(30))]);

        expect(result.warnings).toEqual([]);
        expect(result.samples).toHaveLength(60);
        expect(result.samples[0]).toMatchObject({
            recordedAt: Date.UTC(2026, 5, 18, 8, 42),
            source: {
                generation: 'g1',
                path: '/transferResParams/0/data/Speed/vuDetailedSpeedData/vuDetailedSpeedBlocks/0/speedsPerSecond/0',
            },
            speedKilometresPerHour: 30,
        });
        expect(result.samples[59]).toMatchObject({
            recordedAt: Date.UTC(2026, 5, 18, 8, 42, 59),
            speedKilometresPerHour: 89,
        });
    });

    it.each([
        ['Gen2Speed', 'g2'],
        ['Gen2v2Speed', 'g2v2'],
    ] as const)('normalizes %s records', (typeId, generation) => {
        const result = normalizeVehicleUnitSpeedData([
            {
                ...gen2SpeedParameter(1, 540, typeId),
                data: {
                    Speed: {
                        signatureRecordArray: null,
                        vuDetailedSpeedBlockRecordArray: {
                            noOfRecords: 1,
                            recordSize: 64,
                            recordType: 'VuDetailedSpeedBlock',
                            records: [
                                {
                                    speedBlockBeginDate: '2026-06-18 09:00:00 UTC',
                                    speedsPerSecond: speeds(70),
                                },
                            ],
                        },
                    },
                },
            },
        ]);

        expect(result.warnings).toEqual([]);
        expect(result.samples).toHaveLength(60);
        expect(result.samples[0]).toMatchObject({
            source: {
                generation,
                path: '/transferResParams/0/data/Speed/vuDetailedSpeedBlockRecordArray/records/0/speedsPerSecond/0',
            },
            speedKilometresPerHour: 70,
        });
    });

    it('rejects malformed blocks without partially inventing samples', () => {
        const result = normalizeVehicleUnitSpeedData([gen1SpeedParameter([72])]);

        expect(result.samples).toEqual([]);
        expect(result.warnings).toEqual([
            {
                code: 'invalidValue',
                source: {
                    documentKind: 'vehicleUnit',
                    generation: 'g1',
                    path: '/transferResParams/0/data/Speed/vuDetailedSpeedData/vuDetailedSpeedBlocks/0',
                },
            },
        ]);
    });

    it('retains speed data from a response holding more than 24 hours of blocks', () => {
        // Annex 1C 24h is a minimum requirement, not a ceiling; accept >1440 minute blocks.
        const blockCount = 2000;
        const result = normalizeVehicleUnitSpeedData([gen2SpeedParameter(blockCount, 0)]);

        expect(result.warnings).toEqual([]);
        expect(result.samples).toHaveLength(blockCount * 60);
    });

    it('aggregates samples across repeated speed responses without loss', () => {
        const result = normalizeVehicleUnitSpeedData([gen2SpeedParameter(720, 0), gen2SpeedParameter(720, 720)]);

        expect(result.warnings).toEqual([]);
        expect(result.samples).toHaveLength(1_440 * 60);
    });
});
