import { describe, expect, it } from 'vitest';

import type { IIntervalTimelineSegment, ITimeSeriesPoint } from '../charts/chart-contract.js';
import { orderIntervalSegments, orderTimeSeriesPoints } from '../charts/chart-ordering.js';

function point(id: string, timestamp: number): ITimeSeriesPoint {
    return { description: id, id, timestamp, value: 1 };
}

function segment(id: string, start: number, end: number): IIntervalTimelineSegment {
    return { description: id, end, id, laneId: 'lane', start };
}

describe('orderTimeSeriesPoints', () => {
    it('sorts by timestamp and breaks ties by id without mutating the input', () => {
        const input = [point('c', 30), point('b', 10), point('a', 10)];

        expect(orderTimeSeriesPoints(input).map((item) => item.id)).toEqual(['a', 'b', 'c']);
        expect(input.map((item) => item.id)).toEqual(['c', 'b', 'a']);
    });
});

describe('orderIntervalSegments', () => {
    it('sorts by start and breaks ties by end without mutating the input', () => {
        const input = [segment('late', 20, 30), segment('long', 5, 40), segment('short', 5, 10)];

        expect(orderIntervalSegments(input).map((item) => item.id)).toEqual(['short', 'long', 'late']);
        expect(input.map((item) => item.id)).toEqual(['late', 'long', 'short']);
    });
});
