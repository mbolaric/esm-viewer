import type { ISourceReference } from './source-reference.js';
import type { TachographGeneration } from './tachograph.js';
import type { UtcTimestamp } from './time.js';

declare const speedKilometresPerHourBrand: unique symbol;

export type SpeedKilometresPerHour = number & {
    readonly [speedKilometresPerHourBrand]: 'SpeedKilometresPerHour';
};

export interface IDetailedSpeedSample {
    readonly kind: 'detailedSpeedSample';
    readonly recordedAt: UtcTimestamp;
    readonly source: ISourceReference<TachographGeneration, 'vehicleUnit'>;
    readonly speedKilometresPerHour: SpeedKilometresPerHour;
}

export interface IDetailedSpeedSampleInput {
    readonly recordedAt: UtcTimestamp;
    readonly source: ISourceReference<TachographGeneration, 'vehicleUnit'>;
    readonly speedKilometresPerHour: SpeedKilometresPerHour;
}

export function isSpeedKilometresPerHour(value: unknown): value is SpeedKilometresPerHour {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xff;
}

export function createDetailedSpeedSample(input: IDetailedSpeedSampleInput): IDetailedSpeedSample {
    return {
        kind: 'detailedSpeedSample',
        recordedAt: input.recordedAt,
        source: input.source,
        speedKilometresPerHour: input.speedKilometresPerHour,
    };
}
