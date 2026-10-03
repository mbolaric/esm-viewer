import { expect, vi } from 'vitest';

import type {
    IIntervalTimelineChartModel,
    IIntervalTimelineRuntimeCallbacks,
    IIntervalTimelineRuntimeModule,
    IntervalTimelineRuntimeLoader,
    ITimeSeriesChartModel,
    ITimeSeriesRuntime,
    ITimeSeriesRuntimeModule,
    TimeSeriesRuntimeLoader,
} from '#ui';

// Stubs IntersectionObserver to report charts immediately visible in jsdom.
export class VisibleIntersectionObserver implements IntersectionObserver {
    public readonly root: Document | Element | null = null;
    public readonly rootMargin = '0px';
    public readonly scrollMargin = '0px';
    public readonly thresholds = [0];
    private readonly _callback: IntersectionObserverCallback;

    public constructor(callback: IntersectionObserverCallback) {
        this._callback = callback;
    }

    public disconnect(): void {
        // The stub keeps the element visible for the chart runtime.
    }

    public observe(target: Element): void {
        queueMicrotask(() => {
            const bounds = target.getBoundingClientRect();
            const entry: IntersectionObserverEntry = {
                boundingClientRect: bounds,
                intersectionRatio: 1,
                intersectionRect: bounds,
                isIntersecting: true,
                rootBounds: null,
                target,
                time: 0,
            };
            this._callback([entry], this);
        });
    }

    public takeRecords(): IntersectionObserverEntry[] {
        return [];
    }

    public unobserve(): void {
        // The stub keeps the element visible for the chart runtime.
    }
}

// TimeSeriesRuntimeLoader stub capturing rendered chart models.
export function createCapturingTimeSeriesRuntimeLoader(): {
    readonly capturedModels: ITimeSeriesChartModel[];
    readonly runtimeLoader: TimeSeriesRuntimeLoader;
} {
    const capturedModels: ITimeSeriesChartModel[] = [];
    const runtime: ITimeSeriesRuntime = {
        dispose: vi.fn(),
        focusItem: vi.fn(),
        update: vi.fn(),
    };
    const runtimeModule: ITimeSeriesRuntimeModule = {
        createTimeSeriesRuntime: (element, chartModel) => {
            expect(element).toBeInstanceOf(HTMLElement);
            capturedModels.push(chartModel);
            return runtime;
        },
    };
    const runtimeLoader: TimeSeriesRuntimeLoader = vi.fn(() => Promise.resolve(runtimeModule));
    return { capturedModels, runtimeLoader };
}

// IntervalTimelineRuntimeLoader stub capturing rendered chart models and the selection callbacks.
export function createCapturingIntervalTimelineRuntimeLoader(): {
    readonly callbacks: IIntervalTimelineRuntimeCallbacks[];
    readonly capturedModels: IIntervalTimelineChartModel[];
    readonly runtimeLoader: IntervalTimelineRuntimeLoader;
} {
    const callbacks: IIntervalTimelineRuntimeCallbacks[] = [];
    const capturedModels: IIntervalTimelineChartModel[] = [];
    const runtimeModule: IIntervalTimelineRuntimeModule = {
        createIntervalTimelineRuntime: (element, chartModel, runtimeCallbacks) => {
            expect(element).toBeInstanceOf(HTMLElement);
            capturedModels.push(chartModel);
            callbacks.push(runtimeCallbacks);
            return {
                dispose: vi.fn(),
                focusItem: vi.fn(),
                update: vi.fn((next: IIntervalTimelineChartModel) => {
                    capturedModels.push(next);
                }),
            };
        },
    };
    const runtimeLoader: IntervalTimelineRuntimeLoader = vi.fn(() => Promise.resolve(runtimeModule));
    return { callbacks, capturedModels, runtimeLoader };
}
