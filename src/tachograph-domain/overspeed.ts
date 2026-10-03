import type { EventFaultRecordPurpose } from './event-fault.js';
import type { IRecordedCardReference } from './location.js';
import type { ISourceReference } from './source-reference.js';
import type { SpeedKilometresPerHour } from './speed.js';
import type { TachographGeneration } from './tachograph.js';
import type { UtcTimestamp } from './time.js';

export interface IOverspeedRecord {
    readonly averageSpeedKilometresPerHour: number;
    readonly begin: UtcTimestamp;
    readonly cardNumberDriverSlotBegin: IRecordedCardReference | null;
    readonly end: UtcTimestamp | null;
    readonly kind: 'overspeedRecord';
    readonly maxSpeedKilometresPerHour: SpeedKilometresPerHour;
    readonly purpose: EventFaultRecordPurpose;
    readonly similarEventsNumber: number | null;
    readonly source: ISourceReference<TachographGeneration, 'vehicleUnit'>;
}

export interface IOverspeedControlData {
    readonly firstOverspeedSince: UtcTimestamp | null;
    readonly kind: 'overspeedControlData';
    readonly lastOverspeedControlTime: UtcTimestamp | null;
    readonly numberOfOverspeedSince: number | null;
    readonly source: ISourceReference<TachographGeneration, 'vehicleUnit'>;
}

interface IOverspeedRecordInput {
    readonly averageSpeedKilometresPerHour: number;
    readonly begin: UtcTimestamp;
    readonly cardNumberDriverSlotBegin: IRecordedCardReference | null;
    readonly end: UtcTimestamp | null;
    readonly maxSpeedKilometresPerHour: SpeedKilometresPerHour;
    readonly purpose: EventFaultRecordPurpose;
    readonly similarEventsNumber: number | null;
    readonly source: ISourceReference<TachographGeneration, 'vehicleUnit'>;
}

export function createOverspeedRecord(input: IOverspeedRecordInput): IOverspeedRecord | null {
    if (
        (input.end !== null && input.end < input.begin) ||
        !Number.isFinite(input.averageSpeedKilometresPerHour) ||
        input.averageSpeedKilometresPerHour < 0 ||
        input.averageSpeedKilometresPerHour > 0xff ||
        (input.similarEventsNumber !== null &&
            (!Number.isInteger(input.similarEventsNumber) || input.similarEventsNumber < 0 || input.similarEventsNumber > 0xff))
    ) {
        return null;
    }

    return {
        averageSpeedKilometresPerHour: input.averageSpeedKilometresPerHour,
        begin: input.begin,
        cardNumberDriverSlotBegin: input.cardNumberDriverSlotBegin,
        end: input.end,
        kind: 'overspeedRecord',
        maxSpeedKilometresPerHour: input.maxSpeedKilometresPerHour,
        purpose: input.purpose,
        similarEventsNumber: input.similarEventsNumber,
        source: input.source,
    };
}
