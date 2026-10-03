import { err, type Result } from '#contracts';
import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_HOUR, MILLISECONDS_PER_MINUTE, MILLISECONDS_PER_SECOND } from '#time';

import {
    createDateTimeFormatter,
    createDurationFormatter,
    createNumberFormatter,
    supportedLocaleCount,
} from './intl-primitives.js';
import type { ILocaleService } from './locale-service.js';

export interface ILocalisationService<TTimestamp extends number, TDuration extends number> {
    readonly dateFormat: Exclude<DateFormatKey, 'auto'>;
    readonly locale: string;
    readonly timeZone: string;
    formatDateTime(value: TTimestamp): string;
    formatDate(value: TTimestamp): string;
    formatDuration(value: TDuration): string;
    formatMonthLabel(value: number): string;
    formatMonthShortLabel(value: number): string;
    formatNumber(value: number, options?: Intl.NumberFormatOptions): string;
    formatUtcDate(value: number): string;
    formatUtcTime(value: TTimestamp): string;
    formatWeekdayLabels(): readonly string[];
}

export interface IDisplayTimeZoneService {
    readonly timeZone: string;
}

export type DateFormatKey = 'auto' | 'ddMMyyyy' | 'MMddyyyy' | 'mediumDate' | 'yyyyMMdd';
export type TimeFormatKey = 'auto' | 'h12' | 'h23';
export type DateComponentOrder = 'DMY' | 'MDY' | 'YMD';

export interface IDateTimeFormatService {
    readonly dateFormat: DateFormatKey;
    readonly timeFormat: TimeFormatKey;
}

export type LocalisationConfigurationError = 'unsupportedLocale' | 'unsupportedTimeZone';
export type LocalisationServiceResult<TTimestamp extends number, TDuration extends number> = Result<
    ILocalisationService<TTimestamp, TDuration>,
    LocalisationConfigurationError
>;

export function isIntlLocale(value: unknown): value is string {
    if (typeof value !== 'string' || value.length === 0) {
        return false;
    }

    try {
        return supportedLocaleCount(value) === 1;
    } catch {
        return false;
    }
}

export function isDisplayTimeZone(value: unknown): value is string {
    return typeof value === 'string' && (value === 'UTC' || Intl.supportedValuesOf('timeZone').includes(value));
}

export function isDateFormatKey(value: unknown): value is DateFormatKey {
    return (
        typeof value === 'string' &&
        (value === 'auto' || value === 'ddMMyyyy' || value === 'MMddyyyy' || value === 'mediumDate' || value === 'yyyyMMdd')
    );
}

export function isTimeFormatKey(value: unknown): value is TimeFormatKey {
    return typeof value === 'string' && (value === 'auto' || value === 'h12' || value === 'h23');
}

export function resolveDateFormatKey(value: string): DateFormatKey {
    return isDateFormatKey(value) ? value : 'auto';
}

export function resolveTimeFormatKey(value: string): TimeFormatKey {
    return isTimeFormatKey(value) ? value : 'auto';
}

export function defaultDateFormatForTimeZone(timeZone: string): Exclude<DateFormatKey, 'auto'> {
    if (timeZone === 'UTC') {
        return 'mediumDate';
    }

    const region = timeZone.split('/')[0] ?? '';
    if (region === 'Europe') {
        return 'ddMMyyyy';
    }
    if (region === 'America' || region === 'Canada' || region === 'Mexico' || region === 'US') {
        return 'MMddyyyy';
    }
    if (region === 'Asia' && (timeZone === 'Asia/Tokyo' || timeZone === 'Asia/Seoul')) {
        return 'yyyyMMdd';
    }
    return 'mediumDate';
}

export function defaultTimeFormatForTimeZone(timeZone: string): Exclude<TimeFormatKey, 'auto'> {
    const region = timeZone.split('/')[0] ?? '';
    if (region === 'America' || region === 'Canada' || region === 'Mexico' || region === 'US') {
        return 'h12';
    }
    return 'h23';
}

// Conventional civil date format for each packaged locale.
export function defaultDateFormatForLocale(locale: string): Exclude<DateFormatKey, 'auto'> {
    switch (locale) {
        case 'de':
        case 'en':
        case 'es':
        case 'fr':
        case 'hr':
        case 'it':
        case 'pl':
            return 'ddMMyyyy';
        default:
            return 'mediumDate';
    }
}

// Default time format for packaged locales (24-hour clock).
export function defaultTimeFormatForLocale(_locale: string): Exclude<TimeFormatKey, 'auto'> {
    return 'h23';
}

export function dateFormatPatternToken(key: Exclude<DateFormatKey, 'auto'>): string {
    switch (key) {
        case 'ddMMyyyy':
            return 'dd.MM.yyyy';
        case 'mediumDate':
            return 'MMM d, yyyy';
        case 'MMddyyyy':
            return 'MM/dd/yyyy';
        case 'yyyyMMdd':
            return 'yyyy-MM-dd';
    }
}

export function localeDateOrder(locale: string): DateComponentOrder {
    try {
        const parts = createDateTimeFormatter(locale, {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric',
            timeZone: 'UTC',
        }).formatToParts(Date.UTC(2026, 11, 25));
        let order = '';
        for (const part of parts) {
            if (part.type === 'day') {
                order += 'D';
            } else if (part.type === 'month') {
                order += 'M';
            } else if (part.type === 'year') {
                order += 'Y';
            }
        }
        if (order === 'DMY' || order === 'MDY' || order === 'YMD') {
            return order;
        }
    } catch {
        // Fall through to the default order.
    }
    return 'DMY';
}

export function shortMonthNames(locale: string): readonly string[] {
    const formatter = createDateTimeFormatter(locale, { month: 'short', timeZone: 'UTC' });
    const names: string[] = [];
    for (let month = 0; month < 12; month += 1) {
        names.push(formatter.format(Date.UTC(2026, month, 15)));
    }
    return names;
}

export function timeFormatPatternToken(key: Exclude<TimeFormatKey, 'auto'>): string {
    switch (key) {
        case 'h12':
            return 'h:mm a';
        case 'h23':
            return 'HH:mm';
    }
}

function activeLocale(localeService: ILocaleService): string {
    if (!isIntlLocale(localeService.locale)) {
        throw new TypeError('The active locale is unsupported.');
    }
    return localeService.locale;
}

function activeTimeZone(timeZoneService: IDisplayTimeZoneService): string {
    if (!isDisplayTimeZone(timeZoneService.timeZone)) {
        throw new TypeError('The active display time zone is unsupported.');
    }
    return timeZoneService.timeZone;
}

function activeDateFormat(formatService: IDateTimeFormatService): DateFormatKey {
    return resolveDateFormatKey(formatService.dateFormat);
}

function activeTimeFormat(formatService: IDateTimeFormatService): TimeFormatKey {
    return resolveTimeFormatKey(formatService.timeFormat);
}

const dateTimeFormatCache = new Map<string, Intl.DateTimeFormat>();
const durationFormatCache = new Map<string, Intl.DurationFormat>();
const numberFormatCache = new Map<string, Intl.NumberFormat>();

// Intl formatters are costly to build, so each distinct configuration is built once.
function cached<TFormatter>(cache: Map<string, TFormatter>, key: string, create: () => TFormatter): TFormatter {
    let formatter = cache.get(key);
    if (formatter === undefined) {
        formatter = create();
        cache.set(key, formatter);
    }
    return formatter;
}

function getDateTimeFormatter(key: string, create: () => Intl.DateTimeFormat): Intl.DateTimeFormat {
    return cached(dateTimeFormatCache, key, create);
}

// 12-hour clock reading (1-12) of a 0-23 hour.
function toHour12(hour24: number): string {
    return String(((hour24 + 11) % 12) + 1);
}

// The 12-hour formats always use the Latin AM/PM marker.
function hourPeriod(hour24: number): 'AM' | 'PM' {
    return hour24 < 12 ? 'AM' : 'PM';
}

function formatDateValue(value: number, locale: string, timeZone: string, key: Exclude<DateFormatKey, 'auto'>): string {
    if (key === 'mediumDate') {
        const formatter = getDateTimeFormatter(`date-medium:${locale}:${timeZone}`, () => {
            return createDateTimeFormatter(locale, { dateStyle: 'medium', timeZone });
        });
        return formatter.format(value);
    }

    if (timeZone === 'UTC') {
        const d = new Date(value);
        const yyyy = String(d.getUTCFullYear());
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        switch (key) {
            case 'ddMMyyyy':
                return `${dd}.${mm}.${yyyy}`;
            case 'MMddyyyy':
                return `${mm}/${dd}/${yyyy}`;
            case 'yyyyMMdd':
                return `${yyyy}-${mm}-${dd}`;
        }
    }

    const formatter = getDateTimeFormatter(`date-parts:${locale}:${timeZone}`, () => {
        return createDateTimeFormatter(locale, {
            day: '2-digit',
            month: '2-digit',
            timeZone,
            year: 'numeric',
        });
    });
    const parts = formatter.formatToParts(value);
    const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((candidate) => candidate.type === type)?.value ?? '';

    switch (key) {
        case 'ddMMyyyy':
            return `${part('day')}.${part('month')}.${part('year')}`;
        case 'MMddyyyy':
            return `${part('month')}/${part('day')}/${part('year')}`;
        case 'yyyyMMdd':
            return `${part('year')}-${part('month')}-${part('day')}`;
    }
}

function formatTimeValue(value: number, locale: string, timeZone: string, key: Exclude<TimeFormatKey, 'auto'>): string {
    const formatter = getDateTimeFormatter(`time-parts:${locale}:${timeZone}`, () => {
        return createDateTimeFormatter(locale, {
            hour: '2-digit',
            hourCycle: 'h23',
            minute: '2-digit',
            timeZone,
        });
    });
    const parts = formatter.formatToParts(value);
    const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((candidate) => candidate.type === type)?.value ?? '';

    if (key === 'h23') {
        return `${part('hour')}:${part('minute')}`;
    }

    const hour24 = Number(part('hour'));
    return `${toHour12(hour24)}:${part('minute')} ${hourPeriod(hour24)}`;
}

function formatUtcTimeValue(value: number, locale: string, key: Exclude<TimeFormatKey, 'auto'>): string {
    if (key === 'h23') {
        const d = new Date(value);
        const hh = String(d.getUTCHours()).padStart(2, '0');
        const mm = String(d.getUTCMinutes()).padStart(2, '0');
        const ss = String(d.getUTCSeconds()).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    }

    const formatter = getDateTimeFormatter(`utc-time-parts:${locale}`, () => {
        return createDateTimeFormatter(locale, {
            hour: '2-digit',
            hourCycle: 'h23',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'UTC',
        });
    });
    const parts = formatter.formatToParts(value);
    const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((candidate) => candidate.type === type)?.value ?? '';

    const hour24 = Number(part('hour'));
    return `${toHour12(hour24)}:${part('minute')}:${part('second')} ${hourPeriod(hour24)}`;
}

function formatDateTimeValue(
    value: number,
    locale: string,
    timeZone: string,
    dateFormat: DateFormatKey,
    timeFormat: TimeFormatKey,
): string {
    const dateKey = dateFormat === 'auto' ? defaultDateFormatForTimeZone(timeZone) : dateFormat;
    const timeKey = timeFormat === 'auto' ? defaultTimeFormatForTimeZone(timeZone) : timeFormat;
    return `${formatDateValue(value, locale, timeZone, dateKey)} ${formatTimeValue(value, locale, timeZone, timeKey)}`;
}

function durationRecord(value: number): Partial<Record<Intl.DurationFormatUnit, number>> {
    let remaining: number = value;
    const days = Math.floor(remaining / MILLISECONDS_PER_DAY);
    remaining -= days * MILLISECONDS_PER_DAY;
    const hours = Math.floor(remaining / MILLISECONDS_PER_HOUR);
    remaining -= hours * MILLISECONDS_PER_HOUR;
    const minutes = Math.floor(remaining / MILLISECONDS_PER_MINUTE);
    remaining -= minutes * MILLISECONDS_PER_MINUTE;
    const seconds = Math.floor(remaining / MILLISECONDS_PER_SECOND);
    const milliseconds = remaining - seconds * MILLISECONDS_PER_SECOND;

    return {
        days,
        hours,
        milliseconds,
        minutes,
        seconds,
    };
}

export function createLocalisationService<TTimestamp extends number, TDuration extends number>(
    localeService: ILocaleService,
    timeZoneService: IDisplayTimeZoneService,
    formatService: IDateTimeFormatService,
): LocalisationServiceResult<TTimestamp, TDuration> {
    if (!isIntlLocale(localeService.locale)) {
        return err('unsupportedLocale');
    }
    if (!isDisplayTimeZone(timeZoneService.timeZone)) {
        return err('unsupportedTimeZone');
    }

    return {
        ok: true,
        value: {
            get dateFormat(): Exclude<DateFormatKey, 'auto'> {
                const dateKey = activeDateFormat(formatService);
                return dateKey === 'auto' ? defaultDateFormatForTimeZone(activeTimeZone(timeZoneService)) : dateKey;
            },
            get locale(): string {
                return activeLocale(localeService);
            },
            get timeZone(): string {
                return activeTimeZone(timeZoneService);
            },
            formatDateTime(value: TTimestamp): string {
                return formatDateTimeValue(
                    value,
                    activeLocale(localeService),
                    activeTimeZone(timeZoneService),
                    activeDateFormat(formatService),
                    activeTimeFormat(formatService),
                );
            },
            formatDate(value: TTimestamp): string {
                const dateKey = activeDateFormat(formatService);
                return formatDateValue(
                    value,
                    activeLocale(localeService),
                    activeTimeZone(timeZoneService),
                    dateKey === 'auto' ? defaultDateFormatForTimeZone(activeTimeZone(timeZoneService)) : dateKey,
                );
            },
            formatDuration(value: TDuration): string {
                if (value === 0) {
                    const locale = activeLocale(localeService);
                    return cached(numberFormatCache, `unit-ms:${locale}`, () =>
                        createNumberFormatter(locale, { style: 'unit', unit: 'millisecond', unitDisplay: 'short' }),
                    ).format(0);
                }

                const locale = activeLocale(localeService);
                return cached(durationFormatCache, locale, () => createDurationFormatter(locale, { style: 'short' })).format(
                    durationRecord(value),
                );
            },
            formatMonthLabel(value: number): string {
                const locale = activeLocale(localeService);
                const formatter = getDateTimeFormatter(`month-long:${locale}`, () => {
                    return createDateTimeFormatter(locale, {
                        month: 'long',
                        timeZone: 'UTC',
                        year: 'numeric',
                    });
                });
                return formatter.format(value);
            },
            formatMonthShortLabel(value: number): string {
                const locale = activeLocale(localeService);
                const formatter = getDateTimeFormatter(`month-short:${locale}`, () => {
                    return createDateTimeFormatter(locale, {
                        month: 'short',
                        timeZone: 'UTC',
                    });
                });
                return formatter.format(value);
            },
            formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
                const locale = activeLocale(localeService);
                const cacheKey = options === undefined ? `num:${locale}` : `num:${locale}:${JSON.stringify(options)}`;
                return cached(numberFormatCache, cacheKey, () => createNumberFormatter(locale, options)).format(value);
            },
            formatUtcDate(value: number): string {
                const dateKey = activeDateFormat(formatService);
                return formatDateValue(
                    value,
                    activeLocale(localeService),
                    'UTC',
                    dateKey === 'auto' ? defaultDateFormatForTimeZone(activeTimeZone(timeZoneService)) : dateKey,
                );
            },
            formatUtcTime(value: TTimestamp): string {
                const timeKey = activeTimeFormat(formatService);
                return formatUtcTimeValue(
                    value,
                    activeLocale(localeService),
                    timeKey === 'auto' ? defaultTimeFormatForTimeZone(activeTimeZone(timeZoneService)) : timeKey,
                );
            },
            formatWeekdayLabels(): readonly string[] {
                const formatter = createDateTimeFormatter(activeLocale(localeService), {
                    timeZone: 'UTC',
                    weekday: 'short',
                });
                const labels: string[] = [];
                for (let index = 0; index < 7; index += 1) {
                    labels.push(formatter.format(Date.UTC(2026, 0, 5 + index)));
                }
                return labels;
            },
        },
    };
}
