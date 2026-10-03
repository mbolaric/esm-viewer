import { isDurationMilliseconds, isUtcTimestamp } from '#viewer-domain';
import type {
    ActivityInterval,
    DurationMilliseconds,
    IDetailedSpeedSample,
    IOverspeedRecord,
    IActivityDay,
    ICardNotes,
    ICardUse,
    ITachographWarning,
    IVehicleUnitDailyOdometerTechnicalRecord,
    SpeedKilometresPerHour,
    TachographLocationRecord,
    TachographAssociation,
    TachographEventFault,
    TachographGeneration,
    TachographIdentity,
    TachographTechnicalRecord,
    UtcTimestamp,
    IVehicleUnitUse,
    IVehicleUse,
} from '#viewer-domain';
import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_HOUR } from '#time';

import { createDocumentIntegrityProjection } from './document-integrity.js';
import type { IDocumentIntegrityCounts } from './document-integrity.js';
import type { OpenedTachographDocument } from './opened-document.js';

export type EventFaultTypeFilter = 'all' | 'event' | 'fault';
export type AssociationGenerationFilter = 'all' | TachographGeneration;
export type LocationRecordTypeFilter =
    'all' | 'borderCrossing' | 'gen2v2Operations' | 'loadTypeEntry' | 'loadUnloadOperation' | 'place' | 'position';

export const detailedSpeedChartSampleLimit = 1_200;
export const detailedSpeedPageSize = 300;
export const maximumDetailedSpeedRangeMilliseconds = MILLISECONDS_PER_DAY;

export interface IDetailedSpeedProjectionRequest {
    readonly end: UtcTimestamp | null;
    readonly pageIndex: number;
    readonly preferredSample: IDetailedSpeedSample | null;
    readonly start: UtcTimestamp | null;
}

export interface IDetailedSpeedChartSample {
    readonly pageIndex: number;
    readonly sample: IDetailedSpeedSample;
}

export interface IDetailedSpeedStatistics {
    readonly averageSpeedKilometresPerHour: number;
    readonly maximumSpeedKilometresPerHour: SpeedKilometresPerHour;
    readonly minimumSpeedKilometresPerHour: SpeedKilometresPerHour;
}

export interface IDetailedSpeedRangeMeasurement {
    readonly distanceKilometres: number;
    readonly durationMilliseconds: DurationMilliseconds;
}

export interface IDocumentDetailedSpeedProjection {
    readonly chartSamples: readonly IDetailedSpeedChartSample[];
    readonly chartSamplesReduced: boolean;
    readonly coverage: IDocumentCoverage | null;
    readonly measurement: IDetailedSpeedRangeMeasurement | null;
    readonly pageCount: number;
    readonly pageIndex: number;
    readonly range: IDocumentCoverage | null;
    readonly rangeLimited: boolean;
    readonly samples: readonly IDetailedSpeedSample[];
    readonly statistics: IDetailedSpeedStatistics | null;
    readonly totalSamples: number;
}

export interface IDocumentActivityRecord {
    readonly generation: TachographGeneration;
    readonly interval: ActivityInterval;
    readonly midnightUtc: UtcTimestamp;
    readonly recordKind: 'activity';
    readonly source: ActivityInterval['source'];
}

export interface IDocumentActivityDayProjection {
    readonly day: IActivityDay;
    readonly generation: TachographGeneration;
    readonly records: readonly IDocumentActivityRecord[];
}

export interface IDocumentContentCounts {
    readonly activityDays: number;
    readonly events: number;
    readonly faults: number;
    readonly inferredActivityGaps: number;
    readonly recordedActivityIntervals: number;
    readonly warnings: number;
}

export interface IDocumentCoverage {
    readonly end: UtcTimestamp;
    readonly start: UtcTimestamp;
}

export interface IDocumentOverviewProjection {
    readonly applicationGenerations: readonly TachographGeneration[];
    readonly cardNotes: readonly ICardNotes[];
    readonly counts: IDocumentContentCounts;
    readonly coverage: IDocumentCoverage | null;
    readonly identities: readonly TachographIdentity[];
    readonly integrityCounts: IDocumentIntegrityCounts;
    readonly warnings: readonly ITachographWarning[];
}

type SortKey<TItem> = (item: TItem) => number | string;

// Orders items by each key in turn; the first key on which two items differ decides. Keys are compared with `<`, so
// a value that must sort last (for example a missing one) needs its own leading 0/1 key.
function compareByKeys<TItem>(...keys: readonly SortKey<TItem>[]): (left: TItem, right: TItem) => number {
    return (left, right) => {
        for (const key of keys) {
            const leftKey = key(left);
            const rightKey = key(right);
            if (leftKey !== rightKey) {
                return leftKey < rightKey ? -1 : 1;
            }
        }
        return 0;
    };
}

const sourcePath = (item: { readonly source: { readonly path: string } }): string => item.source.path;

const generationOrder: Readonly<Record<TachographGeneration, number>> = {
    g1: 0,
    g2: 1,
    g2v2: 2,
};

const compareActivityRecords = compareByKeys<IDocumentActivityRecord>(
    (record) => record.interval.start,
    (record) => record.interval.end,
    (record) => generationOrder[record.generation],
    (record) => (record.source === null ? 1 : 0),
    (record) => record.source?.path ?? '',
);

const compareActivityDays = compareByKeys<IDocumentActivityDayProjection>(
    (projection) => projection.day.midnightUtc,
    (projection) => generationOrder[projection.generation],
);

const compareEventFaultRecords = compareByKeys<TachographEventFault>(
    (record) => record.start,
    (record) => (record.recordKind === 'event' ? 0 : 1),
    sourcePath,
);

function associationStart(record: TachographAssociation): UtcTimestamp {
    return record.kind === 'vehicleUse' ? record.firstUse : record.kind === 'vehicleUnitUse' ? record.usedAt : record.insertion;
}

function locationRecordedAt(record: TachographLocationRecord): UtcTimestamp {
    if (record.kind === 'dailyWorkPeriodPlace') {
        return record.entryAt;
    }
    if (record.kind === 'accumulatedDrivingPosition') {
        return record.recordedAt;
    }
    if (record.kind === 'borderCrossing') {
        return record.crossedAt;
    }
    if (record.kind === 'loadUnloadOperation') {
        return record.operationAt;
    }
    return record.enteredAt;
}

const compareLocationRecords = compareByKeys<TachographLocationRecord>(
    locationRecordedAt,
    (record) => (record.kind === 'dailyWorkPeriodPlace' ? 0 : 1),
    sourcePath,
);

const compareDetailedSpeedSamples = compareByKeys<IDetailedSpeedSample>((sample) => sample.recordedAt, sourcePath);

function vehicleGroupKey(record: IVehicleUse): string {
    return [record.registrationMemberState ?? '', record.registrationNumber ?? '', record.vehicleIdentificationNumber ?? ''].join(
        ':',
    );
}

const compareVehicleUses = compareByKeys<IVehicleUse>(vehicleGroupKey, (record) => record.firstUse, sourcePath);

const compareVehicleUnitUses = compareByKeys<IVehicleUnitUse>((record) => record.usedAt, sourcePath);

const compareCardUses = compareByKeys<ICardUse>((record) => record.insertion, sourcePath);

function createActivityDayProjection(generation: TachographGeneration, day: IActivityDay): IDocumentActivityDayProjection {
    return {
        day,
        generation,
        records: day.intervals.map((interval) => ({
            generation,
            interval,
            midnightUtc: day.midnightUtc,
            recordKind: 'activity' as const,
            source: interval.source,
        })),
    };
}

export function projectDocumentActivityDays(document: OpenedTachographDocument): readonly IDocumentActivityDayProjection[] {
    if (document.content.documentKind !== 'driverCard') {
        return [];
    }

    return document.content.applications
        .flatMap((application) => application.activityDays.map((day) => createActivityDayProjection(application.generation, day)))
        .sort(compareActivityDays);
}

export function projectDocumentActivityRecords(document: OpenedTachographDocument): readonly IDocumentActivityRecord[] {
    return projectDocumentActivityDays(document)
        .flatMap((day) => day.records)
        .sort(compareActivityRecords);
}

export function projectDocumentEventFaultRecords(
    document: OpenedTachographDocument,
    filter: EventFaultTypeFilter = 'all',
): readonly TachographEventFault[] {
    const records =
        document.content.documentKind === 'driverCard'
            ? document.content.applications.flatMap((application) => [...application.events, ...application.faults])
            : [...document.content.events, ...document.content.faults];

    return records.filter((record) => filter === 'all' || record.recordKind === filter).sort(compareEventFaultRecords);
}

export function projectDocumentAssociations(
    document: OpenedTachographDocument,
    filter: AssociationGenerationFilter = 'all',
): readonly TachographAssociation[] {
    const records: readonly TachographAssociation[] =
        document.content.documentKind === 'driverCard'
            ? document.content.applications.flatMap((application) => [...application.vehicleUses, ...application.vehicleUnitUses])
            : document.content.cardUses;
    const filtered = records.filter((record) => filter === 'all' || record.source.generation === filter);

    if (document.content.documentKind === 'driverCard') {
        const vehicleUses = filtered.filter((record): record is IVehicleUse => record.kind === 'vehicleUse');
        const vehicleUnitUses = filtered.filter((record): record is IVehicleUnitUse => record.kind === 'vehicleUnitUse');
        return [...vehicleUses.sort(compareVehicleUses), ...vehicleUnitUses.sort(compareVehicleUnitUses)];
    }

    return filtered.filter((record): record is ICardUse => record.kind === 'cardUse').sort(compareCardUses);
}

export function projectDocumentLocationRecords(
    document: OpenedTachographDocument,
    filter: LocationRecordTypeFilter = 'all',
): readonly TachographLocationRecord[] {
    const records =
        document.content.documentKind === 'driverCard'
            ? document.content.applications.flatMap((application) => application.locations)
            : document.content.locations;

    return records
        .filter(
            (record) =>
                filter === 'all' ||
                (filter === 'gen2v2Operations' &&
                    (record.kind === 'borderCrossing' ||
                        record.kind === 'loadUnloadOperation' ||
                        record.kind === 'loadTypeEntry')) ||
                (filter === 'place' && record.kind === 'dailyWorkPeriodPlace') ||
                (filter === 'position' && record.kind === 'accumulatedDrivingPosition') ||
                (filter === 'borderCrossing' && record.kind === 'borderCrossing') ||
                (filter === 'loadUnloadOperation' && record.kind === 'loadUnloadOperation') ||
                (filter === 'loadTypeEntry' && record.kind === 'loadTypeEntry'),
        )
        .sort(compareLocationRecords);
}

export function projectDocumentTechnicalRecords(document: OpenedTachographDocument): readonly TachographTechnicalRecord[] {
    return document.content.documentKind === 'driverCard'
        ? document.content.applications.flatMap((application) => application.technicalRecords)
        : [...document.content.technicalRecords, ...document.content.companyLocks];
}

export function projectDocumentDetailedSpeedSamples(document: OpenedTachographDocument): readonly IDetailedSpeedSample[] {
    if (document.content.documentKind !== 'vehicleUnit') {
        return [];
    }

    return [...document.content.detailedSpeedSamples].sort(compareDetailedSpeedSamples);
}

const compareDailyOdometerRecords = compareByKeys<IVehicleUnitDailyOdometerTechnicalRecord>((record) => record.day, sourcePath);

export function projectDocumentDailyOdometerRecords(
    document: OpenedTachographDocument,
): readonly IVehicleUnitDailyOdometerTechnicalRecord[] {
    if (document.content.documentKind !== 'vehicleUnit') {
        return [];
    }

    return document.content.technicalRecords
        .filter(
            (record): record is IVehicleUnitDailyOdometerTechnicalRecord =>
                record.kind === 'vehicleUnitDailyOdometerTechnicalRecord',
        )
        .sort(compareDailyOdometerRecords);
}

const compareOverspeedRecords = compareByKeys<IOverspeedRecord>(
    (record) => record.begin,
    (record) => (record.end === null ? 1 : 0),
    (record) => record.end ?? 0,
    sourcePath,
);

export function projectDocumentOverspeedRecords(document: OpenedTachographDocument): readonly IOverspeedRecord[] {
    if (document.content.documentKind !== 'vehicleUnit') {
        return [];
    }

    return [...document.content.overspeedRecords].sort(compareOverspeedRecords);
}

function clampTimestamp(value: UtcTimestamp, minimum: UtcTimestamp, maximum: UtcTimestamp): UtcTimestamp {
    return value < minimum ? minimum : value > maximum ? maximum : value;
}

function detailedSpeedStatistics(samples: readonly IDetailedSpeedSample[]): IDetailedSpeedStatistics | null {
    const first = samples[0];
    if (first === undefined) {
        return null;
    }

    let minimum = first.speedKilometresPerHour;
    let maximum = first.speedKilometresPerHour;
    let total = 0;
    for (const sample of samples) {
        minimum = sample.speedKilometresPerHour < minimum ? sample.speedKilometresPerHour : minimum;
        maximum = sample.speedKilometresPerHour > maximum ? sample.speedKilometresPerHour : maximum;
        total += sample.speedKilometresPerHour;
    }

    return {
        averageSpeedKilometresPerHour: total / samples.length,
        maximumSpeedKilometresPerHour: maximum,
        minimumSpeedKilometresPerHour: minimum,
    };
}

function detailedSpeedBucketExtrema(
    samples: readonly IDetailedSpeedSample[],
    startIndex: number,
    endIndex: number,
): readonly IDetailedSpeedSample[] {
    const first = samples[startIndex];
    if (first === undefined) {
        return [];
    }

    let minimumIndex = startIndex;
    let maximumIndex = startIndex;
    for (let index = startIndex + 1; index < endIndex; index += 1) {
        const sample = samples[index];
        if (sample === undefined) {
            continue;
        }
        const minimum = samples[minimumIndex];
        const maximum = samples[maximumIndex];
        if (minimum === undefined || maximum === undefined) {
            throw new TypeError('Detailed-speed bucket bounds are inconsistent.');
        }
        if (sample.speedKilometresPerHour < minimum.speedKilometresPerHour) {
            minimumIndex = index;
        }
        if (sample.speedKilometresPerHour > maximum.speedKilometresPerHour) {
            maximumIndex = index;
        }
    }

    if (minimumIndex === maximumIndex) {
        return [samples[minimumIndex] ?? first];
    }
    const earlierIndex = Math.min(minimumIndex, maximumIndex);
    const laterIndex = Math.max(minimumIndex, maximumIndex);
    const earlier = samples[earlierIndex];
    const later = samples[laterIndex];
    if (earlier === undefined || later === undefined) {
        throw new TypeError('Detailed-speed extrema are unavailable.');
    }
    return [earlier, later];
}

function downsampleDetailedSpeed(
    samples: readonly IDetailedSpeedSample[],
    preferredSample: IDetailedSpeedSample | null,
): readonly IDetailedSpeedSample[] {
    if (samples.length <= detailedSpeedChartSampleLimit) {
        return samples;
    }

    const preservePreferred = preferredSample !== null && samples.includes(preferredSample);
    const baseLimit = preservePreferred ? detailedSpeedChartSampleLimit - 1 : detailedSpeedChartSampleLimit;
    const first = samples[0];
    const last = samples.at(-1);
    if (first === undefined || last === undefined) {
        return [];
    }

    const reduced: IDetailedSpeedSample[] = [first];
    const interiorLength = samples.length - 2;
    const bucketCount = Math.max(1, Math.floor((baseLimit - 2) / 2));
    for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
        const startIndex = 1 + Math.floor((bucketIndex * interiorLength) / bucketCount);
        const endIndex = 1 + Math.floor(((bucketIndex + 1) * interiorLength) / bucketCount);
        reduced.push(...detailedSpeedBucketExtrema(samples, startIndex, endIndex));
    }
    reduced.push(last);

    if (preservePreferred && !reduced.includes(preferredSample)) {
        reduced.push(preferredSample);
    }

    const uniqueSamples = Array.from(new Set(reduced)).sort(compareDetailedSpeedSamples);
    return uniqueSamples;
}

function detailedSpeedChartSamples(
    samples: readonly IDetailedSpeedSample[],
    preferredSample: IDetailedSpeedSample | null,
): readonly IDetailedSpeedChartSample[] {
    const pageIndexBySample = new Map<IDetailedSpeedSample, number>();
    for (const [index, sample] of samples.entries()) {
        pageIndexBySample.set(sample, Math.floor(index / detailedSpeedPageSize));
    }

    return downsampleDetailedSpeed(samples, preferredSample).map((sample) => {
        const pageIndex = pageIndexBySample.get(sample);
        if (pageIndex === undefined) {
            throw new TypeError('Detailed-speed chart sample is outside the selected range.');
        }
        return {
            pageIndex,
            sample,
        };
    });
}

function measureDetailedSpeedRange(
    samples: readonly IDetailedSpeedSample[],
    start: UtcTimestamp,
    end: UtcTimestamp,
): IDetailedSpeedRangeMeasurement | null {
    if (samples.length === 0 || start >= end) {
        return null;
    }

    let distanceKilometres = 0;
    let previous: IDetailedSpeedSample | null = null;
    for (const sample of samples) {
        if (sample.recordedAt < start) {
            previous = sample;
            continue;
        }
        if (sample.recordedAt > end) {
            break;
        }
        if (previous !== null) {
            const elapsedMilliseconds = sample.recordedAt - previous.recordedAt;
            const averageKilometresPerHour = (sample.speedKilometresPerHour + previous.speedKilometresPerHour) / 2;
            distanceKilometres += (averageKilometresPerHour * elapsedMilliseconds) / MILLISECONDS_PER_HOUR;
        }
        previous = sample;
    }

    const durationMilliseconds = end - start;
    if (!isDurationMilliseconds(durationMilliseconds)) {
        return null;
    }

    return {
        distanceKilometres,
        durationMilliseconds,
    };
}

export function projectDocumentDetailedSpeed(
    document: OpenedTachographDocument,
    request: IDetailedSpeedProjectionRequest,
): IDocumentDetailedSpeedProjection {
    const allSamples = projectDocumentDetailedSpeedSamples(document);
    const first = allSamples[0];
    const last = allSamples.at(-1);
    if (first === undefined || last === undefined) {
        return {
            chartSamples: [],
            chartSamplesReduced: false,
            coverage: null,
            measurement: null,
            pageCount: 0,
            pageIndex: 0,
            range: null,
            rangeLimited: false,
            samples: [],
            statistics: null,
            totalSamples: 0,
        };
    }

    const coverage = {
        end: last.recordedAt,
        start: first.recordedAt,
    };
    const requestedStart = clampTimestamp(request.start ?? coverage.start, coverage.start, coverage.end);
    const requestedEnd = clampTimestamp(request.end ?? coverage.end, coverage.start, coverage.end);
    let rangeStart = requestedStart < requestedEnd ? requestedStart : requestedEnd;
    const rangeEnd = requestedStart < requestedEnd ? requestedEnd : requestedStart;
    const rangeLimited = rangeEnd - rangeStart > maximumDetailedSpeedRangeMilliseconds;
    if (rangeLimited) {
        const limitedStartCandidate = rangeEnd - maximumDetailedSpeedRangeMilliseconds;
        const limitedStart = isUtcTimestamp(limitedStartCandidate) ? limitedStartCandidate : coverage.start;
        rangeStart = clampTimestamp(limitedStart, coverage.start, coverage.end);
    }

    const filtered = allSamples.filter((sample) => sample.recordedAt >= rangeStart && sample.recordedAt <= rangeEnd);
    const pageCount = Math.ceil(filtered.length / detailedSpeedPageSize);
    const requestedPageIndex = Number.isInteger(request.pageIndex) && request.pageIndex >= 0 ? request.pageIndex : 0;
    const pageIndex = pageCount === 0 ? 0 : Math.min(requestedPageIndex, pageCount - 1);
    const pageStart = pageIndex * detailedSpeedPageSize;
    const chartSamples = detailedSpeedChartSamples(filtered, request.preferredSample);

    return {
        chartSamples,
        chartSamplesReduced: chartSamples.length < filtered.length,
        coverage,
        measurement: measureDetailedSpeedRange(filtered, rangeStart, rangeEnd),
        pageCount,
        pageIndex,
        range: {
            end: rangeEnd,
            start: rangeStart,
        },
        rangeLimited,
        samples: filtered.slice(pageStart, pageStart + detailedSpeedPageSize),
        statistics: detailedSpeedStatistics(filtered),
        totalSamples: filtered.length,
    };
}

export function projectDocumentIdentities(document: OpenedTachographDocument): readonly TachographIdentity[] {
    if (document.content.documentKind === 'driverCard') {
        return document.content.applications.flatMap((application) =>
            application.identity === null ? [] : [application.identity],
        );
    }

    return document.content.identity === null ? [] : [document.content.identity];
}

function projectDocumentWarnings(document: OpenedTachographDocument): readonly ITachographWarning[] {
    return document.content.documentKind === 'driverCard'
        ? document.content.applications.flatMap((application) => application.warnings)
        : [...document.content.warnings];
}

function updateCoverage(coverage: IDocumentCoverage | null, start: UtcTimestamp, end: UtcTimestamp): IDocumentCoverage {
    return {
        end: coverage === null || end > coverage.end ? end : coverage.end,
        start: coverage === null || start < coverage.start ? start : coverage.start,
    };
}

export function createDocumentOverviewProjection(document: OpenedTachographDocument): IDocumentOverviewProjection {
    const activityDays = projectDocumentActivityDays(document);
    const activityRecords = activityDays.flatMap((day) => day.records);
    const eventFaultRecords = projectDocumentEventFaultRecords(document);
    const identities = projectDocumentIdentities(document);
    const warnings = projectDocumentWarnings(document);
    let coverage: IDocumentCoverage | null = null;

    for (const record of activityRecords) {
        if (record.interval.origin === 'recorded') {
            coverage = updateCoverage(coverage, record.interval.start, record.interval.end);
        }
    }
    for (const record of eventFaultRecords) {
        coverage = updateCoverage(coverage, record.start, record.end ?? record.start);
    }
    for (const record of projectDocumentAssociations(document)) {
        const start = associationStart(record);
        const end =
            record.kind === 'vehicleUse'
                ? (record.lastUse ?? record.firstUse)
                : record.kind === 'vehicleUnitUse'
                  ? record.usedAt
                  : (record.withdrawal ?? record.insertion);
        coverage = updateCoverage(coverage, start, end);
    }
    for (const sample of projectDocumentDetailedSpeedSamples(document)) {
        coverage = updateCoverage(coverage, sample.recordedAt, sample.recordedAt);
    }

    return {
        applicationGenerations:
            document.content.documentKind === 'driverCard'
                ? document.content.applications.map((application) => application.generation)
                : [document.content.generation],
        cardNotes:
            document.content.documentKind === 'driverCard'
                ? document.content.applications.flatMap((application) =>
                      application.cardNotes === null ? [] : [application.cardNotes],
                  )
                : [],
        counts: {
            activityDays: activityDays.length,
            events: eventFaultRecords.filter((record) => record.recordKind === 'event').length,
            faults: eventFaultRecords.filter((record) => record.recordKind === 'fault').length,
            inferredActivityGaps: activityRecords.filter((record) => record.interval.origin === 'inferredGap').length,
            recordedActivityIntervals: activityRecords.filter((record) => record.interval.origin === 'recorded').length,
            warnings: warnings.length,
        },
        coverage,
        identities,
        integrityCounts: createDocumentIntegrityProjection(document).counts,
        warnings,
    };
}
