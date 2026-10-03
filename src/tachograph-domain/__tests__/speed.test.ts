import { describe, expect, it } from 'vitest';

import {
    createDetailedSpeedSample,
    createSourceReference,
    isJsonPointer,
    isSpeedKilometresPerHour,
    isUtcTimestamp,
} from '../index.js';

describe('detailed speed', () => {
    it('accepts the complete raw byte range without inventing sentinel meaning', () => {
        expect(isSpeedKilometresPerHour(0)).toBe(true);
        expect(isSpeedKilometresPerHour(0xfe)).toBe(true);
        expect(isSpeedKilometresPerHour(0xff)).toBe(true);
        expect(isSpeedKilometresPerHour(-1)).toBe(false);
        expect(isSpeedKilometresPerHour(0x100)).toBe(false);
        expect(isSpeedKilometresPerHour(1.5)).toBe(false);
    });

    it('creates immutable one-second sample evidence with an exact source', () => {
        const recordedAt = Date.UTC(2026, 5, 18, 8, 42);
        const speed = 72;
        const path = '/transferResParams/0/data/Speed/vuDetailedSpeedData/vuDetailedSpeedBlocks/0/speedsPerSecond/0';
        if (!isUtcTimestamp(recordedAt) || !isSpeedKilometresPerHour(speed) || !isJsonPointer(path)) {
            throw new TypeError('The detailed-speed fixture must be valid.');
        }

        const sample = createDetailedSpeedSample({
            recordedAt,
            source: createSourceReference('vehicleUnit', 'g1', path),
            speedKilometresPerHour: speed,
        });

        expect(sample).toEqual({
            kind: 'detailedSpeedSample',
            recordedAt,
            source: {
                documentKind: 'vehicleUnit',
                generation: 'g1',
                path,
            },
            speedKilometresPerHour: speed,
        });
    });
});
