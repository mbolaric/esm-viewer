import {
    createDetailedSpeedSample,
    createSourceReference,
    isJsonPointer,
    isSpeedKilometresPerHour,
    isUtcTimestamp,
    type SpeedKilometresPerHour,
    type UtcTimestamp,
} from '#viewer-domain';
import type {
    IFormattedValue,
    IOverspeedRecordViewModel,
    ISpeedSampleViewModel,
    ISpeedSectionViewModel,
} from '#viewer-presentation';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SpeedScreen from '../components/screens/SpeedScreen.svelte';
import { createDocumentScopedValue } from '../controllers/document-scoped-value.svelte.js';
import { createViewerTestRenderOptions } from './viewer-test-render.js';

afterEach(() => {
    cleanup();
});

function timestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The speed screen timestamp fixture must be valid.');
    }
    return value;
}

function formatted<TValue>(value: TValue, display: string): IFormattedValue<TValue> {
    return { display, value };
}

function speedRecord(recordedAt: UtcTimestamp, speed: number, index: number): ISpeedSampleViewModel {
    const path = `/speed/${String(index)}`;
    if (!isSpeedKilometresPerHour(speed) || !isJsonPointer(path)) {
        throw new TypeError('The speed screen record fixture must be valid.');
    }
    const record = createDetailedSpeedSample({
        recordedAt,
        source: createSourceReference('vehicleUnit', 'g2', path),
        speedKilometresPerHour: speed,
    });
    return {
        generation: 'g2',
        id: path,
        record,
        recordedAt: formatted(recordedAt, new Date(recordedAt).toISOString()),
        source: record.source,
        speed: formatted(record.speedKilometresPerHour, String(speed)),
    };
}

function viewModel(): ISpeedSectionViewModel {
    const start = timestamp(Date.UTC(2026, 5, 18, 8, 42));
    const end = timestamp(start + 1_000);
    const first = speedRecord(start, 72, 0);
    const second = speedRecord(end, 73, 1);
    const minimum = formatted<SpeedKilometresPerHour>(first.speed.value, '72');
    const maximum = formatted<SpeedKilometresPerHour>(second.speed.value, '73');

    return {
        chartRecords: [
            { ...first, pageIndex: 0 },
            { ...second, pageIndex: 1 },
        ],
        chartReduced: true,
        chartTicks: [
            { display: '08:42:00', value: start },
            { display: '08:42:01', value: end },
        ],
        coverage: {
            end: formatted(end, '18 Jun 2026, 08:42:01'),
            endInput: 'Jun 18, 2026 08:42:01',
            start: formatted(start, '18 Jun 2026, 08:42:00'),
            startInput: 'Jun 18, 2026 08:42:00',
        },
        locale: 'en',
        measurement: {
            distanceKilometres: formatted(0.04, '0.0'),
            duration: formatted(1_000, 'duration:1000'),
        },
        overspeedControl: null,
        overspeedRecords: [],
        pageCount: formatted(2, '2'),
        pageIndex: 0,
        pageNumber: formatted(1, '1'),
        range: {
            end: formatted(end, '18 Jun 2026, 08:42:01'),
            endInput: 'Jun 18, 2026 08:42:01',
            start: formatted(start, '18 Jun 2026, 08:42:00'),
            startInput: 'Jun 18, 2026 08:42:00',
        },
        rangeLimited: true,
        records: [first, second],
        statistics: {
            average: formatted(72.5, '72.5'),
            maximum,
            minimum,
        },
        timeZone: 'UTC',
        totalSamples: formatted(302, '302'),
    };
}

function emptyViewModel(): ISpeedSectionViewModel {
    return {
        chartRecords: [],
        chartReduced: false,
        chartTicks: [],
        coverage: null,
        locale: 'en',
        measurement: null,
        overspeedControl: null,
        overspeedRecords: [],
        pageCount: formatted(0, '0'),
        pageIndex: 0,
        pageNumber: formatted(0, '0'),
        range: null,
        rangeLimited: false,
        records: [],
        statistics: null,
        timeZone: 'UTC',
        totalSamples: formatted(0, '0'),
    };
}

function overspeedViewModel(): ISpeedSectionViewModel {
    const base = viewModel();
    const begin = timestamp(Date.UTC(2026, 5, 14, 8));
    const end = timestamp(Date.UTC(2026, 5, 14, 8, 5));
    const firstOverspeedSince = timestamp(Date.UTC(2026, 5, 14, 8));
    const lastControl = timestamp(Date.UTC(2026, 5, 14, 12));
    const maxSpeed = 98;
    const recordPath = '/overspeed/0';
    const controlPath = '/overspeedControl';
    if (!isSpeedKilometresPerHour(maxSpeed) || !isJsonPointer(recordPath) || !isJsonPointer(controlPath)) {
        throw new TypeError('The speed screen overspeed fixture must be valid.');
    }
    const record: IOverspeedRecordViewModel = {
        begin: formatted(begin, '14 Jun 2026, 08:00:00'),
        cardNumber: null,
        end: formatted(end, '14 Jun 2026, 08:05:00'),
        generation: 'g2',
        id: recordPath,
        maxSpeed: formatted(maxSpeed, '98'),
        purpose: 'oneOf10MostRecentOrLast',
        similarEvents: formatted(2, '2'),
        source: {
            documentKind: 'vehicleUnit',
            generation: 'g2',
            path: recordPath,
        },
    };

    return {
        ...base,
        overspeedControl: {
            firstOverspeedSince: formatted(firstOverspeedSince, '14 Jun 2026, 08:00:00'),
            lastControl: formatted(lastControl, '14 Jun 2026, 12:00:00'),
            numberOfOverspeedSince: formatted(1, '1'),
            source: {
                documentKind: 'vehicleUnit',
                generation: 'g2',
                path: controlPath,
            },
        },
        overspeedRecords: [record],
    };
}

describe('SpeedScreen', () => {
    it('renders factual summaries, bounded controls, pagination, selection, and source actions', async () => {
        const range = vi.fn();
        const reset = vi.fn();
        const page = vi.fn();
        const selectRecord = vi.fn();
        const openSource = vi.fn();

        render(
            SpeedScreen,
            {
                props: {
                    onchartfailure: vi.fn(),
                    onclearrecord: vi.fn(),
                    onpage: page,
                    onrange: range,
                    onreset: reset,
                    onselectrecord: selectRecord,
                    onopensource: openSource,
                    overspeedFilterText: createDocumentScopedValue(''),
                    sampleFilterText: createDocumentScopedValue(''),
                    selectedRecord: null,
                    viewModel: viewModel(),
                },
            },
            createViewerTestRenderOptions(),
        );

        const heading = screen.getByRole('heading', { level: 1, name: 'Speed' });
        expect(document.activeElement).toBe(heading);
        expect(screen.getByText('The selected range was limited to the latest 24 hours.')).toBeTruthy();
        expect(screen.getByText('72.5 km/h')).toBeTruthy();
        expect(
            screen.getByText(
                'The chart uses a bounded extrema-preserving projection. The table below retains every exact source sample.',
            ),
        ).toBeTruthy();
        // Speed reference lines must include noncompliance disclaimer.
        expect(
            screen.getByText(
                'The 80 and 90 km/h lines are generic illustrative references, not this vehicle’s confirmed category, jurisdiction, or authorised speed-limiter setting. They are not a finding of speeding or limiter noncompliance.',
            ),
        ).toBeTruthy();
        expect(
            screen.getByRole('button', {
                name: 'A detailed-speed time series for the selected UTC range. Use the arrow keys to move through displayed source samples.',
            }),
        ).toBeTruthy();

        const table = screen.getByRole('table', {
            name: 'Exact chronological detailed-speed samples for the selected UTC range',
        });
        expect(within(table).getAllByRole('row')).toHaveLength(3);
        await fireEvent.click(
            within(table).getByRole('button', {
                name: /Select speed sample: .*72 km\/h/u,
            }),
        );
        expect(selectRecord).toHaveBeenCalledWith(expect.objectContaining({ speedKilometresPerHour: 72 }));

        await fireEvent.click(
            within(table).getByRole('button', {
                name: 'Open in Raw Data: /speed/0',
            }),
        );
        expect(openSource).toHaveBeenCalledWith('/speed/0');

        await fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
        expect(page).toHaveBeenCalledWith(1);

        const startInput = screen.getByLabelText('Range start (UTC)');
        await fireEvent.click(screen.getByRole('button', { name: 'Apply range' }));
        expect(range).toHaveBeenCalledWith(Date.UTC(2026, 5, 18, 8, 42), Date.UTC(2026, 5, 18, 8, 42, 1));

        await fireEvent.input(startInput, {
            target: { value: '' },
        });
        await fireEvent.click(screen.getByRole('button', { name: 'Apply range' }));
        expect(screen.getByRole('alert').textContent).toContain('Enter valid UTC start and end date-times');
        expect(range).toHaveBeenCalledTimes(1);

        await fireEvent.click(screen.getByRole('button', { name: 'Reset range' }));
        expect(reset).toHaveBeenCalledTimes(1);
    });

    it('parses edited range values in the active display format and keeps untouched precision', async () => {
        const range = vi.fn();
        render(
            SpeedScreen,
            {
                props: {
                    onchartfailure: vi.fn(),
                    onclearrecord: vi.fn(),
                    onpage: vi.fn(),
                    onrange: range,
                    onreset: vi.fn(),
                    onselectrecord: vi.fn(),
                    onopensource: vi.fn(),
                    overspeedFilterText: createDocumentScopedValue(''),
                    sampleFilterText: createDocumentScopedValue(''),
                    selectedRecord: null,
                    viewModel: viewModel(),
                },
            },
            createViewerTestRenderOptions(),
        );

        const startInput = screen.getByLabelText('Range start (UTC)');
        const endInput = screen.getByLabelText('Range end (UTC)');
        if (!(startInput instanceof HTMLInputElement) || !(endInput instanceof HTMLInputElement)) {
            throw new TypeError('The speed range controls must be inputs.');
        }
        expect(startInput.value).toBe('Jun 18, 2026 08:42:00');
        expect(endInput.value).toBe('Jun 18, 2026 08:42:01');

        await fireEvent.input(startInput, {
            target: { value: 'Jun 18, 2026 08:45:30' },
        });
        await fireEvent.click(screen.getByRole('button', { name: 'Apply range' }));
        expect(range).toHaveBeenCalledWith(Date.UTC(2026, 5, 18, 8, 45, 30), Date.UTC(2026, 5, 18, 8, 42, 1));
    });

    it('renders overspeed records, range measurement, and control context as raw evidence', async () => {
        const openSource = vi.fn();
        render(
            SpeedScreen,
            {
                props: {
                    onchartfailure: vi.fn(),
                    onclearrecord: vi.fn(),
                    onpage: vi.fn(),
                    onrange: vi.fn(),
                    onreset: vi.fn(),
                    onselectrecord: vi.fn(),
                    onopensource: openSource,
                    overspeedFilterText: createDocumentScopedValue(''),
                    sampleFilterText: createDocumentScopedValue(''),
                    selectedRecord: null,
                    viewModel: overspeedViewModel(),
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByRole('heading', { name: 'Overspeed records' })).toBeTruthy();
        const overspeedTable = screen.getByRole('table', {
            name: 'Chronological overspeed event records',
        });
        expect(within(overspeedTable).getAllByRole('row')).toHaveLength(2);
        expect(within(overspeedTable).getByText('14 Jun 2026, 08:00:00 through 14 Jun 2026, 08:05:00')).toBeTruthy();
        expect(within(overspeedTable).getByText('98 km/h')).toBeTruthy();
        expect(within(overspeedTable).getByText('One of the 10 most recent or last')).toBeTruthy();

        await fireEvent.click(
            within(overspeedTable).getByRole('button', {
                name: 'Open in Raw Data: /overspeed/0',
            }),
        );
        expect(openSource).toHaveBeenCalledWith('/overspeed/0');

        expect(screen.getByText('duration:1000')).toBeTruthy();
        expect(screen.getByText('0.0 kilometres')).toBeTruthy();
        expect(screen.getByText('1')).toBeTruthy();
        expect(screen.getByText('14 Jun 2026, 08:00:00')).toBeTruthy();
        expect(screen.getByText('14 Jun 2026, 12:00:00')).toBeTruthy();
    });

    it('shows explicit projection-error and decoded-empty states', async () => {
        const rendered = render(
            SpeedScreen,
            {
                props: {
                    onchartfailure: vi.fn(),
                    onclearrecord: vi.fn(),
                    onpage: vi.fn(),
                    onrange: vi.fn(),
                    onreset: vi.fn(),
                    onselectrecord: vi.fn(),
                    onopensource: vi.fn(),
                    overspeedFilterText: createDocumentScopedValue(''),
                    sampleFilterText: createDocumentScopedValue(''),
                    selectedRecord: null,
                    viewModel: null,
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByRole('heading', { name: 'Detailed speed unavailable' })).toBeTruthy();
        await rendered.rerender({ viewModel: emptyViewModel() });
        expect(screen.getByText('No detailed-speed records were decoded from this file.')).toBeTruthy();
    });
});
