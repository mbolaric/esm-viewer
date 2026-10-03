import {
    createSourceReference,
    isJsonPointer,
    isSpeedKilometresPerHour,
    isUtcTimestamp,
    type ISourceReference,
} from '#viewer-domain';
import { describe, expect, it } from 'vitest';

import { createOverspeedRecord } from '../overspeed.js';

function validSource(path: string): ISourceReference<'g2', 'vehicleUnit'> {
    if (!isJsonPointer(path)) {
        throw new TypeError('The overspeed source fixture must be a JSON pointer.');
    }
    return createSourceReference('vehicleUnit', 'g2', path);
}

function validRecord(): ReturnType<typeof createOverspeedRecord> {
    const begin = Date.UTC(2026, 5, 18, 8);
    const end = begin + 5 * 60 * 1_000;
    const maxSpeed = 98;
    if (!isUtcTimestamp(begin) || !isUtcTimestamp(end) || !isSpeedKilometresPerHour(maxSpeed)) {
        throw new TypeError('The overspeed fixture must be valid.');
    }
    return createOverspeedRecord({
        averageSpeedKilometresPerHour: 95,
        begin,
        cardNumberDriverSlotBegin: null,
        end,
        maxSpeedKilometresPerHour: maxSpeed,
        purpose: 'oneOf10MostRecentOrLast',
        similarEventsNumber: 1,
        source: validSource('/overspeed/0'),
    });
}

describe('createOverspeedRecord', () => {
    it('creates a typed overspeed record with raw evidence', () => {
        const record = validRecord();
        expect(record).not.toBeNull();
        expect(record).toMatchObject({
            kind: 'overspeedRecord',
            averageSpeedKilometresPerHour: 95,
            maxSpeedKilometresPerHour: 98,
            purpose: 'oneOf10MostRecentOrLast',
            similarEventsNumber: 1,
        });
        expect(record?.source.path).toBe('/overspeed/0');
    });

    it('rejects an end before begin', () => {
        const record = validRecord();
        if (record === null) {
            throw new TypeError('The overspeed fixture must be valid.');
        }
        expect(
            createOverspeedRecord({
                ...record,
                begin: record.end ?? record.begin,
                end: record.begin,
            }),
        ).toBeNull();
    });

    it('rejects an out-of-range average speed', () => {
        const record = validRecord();
        if (record === null) {
            throw new TypeError('The overspeed fixture must be valid.');
        }
        expect(
            createOverspeedRecord({
                ...record,
                averageSpeedKilometresPerHour: 0x100,
            }),
        ).toBeNull();
    });

    it('rejects an out-of-range similar-events count', () => {
        const record = validRecord();
        if (record === null) {
            throw new TypeError('The overspeed fixture must be valid.');
        }
        expect(
            createOverspeedRecord({
                ...record,
                similarEventsNumber: 0x100,
            }),
        ).toBeNull();
    });
});
