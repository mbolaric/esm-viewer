import { decodeFileMetadata } from '#contracts';
import {
    createDetailedSpeedSample,
    createOverspeedRecord,
    createSourceReference,
    isJsonPointer,
    isSpeedKilometresPerHour,
    isUtcTimestamp,
    type IDetailedSpeedSample,
    type IOverspeedRecord,
    type UtcTimestamp,
} from '#viewer-domain';
import { describe, expect, it } from 'vitest';

import {
    createDocumentSource,
    createOpenedTachographDocument,
    type IParsedDriverCardDocument,
    detailedSpeedChartSampleLimit,
    detailedSpeedPageSize,
    DocumentSelectionController,
    maximumDetailedSpeedRangeMilliseconds,
    projectDocumentDetailedSpeed,
    projectDocumentOverspeedRecords,
    type IParsedVehicleUnitDocument,
    type OpenedTachographDocument,
} from '../index.js';

function timestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The speed projection timestamp fixture must be valid.');
    }
    return value;
}

function sample(recordedAt: number, speed: number, index: number): IDetailedSpeedSample {
    const path = `/speed/${String(index)}`;
    if (!isSpeedKilometresPerHour(speed) || !isJsonPointer(path)) {
        throw new TypeError('The speed projection sample fixture must be valid.');
    }
    return createDetailedSpeedSample({
        recordedAt: timestamp(recordedAt),
        source: createSourceReference('vehicleUnit', 'g2', path),
        speedKilometresPerHour: speed,
    });
}

function overspeedRecord(begin: number, end: number | null, index: number): IOverspeedRecord {
    const path = `/overspeed/${String(index)}`;
    const maxSpeed = 98;
    if (!isJsonPointer(path) || !isSpeedKilometresPerHour(maxSpeed)) {
        throw new TypeError('The overspeed projection fixture must be valid.');
    }
    const record = createOverspeedRecord({
        averageSpeedKilometresPerHour: 96,
        begin: timestamp(begin),
        cardNumberDriverSlotBegin: null,
        end: end === null ? null : timestamp(end),
        maxSpeedKilometresPerHour: maxSpeed,
        purpose: 'oneOf10MostRecentOrLast',
        similarEventsNumber: 1,
        source: createSourceReference('vehicleUnit', 'g2', path),
    });
    if (record === null) {
        throw new TypeError('The overspeed projection fixture must be valid.');
    }
    return record;
}

function overspeedOpenedDocument(
    records: readonly IOverspeedRecord[],
    control: IParsedVehicleUnitDocument['overspeedControl'],
): OpenedTachographDocument {
    const metadata = decodeFileMetadata({
        byteLength: 3,
        displayName: 'speed.ddd',
        sha256: 'c'.repeat(64),
    });
    const rootPath = '';
    if (!metadata.ok || !isJsonPointer(rootPath)) {
        throw new TypeError('The overspeed projection document fixture must be valid.');
    }
    const emptyRecords = [] as const;
    const content: IParsedVehicleUnitDocument = {
        cardUses: emptyRecords,
        detailedSpeedSamples: emptyRecords,
        documentKind: 'vehicleUnit',
        companyLocks: emptyRecords,
        events: emptyRecords,
        faults: emptyRecords,
        generation: 'g2',
        identity: null,
        locations: emptyRecords,
        overspeedControl: control,
        overspeedRecords: [...records],
        parserVariant: 'vuGen2',
        verification: null,
        rawTree: {},
        rootSource: createSourceReference('vehicleUnit', 'g2', rootPath),
        sections: emptyRecords,
        technicalRecords: emptyRecords,
        warnings: emptyRecords,
    };
    return createOpenedTachographDocument(createDocumentSource(metadata.value, timestamp(Date.UTC(2026, 5, 18))), content);
}

function openedDocument(samples: readonly IDetailedSpeedSample[]): OpenedTachographDocument {
    const metadata = decodeFileMetadata({
        byteLength: 3,
        displayName: 'speed.ddd',
        sha256: 'c'.repeat(64),
    });
    const rootPath = '';
    if (!metadata.ok || !isJsonPointer(rootPath)) {
        throw new TypeError('The speed projection document fixture must be valid.');
    }
    const emptyRecords = [] as const;
    const content: IParsedVehicleUnitDocument = {
        cardUses: emptyRecords,
        detailedSpeedSamples: [...samples],
        documentKind: 'vehicleUnit',
        companyLocks: emptyRecords,
        events: emptyRecords,
        faults: emptyRecords,
        generation: 'g2',
        overspeedControl: null,
        overspeedRecords: emptyRecords,

        identity: null,
        locations: emptyRecords,
        parserVariant: 'vuGen2',
        verification: null,
        rawTree: {},
        rootSource: createSourceReference('vehicleUnit', 'g2', rootPath),
        sections: emptyRecords,
        technicalRecords: emptyRecords,
        warnings: emptyRecords,
    };
    return createOpenedTachographDocument(createDocumentSource(metadata.value, timestamp(Date.UTC(2026, 5, 18))), content);
}

describe('detailed-speed projection', () => {
    it('sorts, filters, pages, and calculates factual selected-range statistics', () => {
        const start = Date.UTC(2026, 5, 18, 8);
        const samples = Array.from({ length: detailedSpeedPageSize + 2 }, (_, index) =>
            sample(start + index * 1_000, index % 101, detailedSpeedPageSize + 1 - index),
        ).reverse();
        const document = openedDocument(samples);

        const projection = projectDocumentDetailedSpeed(document, {
            end: timestamp(start + (detailedSpeedPageSize + 1) * 1_000),
            pageIndex: 1,
            preferredSample: null,
            start: timestamp(start),
        });

        expect(projection).toMatchObject({
            pageCount: 2,
            pageIndex: 1,
            rangeLimited: false,
            totalSamples: detailedSpeedPageSize + 2,
        });
        expect(projection.samples).toHaveLength(2);
        expect(projection.samples[0]?.recordedAt).toBe(start + detailedSpeedPageSize * 1_000);
        expect(projection.statistics).toMatchObject({
            maximumSpeedKilometresPerHour: 100,
            minimumSpeedKilometresPerHour: 0,
        });
        expect(projection.statistics?.averageSpeedKilometresPerHour).toBeGreaterThan(0);
    });

    it('limits an over-wide request to the latest 24 hours without hiding the fact', () => {
        const start = Date.UTC(2026, 5, 18);
        const end = start + maximumDetailedSpeedRangeMilliseconds + 60_000;
        const document = openedDocument([sample(start, 10, 0), sample(end - 1_000, 20, 1), sample(end, 30, 2)]);

        const projection = projectDocumentDetailedSpeed(document, {
            end: timestamp(end),
            pageIndex: 0,
            preferredSample: null,
            start: timestamp(start),
        });

        expect(projection.rangeLimited).toBe(true);
        expect(projection.range).toEqual({
            end,
            start: end - maximumDetailedSpeedRangeMilliseconds,
        });
        expect(projection.samples.map((record) => record.speedKilometresPerHour)).toEqual([20, 30]);
    });

    it('bounds chart records while preserving extrema and the selected exact sample', () => {
        const start = Date.UTC(2026, 5, 18, 8);
        const samples = Array.from({ length: detailedSpeedChartSampleLimit * 2 }, (_, index) =>
            sample(start + index * 1_000, index === detailedSpeedChartSampleLimit ? 255 : index % 80, index),
        );
        const preferredSample = samples[detailedSpeedChartSampleLimit + 1];
        if (preferredSample === undefined) {
            throw new TypeError('The preferred detailed-speed sample must exist.');
        }

        const projection = projectDocumentDetailedSpeed(openedDocument(samples), {
            end: null,
            pageIndex: 0,
            preferredSample,
            start: null,
        });

        expect(projection.chartSamplesReduced).toBe(true);
        expect(projection.chartSamples.length).toBeLessThanOrEqual(detailedSpeedChartSampleLimit);
        expect(projection.chartSamples[0]?.sample).toBe(samples[0]);
        expect(projection.chartSamples.at(-1)?.sample).toBe(samples.at(-1));
        expect(projection.chartSamples.some((chartSample) => chartSample.sample.speedKilometresPerHour === 255)).toBe(true);
        expect(projection.chartSamples.some((chartSample) => chartSample.sample === preferredSample)).toBe(true);
        expect(projection.chartSamples.find((chartSample) => chartSample.sample === preferredSample)?.pageIndex).toBe(
            Math.floor((detailedSpeedChartSampleLimit + 1) / detailedSpeedPageSize),
        );

        const timestamps = projection.chartSamples.map((cs) => cs.sample.recordedAt);
        const sortedTimestamps = [...timestamps].sort((a, b) => a - b);
        expect(timestamps).toEqual(sortedTimestamps);
        expect(new Set(timestamps).size).toBe(timestamps.length);
    });

    it('exposes speed samples as selectable section records', () => {
        const record = sample(Date.UTC(2026, 5, 18, 8), 72, 0);
        const controller = new DocumentSelectionController(openedDocument([record]));

        expect(controller.snapshot.availableSections).toContain('speed');
        expect(controller.selectSection('speed')).toMatchObject({ ok: true });
        expect(controller.snapshot.projection.records).toEqual([record]);
        expect(controller.selectRecord(record)).toMatchObject({ ok: true });
        expect(controller.snapshot.selectedRecord).toBe(record);
    });

    it('measures viewer-calculated duration and distance over the selected range', () => {
        const start = Date.UTC(2026, 5, 18, 8);
        const document = openedDocument([sample(start, 36, 0), sample(start + 1_000, 72, 1), sample(start + 2_000, 0, 2)]);

        const projection = projectDocumentDetailedSpeed(document, {
            end: timestamp(start + 2_000),
            pageIndex: 0,
            preferredSample: null,
            start: timestamp(start),
        });

        expect(projection.measurement).not.toBeNull();
        expect(projection.measurement?.durationMilliseconds).toBe(2_000);
        expect(projection.measurement?.distanceKilometres).toBeCloseTo(0.025, 6);
    });

    it('returns no range measurement for an empty or zero-length range', () => {
        const start = Date.UTC(2026, 5, 18, 8);
        const document = openedDocument([sample(start, 72, 0)]);

        expect(
            projectDocumentDetailedSpeed(document, {
                end: timestamp(start),
                pageIndex: 0,
                preferredSample: null,
                start: timestamp(start),
            }).measurement,
        ).toBeNull();
        expect(
            projectDocumentDetailedSpeed(openedDocument([]), {
                end: null,
                pageIndex: 0,
                preferredSample: null,
                start: null,
            }).measurement,
        ).toBeNull();
    });

    it('sorts overspeed records chronologically and preserves raw evidence', () => {
        const later = Date.UTC(2026, 5, 18, 10);
        const earlier = Date.UTC(2026, 5, 18, 8);
        const controlPath = '/overspeedControl';
        if (!isJsonPointer(controlPath)) {
            throw new TypeError('The overspeed control fixture must be valid.');
        }
        const document = overspeedOpenedDocument([overspeedRecord(later, null, 1), overspeedRecord(earlier, later, 0)], {
            firstOverspeedSince: timestamp(earlier),
            kind: 'overspeedControlData',
            lastOverspeedControlTime: null,
            numberOfOverspeedSince: 2,
            source: createSourceReference('vehicleUnit', 'g2', controlPath),
        });

        const projection = projectDocumentOverspeedRecords(document);

        expect(projection.map((record) => record.begin)).toEqual([earlier, later]);
        expect(projection[0]?.maxSpeedKilometresPerHour).toBe(98);
        expect(projection[0]?.end).toBe(later);
        expect(projection[0]?.purpose).toBe('oneOf10MostRecentOrLast');
        expect(projection[0]?.similarEventsNumber).toBe(1);
    });

    it('returns no overspeed records for a driver-card document', () => {
        const metadata = decodeFileMetadata({
            byteLength: 3,
            displayName: 'driver-card.ddd',
            sha256: 'c'.repeat(64),
        });
        const rootPath = '';
        if (!metadata.ok || !isJsonPointer(rootPath)) {
            throw new TypeError('The overspeed driver-card fixture must be valid.');
        }
        const content: IParsedDriverCardDocument = {
            applications: [],
            cardType: 'driverCard',
            documentKind: 'driverCard',
            generation: 'g1',
            parserVariant: 'cardGen1',
            rawTree: {},
            sections: [],
        };
        const document = createOpenedTachographDocument(
            createDocumentSource(metadata.value, timestamp(Date.UTC(2026, 5, 18))),
            content,
        );

        expect(projectDocumentOverspeedRecords(document)).toEqual([]);
    });
});
