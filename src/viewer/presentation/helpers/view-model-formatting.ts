import type { ParseError, Result } from '#contracts';
import { isUtcTimestamp, type DurationMilliseconds, type OdometerKilometres, type UtcTimestamp } from '#viewer-domain';
import type { ILocalisationService } from '#localization';
import { startOfUtcDay } from '#time';

export type ViewerLocalisationService = ILocalisationService<UtcTimestamp, DurationMilliseconds>;

export interface IFormattedValue<TValue> {
    readonly display: string;
    readonly value: TValue;
}

export interface IFormattedUtcRange {
    readonly end: IFormattedValue<UtcTimestamp>;
    readonly start: IFormattedValue<UtcTimestamp>;
}

export function formattedValue<TValue>(value: TValue, display: string): IFormattedValue<TValue> {
    return {
        display,
        value,
    };
}

export function formatNumber(value: number, localisation: ViewerLocalisationService): IFormattedValue<number> {
    return formattedValue(value, localisation.formatNumber(value));
}

export function formatDuration(
    value: DurationMilliseconds,
    localisation: ViewerLocalisationService,
): IFormattedValue<DurationMilliseconds> {
    return formattedValue(value, localisation.formatDuration(value));
}

export function formatUtcDate(value: UtcTimestamp, localisation: ViewerLocalisationService): IFormattedValue<UtcTimestamp> {
    return formattedValue(value, localisation.formatUtcDate(value));
}

export function formatUtcDateInputValue(value: UtcTimestamp): string;
export function formatUtcDateInputValue(value: number): string | null;
export function formatUtcDateInputValue(value: number): string | null {
    if (!isUtcTimestamp(value)) {
        return null;
    }
    return new Date(value).toISOString().slice(0, 10);
}

export function formatDateTime(value: UtcTimestamp, localisation: ViewerLocalisationService): IFormattedValue<UtcTimestamp> {
    return formattedValue(value, localisation.formatDateTime(value));
}

export function formatUtcTime(value: UtcTimestamp, localisation: ViewerLocalisationService): IFormattedValue<UtcTimestamp> {
    return formattedValue(value, localisation.formatUtcTime(value));
}

export type DocumentViewModelResult<TValue> = Result<TValue, ParseError>;

export function formatOdometer(
    odometer: OdometerKilometres | null,
    localisation: ViewerLocalisationService,
): IFormattedValue<OdometerKilometres> | null {
    if (odometer === null) {
        return null;
    }
    return formattedValue(odometer, localisation.formatNumber(odometer));
}

export function utcMidnightOfDay(value: number): UtcTimestamp | null {
    const midnight = startOfUtcDay(value);
    return isUtcTimestamp(midnight) ? midnight : null;
}
