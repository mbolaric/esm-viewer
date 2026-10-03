import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

import type { ILocalisationService } from '#localization';
import type { OpenedTachographDocument } from '#viewer-application';
import {
    createDetailedSpeedSample,
    createSourceReference,
    isJsonPointer,
    isSpeedKilometresPerHour,
    isUtcTimestamp,
    type DurationMilliseconds,
    type UtcTimestamp,
} from '#viewer-domain';
import { describe, expect, it } from 'vitest';

import { EU_561_2006_STANDARD } from '#compliance';

import { createVehicleUnitDocumentFixture } from './vehicle-unit-document-fixture.js';
import { createActivitySectionViewModel, createDocumentOverviewViewModel, createSpeedSectionViewModel } from '../index.js';
import { NO_COMPLIANCE_EVALUATION } from './activity-view-model-fixture.js';

const sampleCount = 24 * 60 * 60;
const pageSize = 300;

interface IMemorySnapshot {
    readonly arrayBuffersBytes: number;
    readonly externalBytes: number;
    readonly heapUsedBytes: number;
    readonly rssBytes: number;
}

interface IProjectionMeasurement {
    readonly durationMs: number;
    readonly memoryDeltaBytes: IMemorySnapshot;
}

interface IPhase0ProjectionReport {
    readonly architecture: string;
    readonly document: {
        readonly detailedSpeedSamples: number;
        readonly openedDocumentBuildMemoryDeltaBytes: IMemorySnapshot;
    };
    readonly nodeVersion: string;
    readonly platform: string;
    readonly projections: {
        readonly activities: IProjectionMeasurement;
        readonly overview: IProjectionMeasurement;
        readonly speed: IProjectionMeasurement;
    };
    readonly reportVersion: 1;
}

function measureProjection(run: () => unknown): IProjectionMeasurement {
    const before = process.memoryUsage();
    const startedAt = performance.now();
    run();
    const durationMs = performance.now() - startedAt;
    const after = process.memoryUsage();

    return {
        durationMs,
        memoryDeltaBytes: {
            arrayBuffersBytes: after.arrayBuffers - before.arrayBuffers,
            externalBytes: after.external - before.external,
            heapUsedBytes: after.heapUsed - before.heapUsed,
            rssBytes: after.rss - before.rss,
        },
    };
}

function benchmarkLocalisation(): ILocalisationService<UtcTimestamp, DurationMilliseconds> {
    const dateTimeFormatter = new Intl.DateTimeFormat('en', {
        dateStyle: 'medium',
        timeStyle: 'medium',
        timeZone: 'UTC',
    });

    return {
        dateFormat: 'ddMMyyyy',
        formatDateTime: (value) => dateTimeFormatter.format(new Date(value)),
        formatDuration: (value) => `${String(Math.round(value / 60000))}m`,
        formatMonthLabel: (value) =>
            new Intl.DateTimeFormat('en', {
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
            }).format(value),
        formatMonthShortLabel: (value) =>
            new Intl.DateTimeFormat('en', {
                month: 'short',
                timeZone: 'UTC',
            }).format(value),
        formatNumber: (value, options) => new Intl.NumberFormat('en', options).format(value),
        formatDate: (value) => new Date(value).toISOString().slice(0, 10),
        formatUtcDate: (value) => new Date(value).toISOString().slice(0, 10),
        formatUtcTime: (value) => new Date(value).toISOString().slice(11, 19),
        formatWeekdayLabels: () => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        locale: 'en',
        timeZone: 'UTC',
    };
}

function benchmarkDocument(): OpenedTachographDocument {
    const recordedAtStart = Date.UTC(2026, 5, 18);
    const samples = Array.from({ length: sampleCount }, (_, index) => {
        const recordedAt = recordedAtStart + index * 1000;
        const path = `/speed/${String(index)}`;
        const speed = 72;
        if (!isUtcTimestamp(recordedAt) || !isJsonPointer(path) || !isSpeedKilometresPerHour(speed)) {
            throw new TypeError('The Phase 0 projection fixture must be valid.');
        }

        return createDetailedSpeedSample({
            recordedAt,
            source: createSourceReference('vehicleUnit', 'g2', path),
            speedKilometresPerHour: speed,
        });
    });

    if (!isUtcTimestamp(recordedAtStart)) {
        throw new TypeError('The Phase 0 projection fixture date must be valid.');
    }

    return createVehicleUnitDocumentFixture({
        detailedSpeedSamples: samples,
        openedAt: recordedAtStart,
    });
}

describe('Phase 0 synthetic projection benchmark', () => {
    it('measures representative overview, speed, and activity projections', () => {
        const beforeDocument = process.memoryUsage();
        const document = benchmarkDocument();
        const afterDocument = process.memoryUsage();
        const localisation = benchmarkLocalisation();
        if (document.content.documentKind !== 'vehicleUnit') {
            throw new TypeError('The Phase 0 projection fixture must be a Vehicle Unit.');
        }
        const detailedSpeedSamples = document.content.detailedSpeedSamples.length;

        const overview = measureProjection(() => {
            const result = createDocumentOverviewViewModel(document, localisation);
            expect(result.documentKind).toBe('vehicleUnit');
            expect(result.generation).toBe('g2');
        });
        const speed = measureProjection(() => {
            const viewModel = createSpeedSectionViewModel(document, localisation, {
                end: null,
                pageIndex: 0,
                preferredSample: null,
                start: null,
            });
            expect(viewModel.records).toHaveLength(pageSize);
            expect(viewModel.pageCount.value).not.toBe('0');
        });
        const activities = measureProjection(() => {
            const result = createActivitySectionViewModel(document, localisation, EU_561_2006_STANDARD, NO_COMPLIANCE_EVALUATION);
            expect(result.ok).toBe(true);
        });

        const report: IPhase0ProjectionReport = {
            architecture: process.arch,
            document: {
                detailedSpeedSamples,
                openedDocumentBuildMemoryDeltaBytes: {
                    arrayBuffersBytes: afterDocument.arrayBuffers - beforeDocument.arrayBuffers,
                    externalBytes: afterDocument.external - beforeDocument.external,
                    heapUsedBytes: afterDocument.heapUsed - beforeDocument.heapUsed,
                    rssBytes: afterDocument.rss - beforeDocument.rss,
                },
            },
            nodeVersion: process.versions.node,
            platform: process.platform,
            projections: {
                activities,
                overview,
                speed,
            },
            reportVersion: 1,
        };

        const evidencePath = process.env['ESM_VIEWER_PHASE0_EVIDENCE'];
        if (evidencePath !== undefined) {
            void writeFile(evidencePath, `${JSON.stringify(report)}\n`, 'utf8');
        }
        process.stdout.write(`ESM_VIEWER_PHASE0_PROJECTION ${JSON.stringify(report)}\n`);
    }, 60_000);
});
