import { describe, expect, it } from 'vitest';

import type { IErrorService } from '#error-reporting';
import { ERROR_CODES, type IErrorEvent } from '#contracts';

import { createTranslationService } from '../translation-service.js';

type TestLocale = 'de' | 'en';
type TestMessageKey = 'test.count' | 'test.message';

interface ITestMessageParams {
    readonly 'test.count': {
        readonly count: number;
    };
}

describe('createTranslationService', () => {
    it('uses the active locale and interpolates key-specific parameters', () => {
        const errorService: IErrorService = {
            report: () => Promise.resolve(),
        };
        const localeService: { locale: TestLocale } = {
            locale: 'en',
        };
        const service = createTranslationService<TestLocale, TestMessageKey, ITestMessageParams>(
            localeService,
            {
                de: {
                    'test.count': '{count} Einträge',
                    'test.message': 'Übersetzte Nachricht',
                },
                en: {
                    'test.count': '{count} records',
                    'test.message': 'Translated message',
                },
            },
            'en',
            errorService,
        );

        expect(service.translate('test.message')).toBe('Translated message');
        expect(service.translate('test.count', { count: 2 })).toBe('2 records');

        localeService.locale = 'de';
        expect(service.translate('test.message')).toBe('Übersetzte Nachricht');
        expect(service.translate('test.count', { count: 2 })).toBe('2 Einträge');
    });

    it('uses the English fallback and reports an active-locale parity failure', () => {
        const reportedErrors: IErrorEvent[] = [];
        const errorService: IErrorService = {
            report(error) {
                reportedErrors.push(error);
                return Promise.resolve();
            },
        };
        const service = createTranslationService<TestLocale, 'test.message'>(
            { locale: 'de' },
            {
                de: {},
                en: {
                    'test.message': 'Fallback message',
                },
            },
            'en',
            errorService,
        );

        expect(service.translate('test.message')).toBe('Fallback message');
        expect(reportedErrors).toEqual([
            {
                code: ERROR_CODES.translationMissingKey,
                context: { key: 'test.message' },
                severity: 'error',
                source: 'translation',
            },
        ]);
    });

    it('returns the key when neither active nor fallback catalogue contains it', () => {
        const errorService: IErrorService = {
            report: () => Promise.resolve(),
        };
        const service = createTranslationService<'en', 'missing.message'>({ locale: 'en' }, { en: {} }, 'en', errorService);

        expect(service.translate('missing.message')).toBe('missing.message');
    });
});
