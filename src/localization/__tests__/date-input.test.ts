import { describe, expect, it } from 'vitest';

import {
    dateInputPlaceholder,
    parseDateInputValue,
    parseUtcDateTimeInputValue,
    resolveInputFormatKeys,
    translateDatePickerLabels,
    type DatePickerLabelTranslationKey,
} from '../date-input.js';
import { createTranslationService } from '../translation-service.js';
import type { DateFormatKey, TimeFormatKey } from '../localisation-service.js';

const reference = Date.UTC(2026, 6, 27);

function parsed(text: string, formatKey: 'ddMMyyyy' | 'MMddyyyy' | 'yyyyMMdd' | 'mediumDate'): number | null {
    return parseDateInputValue(text, formatKey, 'en', reference);
}

describe('dateInputPlaceholder', () => {
    it('maps each resolved date format to its pattern token', () => {
        expect(dateInputPlaceholder('ddMMyyyy')).toBe('dd.MM.yyyy');
        expect(dateInputPlaceholder('MMddyyyy')).toBe('MM/dd/yyyy');
        expect(dateInputPlaceholder('yyyyMMdd')).toBe('yyyy-MM-dd');
        expect(dateInputPlaceholder('mediumDate')).toBe('MMM d, yyyy');
        expect(dateInputPlaceholder('auto')).toBe('');
    });
});

describe('parseDateInputValue', () => {
    it('parses separated full dates in every numeric order', () => {
        expect(parsed('27.07.2026', 'ddMMyyyy')).toBe(Date.UTC(2026, 6, 27));
        expect(parsed('01.01.2024', 'ddMMyyyy')).toBe(Date.UTC(2024, 0, 1));
        expect(parsed('07/27/2026', 'MMddyyyy')).toBe(Date.UTC(2026, 6, 27));
        expect(parsed('2026-07-27', 'yyyyMMdd')).toBe(Date.UTC(2026, 6, 27));
    });

    it('tolerates trailing punctuation and delimiters in date inputs', () => {
        expect(parsed('27.07.2026.', 'ddMMyyyy')).toBe(Date.UTC(2026, 6, 27));
        expect(parsed('01.01.2024.', 'ddMMyyyy')).toBe(Date.UTC(2024, 0, 1));
        expect(parsed('07/27/2026/', 'MMddyyyy')).toBe(Date.UTC(2026, 6, 27));
        expect(parsed('2026-07-27-', 'yyyyMMdd')).toBe(Date.UTC(2026, 6, 27));
    });

    it('disambiguates day and month when an unambiguous component exceeds 12', () => {
        // DMY typed into an MDY format setting: 27 can only be the day
        expect(parsed('27/07/2026', 'MMddyyyy')).toBe(Date.UTC(2026, 6, 27));
        // MDY typed into a DMY format setting: 27 can only be the day
        expect(parsed('07.27.2026', 'ddMMyyyy')).toBe(Date.UTC(2026, 6, 27));
    });

    it('parses two-part dates against the current year', () => {
        expect(parsed('27.07', 'ddMMyyyy')).toBe(Date.UTC(2026, 6, 27));
        expect(parsed('07/27', 'MMddyyyy')).toBe(Date.UTC(2026, 6, 27));
        expect(parsed('07-27', 'yyyyMMdd')).toBe(Date.UTC(2026, 6, 27));
    });

    it('parses digit shorthands for day, day/month, and full dates', () => {
        expect(parsed('25', 'ddMMyyyy')).toBe(Date.UTC(2026, 6, 25));
        expect(parsed('2707', 'ddMMyyyy')).toBe(Date.UTC(2026, 6, 27));
        expect(parsed('27072026', 'ddMMyyyy')).toBe(Date.UTC(2026, 6, 27));
        expect(parsed('0727', 'MMddyyyy')).toBe(Date.UTC(2026, 6, 27));
        expect(parsed('20260727', 'yyyyMMdd')).toBe(Date.UTC(2026, 6, 27));
    });

    it('parses two-digit years into the current century', () => {
        expect(parsed('27.07.26', 'ddMMyyyy')).toBe(Date.UTC(2026, 6, 27));
        expect(parsed('270726', 'ddMMyyyy')).toBe(Date.UTC(2026, 6, 27));
    });

    it('parses medium dates with short month names', () => {
        expect(parsed('Jul 27, 2026', 'mediumDate')).toBe(Date.UTC(2026, 6, 27));
        expect(parsed('27 Jul 2026', 'mediumDate')).toBe(Date.UTC(2026, 6, 27));
        expect(parsed('Jul 27', 'mediumDate')).toBe(Date.UTC(2026, 6, 27));
    });

    it('rejects invalid dates and impossible calendar days', () => {
        expect(parsed('30.02.2026', 'ddMMyyyy')).toBeNull();
        expect(parsed('32.01.2026', 'ddMMyyyy')).toBeNull();
        expect(parsed('13.13.2026', 'ddMMyyyy')).toBeNull();
        expect(parsed('not-a-date', 'ddMMyyyy')).toBeNull();
        expect(parsed('', 'ddMMyyyy')).toBeNull();
        expect(parsed('  ', 'ddMMyyyy')).toBeNull();
        expect(parsed('2026/07/27', 'yyyyMMdd')).toBe(Date.UTC(2026, 6, 27));
    });

    it('rejects an unresolved auto format', () => {
        expect(parseDateInputValue('27.07.2026', 'auto', 'en', reference)).toBeNull();
    });
});

describe('resolveInputFormatKeys', () => {
    it('resolves auto preferences to the UTC defaults', () => {
        expect(resolveInputFormatKeys('auto', 'auto')).toEqual({
            dateFormat: 'mediumDate',
            timeFormat: 'h23',
        });
    });

    it('resolves auto preferences through the display time zone', () => {
        expect(resolveInputFormatKeys('auto', 'auto', 'Europe/Berlin')).toEqual({
            dateFormat: 'ddMMyyyy',
            timeFormat: 'h23',
        });
        expect(resolveInputFormatKeys('auto', 'auto', 'America/New_York')).toEqual({
            dateFormat: 'MMddyyyy',
            timeFormat: 'h12',
        });
    });

    it('keeps explicit display format choices', () => {
        expect(resolveInputFormatKeys('ddMMyyyy', 'h12')).toEqual({
            dateFormat: 'ddMMyyyy',
            timeFormat: 'h12',
        });
    });
});

describe('parseUtcDateTimeInputValue', () => {
    function parsedDateTime(
        text: string,
        formatKey: DateFormatKey = 'ddMMyyyy',
        timeFormatKey: TimeFormatKey = 'h23',
    ): number | null {
        return parseUtcDateTimeInputValue(text, formatKey, timeFormatKey, 'en', reference);
    }

    it('parses formatted date-time values in every date order', () => {
        expect(parsedDateTime('27.07.2026 08:42')).toBe(Date.UTC(2026, 6, 27, 8, 42));
        expect(parsedDateTime('07/27/2026 08:42:30', 'MMddyyyy')).toBe(Date.UTC(2026, 6, 27, 8, 42, 30));
        expect(parsedDateTime('2026-07-27 08:42', 'yyyyMMdd')).toBe(Date.UTC(2026, 6, 27, 8, 42));
        expect(parsedDateTime('Jul 27, 2026 08:42:30', 'mediumDate')).toBe(Date.UTC(2026, 6, 27, 8, 42, 30));
    });

    it('parses ISO-style T-separated values through the fallback date order', () => {
        expect(parsedDateTime('2026-07-27T08:46:59')).toBe(Date.UTC(2026, 6, 27, 8, 46, 59));
        expect(parsedDateTime('2026-07-27T08:46:59', 'mediumDate')).toBe(Date.UTC(2026, 6, 27, 8, 46, 59));
    });

    it('parses twelve-hour times with a period', () => {
        expect(parsedDateTime('27.07.2026 8:42 AM', 'ddMMyyyy', 'h12')).toBe(Date.UTC(2026, 6, 27, 8, 42));
        expect(parsedDateTime('27.07.2026 8:42 PM', 'ddMMyyyy', 'h12')).toBe(Date.UTC(2026, 6, 27, 20, 42));
        expect(parsedDateTime('27.07.2026 12:15 AM', 'ddMMyyyy', 'h12')).toBe(Date.UTC(2026, 6, 27, 0, 15));
    });

    it('rejects invalid times, impossible dates, and missing time parts', () => {
        expect(parsedDateTime('27.07.2026 24:00')).toBeNull();
        expect(parsedDateTime('27.07.2026 08:60')).toBeNull();
        expect(parsedDateTime('30.02.2026 08:42')).toBeNull();
        expect(parsedDateTime('27.07.2026 13:00 PM', 'ddMMyyyy', 'h12')).toBeNull();
        expect(parsedDateTime('27.07.2026')).toBeNull();
        expect(parsedDateTime('not-a-date-time')).toBeNull();
        expect(parsedDateTime('', 'ddMMyyyy')).toBeNull();
        expect(parsedDateTime('27.07.2026 08:42', 'auto', 'h23')).toBeNull();
    });
});

describe('translateDatePickerLabels', () => {
    it('looks up every label from the shared date picker catalogue keys', () => {
        const translationService = createTranslationService<'en', DatePickerLabelTranslationKey>(
            { locale: 'en' },
            {
                en: {
                    'activities.datePicker.clear': 'Clear',
                    'activities.datePicker.nextMonth': 'Next',
                    'activities.datePicker.popup': 'Popup',
                    'activities.datePicker.prevMonth': 'Previous',
                    'activities.datePicker.toggle': 'Toggle',
                },
            },
            'en',
            { report: () => Promise.resolve() },
        );

        expect(translateDatePickerLabels(translationService)).toEqual({
            clear: 'Clear',
            nextMonth: 'Next',
            popup: 'Popup',
            prevMonth: 'Previous',
            toggle: 'Toggle',
        });
    });
});
