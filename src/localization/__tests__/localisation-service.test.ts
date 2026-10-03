import { describe, expect, it } from 'vitest';

import {
    createLocalisationService,
    dateFormatPatternToken,
    defaultDateFormatForTimeZone,
    defaultTimeFormatForTimeZone,
    isDateFormatKey,
    isDisplayTimeZone,
    isIntlLocale,
    isTimeFormatKey,
    resolveDateFormatKey,
    resolveTimeFormatKey,
    timeFormatPatternToken,
    type IDateTimeFormatService,
} from '../localisation-service.js';

const mediumFormat: IDateTimeFormatService = { dateFormat: 'mediumDate', timeFormat: 'h23' };

describe('createLocalisationService', () => {
    it('formats selected-zone instants while keeping UTC-bound dates and times stable', () => {
        const localeService = { locale: 'en-GB' };
        const timeZoneService = { timeZone: 'America/New_York' };
        const result = createLocalisationService<number, number>(localeService, timeZoneService, mediumFormat);
        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }

        const value = Date.UTC(2026, 0, 1, 0, 30);
        expect(result.value.formatDateTime(value)).toBe('31 Dec 2025 19:30');
        expect(result.value.formatDate(value)).toBe('31 Dec 2025');
        expect(result.value.formatUtcDate(value)).toBe('1 Jan 2026');
        expect(result.value.formatUtcTime(value)).toBe('00:30:00');
    });

    it('reacts to valid locale and display-zone changes without changing exact inputs', () => {
        const localeService = { locale: 'en-GB' };
        const timeZoneService = { timeZone: 'UTC' };
        const result = createLocalisationService<number, number>(localeService, timeZoneService, mediumFormat);
        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }

        const value = Date.UTC(2026, 6, 15, 13, 45, 30);
        expect(result.value.formatDateTime(value)).toBe('15 Jul 2026 13:45');
        expect(result.value.formatNumber(1_234.5)).toBe('1,234.5');
        // Regression test: formatNumber caches by (locale, options) without cache collision.
        expect(result.value.formatNumber(47.846_666_666, { maximumFractionDigits: 6 })).toBe('47.846667');
        expect(result.value.formatNumber(47.846_666_666, { maximumFractionDigits: 1 })).toBe('47.8');
        expect(result.value.formatNumber(47.846_666_666, { maximumFractionDigits: 6 })).toBe('47.846667');
        expect(result.value.formatDuration(3_661_250)).toBe('1 hr, 1 min, 1 sec, 250 ms');
        expect(result.value.formatDuration(0)).toBe('0 ms');
        expect(result.value.formatMonthLabel(Date.UTC(2026, 6, 26))).toBe('July 2026');
        expect(result.value.formatMonthShortLabel(Date.UTC(2026, 6, 26))).toBe('Jul');
        expect(result.value.formatWeekdayLabels()).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

        localeService.locale = 'de-DE';
        timeZoneService.timeZone = 'Europe/Berlin';

        expect(result.value.locale).toBe('de-DE');
        expect(result.value.timeZone).toBe('Europe/Berlin');
        expect(result.value.formatDateTime(value)).toContain('15:45');
        expect(result.value.formatNumber(1_234.5)).toBe('1.234,5');
        expect(result.value.formatWeekdayLabels()).toEqual(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
    });

    it('resolves the time-zone default when the format preference is automatic', () => {
        const localeService = { locale: 'en-GB' };
        const timeZoneService = { timeZone: 'Europe/Berlin' };
        const formatService: IDateTimeFormatService = { dateFormat: 'auto', timeFormat: 'auto' };
        const result = createLocalisationService<number, number>(localeService, timeZoneService, formatService);
        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }

        const value = Date.UTC(2026, 4, 6, 8, 3, 36);
        expect(result.value.formatDateTime(value)).toBe('06.05.2026 10:03');
        expect(result.value.dateFormat).toBe('ddMMyyyy');
        expect(defaultDateFormatForTimeZone('Europe/Berlin')).toBe('ddMMyyyy');
        expect(defaultTimeFormatForTimeZone('Europe/Berlin')).toBe('h23');
    });

    it('applies explicit pattern choices independent of the selected locale', () => {
        const localeService = { locale: 'en-US' };
        const timeZoneService = { timeZone: 'America/New_York' };
        const monthFirstFormat: IDateTimeFormatService = {
            dateFormat: 'MMddyyyy',
            timeFormat: 'h12',
        };
        const result = createLocalisationService<number, number>(localeService, timeZoneService, monthFirstFormat);
        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }

        const value = Date.UTC(2026, 4, 6, 8, 3, 36);
        expect(result.value.formatDateTime(value)).toBe('05/06/2026 4:03 AM');
        expect(result.value.dateFormat).toBe('MMddyyyy');
    });

    it('applies the time preference to UTC-bound evidence times', () => {
        const localeService = { locale: 'en-US' };
        const timeZoneService = { timeZone: 'UTC' };
        const result = createLocalisationService<number, number>(localeService, timeZoneService, {
            dateFormat: 'yyyyMMdd',
            timeFormat: 'h23',
        });
        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }

        const value = Date.UTC(2026, 4, 6, 8, 3, 36);
        expect(result.value.formatUtcDate(value)).toBe('2026-05-06');
        expect(result.value.formatUtcTime(value)).toBe('08:03:36');

        const twelveHourResult = createLocalisationService<number, number>(localeService, timeZoneService, {
            dateFormat: 'auto',
            timeFormat: 'h12',
        });
        expect(twelveHourResult.ok).toBe(true);
        if (!twelveHourResult.ok) {
            return;
        }
        expect(twelveHourResult.value.formatUtcTime(value)).toBe('8:03:36 AM');
    });

    it('falls back to the automatic default for unknown format keys', () => {
        const localeService = { locale: 'en-GB' };
        const timeZoneService = { timeZone: 'UTC' };
        const automaticFormat: IDateTimeFormatService = { dateFormat: 'auto', timeFormat: 'auto' };
        const result = createLocalisationService<number, number>(localeService, timeZoneService, automaticFormat);
        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }

        const value = Date.UTC(2026, 4, 6, 8, 3, 36);
        expect(result.value.formatDateTime(value)).toBe('6 May 2026 08:03');
        expect(resolveDateFormatKey('unknown')).toBe('auto');
        expect(resolveDateFormatKey('yyyyMMdd')).toBe('yyyyMMdd');
        expect(resolveTimeFormatKey('unknown')).toBe('auto');
        expect(resolveTimeFormatKey('h23')).toBe('h23');
        expect(isDateFormatKey('mediumDate')).toBe(true);
        expect(isDateFormatKey('unknown')).toBe(false);
        expect(isTimeFormatKey('h12')).toBe(true);
        expect(isTimeFormatKey('unknown')).toBe(false);
        expect(dateFormatPatternToken('yyyyMMdd')).toBe('yyyy-MM-dd');
        expect(timeFormatPatternToken('h12')).toBe('h:mm a');
        expect(timeFormatPatternToken('h23')).toBe('HH:mm');
        expect(defaultDateFormatForTimeZone('America/New_York')).toBe('MMddyyyy');
        expect(defaultDateFormatForTimeZone('Asia/Tokyo')).toBe('yyyyMMdd');
        expect(defaultDateFormatForTimeZone('Australia/Sydney')).toBe('mediumDate');
        expect(defaultTimeFormatForTimeZone('America/New_York')).toBe('h12');
        expect(defaultTimeFormatForTimeZone('Asia/Tokyo')).toBe('h23');
    });

    it('rejects unsupported initial locale and time-zone settings', () => {
        expect(createLocalisationService<number, number>({ locale: 'zz' }, { timeZone: 'UTC' }, mediumFormat)).toEqual({
            error: 'unsupportedLocale',
            ok: false,
        });
        expect(createLocalisationService<number, number>({ locale: 'en' }, { timeZone: 'Mars/Olympus' }, mediumFormat)).toEqual({
            error: 'unsupportedTimeZone',
            ok: false,
        });
        expect(isIntlLocale('en-XA')).toBe(true);
        expect(isIntlLocale('bad_locale')).toBe(false);
        expect(isDisplayTimeZone('UTC')).toBe(true);
        expect(isDisplayTimeZone('Europe/Berlin')).toBe(true);
        expect(isDisplayTimeZone('../private')).toBe(false);
    });
});
