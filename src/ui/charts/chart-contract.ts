import type { IconName } from '../icon/icon-registry.js';

export type ChartColorToken = `--color-${string}`;

export type IntervalTimelineVariant = 'band' | 'lanes';

export interface IChartRuntime<TModel> {
    dispose(): void;
    focusItem(itemId: string | null): void;
    update(model: TModel): void;
}

export interface IChartHostLabels {
    readonly failureCode: string;
    readonly failureCodeLabel: string;
    readonly failureDescription: string;
    readonly failureHeading: string;
    readonly keyboardHelp: string;
    readonly loading: string;
    readonly retry: string;
    readonly roleDescription: string;
}

export interface IChartLegendItem {
    readonly colorToken: ChartColorToken;
    readonly id: string;
    readonly label: string;
    readonly pattern?: 'diagonal' | 'solid' | undefined;
}

// A legend entry for a marker drawn as an icon rather than as a coloured area.
export interface IChartLegendIconItem {
    readonly icon: IconName;
    readonly id: string;
    readonly label: string;
}

export interface IIntervalTimelineLane {
    readonly bandHeight: number;
    readonly colorToken: ChartColorToken;
    readonly id: string;
    readonly label: string;
    readonly pattern: 'diagonal' | 'solid';
}

export interface IIntervalTimelineSegment {
    readonly description: string;
    readonly end: number;
    readonly id: string;
    readonly laneId: string;
    readonly start: number;
}

// A shaded span behind the lanes, such as a window that applies to part of the domain.
export interface IIntervalTimelineRange {
    readonly colorToken: ChartColorToken;
    readonly end: number;
    readonly id: string;
    readonly label: string;
    readonly start: number;
}

export interface IIntervalTimelineTick {
    readonly display: string;
    readonly value: number;
}

export interface IIntervalTimelineChartModel {
    readonly ariaDescription: string;
    readonly domainEnd: number;
    readonly domainStart: number;
    readonly lanes: readonly IIntervalTimelineLane[];
    readonly ranges: readonly IIntervalTimelineRange[];
    readonly segments: readonly IIntervalTimelineSegment[];
    readonly selectedSegmentId: string | null;
    readonly ticks: readonly IIntervalTimelineTick[];
    readonly variant: IntervalTimelineVariant;
}

export interface IIntervalTimelineActivation {
    readonly blockOffset: number;
    readonly inlineOffset: number;
    readonly segmentId: string;
}

export interface IIntervalTimelineRuntimeCallbacks {
    readonly onactivate: (activation: IIntervalTimelineActivation | null) => void;
    readonly onselect: (segmentId: string | null) => void;
}

export type IIntervalTimelineRuntime = IChartRuntime<IIntervalTimelineChartModel>;

export interface IIntervalTimelineRuntimeModule {
    createIntervalTimelineRuntime(
        element: HTMLElement,
        model: IIntervalTimelineChartModel,
        callbacks: IIntervalTimelineRuntimeCallbacks,
    ): IIntervalTimelineRuntime;
}

export type IntervalTimelineRuntimeLoader = () => Promise<IIntervalTimelineRuntimeModule>;

export interface ITimeSeriesPoint {
    readonly description: string;
    readonly id: string;
    readonly timestamp: number;
    readonly value: number;
}

export interface ITimeSeriesTick {
    readonly display: string;
    readonly value: number;
}

export interface ITimeSeriesThreshold {
    readonly colorToken?: ChartColorToken | undefined;
    readonly label: string;
    readonly value: number;
}

export interface ITimeSeriesChartModel {
    readonly ariaDescription: string;
    readonly colorToken: ChartColorToken;
    readonly domainEnd: number;
    readonly domainStart: number;
    readonly points: readonly ITimeSeriesPoint[];
    readonly selectedPointId: string | null;
    readonly seriesLabel: string;
    readonly thresholds?: readonly ITimeSeriesThreshold[] | undefined;
    readonly ticks: readonly ITimeSeriesTick[];
    readonly timeAxisLabel: string;
    readonly valueAxisLabel: string;
    readonly valueDomainEnd: number;
    readonly valueDomainStart: number;
}

export interface ITimeSeriesActivation {
    readonly blockOffset: number;
    readonly inlineOffset: number;
    readonly pointId: string;
}

export interface ITimeSeriesRuntimeCallbacks {
    readonly onactivate: (activation: ITimeSeriesActivation | null) => void;
    readonly onselect: (pointId: string | null) => void;
}

export type ITimeSeriesRuntime = IChartRuntime<ITimeSeriesChartModel>;

export interface ITimeSeriesRuntimeModule {
    createTimeSeriesRuntime(
        element: HTMLElement,
        model: ITimeSeriesChartModel,
        callbacks: ITimeSeriesRuntimeCallbacks,
    ): ITimeSeriesRuntime;
}

export type TimeSeriesRuntimeLoader = () => Promise<ITimeSeriesRuntimeModule>;
