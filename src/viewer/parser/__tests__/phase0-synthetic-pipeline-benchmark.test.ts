import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { decodeParserDocument } from '../decoders/parser-document-decoder.js';
import type {
    Gen2VUData,
    Gen2VuDownloadablePeriod,
    Gen2VuEventRecord,
    Gen2VuFaultRecord,
    Gen2VuTimeAdjustmentRecord,
    Gen2VUEvents,
    Gen2VUOverview,
    Gen2VUSpeed,
} from '../generated/esm_parser.js';
import type { ParserGen2VehicleUnitTransferParameter } from '../decoders/parser-result-types.js';
import { decodeParserNationAlphaCodes } from '../normalizers/parser-value-normalizer.js';
import { fullCardNumber, recordArray, vehicleUnitHeader } from './parser-fixtures.js';

const speedBlocks = 24 * 60;
const samplesPerBlock = 60;
const eventCount = 240;
const faultCount = 120;
const timeAdjustmentCount = 60;
const downloadPeriodCount = 90;
const downloadActivityCount = 60;
const benchmarkDownloadPeriods: Gen2VuDownloadablePeriod[] = Array.from({ length: downloadPeriodCount }, (_, index) => ({
    maxDownloadableTime: formatUtcDateTime(Date.UTC(2026, 5, 17 + (index % 12), 12)),
    minDownloadableTime: formatUtcDateTime(Date.UTC(2026, 5, 1, 0)),
}));
const benchmarkDownloadActivities = Array.from({ length: downloadActivityCount }, (_, index) => ({
    companyOrWorkshopName: 'Synthetic carrier',
    downloadingTime: formatUtcDateTime(Date.UTC(2026, 5, 2 + (index % 12), 6)),
    fullCardNumberAndGeneration: {
        fullcardNumber: fullCardNumber(),
        generation: 2,
    },
}));

interface IMemorySnapshot {
    readonly arrayBuffersBytes: number;
    readonly externalBytes: number;
    readonly heapUsedBytes: number;
    readonly rssBytes: number;
}

interface IPhase0DecoderReport {
    readonly architecture: string;
    readonly memoryBytes: {
        readonly decodeDelta: IMemorySnapshot;
    };
    readonly nodeVersion: string;
    readonly parser: {
        readonly commit: string;
        readonly version: string;
    };
    readonly payload: {
        readonly downloadActivities: number;
        readonly downloadPeriods: number;
        readonly events: number;
        readonly faults: number;
        readonly jsonBytes: number;
        readonly speedBlocks: number;
        readonly speedSamples: number;
        readonly timeAdjustments: number;
    };
    readonly platform: string;
    readonly reportVersion: 1;
    readonly timingsMs: {
        readonly decode: number;
    };
}

function memorySnapshot(): IMemorySnapshot {
    const memory = process.memoryUsage();

    return {
        arrayBuffersBytes: memory.arrayBuffers,
        externalBytes: memory.external,
        heapUsedBytes: memory.heapUsed,
        rssBytes: memory.rss,
    };
}

function memoryDelta(after: IMemorySnapshot, before: IMemorySnapshot): IMemorySnapshot {
    return {
        arrayBuffersBytes: after.arrayBuffersBytes - before.arrayBuffersBytes,
        externalBytes: after.externalBytes - before.externalBytes,
        heapUsedBytes: after.heapUsedBytes - before.heapUsedBytes,
        rssBytes: after.rssBytes - before.rssBytes,
    };
}

function formatUtcDateTime(milliseconds: number): string {
    return new Date(milliseconds).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
}

function speedsForBlock(blockIndex: number): number[] {
    return Array.from({ length: samplesPerBlock }, (_, sampleIndex) => (blockIndex + sampleIndex * 4) % 251);
}

function benchmarkSpeedParameter(): ParserGen2VehicleUnitTransferParameter {
    const blocks = Array.from({ length: speedBlocks }, (_, blockIndex) => ({
        speedBlockBeginDate: formatUtcDateTime(Date.UTC(2026, 5, 18, 0, blockIndex)),
        speedsPerSecond: speedsForBlock(blockIndex),
    }));
    const speed: Gen2VUSpeed = {
        signatureRecordArray: null,
        vuDetailedSpeedBlockRecordArray: recordArray('VuDetailedSpeedBlock', blocks),
    };

    return {
        data: {
            Speed: speed,
        },
        position: 2,
        typeId: 'Gen2Speed',
    };
}

function benchmarkEventsParameter(): ParserGen2VehicleUnitTransferParameter {
    const cardNumber = fullCardNumber();
    const cardNumberAndGeneration = {
        fullcardNumber: cardNumber,
        generation: 2,
    };
    const events: Gen2VuEventRecord[] = Array.from({ length: eventCount }, (_, index) => ({
        cardNumberAndGenCodriverSlotBegin: cardNumberAndGeneration,
        cardNumberAndGenCodriverSlotEnd: cardNumberAndGeneration,
        cardNumberAndGenDriverSlotBegin: cardNumberAndGeneration,
        cardNumberAndGenDriverSlotEnd: cardNumberAndGeneration,
        eventBeginTime: formatUtcDateTime(Date.UTC(2026, 5, 1 + (index % 12), 8)),
        eventEndTime: formatUtcDateTime(Date.UTC(2026, 5, 1 + (index % 12), 9)),
        eventRecordPurpose: 'OneOf10MostRecentOrLast',
        eventType: 'PowerSupplyInterruption',
        manufacturerSpecificEventFaultData: {
            manufacturerCode: 32,
            manufacturerSpecificErrorCode: [1, 2],
        },
        similarEventsNumber: 2,
    }));
    const faults: Gen2VuFaultRecord[] = Array.from({ length: faultCount }, (_, index) => ({
        cardNumberAndGenCodriverSlotBegin: cardNumberAndGeneration,
        cardNumberAndGenCodriverSlotEnd: cardNumberAndGeneration,
        cardNumberAndGenDriverSlotBegin: cardNumberAndGeneration,
        cardNumberAndGenDriverSlotEnd: cardNumberAndGeneration,
        faultBeginTime: formatUtcDateTime(Date.UTC(2026, 5, 1 + (index % 12), 10)),
        faultEndTime: formatUtcDateTime(Date.UTC(2026, 5, 1 + (index % 12), 11)),
        faultRecordPurpose: 'ActiveEventOrFault',
        faultType: 'REDisplayFault',
        manufacturerSpecificEventFaultData: {
            manufacturerCode: 32,
            manufacturerSpecificErrorCode: [1, 2],
        },
    }));
    const timeAdjustments: Gen2VuTimeAdjustmentRecord[] = Array.from({ length: timeAdjustmentCount }, (_, index) => ({
        newTimeValue: formatUtcDateTime(Date.UTC(2026, 5, 1 + (index % 12), 12)),
        oldTimeValue: formatUtcDateTime(Date.UTC(2026, 5, 1 + (index % 12), 11)),
        workshopAddress: 'Synthetic street 4',
        workshopCardNumberAndGeneration: cardNumberAndGeneration,
        workshopName: 'Synthetic workshop',
    }));
    const eventsData: Gen2VUEvents = {
        signatureRecordArray: null,
        vuEventRecordArray: recordArray('VuEventRecord', events),
        vuFaultRecordArray: recordArray('VuFaultRecord', faults),
        vuOverSpeedingControlDataRecordArray: recordArray('VuOverSpeedingControlData', []),
        VuOverSpeedingEventRecordArray: recordArray('VuOverSpeedingEventRecord', []),
        vuTimeAdjustmentRecordArray: recordArray('VuTimeAdjustmentRecord', timeAdjustments),
    };

    return {
        data: {
            Events: eventsData,
        },
        position: 1,
        typeId: 'Gen2EventsAndFaults',
    };
}

function benchmarkControlParameter(): ParserGen2VehicleUnitTransferParameter {
    const overview: Gen2VUOverview = {
        CurrentDateTimeRecordArray: recordArray('CurrentDateTime', []),
        cardSlotsStatusRecordArray: recordArray('CardSlotStatus', []),
        memberStateCertificateRaw: [],
        memberStateCertificateRecordArray: recordArray('MemberStateCertificate', []),
        signatureRecordArray: recordArray('Signature', []),
        trepId: 'Gen2Overview',
        vehicleIdentificationNumberRecordArray: recordArray('VehicleIdentificationNumber', ['WVWZZZ1JZXW000001']),
        vehicleRegistrationNumberRecordArray: recordArray('VehicleRegistrationNumber', ['TEST-123']),
        vuCertificateRaw: [],
        vuCertificateRecordArray: recordArray('VuCertificate', []),
        vuCompanyLocksRecordArray: recordArray('VuCompanyLocksRecord', []),
        vuControlActivityRecordArray: recordArray('VuControlActivityRecord', []),
        vuDownloadActivityDataRecordArray: recordArray('VuDownloadActivityData', benchmarkDownloadActivities),
        vuDownloadablePeriodRecordArray: recordArray('VuDownloadablePeriod', benchmarkDownloadPeriods),
    };

    return {
        data: {
            Control: overview,
        },
        position: 0,
        typeId: 'Gen2Overview',
    };
}

function createBenchmarkRawTree(): Gen2VUData {
    const parameters: ParserGen2VehicleUnitTransferParameter[] = [
        benchmarkControlParameter(),
        benchmarkEventsParameter(),
        benchmarkSpeedParameter(),
    ];

    return {
        dataFiles: [],
        header: vehicleUnitHeader('SecondGeneration'),
        transferResParams: parameters,
    };
}

describe('Phase 0 synthetic decoder benchmark', () => {
    it('measures representative synthetic decode and memory evidence', async () => {
        const rawTree = createBenchmarkRawTree();
        const nations = decodeParserNationAlphaCodes({
            Germany: 'D',
        });
        if (!nations.ok) {
            throw new Error('The Phase 0 synthetic nation metadata must be valid.');
        }

        const jsonBytes = JSON.stringify(rawTree).length;

        const beforeDecode = memorySnapshot();
        const decodeStartedAt = performance.now();
        const decoded = decodeParserDocument({ data: rawTree, kind: 'vuGen2' }, nations.value);
        const decodeMs = performance.now() - decodeStartedAt;
        const decodeDelta = memoryDelta(memorySnapshot(), beforeDecode);

        expect(decoded.ok).toBe(true);
        if (!decoded.ok || decoded.value.documentKind !== 'vehicleUnit') {
            return;
        }
        expect(decoded.value.detailedSpeedSamples).toHaveLength(speedBlocks * samplesPerBlock);
        expect(decoded.value.events).toHaveLength(eventCount);
        expect(decoded.value.faults).toHaveLength(faultCount);

        const report: IPhase0DecoderReport = {
            architecture: process.arch,
            memoryBytes: {
                decodeDelta,
            },
            nodeVersion: process.versions.node,
            parser: {
                commit: 'synthetic',
                version: 'benchmark',
            },
            payload: {
                downloadActivities: benchmarkDownloadActivities.length,
                downloadPeriods: benchmarkDownloadPeriods.length,
                events: eventCount,
                faults: faultCount,
                jsonBytes,
                speedBlocks,
                speedSamples: speedBlocks * samplesPerBlock,
                timeAdjustments: timeAdjustmentCount,
            },
            platform: process.platform,
            reportVersion: 1,
            timingsMs: {
                decode: decodeMs,
            },
        };

        const evidencePath = process.env['ESM_VIEWER_PHASE0_EVIDENCE'];
        if (evidencePath !== undefined) {
            await writeFile(evidencePath, `${JSON.stringify(report)}\n`, 'utf8');
        }
        process.stdout.write(`ESM_VIEWER_PHASE0_DECODER ${JSON.stringify(report)}\n`);
    }, 60_000);
});
