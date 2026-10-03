import type { IIntervalTimelineSegment, ITimeSeriesPoint } from './chart-contract.js';

// The chart runtime resolves an ECharts `dataIndex` against this order, and the keyboard navigation walks the same
// order, so both must use these functions.
export function orderTimeSeriesPoints(points: readonly ITimeSeriesPoint[]): ITimeSeriesPoint[] {
    return [...points].sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id));
}

export function orderIntervalSegments(segments: readonly IIntervalTimelineSegment[]): IIntervalTimelineSegment[] {
    return [...segments].sort((left, right) => left.start - right.start || left.end - right.end);
}
