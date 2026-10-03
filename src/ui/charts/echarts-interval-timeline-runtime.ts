import { CustomChart, type CustomSeriesOption } from 'echarts/charts';
import {
    AriaComponent,
    DataZoomComponent,
    DataZoomInsideComponent,
    DataZoomSliderComponent,
    GridComponent,
    type AriaComponentOption,
    type DataZoomComponentOption,
    type GridComponentOption,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import type { ComposeOption, EChartsCoreOption, EChartsType, ECElementEvent } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

import type {
    IChartRuntime,
    IIntervalTimelineActivation,
    IIntervalTimelineChartModel,
    IIntervalTimelineRange,
    IIntervalTimelineRuntime,
    IIntervalTimelineRuntimeCallbacks,
    IIntervalTimelineSegment,
    ITimeSeriesActivation,
    ITimeSeriesChartModel,
    ITimeSeriesPoint,
    ITimeSeriesRuntime,
    ITimeSeriesRuntimeCallbacks,
} from './chart-contract.js';
import { orderTimeSeriesPoints } from './chart-ordering.js';

type IntervalTimelineOption = ComposeOption<AriaComponentOption | CustomSeriesOption | GridComponentOption>;
type TimeSeriesOption = ComposeOption<AriaComponentOption | CustomSeriesOption | DataZoomComponentOption | GridComponentOption>;
type CustomSeriesRenderItem = NonNullable<CustomSeriesOption['renderItem']>;
type CustomSeriesRenderItemAPI = Parameters<CustomSeriesRenderItem>[1];
type CustomSeriesRenderItemReturn = ReturnType<CustomSeriesRenderItem>;

interface IChartTheme {
    readonly axis: string;
    readonly canvas: string;
    readonly focus: string;
    readonly grid: string;
    readonly gridStrong: string;
    readonly hoverDelay: number;
    readonly lineWidth: number;
    readonly patternDash: number;
    readonly patternGap: number;
    readonly patternRotation: number;
    readonly patternSymbol: number;
    readonly segmentHeight: number;
    readonly separator: number;
    readonly selectionFill: string;
    readonly selectionMarker: number;
    readonly selectionWidth: number;
    readonly surface: string;
    readonly text: string;
    readonly pointSize: number;
}

interface IDecalPattern {
    readonly backgroundColor: string;
    readonly color: string;
    readonly dashArrayX: number[];
    readonly dashArrayY: number[];
    readonly rotation: number;
    readonly symbol: 'rect';
    readonly symbolSize: number;
}

interface ISolidDecal {
    readonly symbol: 'none';
}

interface IChartSegmentData {
    readonly name: string;
    readonly value: readonly [number, number, number];
}

echarts.use([
    AriaComponent,
    CanvasRenderer,
    CustomChart,
    DataZoomComponent,
    DataZoomInsideComponent,
    DataZoomSliderComponent,
    GridComponent,
]);

function readRequiredToken(styles: CSSStyleDeclaration, token: string): string {
    const value = styles.getPropertyValue(token).trim();
    if (value.length === 0) {
        throw new TypeError(`Required chart design token is unavailable: ${token}`);
    }
    return value;
}

function resolveColorToken(element: HTMLElement, token: string): string {
    // Probe element resolves custom properties, light-dark(), and color-mix() into rgb() for canvas.
    const probe = element.ownerDocument.createElement('span');
    probe.style.color = `var(${token})`;
    element.append(probe);
    const value = getComputedStyle(probe).color.trim();
    probe.remove();
    if (value.length === 0) {
        throw new TypeError(`Required chart design token is unavailable: ${token}`);
    }
    return value;
}

function resolveLengthToken(element: HTMLElement, token: string): number {
    // Probe element resolves rem-based tokens to computed pixel values.
    const probe = element.ownerDocument.createElement('span');
    probe.style.borderTopStyle = 'solid';
    probe.style.borderTopWidth = `var(${token})`;
    element.append(probe);
    const pixels = Number.parseFloat(getComputedStyle(probe).borderTopWidth);
    probe.remove();
    if (!Number.isFinite(pixels)) {
        throw new TypeError(`Chart design token is not a numeric length: ${token}`);
    }
    return pixels;
}

function readDurationToken(styles: CSSStyleDeclaration, token: string): number {
    const value = readRequiredToken(styles, token);
    if (value.endsWith('ms')) {
        return Number.parseFloat(value);
    }
    if (value.endsWith('s')) {
        return Number.parseFloat(value) * 1_000;
    }
    throw new TypeError(`Chart design token is not a duration: ${token}`);
}

function readAngleToken(styles: CSSStyleDeclaration, token: string): number {
    const value = readRequiredToken(styles, token);
    if (!value.endsWith('deg')) {
        throw new TypeError(`Chart design token is not a degree angle: ${token}`);
    }
    return (Number.parseFloat(value) * Math.PI) / 180;
}

function readTheme(element: HTMLElement): IChartTheme {
    const styles = getComputedStyle(element);
    return {
        axis: resolveColorToken(element, '--color-text-muted'),
        canvas: resolveColorToken(element, '--color-surface'),
        focus: resolveColorToken(element, '--color-focus'),
        grid: resolveColorToken(element, '--color-chart-grid'),
        gridStrong: resolveColorToken(element, '--color-chart-grid-strong'),
        hoverDelay: readDurationToken(styles, '--duration-chart-hover'),
        lineWidth: resolveLengthToken(element, '--size-chart-line'),
        patternDash: resolveLengthToken(element, '--size-chart-pattern-dash'),
        patternGap: resolveLengthToken(element, '--size-chart-pattern-gap'),
        patternRotation: readAngleToken(styles, '--angle-chart-pattern'),
        patternSymbol: resolveLengthToken(element, '--size-chart-pattern-symbol'),
        segmentHeight: resolveLengthToken(element, '--size-chart-segment'),
        separator: resolveLengthToken(element, '--size-chart-separator'),
        selectionMarker: resolveLengthToken(element, '--size-chart-selection-marker'),
        selectionWidth: resolveLengthToken(element, '--size-chart-selection'),
        selectionFill: resolveColorToken(element, '--color-chart-selection-fill'),
        surface: resolveColorToken(element, '--color-surface'),
        text: resolveColorToken(element, '--color-text'),
        pointSize: resolveLengthToken(element, '--size-chart-point'),
    };
}

function createUnknownPattern(theme: IChartTheme): IDecalPattern {
    return {
        backgroundColor: theme.canvas,
        color: theme.axis,
        dashArrayX: [theme.patternSymbol],
        dashArrayY: [theme.patternDash, theme.patternGap],
        rotation: theme.patternRotation,
        symbol: 'rect',
        symbolSize: theme.patternSymbol,
    };
}

function createSolidDecal(): ISolidDecal {
    // Fresh object per series prevents mutation side-effects; 'none' symbol prevents aria decals on solid lanes.
    return { symbol: 'none' };
}

function numberValue(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

interface ISegmentGeometry {
    readonly height: number;
    readonly markerY: number;
    readonly y: number;
}

function laneGeometry(
    theme: IChartTheme,
    api: CustomSeriesRenderItemAPI,
    start: number,
    laneIndex: number,
): ISegmentGeometry | null {
    const centerY = numberValue(api.coord([start, laneIndex])[1]);
    if (centerY === null) {
        return null;
    }
    return {
        height: theme.segmentHeight,
        markerY: centerY,
        y: centerY - theme.segmentHeight / 2,
    };
}

function bandGeometry(api: CustomSeriesRenderItemAPI, start: number, bandHeight: number): ISegmentGeometry | null {
    const baselineY = numberValue(api.coord([start, 0])[1]);
    const topY = numberValue(api.coord([start, 1])[1]);
    if (baselineY === null || topY === null) {
        return null;
    }
    const height = (baselineY - topY) * bandHeight;
    return {
        height,
        markerY: baselineY - height / 2,
        y: baselineY - height,
    };
}

function renderSegment(
    selectedSegmentId: string | null,
    segmentId: string,
    theme: IChartTheme,
    api: CustomSeriesRenderItemAPI,
    geometry: (api: CustomSeriesRenderItemAPI, start: number) => ISegmentGeometry | null,
): CustomSeriesRenderItemReturn {
    const start = numberValue(api.value(0));
    const end = numberValue(api.value(1));
    if (start === null || end === null) {
        return null;
    }

    const startX = numberValue(api.coord([start, 0])[0]);
    const endX = numberValue(api.coord([end, 0])[0]);
    const placement = geometry(api, start);
    if (startX === null || endX === null || placement === null) {
        return null;
    }
    const selected = segmentId === selectedSegmentId;
    const fill = api.visual('color');
    const decal = api.visual('decal');
    if (fill === undefined) {
        return null;
    }
    const style =
        decal === undefined
            ? {
                  fill,
                  lineWidth: selected ? theme.selectionWidth : theme.separator,
                  stroke: selected ? theme.focus : theme.surface,
              }
            : {
                  decal,
                  fill,
                  lineWidth: selected ? theme.selectionWidth : theme.separator,
                  stroke: selected ? theme.focus : theme.surface,
              };
    const rectangle = {
        emphasisDisabled: true,
        name: segmentId,
        shape: {
            height: placement.height,
            width: Math.max(endX - startX - theme.separator, theme.separator),
            x: startX,
            y: placement.y,
        },
        style,
        type: 'rect' as const,
    };

    if (!selected) {
        return rectangle;
    }

    return {
        children: [
            rectangle,
            {
                name: segmentId,
                shape: {
                    cx: startX + theme.selectionMarker,
                    cy: placement.markerY,
                    r: theme.selectionMarker,
                },
                style: {
                    fill: theme.focus,
                    stroke: theme.surface,
                },
                type: 'circle',
            },
        ],
        emphasisDisabled: true,
        name: segmentId,
        type: 'group',
    };
}

interface IGridRectangle {
    readonly height: number;
    readonly y: number;
}

function gridRectangle(coordSys: unknown): IGridRectangle | null {
    if (typeof coordSys !== 'object' || coordSys === null || !('y' in coordSys) || !('height' in coordSys)) {
        return null;
    }
    const y = numberValue(coordSys.y);
    const height = numberValue(coordSys.height);
    return y === null || height === null ? null : { height, y };
}

// Shaded spans drawn behind every lane over the full grid height; silent, so they never take pointer or selection.
function createRangeSeries(
    element: HTMLElement,
    theme: IChartTheme,
    ranges: readonly IIntervalTimelineRange[],
): CustomSeriesOption {
    return {
        animation: false,
        coordinateSystem: 'cartesian2d',
        data: ranges.map((range) => ({ name: range.id, value: [range.start, range.end] })),
        encode: {
            x: [0, 1],
        },
        renderItem: (params, api) => {
            const range = ranges.at(params.dataIndex);
            const grid = gridRectangle(params.coordSys);
            if (range === undefined || grid === null) {
                return null;
            }
            const startX = numberValue(api.coord([range.start, 0])[0]);
            const endX = numberValue(api.coord([range.end, 0])[0]);
            if (startX === null || endX === null) {
                return null;
            }
            return {
                children: [
                    {
                        shape: { height: grid.height, width: Math.max(endX - startX, 0), x: startX, y: grid.y },
                        style: { fill: resolveColorToken(element, range.colorToken) },
                        type: 'rect',
                    },
                    {
                        style: { fill: theme.axis, text: range.label, x: startX + theme.selectionMarker, y: grid.y },
                        type: 'text',
                    },
                ],
                silent: true,
                type: 'group',
            };
        },
        silent: true,
        type: 'custom',
        z: 0,
    };
}

function segmentData(segment: IIntervalTimelineSegment, laneIndex: number): IChartSegmentData {
    const value: readonly [number, number, number] = [segment.start, segment.end, laneIndex];
    return {
        name: segment.id,
        value,
    };
}

function createIntervalTimelineOption(element: HTMLElement, model: IIntervalTimelineChartModel): IntervalTimelineOption {
    const theme = readTheme(element);
    const band = model.variant === 'band';
    const series = model.lanes.map<CustomSeriesOption>((lane, laneIndex) => {
        const laneSegments = model.segments.filter((segment) => segment.laneId === lane.id);
        const geometry = band
            ? (api: CustomSeriesRenderItemAPI, start: number) => bandGeometry(api, start, lane.bandHeight)
            : (api: CustomSeriesRenderItemAPI, start: number) => laneGeometry(theme, api, start, laneIndex);
        return {
            animation: false,
            coordinateSystem: 'cartesian2d',
            data: laneSegments.map((segment) => segmentData(segment, laneIndex)),
            encode: {
                x: [0, 1],
                y: 2,
            },
            itemStyle: {
                color: resolveColorToken(element, lane.colorToken),
                decal: lane.pattern === 'diagonal' ? createUnknownPattern(theme) : createSolidDecal(),
            },
            name: lane.label,
            renderItem: (params, api) => {
                const segment = laneSegments.at(params.dataIndex);
                return segment === undefined ? null : renderSegment(model.selectedSegmentId, segment.id, theme, api, geometry);
            },
            silent: false,
            type: 'custom',
        };
    });
    const tickByValue = new Map(model.ticks.map((tick) => [tick.value, tick.display]));
    // Appended after the lanes so lane series keep their indices for keyboard focus.
    const ranges = model.ranges.length === 0 ? [] : [createRangeSeries(element, theme, model.ranges)];

    return {
        animation: false,
        aria: {
            decal: {
                show: true,
            },
            description: model.ariaDescription,
            enabled: true,
        },
        backgroundColor: theme.canvas,
        grid: {
            bottom: resolveLengthToken(element, '--space-chart-grid-block'),
            containLabel: true,
            left: resolveLengthToken(element, '--space-chart-grid-inline-start'),
            right: resolveLengthToken(element, '--space-chart-grid-inline-end'),
            top: resolveLengthToken(element, '--space-chart-grid-top'),
        },
        series: [...series, ...ranges],
        xAxis: {
            axisLabel: {
                color: theme.axis,
                formatter: (value: number) => tickByValue.get(value) ?? '',
            },
            axisLine: {
                lineStyle: {
                    color: theme.gridStrong,
                },
            },
            axisTick: {
                lineStyle: {
                    color: theme.gridStrong,
                },
            },
            interval: model.ticks[1]?.value ?? model.domainEnd,
            max: model.domainEnd,
            min: model.domainStart,
            minorSplitLine: {
                lineStyle: {
                    color: theme.grid,
                },
                show: true,
            },
            minorTick: {
                show: true,
                splitNumber: 6,
            },
            splitLine: {
                lineStyle: {
                    color: theme.gridStrong,
                },
                show: true,
            },
            type: 'value',
        },
        yAxis: band
            ? {
                  axisLabel: {
                      show: false,
                  },
                  axisLine: {
                      lineStyle: {
                          color: theme.gridStrong,
                      },
                      show: true,
                  },
                  axisTick: {
                      show: false,
                  },
                  max: 1,
                  min: 0,
                  splitLine: {
                      show: false,
                  },
                  type: 'value',
              }
            : {
                  axisLabel: {
                      color: theme.text,
                  },
                  axisLine: {
                      lineStyle: {
                          color: theme.gridStrong,
                      },
                      show: true,
                  },
                  axisTick: {
                      show: false,
                  },
                  data: model.lanes.map((lane) => lane.label),
                  inverse: true,
                  type: 'category',
              },
    };
}

function eventItemId(event: ECElementEvent): string | null {
    return typeof event.name === 'string' ? event.name : null;
}

// Pointer position of a hover, in pixels within the chart, or null when the event carries none.
function pointerOffsets(event: ECElementEvent): { readonly blockOffset: number; readonly inlineOffset: number } | null {
    const blockOffset = numberValue(event.event?.offsetY);
    const inlineOffset = numberValue(event.event?.offsetX);
    return blockOffset === null || inlineOffset === null ? null : { blockOffset, inlineOffset };
}

function eventActivation(event: ECElementEvent, segmentId: string): IIntervalTimelineActivation | null {
    const offsets = pointerOffsets(event);
    return offsets === null ? null : { ...offsets, segmentId };
}

function timeSeriesActivation(event: ECElementEvent, pointId: string): ITimeSeriesActivation | null {
    const offsets = pointerOffsets(event);
    return offsets === null ? null : { ...offsets, pointId };
}

function timeSeriesTickLabel(model: ITimeSeriesChartModel, value: number): string {
    const exact = model.ticks.find((tick) => tick.value === value);
    if (exact !== undefined) {
        return exact.display;
    }
    const interval =
        model.ticks.length > 1
            ? Math.abs((model.ticks[1]?.value ?? value) - (model.ticks[0]?.value ?? value))
            : Math.abs(model.domainEnd - model.domainStart);
    const nearest = model.ticks.reduce<ITimeSeriesChartModel['ticks'][number] | null>(
        (candidate, tick) =>
            candidate === null || Math.abs(tick.value - value) < Math.abs(candidate.value - value) ? tick : candidate,
        null,
    );
    return nearest !== null && Math.abs(nearest.value - value) <= interval / 4 ? nearest.display : '';
}

function renderTimeSeries(
    model: ITimeSeriesChartModel,
    sortedPoints: readonly ITimeSeriesPoint[],
    selectedPointId: string | null,
    seriesColor: string,
    theme: IChartTheme,
    params: Parameters<CustomSeriesRenderItem>[0],
    api: CustomSeriesRenderItemAPI,
): CustomSeriesRenderItemReturn {
    const point = sortedPoints[params.dataIndex];
    if (point === undefined) {
        return null;
    }
    const currentCoord = api.coord([point.timestamp, point.value]);
    const cx = numberValue(currentCoord[0]);
    const cy = numberValue(currentCoord[1]);
    if (cx === null || cy === null) {
        return null;
    }

    const selected = point.id === selectedPointId;
    const pointCircle = {
        name: point.id,
        shape: {
            cx,
            cy,
            r: selected ? theme.pointSize : theme.pointSize / 2,
        },
        style: {
            fill: selected ? theme.focus : seriesColor,
            lineWidth: selected ? theme.selectionWidth : theme.separator,
            stroke: selected ? theme.surface : seriesColor,
        },
        type: 'circle' as const,
    };

    if (params.dataIndex !== 0) {
        return pointCircle;
    }

    const coordinates: [number, number][] = [];
    for (const p of sortedPoints) {
        const coord = api.coord([p.timestamp, p.value]);
        const x = numberValue(coord[0]);
        const y = numberValue(coord[1]);
        if (x !== null && y !== null) {
            coordinates.push([x, y]);
        }
    }

    return {
        children: [
            {
                name: model.seriesLabel,
                shape: {
                    points: coordinates,
                },
                silent: true,
                style: {
                    fill: 'none',
                    lineWidth: theme.lineWidth,
                    stroke: seriesColor,
                },
                type: 'polyline',
            },
            pointCircle,
        ],
        name: model.seriesLabel,
        type: 'group',
    };
}

function createTimeSeriesOption(
    element: HTMLElement,
    model: ITimeSeriesChartModel,
    selectedPointId: string | null,
): TimeSeriesOption {
    const theme = readTheme(element);
    const seriesColor = resolveColorToken(element, model.colorToken);
    const rawInterval =
        model.ticks.length > 1
            ? Math.abs((model.ticks[1]?.value ?? 0) - (model.ticks[0]?.value ?? 0))
            : Math.max(model.domainEnd - model.domainStart, 1);
    const interval = Number.isFinite(rawInterval) && rawInterval > 0 ? rawInterval : undefined;

    const sortedPoints = orderTimeSeriesPoints(model.points);

    const TIME_SERIES_ZOOM_SLIDER_HEIGHT = 18;
    const TIME_SERIES_ZOOM_SLIDER_BOTTOM_OFFSET = 2;
    const TIME_SERIES_GRID_BOTTOM_SLIDER_CLEARANCE = 22;
    const TIME_SERIES_ZOOM_FONT_SIZE = 9;

    return {
        animation: false,
        aria: {
            description: model.ariaDescription,
            enabled: true,
        },
        backgroundColor: theme.canvas,
        dataZoom: [
            {
                filterMode: 'filter',
                type: 'inside',
                xAxisIndex: [0],
            },
            {
                borderColor: theme.grid,
                bottom: TIME_SERIES_ZOOM_SLIDER_BOTTOM_OFFSET,
                brushSelect: true,
                dataBackground: {
                    areaStyle: {
                        color: theme.surface,
                    },
                    lineStyle: {
                        color: seriesColor,
                        width: 1,
                    },
                },
                fillerColor: theme.selectionFill,
                handleSize: '80%',
                handleStyle: {
                    color: theme.axis,
                    shadowBlur: 2,
                },
                height: TIME_SERIES_ZOOM_SLIDER_HEIGHT,
                selectedDataBackground: {
                    areaStyle: {
                        color: seriesColor,
                    },
                    lineStyle: {
                        color: seriesColor,
                    },
                },
                textStyle: {
                    color: theme.axis,
                    fontSize: TIME_SERIES_ZOOM_FONT_SIZE,
                },
                type: 'slider',
                xAxisIndex: [0],
            },
        ],
        grid: {
            bottom: resolveLengthToken(element, '--space-chart-grid-block') + TIME_SERIES_GRID_BOTTOM_SLIDER_CLEARANCE,
            containLabel: true,
            left: resolveLengthToken(element, '--space-chart-grid-inline-start'),
            right: resolveLengthToken(element, '--space-chart-grid-inline-end'),
            top: resolveLengthToken(element, '--space-chart-grid-top'),
        },
        series: {
            animation: false,
            coordinateSystem: 'cartesian2d',
            data: sortedPoints.map((point) => ({
                name: point.id,
                value: [point.timestamp, point.value],
            })),
            encode: {
                x: 0,
                y: 1,
            },
            ...(model.thresholds !== undefined && model.thresholds.length > 0
                ? {
                      markLine: {
                          animation: false,
                          data: model.thresholds.map((threshold) => ({
                              label: {
                                  color: theme.axis,
                                  fontSize: 10,
                                  formatter: `${threshold.label} (${String(threshold.value)})`,
                                  position: 'insideEndTop',
                                  show: true,
                              },
                              lineStyle: {
                                  color:
                                      threshold.colorToken !== undefined
                                          ? resolveColorToken(element, threshold.colorToken)
                                          : theme.gridStrong,
                                  type: 'dashed',
                                  width: 1,
                              },
                              name: threshold.label,
                              yAxis: threshold.value,
                          })),
                          silent: true,
                          symbol: 'none',
                      },
                  }
                : {}),
            name: model.seriesLabel,
            renderItem: (params, api) => renderTimeSeries(model, sortedPoints, selectedPointId, seriesColor, theme, params, api),
            silent: false,
            type: 'custom',
        },
        xAxis: {
            axisLabel: {
                color: theme.axis,
                formatter: (value: number) => timeSeriesTickLabel(model, value),
                hideOverlap: true,
            },
            axisLine: {
                lineStyle: {
                    color: theme.gridStrong,
                },
            },
            axisTick: {
                lineStyle: {
                    color: theme.gridStrong,
                },
            },
            ...(interval !== undefined ? { interval } : {}),
            max: model.domainEnd,
            min: model.domainStart,
            name: model.timeAxisLabel,
            // Centered below axis to avoid right-margin clipping and label collisions; space reserved by containLabel.
            nameGap: 24,
            nameLocation: 'middle',
            nameTextStyle: {
                color: theme.axis,
            },
            splitLine: {
                lineStyle: {
                    color: theme.grid,
                },
                show: true,
            },
            type: 'value',
        },
        yAxis: {
            axisLabel: {
                color: theme.axis,
            },
            axisLine: {
                lineStyle: {
                    color: theme.gridStrong,
                },
                show: true,
            },
            axisTick: {
                lineStyle: {
                    color: theme.gridStrong,
                },
            },
            max: model.valueDomainEnd,
            min: model.valueDomainStart,
            name: model.valueAxisLabel,
            nameGap: 14,
            nameTextStyle: {
                align: 'left',
                color: theme.axis,
            },
            splitLine: {
                lineStyle: {
                    color: theme.grid,
                },
                show: true,
            },
            type: 'value',
        },
    };
}

abstract class ChartRuntime<TModel> implements IChartRuntime<TModel> {
    protected readonly chart: EChartsType;
    protected readonly element: HTMLElement;
    protected model: TModel;
    private _hoverTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly _resizeObserver: ResizeObserver | null;
    private readonly _themeObserver: MutationObserver;

    public constructor(element: HTMLElement, model: TModel) {
        this.element = element;
        this.model = model;
        this.chart = echarts.init(element, undefined, {
            renderer: 'canvas',
            useDirtyRect: true,
        });
        this._resizeObserver =
            typeof ResizeObserver === 'function'
                ? new ResizeObserver(() => {
                      this.chart.resize();
                  })
                : null;
        this._resizeObserver?.observe(element);
        this._themeObserver = new MutationObserver(() => {
            this.update(this.model);
        });
        this._themeObserver.observe(document.documentElement, {
            attributeFilter: ['class', 'data-density', 'data-theme', 'style'],
            attributes: true,
        });
    }

    public dispose(): void {
        this.clearHoverTimer();
        this._resizeObserver?.disconnect();
        this._themeObserver.disconnect();
        this.chart.dispose();
    }

    public abstract focusItem(itemId: string | null): void;

    // A click selects the item under the pointer; hovering activates it after the hover delay and leaving clears it.
    protected bindItemEvents<TActivation>(
        itemIdOf: (event: ECElementEvent) => string | null,
        activationOf: (event: ECElementEvent, itemId: string) => TActivation | null,
        callbacks: { onactivate(activation: TActivation | null): void; onselect(itemId: string): void },
    ): void {
        this.chart.on('click', (event: ECElementEvent) => {
            const itemId = itemIdOf(event);
            if (itemId !== null) {
                callbacks.onselect(itemId);
            }
        });
        this.chart.on('mouseover', (event: ECElementEvent) => {
            const itemId = itemIdOf(event);
            if (itemId === null) {
                return;
            }
            this.scheduleHover(() => {
                callbacks.onactivate(activationOf(event, itemId));
            });
        });
        this.chart.on('mouseout', () => {
            this.clearHoverTimer();
            callbacks.onactivate(null);
        });
    }

    public update(model: TModel): void {
        this.model = model;
        this.chart.setOption(this.createOption(model), {
            lazyUpdate: false,
            notMerge: true,
        });
    }

    protected abstract createOption(model: TModel): EChartsCoreOption;

    protected clearHoverTimer(): void {
        if (this._hoverTimer !== null) {
            clearTimeout(this._hoverTimer);
            this._hoverTimer = null;
        }
    }

    protected scheduleHover(callback: () => void): void {
        this.clearHoverTimer();
        this._hoverTimer = setTimeout(() => {
            callback();
            this._hoverTimer = null;
        }, readTheme(this.element).hoverDelay);
    }
}

class IntervalTimelineRuntime extends ChartRuntime<IIntervalTimelineChartModel> implements IIntervalTimelineRuntime {
    public constructor(element: HTMLElement, model: IIntervalTimelineChartModel, callbacks: IIntervalTimelineRuntimeCallbacks) {
        super(element, model);
        this.bindItemEvents(eventItemId, eventActivation, callbacks);
        this.update(model);
    }

    public focusItem(segmentId: string | null): void {
        this.chart.dispatchAction({
            type: 'downplay',
        });
        if (segmentId === null) {
            return;
        }
        const segment = this.model.segments.find((candidate) => candidate.id === segmentId);
        if (segment === undefined) {
            return;
        }
        const seriesIndex = this.model.lanes.findIndex((lane) => lane.id === segment.laneId);
        const dataIndex = this.model.segments
            .filter((candidate) => candidate.laneId === segment.laneId)
            .findIndex((candidate) => candidate.id === segmentId);
        this.chart.dispatchAction({
            dataIndex,
            seriesIndex,
            type: 'highlight',
        });
    }

    protected createOption(model: IIntervalTimelineChartModel): IntervalTimelineOption {
        return createIntervalTimelineOption(this.element, model);
    }
}

class TimeSeriesRuntime extends ChartRuntime<ITimeSeriesChartModel> implements ITimeSeriesRuntime {
    private _focusedPointId: string | null = null;

    public constructor(element: HTMLElement, model: ITimeSeriesChartModel, callbacks: ITimeSeriesRuntimeCallbacks) {
        super(element, model);
        this.bindItemEvents((event) => this.eventPointId(event), timeSeriesActivation, callbacks);
        this.update(model);
    }

    public focusItem(pointId: string | null): void {
        if (pointId === this._focusedPointId) {
            return;
        }
        this._focusedPointId = pointId;
        this.update(this.model);
    }

    protected createOption(model: ITimeSeriesChartModel): TimeSeriesOption {
        return createTimeSeriesOption(this.element, model, this._focusedPointId ?? model.selectedPointId);
    }

    private eventPointId(event: ECElementEvent): string | null {
        const namedPointId = eventItemId(event);
        if (namedPointId !== null && this.model.points.some((point) => point.id === namedPointId)) {
            return namedPointId;
        }
        const dataIndex = numberValue(event.dataIndex);
        if (dataIndex === null || !Number.isInteger(dataIndex)) {
            return null;
        }
        const sortedPoints = orderTimeSeriesPoints(this.model.points);
        return sortedPoints[dataIndex]?.id ?? null;
    }
}

export function createIntervalTimelineRuntime(
    element: HTMLElement,
    model: IIntervalTimelineChartModel,
    callbacks: IIntervalTimelineRuntimeCallbacks,
): IIntervalTimelineRuntime {
    return new IntervalTimelineRuntime(element, model, callbacks);
}

export function createTimeSeriesRuntime(
    element: HTMLElement,
    model: ITimeSeriesChartModel,
    callbacks: ITimeSeriesRuntimeCallbacks,
): ITimeSeriesRuntime {
    return new TimeSeriesRuntime(element, model, callbacks);
}
