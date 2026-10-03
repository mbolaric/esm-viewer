import {
    dateFormatPatternToken,
    defaultDateFormatForTimeZone,
    defaultTimeFormatForTimeZone,
    localeDateOrder,
    shortMonthNames,
    type DateComponentOrder,
    type DateFormatKey,
    type TimeFormatKey,
} from './localisation-service.js';
import type { ITranslationService } from './translation-service.js';

type ResolvedDateFormat = Exclude<DateFormatKey, 'auto'>;
type ResolvedTimeFormat = Exclude<TimeFormatKey, 'auto'>;

const currentCentury = 2_000;

function isResolvedDateFormat(value: DateFormatKey): value is ResolvedDateFormat {
    return value !== 'auto';
}

function isResolvedTimeFormat(value: TimeFormatKey): value is ResolvedTimeFormat {
    return value === 'h12' || value === 'h23';
}

export interface IResolvedInputFormatKeys {
    readonly dateFormat: ResolvedDateFormat;
    readonly timeFormat: ResolvedTimeFormat;
}

export function resolveInputFormatKeys(
    dateFormat: DateFormatKey,
    timeFormat: TimeFormatKey,
    timeZone = 'UTC',
): IResolvedInputFormatKeys {
    return {
        dateFormat: dateFormat === 'auto' ? defaultDateFormatForTimeZone(timeZone) : dateFormat,
        timeFormat: timeFormat === 'auto' ? defaultTimeFormatForTimeZone(timeZone) : timeFormat,
    };
}

function dateOrder(formatKey: ResolvedDateFormat, locale: string): DateComponentOrder {
    switch (formatKey) {
        case 'ddMMyyyy':
            return 'DMY';
        case 'MMddyyyy':
            return 'MDY';
        case 'yyyyMMdd':
            return 'YMD';
        case 'mediumDate':
            return localeDateOrder(locale);
    }
}

function buildUtcTimestamp(year: number, month: number, day: number): number | null {
    if (year < 1 || year > 9_999) {
        return null;
    }
    const value = Date.UTC(year, month - 1, day);
    const probe = new Date(value);
    if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
        return null;
    }
    return value;
}

function parseOrderedDate(clean: string, order: DateComponentOrder, reference: number): number | null {
    const referenceDate = new Date(reference);
    const referenceYear = referenceDate.getUTCFullYear();
    const referenceMonth = referenceDate.getUTCMonth() + 1;
    const trimmed = clean.replace(/^[./\s-]+|[./\s-]+$/gu, '');
    const parts = trimmed.split(/[./-]/u).map((part) => part.trim());

    if (parts.length >= 2) {
        const values = parts.map((part) => Number(part));
        if (values.some((value) => !Number.isInteger(value) || value < 1)) {
            return null;
        }
        if (parts.length === 2) {
            const first = values[0];
            const second = values[1];
            if (first === undefined || second === undefined) {
                return null;
            }
            if (order === 'DMY') {
                return buildUtcTimestamp(referenceYear, second, first);
            }
            return buildUtcTimestamp(referenceYear, first, second);
        }
        if (parts.length === 3) {
            const first = values[0];
            const second = values[1];
            const third = values[2];
            if (first === undefined || second === undefined || third === undefined) {
                return null;
            }
            const yearPart = parts[0];
            if (yearPart === undefined) {
                return null;
            }
            if (yearPart.length === 4) {
                return buildUtcTimestamp(first, second, third);
            }
            const year = third < 100 ? third + currentCentury : third;
            if (order === 'MDY') {
                if (first > 12 && second <= 12) {
                    return buildUtcTimestamp(year, second, first);
                }
                return buildUtcTimestamp(year, first, second);
            }
            if (order === 'DMY') {
                if (second > 12 && first <= 12) {
                    return buildUtcTimestamp(year, first, second);
                }
                return buildUtcTimestamp(year, second, first);
            }
            return buildUtcTimestamp(year, second, first);
        }
        return null;
    }

    const digits = clean.replace(/\D/gu, '');
    if (digits.length < 1 || digits.length > 8) {
        return null;
    }
    if (digits.length <= 2) {
        const day = Number(digits);
        return buildUtcTimestamp(referenceYear, referenceMonth, day);
    }
    if (digits.length <= 4) {
        const padded = digits.padStart(4, '0');
        const first = Number(padded.slice(0, 2));
        const second = Number(padded.slice(2, 4));
        if (order === 'MDY') {
            return buildUtcTimestamp(referenceYear, first, second);
        }
        return buildUtcTimestamp(referenceYear, second, first);
    }
    if (digits.length <= 6) {
        const padded = digits.padStart(6, '0');
        const first = Number(padded.slice(0, 2));
        const second = Number(padded.slice(2, 4));
        const third = Number(padded.slice(4, 6));
        if (order === 'YMD') {
            return buildUtcTimestamp(first + currentCentury, second, third);
        }
        const year = third + currentCentury;
        if (order === 'MDY') {
            return buildUtcTimestamp(year, first, second);
        }
        return buildUtcTimestamp(year, second, first);
    }

    const padded = digits.padStart(8, '0');
    if (order === 'YMD') {
        const year = Number(padded.slice(0, 4));
        const month = Number(padded.slice(4, 6));
        const day = Number(padded.slice(6, 8));
        return buildUtcTimestamp(year, month, day);
    }
    const first = Number(padded.slice(0, 2));
    const second = Number(padded.slice(2, 4));
    const year = Number(padded.slice(4, 8));
    if (order === 'MDY') {
        return buildUtcTimestamp(year, first, second);
    }
    return buildUtcTimestamp(year, second, first);
}

function parseMediumDate(clean: string, locale: string, reference: number): number | null {
    const referenceDate = new Date(reference);
    const referenceYear = referenceDate.getUTCFullYear();
    const monthNames = shortMonthNames(locale);
    const matchedMonth = monthNames.findIndex((name) => new RegExp(`(?:^|\\W)${escapeRegExp(name)}(?:\\W|$)`, 'iu').test(clean));
    if (matchedMonth < 0) {
        return parseOrderedDate(clean, localeDateOrder(locale), reference);
    }
    const numbers = [...clean.matchAll(/\d+/gu)].map((match) => Number(match[0]));
    if (numbers.length === 0 || numbers.length > 2) {
        return null;
    }
    const year = numbers.find((value) => value >= 1_000) ?? referenceYear;
    const day = numbers.length === 2 ? numbers.find((value) => value < 1_000) : numbers[0];
    if (day === undefined || day < 1 || day > 31) {
        return null;
    }
    return buildUtcTimestamp(year, matchedMonth + 1, day);
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

export function parseDateInputValue(
    text: string,
    formatKey: DateFormatKey,
    locale: string,
    referenceValue: number,
): number | null {
    const clean = text.trim();
    if (clean.length === 0) {
        return null;
    }
    if (!isResolvedDateFormat(formatKey)) {
        return null;
    }
    if (formatKey === 'mediumDate') {
        return parseMediumDate(clean, locale, referenceValue);
    }
    return parseOrderedDate(clean, dateOrder(formatKey, locale), referenceValue);
}

export function parseUtcDateTimeInputValue(
    text: string,
    formatKey: DateFormatKey,
    timeFormatKey: TimeFormatKey,
    locale: string,
    referenceValue: number,
): number | null {
    const clean = text.trim();
    if (clean.length === 0) {
        return null;
    }
    if (!isResolvedDateFormat(formatKey) || !isResolvedTimeFormat(timeFormatKey)) {
        return null;
    }

    const match = /^(.+?)[\sT](\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]m)?$/iu.exec(clean);
    if (match === null) {
        return null;
    }
    const datePart = match[1]?.trim();
    const hourText = match[2];
    const minuteText = match[3];
    const secondText = match[4];
    const periodText = match[5];
    if (datePart === undefined || datePart.length === 0 || hourText === undefined || minuteText === undefined) {
        return null;
    }

    const dayTimestamp = parseDateInputValue(datePart, formatKey, locale, referenceValue);
    if (dayTimestamp === null) {
        return null;
    }

    const hour = Number(hourText);
    const minute = Number(minuteText);
    const second = secondText === undefined ? 0 : Number(secondText);
    if (!Number.isInteger(hour) || !Number.isInteger(minute) || !Number.isInteger(second)) {
        return null;
    }
    if (minute > 59 || second > 59) {
        return null;
    }

    const period = periodText === undefined ? null : periodText.toLowerCase();
    let hour24: number;
    if (period !== null) {
        if (hour < 1 || hour > 12) {
            return null;
        }
        hour24 = (hour % 12) + (period === 'pm' ? 12 : 0);
    } else {
        if (hour > 23) {
            return null;
        }
        hour24 = hour;
    }

    const day = new Date(dayTimestamp);
    const value = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour24, minute, second);
    const probe = new Date(value);
    if (
        probe.getUTCFullYear() !== day.getUTCFullYear() ||
        probe.getUTCMonth() !== day.getUTCMonth() ||
        probe.getUTCDate() !== day.getUTCDate() ||
        probe.getUTCHours() !== hour24 ||
        probe.getUTCMinutes() !== minute ||
        probe.getUTCSeconds() !== second
    ) {
        return null;
    }
    return value;
}

export function dateInputPlaceholder(formatKey: DateFormatKey): string {
    if (!isResolvedDateFormat(formatKey)) {
        return '';
    }
    return dateFormatPatternToken(formatKey);
}

export interface IDateInputLocalisation {
    readonly formatDayLabel: (value: number) => string;
    readonly formatMonthLabel: (year: number, month: number) => string;
    readonly formatValue: (value: number) => string;
    readonly parseValue: (text: string, referenceValue: number) => number | null;
    readonly weekdayLabels: readonly string[];
}

export interface IDateInputLocalisationResult {
    readonly localise: IDateInputLocalisation;
    readonly placeholder: string;
}

export type IDatePickerLocalisationResult = IDateInputLocalisationResult;

export interface IDateInputFormatterSource {
    readonly locale: string;
    formatMonthLabel(value: number): string;
    formatUtcDate(value: number): string;
    formatWeekdayLabels(): readonly string[];
}

const maximumDateEpochMilliseconds = 8_640_000_000_000_000;

function isValidTimestamp(value: number): boolean {
    return typeof value === 'number' && Number.isSafeInteger(value) && Math.abs(value) <= maximumDateEpochMilliseconds;
}

// Builds localise and placeholder config for a date input from resolved date format.
export function buildDateInputLocalisation(
    localisationService: IDateInputFormatterSource,
    formatKey: Exclude<DateFormatKey, 'auto'>,
): IDateInputLocalisationResult {
    const formatTimestamp = (value: number): string => {
        return isValidTimestamp(value) ? localisationService.formatUtcDate(value) : '';
    };
    const localise: IDateInputLocalisation = {
        formatDayLabel: formatTimestamp,
        formatMonthLabel: (year: number, month: number) => {
            const monthStart = Date.UTC(year, month, 1);
            return isValidTimestamp(monthStart) ? localisationService.formatMonthLabel(monthStart) : '';
        },
        formatValue: formatTimestamp,
        parseValue: (text: string, referenceValue: number) =>
            parseDateInputValue(text, formatKey, localisationService.locale, referenceValue),
        weekdayLabels: localisationService.formatWeekdayLabels(),
    };
    return {
        localise,
        placeholder: dateInputPlaceholder(formatKey),
    };
}

export const buildDatePickerLocalisation = buildDateInputLocalisation;

export type DatePickerLabelTranslationKey =
    | 'activities.datePicker.clear'
    | 'activities.datePicker.nextMonth'
    | 'activities.datePicker.popup'
    | 'activities.datePicker.prevMonth'
    | 'activities.datePicker.toggle';

export interface IDatePickerLabelTexts {
    readonly clear: string;
    readonly nextMonth: string;
    readonly popup: string;
    readonly prevMonth: string;
    readonly toggle: string;
}

// Every date picker shares one set of catalogue keys, so capability-specific translation services can all satisfy it.
export function translateDatePickerLabels(
    translationService: ITranslationService<DatePickerLabelTranslationKey>,
): IDatePickerLabelTexts {
    return {
        clear: translationService.translate('activities.datePicker.clear'),
        nextMonth: translationService.translate('activities.datePicker.nextMonth'),
        popup: translationService.translate('activities.datePicker.popup'),
        prevMonth: translationService.translate('activities.datePicker.prevMonth'),
        toggle: translationService.translate('activities.datePicker.toggle'),
    };
}
