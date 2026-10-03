import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import TimeSeriesChart from '../charts/TimeSeriesChart.svelte';
import type {
    ITimeSeriesChartModel,
    ITimeSeriesRuntime,
    ITimeSeriesRuntimeCallbacks,
    ITimeSeriesRuntimeModule,
    TimeSeriesRuntimeLoader,
} from '../charts/chart-contract.js';
import { VisibleIntersectionObserver } from './visible-intersection-observer.js';

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

const labels = {
    failureCode: 'viewer.chart-render-failed',
    failureCodeLabel: 'Error code:',
    failureDescription: 'The records remain available below.',
    failureHeading: 'The chart could not be displayed',
    keyboardHelp: 'Use arrow keys to move through samples.',
    loading: 'Loading chart…',
    retry: 'Retry chart',
    roleDescription: 'time-series chart',
};

const model: ITimeSeriesChartModel = {
    ariaDescription: 'A detailed-speed time series',
    colorToken: '--color-speed-series',
    domainEnd: 2,
    domainStart: 0,
    points: [
        {
            description: '08:00:00, 40 km/h',
            id: 'first',
            timestamp: 0,
            value: 40,
        },
        {
            description: '08:00:01, 55 km/h',
            id: 'second',
            timestamp: 1,
            value: 55,
        },
        {
            description: '08:00:02, 30 km/h',
            id: 'third',
            timestamp: 2,
            value: 30,
        },
    ],
    selectedPointId: null,
    seriesLabel: 'Recorded speed',
    ticks: [
        { display: '08:00:00', value: 0 },
        { display: '08:00:02', value: 2 },
    ],
    timeAxisLabel: 'Time',
    valueAxisLabel: 'km/h',
    valueDomainEnd: 60,
    valueDomainStart: 0,
};

describe('TimeSeriesChart', () => {
    it('loads lazily and exposes chronological keyboard selection with DOM values', async () => {
        vi.stubGlobal('IntersectionObserver', VisibleIntersectionObserver);
        const runtime: ITimeSeriesRuntime = {
            dispose: vi.fn(),
            focusItem: vi.fn(),
            update: vi.fn(),
        };
        const callbacksHolder: { current: ITimeSeriesRuntimeCallbacks | null } = {
            current: null,
        };
        const runtimeModule: ITimeSeriesRuntimeModule = {
            createTimeSeriesRuntime: (element, chartModel, callbacks) => {
                expect(element).toBeInstanceOf(HTMLElement);
                expect(chartModel).toBe(model);
                callbacksHolder.current = callbacks;
                return runtime;
            },
        };
        const runtimeLoader: TimeSeriesRuntimeLoader = vi.fn(() => Promise.resolve(runtimeModule));
        const onselect = vi.fn();

        render(TimeSeriesChart, {
            props: {
                labels,
                model,
                onfailure: vi.fn(),
                onselect,
                runtimeLoader,
            },
        });

        const chart = screen.getByRole('button', {
            name: 'A detailed-speed time series',
        });
        await vi.waitFor(() => {
            expect(runtimeLoader).toHaveBeenCalledTimes(1);
        });
        await fireEvent.focus(chart);
        expect(screen.getByText('08:00:00, 40 km/h')).toBeTruthy();

        await fireEvent.keyDown(chart, { key: 'ArrowRight' });
        expect(onselect).toHaveBeenLastCalledWith('second');
        expect(screen.getByText('08:00:01, 55 km/h')).toBeTruthy();

        const callbacks = callbacksHolder.current;
        if (callbacks === null) {
            throw new TypeError('The time-series runtime callbacks must be captured.');
        }
        callbacks.onactivate({
            blockOffset: 10,
            inlineOffset: 20,
            pointId: 'third',
        });
        expect((await screen.findByRole('tooltip')).textContent).toContain('08:00:02, 30 km/h');
    });

    it('contains asynchronous runtime failures and retains retry behavior', async () => {
        vi.stubGlobal('IntersectionObserver', VisibleIntersectionObserver);
        const runtimeLoader: TimeSeriesRuntimeLoader = vi.fn(() =>
            Promise.reject(new TypeError('Synthetic time-series failure.')),
        );
        const onfailure = vi.fn();

        render(TimeSeriesChart, {
            props: {
                labels,
                model,
                onfailure,
                onselect: vi.fn(),
                runtimeLoader,
            },
        });

        expect(
            await screen.findByRole('heading', {
                name: 'The chart could not be displayed',
            }),
        ).toBeTruthy();
        expect(screen.getByText('The records remain available below.')).toBeTruthy();
        expect(onfailure).toHaveBeenCalledTimes(1);

        await fireEvent.click(screen.getByRole('button', { name: 'Retry chart' }));
        await vi.waitFor(() => {
            expect(onfailure).toHaveBeenCalledTimes(2);
        });
    });
});
