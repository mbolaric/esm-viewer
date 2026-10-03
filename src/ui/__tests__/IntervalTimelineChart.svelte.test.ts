import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import IntervalTimelineChart from '../charts/IntervalTimelineChart.svelte';
import type {
    IIntervalTimelineChartModel,
    IIntervalTimelineRuntime,
    IIntervalTimelineRuntimeCallbacks,
    IIntervalTimelineRuntimeModule,
    IntervalTimelineRuntimeLoader,
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
    failureHeading: 'The timeline could not be displayed',
    keyboardHelp: 'Use arrow keys to move through records.',
    loading: 'Loading timeline…',
    retry: 'Retry timeline',
    roleDescription: 'timeline chart',
};

const model: IIntervalTimelineChartModel = {
    ariaDescription: 'A 24-hour activity timeline',
    domainEnd: 24,
    domainStart: 0,
    lanes: [
        {
            bandHeight: 1,
            colorToken: '--color-activity-driving',
            id: 'driving',
            label: 'Driving',
            pattern: 'solid',
        },
        {
            bandHeight: 0.2,
            colorToken: '--color-activity-unknown',
            id: 'unknown',
            label: 'Unknown',
            pattern: 'diagonal',
        },
    ],
    ranges: [],
    segments: [
        {
            description: 'Driving, 08:00–09:00, 1 hour, UTC',
            end: 9,
            id: 'first',
            laneId: 'driving',
            start: 8,
        },
        {
            description: 'Unknown, 09:00–10:00, 1 hour, UTC',
            end: 10,
            id: 'second',
            laneId: 'unknown',
            start: 9,
        },
    ],
    selectedSegmentId: null,
    ticks: [
        { display: '00:00', value: 0 },
        { display: '24:00', value: 24 },
    ],
    variant: 'lanes',
};

describe('IntervalTimelineChart', () => {
    it('loads when visible and provides one keyboard interaction path over chronological data', async () => {
        vi.stubGlobal('IntersectionObserver', VisibleIntersectionObserver);
        const runtime: IIntervalTimelineRuntime = {
            dispose: vi.fn(),
            focusItem: vi.fn(),
            update: vi.fn(),
        };
        const callbacksHolder: { current: IIntervalTimelineRuntimeCallbacks | null } = {
            current: null,
        };
        const runtimeModule: IIntervalTimelineRuntimeModule = {
            createIntervalTimelineRuntime: (element, chartModel, callbacks) => {
                expect(element).toBeInstanceOf(HTMLElement);
                expect(chartModel).toBe(model);
                callbacksHolder.current = callbacks;
                return runtime;
            },
        };
        const runtimeLoader: IntervalTimelineRuntimeLoader = vi.fn(() => Promise.resolve(runtimeModule));
        const onselect = vi.fn();

        render(IntervalTimelineChart, {
            props: {
                labels,
                model,
                onfailure: vi.fn(),
                onselect,
                runtimeLoader,
            },
        });

        const chart = screen.getByRole('button', {
            name: 'A 24-hour activity timeline',
        });
        await vi.waitFor(() => {
            expect(runtimeLoader).toHaveBeenCalledTimes(1);
        });
        await fireEvent.focus(chart);
        expect(screen.getByText('Driving, 08:00–09:00, 1 hour, UTC')).toBeTruthy();

        await fireEvent.keyDown(chart, { key: 'ArrowRight' });
        expect(onselect).toHaveBeenLastCalledWith('second');
        expect(screen.getByText('Unknown, 09:00–10:00, 1 hour, UTC')).toBeTruthy();

        await fireEvent.keyDown(chart, { key: 'Home' });
        expect(onselect).toHaveBeenLastCalledWith('first');

        await fireEvent.keyDown(chart, { key: 'Escape' });
        expect(onselect).toHaveBeenLastCalledWith(null);

        const callbacks = callbacksHolder.current;
        if (callbacks === null) {
            throw new TypeError('The timeline runtime callbacks must be captured.');
        }
        callbacks.onactivate({
            blockOffset: 10,
            inlineOffset: 20,
            segmentId: 'second',
        });
        expect((await screen.findByRole('tooltip')).textContent).toContain('Unknown, 09:00–10:00, 1 hour, UTC');
    });

    it('contains asynchronous loading failures and offers a bounded retry', async () => {
        vi.stubGlobal('IntersectionObserver', VisibleIntersectionObserver);
        const runtimeLoader: IntervalTimelineRuntimeLoader = vi.fn(() =>
            Promise.reject(new TypeError('Synthetic chart load failure.')),
        );
        const onfailure = vi.fn();

        render(IntervalTimelineChart, {
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
                name: 'The timeline could not be displayed',
            }),
        ).toBeTruthy();
        expect(screen.getByText('The records remain available below.')).toBeTruthy();
        expect(screen.getByText('viewer.chart-render-failed')).toBeTruthy();
        expect(onfailure).toHaveBeenCalledTimes(1);

        await fireEvent.click(screen.getByRole('button', { name: 'Retry timeline' }));
        await vi.waitFor(() => {
            expect(onfailure).toHaveBeenCalledTimes(2);
        });
    });
});
