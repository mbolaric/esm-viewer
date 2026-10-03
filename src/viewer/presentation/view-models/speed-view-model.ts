import {
    projectDocumentDetailedSpeed,
    projectDocumentOverspeedRecords,
    type IDetailedSpeedChartSample,
    type IDetailedSpeedProjectionRequest,
    type IDocumentCoverage,
    type OpenedTachographDocument,
} from '#viewer-application';
import { parseUtcDateTimeInputValue, type DateFormatKey, type TimeFormatKey } from '#localization';
import {
    isUtcTimestamp,
    type EventFaultRecordPurpose,
    type IDetailedSpeedSample,
    type IOverspeedControlData,
    type IOverspeedRecord,
    type ISourceReference,
    type SpeedKilometresPerHour,
    type TachographGeneration,
    type UtcTimestamp,
} from '#viewer-domain';

import type { IFormattedUtcRange, IFormattedValue } from './document-view-model.js';
import type { ViewerLocalisationService } from '../helpers/view-model-formatting.js';

export interface IFormattedUtcRangeInput extends IFormattedUtcRange {
    readonly endInput: string;
    readonly startInput: string;
}

export interface ISpeedStatisticsViewModel {
    readonly average: IFormattedValue<number>;
    readonly maximum: IFormattedValue<SpeedKilometresPerHour>;
    readonly minimum: IFormattedValue<SpeedKilometresPerHour>;
}

export interface ISpeedRangeMeasurementViewModel {
    readonly distanceKilometres: IFormattedValue<number>;
    readonly duration: IFormattedValue<number>;
}

export interface IOverspeedRecordViewModel {
    readonly begin: IFormattedValue<UtcTimestamp>;
    readonly cardNumber: string | null;
    readonly end: IFormattedValue<UtcTimestamp> | null;
    readonly generation: TachographGeneration;
    readonly id: string;
    readonly maxSpeed: IFormattedValue<SpeedKilometresPerHour>;
    readonly purpose: EventFaultRecordPurpose | null;
    readonly similarEvents: IFormattedValue<number> | null;
    readonly source: ISourceReference<TachographGeneration, 'vehicleUnit'>;
}

export interface IOverspeedControlViewModel {
    readonly firstOverspeedSince: IFormattedValue<UtcTimestamp> | null;
    readonly lastControl: IFormattedValue<UtcTimestamp> | null;
    readonly numberOfOverspeedSince: IFormattedValue<number> | null;
    readonly source: ISourceReference<TachographGeneration, 'vehicleUnit'>;
}

export interface ISpeedSampleViewModel {
    readonly generation: TachographGeneration;
    readonly id: string;
    readonly record: IDetailedSpeedSample;
    readonly recordedAt: IFormattedValue<UtcTimestamp>;
    readonly source: ISourceReference<TachographGeneration, 'vehicleUnit'>;
    readonly speed: IFormattedValue<SpeedKilometresPerHour>;
}

export interface ISpeedChartSampleViewModel extends ISpeedSampleViewModel {
    readonly pageIndex: number;
}

export interface ISpeedChartTickViewModel {
    readonly display: string;
    readonly value: UtcTimestamp;
}

export interface ISpeedSectionViewModel {
    readonly chartRecords: readonly ISpeedChartSampleViewModel[];
    readonly chartReduced: boolean;
    readonly chartTicks: readonly ISpeedChartTickViewModel[];
    readonly coverage: IFormattedUtcRangeInput | null;
    readonly locale: string;
    readonly measurement: ISpeedRangeMeasurementViewModel | null;
    readonly overspeedControl: IOverspeedControlViewModel | null;
    readonly overspeedRecords: readonly IOverspeedRecordViewModel[];
    readonly pageCount: IFormattedValue<number>;
    readonly pageIndex: number;
    readonly pageNumber: IFormattedValue<number>;
    readonly range: IFormattedUtcRangeInput | null;
    readonly rangeLimited: boolean;
    readonly records: readonly ISpeedSampleViewModel[];
    readonly statistics: ISpeedStatisticsViewModel | null;
    readonly timeZone: string;
    readonly totalSamples: IFormattedValue<number>;
}

function formattedValue<TValue>(value: TValue, display: string): IFormattedValue<TValue> {
    return {
        display,
        value,
    };
}

function formatUtcDateTimeInput(value: UtcTimestamp, localisation: ViewerLocalisationService): string {
    return `${localisation.formatUtcDate(value)} ${localisation.formatUtcTime(value)}`;
}

function formatRange(range: IDocumentCoverage | null, localisation: ViewerLocalisationService): IFormattedUtcRangeInput | null {
    return range === null
        ? null
        : {
              end: formattedValue(range.end, localisation.formatDateTime(range.end)),
              endInput: formatUtcDateTimeInput(range.end, localisation),
              start: formattedValue(range.start, localisation.formatDateTime(range.start)),
              startInput: formatUtcDateTimeInput(range.start, localisation),
          };
}

function formatSpeed(
    value: SpeedKilometresPerHour,
    localisation: ViewerLocalisationService,
): IFormattedValue<SpeedKilometresPerHour> {
    return formattedValue(value, localisation.formatNumber(value));
}

function mapRecord(record: IDetailedSpeedSample, localisation: ViewerLocalisationService): ISpeedSampleViewModel {
    return {
        generation: record.source.generation,
        id: record.source.path,
        record,
        recordedAt: formattedValue(record.recordedAt, localisation.formatDateTime(record.recordedAt)),
        source: record.source,
        speed: formatSpeed(record.speedKilometresPerHour, localisation),
    };
}

function mapChartRecord(record: IDetailedSpeedChartSample, localisation: ViewerLocalisationService): ISpeedChartSampleViewModel {
    return {
        ...mapRecord(record.sample, localisation),
        pageIndex: record.pageIndex,
    };
}

function formatChartTicks(
    range: IDocumentCoverage | null,
    localisation: ViewerLocalisationService,
): readonly ISpeedChartTickViewModel[] {
    if (range === null) {
        return [];
    }
    if (range.start === range.end) {
        return [
            {
                display: localisation.formatDateTime(range.start),
                value: range.start,
            },
        ];
    }

    const ticks: ISpeedChartTickViewModel[] = [];
    const CHART_TICK_INTERVAL_COUNT = 4;
    for (let index = 0; index <= CHART_TICK_INTERVAL_COUNT; index += 1) {
        const candidate = Math.round(range.start + ((range.end - range.start) * index) / CHART_TICK_INTERVAL_COUNT);
        if (!isUtcTimestamp(candidate)) {
            throw new TypeError('Detailed-speed chart tick is outside the UTC timestamp range.');
        }
        ticks.push({
            display: localisation.formatDateTime(candidate),
            value: candidate,
        });
    }
    return ticks;
}

function formatOverspeedRecord(record: IOverspeedRecord, localisation: ViewerLocalisationService): IOverspeedRecordViewModel {
    const cardNumber = record.cardNumberDriverSlotBegin?.cardNumber ?? null;
    return {
        begin: formattedValue(record.begin, localisation.formatDateTime(record.begin)),
        cardNumber,
        end: record.end === null ? null : formattedValue(record.end, localisation.formatDateTime(record.end)),
        generation: record.source.generation,
        id: record.source.path,
        maxSpeed: formatSpeed(record.maxSpeedKilometresPerHour, localisation),
        purpose: record.purpose,
        similarEvents:
            record.similarEventsNumber === null
                ? null
                : formattedValue(record.similarEventsNumber, localisation.formatNumber(record.similarEventsNumber)),
        source: record.source,
    };
}

function formatOverspeedControl(
    control: IOverspeedControlData,
    localisation: ViewerLocalisationService,
): IOverspeedControlViewModel {
    return {
        firstOverspeedSince:
            control.firstOverspeedSince === null
                ? null
                : formattedValue(control.firstOverspeedSince, localisation.formatDateTime(control.firstOverspeedSince)),
        lastControl:
            control.lastOverspeedControlTime === null
                ? null
                : formattedValue(control.lastOverspeedControlTime, localisation.formatDateTime(control.lastOverspeedControlTime)),
        numberOfOverspeedSince:
            control.numberOfOverspeedSince === null
                ? null
                : formattedValue(control.numberOfOverspeedSince, localisation.formatNumber(control.numberOfOverspeedSince)),
        source: control.source,
    };
}

export function createSpeedSectionViewModel(
    document: OpenedTachographDocument,
    localisation: ViewerLocalisationService,
    request: IDetailedSpeedProjectionRequest,
): ISpeedSectionViewModel {
    const projection = projectDocumentDetailedSpeed(document, request);
    const statistics =
        projection.statistics === null
            ? null
            : {
                  average: formattedValue(
                      projection.statistics.averageSpeedKilometresPerHour,
                      localisation.formatNumber(projection.statistics.averageSpeedKilometresPerHour, {
                          maximumFractionDigits: 1,
                          minimumFractionDigits: 1,
                      }),
                  ),
                  maximum: formatSpeed(projection.statistics.maximumSpeedKilometresPerHour, localisation),
                  minimum: formatSpeed(projection.statistics.minimumSpeedKilometresPerHour, localisation),
              };

    const overspeedRecords = projectDocumentOverspeedRecords(document);

    return {
        chartRecords: projection.chartSamples.map((record) => mapChartRecord(record, localisation)),
        chartReduced: projection.chartSamplesReduced,
        chartTicks: formatChartTicks(projection.range, localisation),
        coverage: formatRange(projection.coverage, localisation),
        locale: localisation.locale,
        measurement:
            projection.measurement === null
                ? null
                : {
                      distanceKilometres: formattedValue(
                          projection.measurement.distanceKilometres,
                          localisation.formatNumber(projection.measurement.distanceKilometres, {
                              maximumFractionDigits: 1,
                              minimumFractionDigits: 1,
                          }),
                      ),
                      duration: formattedValue(
                          projection.measurement.durationMilliseconds,
                          localisation.formatDuration(projection.measurement.durationMilliseconds),
                      ),
                  },
        overspeedControl:
            document.content.documentKind !== 'vehicleUnit' || document.content.overspeedControl === null
                ? null
                : formatOverspeedControl(document.content.overspeedControl, localisation),
        overspeedRecords: overspeedRecords.map((record) => formatOverspeedRecord(record, localisation)),
        pageCount: formattedValue(projection.pageCount, localisation.formatNumber(projection.pageCount)),
        pageIndex: projection.pageIndex,
        pageNumber: formattedValue(
            projection.pageCount === 0 ? 0 : projection.pageIndex + 1,
            localisation.formatNumber(projection.pageCount === 0 ? 0 : projection.pageIndex + 1),
        ),
        range: formatRange(projection.range, localisation),
        rangeLimited: projection.rangeLimited,
        records: projection.samples.map((record) => mapRecord(record, localisation)),
        statistics,
        timeZone: localisation.timeZone,
        totalSamples: formattedValue(projection.totalSamples, localisation.formatNumber(projection.totalSamples)),
    };
}

export function calculatePresetSpeedRange(
    coverage: IFormattedUtcRange | null,
    fallbackRecords: readonly ISpeedSampleViewModel[],
    durationMs: number,
): { start: UtcTimestamp; end: UtcTimestamp } | null {
    const fullEnd = coverage?.end.value ?? fallbackRecords.at(-1)?.recordedAt.value;
    const fullStart = coverage?.start.value ?? fallbackRecords[0]?.recordedAt.value;

    if (fullEnd === undefined || fullStart === undefined) {
        return null;
    }

    const end = fullEnd;
    const start = Math.max(end - durationMs, fullStart);

    if (isUtcTimestamp(start) && isUtcTimestamp(end)) {
        return { end, start };
    }
    return null;
}

export function calculateSpeedChartBounds(
    range: IFormattedUtcRange | null,
    chartRecords: readonly ISpeedChartSampleViewModel[],
): {
    readonly domainEnd: number;
    readonly domainStart: number;
    readonly valueDomainEnd: number;
} {
    const domainStart = range?.start.value ?? 0;
    const domainEnd = Math.max(1, (range?.end.value ?? domainStart) - domainStart);
    const valueDomainEnd = Math.max(1, ...chartRecords.map((record) => record.speed.value));

    return {
        domainEnd,
        domainStart,
        valueDomainEnd,
    };
}

export function parseSpeedRangeInput(
    text: string,
    dateFormat: DateFormatKey,
    timeFormat: TimeFormatKey,
    locale: string,
    reference: UtcTimestamp | null,
): UtcTimestamp | null {
    const value = parseUtcDateTimeInputValue(text, dateFormat, timeFormat, locale, reference ?? 0);
    return isUtcTimestamp(value) ? value : null;
}
