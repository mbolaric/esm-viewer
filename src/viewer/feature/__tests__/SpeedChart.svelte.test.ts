import {
    createDetailedSpeedSample,
    createSourceReference,
    isJsonPointer,
    isSpeedKilometresPerHour,
    isUtcTimestamp,
    type UtcTimestamp,
} from '#viewer-domain';
import { createCapturingTimeSeriesRuntimeLoader, VisibleIntersectionObserver } from '#testing';
import type { IFormattedValue, ISpeedChartSampleViewModel, ISpeedSectionViewModel } from '#viewer-presentation';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SpeedChart from '../components/screens/SpeedChart.svelte';
import { createViewerTestRenderOptions } from './viewer-test-render.js';

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

function timestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The speed chart timestamp fixture must be valid.');
    }
    return value;
}

function formatted<TValue>(value: TValue, display: string): IFormattedValue<TValue> {
    return { display, value };
}

function chartSample(recordedAt: UtcTimestamp, speed: number, index: number): ISpeedChartSampleViewModel {
    const path = `/speed/${String(index)}`;
    if (!isSpeedKilometresPerHour(speed) || !isJsonPointer(path)) {
        throw new TypeError('The speed chart record fixture must be valid.');
    }
    const record = createDetailedSpeedSample({
        recordedAt,
        source: createSourceReference('vehicleUnit', 'g2', path),
        speedKilometresPerHour: speed,
    });
    return {
        generation: 'g2',
        id: path,
        pageIndex: index,
        record,
        recordedAt: formatted(recordedAt, new Date(recordedAt).toISOString()),
        source: record.source,
        speed: formatted(record.speedKilometresPerHour, String(speed)),
    };
}

function viewModel(): ISpeedSectionViewModel {
    const start = timestamp(Date.UTC(2026, 5, 18, 8, 42));
    const end = timestamp(start + 1_000);
    const first = chartSample(start, 72, 0);
    const second = chartSample(end, 73, 1);
    return {
        allRecords: [],
        pageSize: 500,
        chartRecords: [first, second],
        chartReduced: true,
        chartTicks: [
            { display: '08:42:00', value: start },
            { display: '08:42:01', value: end },
        ],
        coverage: null,
        locale: 'en',
        measurement: null,
        overspeedControl: null,
        overspeedRecords: [],
        pageCount: formatted(2, '2'),
        pageIndex: 0,
        pageNumber: formatted(1, '1'),
        range: null,
        rangeLimited: false,
        records: [first, second],
        statistics: null,
        timeZone: 'UTC',
        totalSamples: formatted(2, '2'),
    };
}

describe('SpeedChart illustrative reference lines (VIEWER-06)', () => {
    it('supplies the 80 and 90 km/h illustrative reference lines to the chart, clearly labeled as such', async () => {
        vi.stubGlobal('IntersectionObserver', VisibleIntersectionObserver);
        const { capturedModels, runtimeLoader } = createCapturingTimeSeriesRuntimeLoader();

        render(
            SpeedChart,
            {
                props: {
                    onclearrecord: vi.fn(),
                    onfailure: vi.fn(),
                    onselectrecord: vi.fn(),
                    runtimeLoader,
                    selectedRecord: null,
                    viewModel: viewModel(),
                },
            },
            createViewerTestRenderOptions(),
        );

        await waitFor(() => {
            expect(runtimeLoader).toHaveBeenCalledTimes(1);
        });
        const capturedModel = capturedModels[0];
        if (capturedModel === undefined) {
            throw new TypeError('The speed chart runtime must capture the chart model.');
        }
        expect(capturedModel.thresholds).toEqual([
            {
                colorToken: '--color-warning',
                label: '80 km/h (illustrative reference)',
                value: 80,
            },
            {
                colorToken: '--color-danger',
                label: '90 km/h (illustrative reference)',
                value: 90,
            },
        ]);
        // The reference lines are ordered chronologically by speed: 80 before 90.
        expect(capturedModel.thresholds?.[0]?.value).toBe(80);
        expect(capturedModel.thresholds?.[1]?.value).toBe(90);
        // Labels must not assert actual HGV limits without evidence.
        for (const threshold of capturedModel.thresholds ?? []) {
            expect(threshold.label).not.toMatch(/HGV limit|EU limiter/u);
        }
    });
});
