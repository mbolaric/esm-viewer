import { describe, expect, it } from 'vitest';
import { classifyParseError, type ParseFailureCode } from '#contracts';
import type { TranslationKey } from '#i18n-locales';
import type { ViewerTranslationService } from '../../viewer-context.js';
import { translateParseErrorDescription } from '../viewer-labels.js';

describe('translateParseErrorDescription', () => {
    const translationService: ViewerTranslationService = {
        translate: (key: string, _params?: unknown): string => {
            return key;
        },
    };

    it('uses the dedicated multipleFilesDropped copy ahead of its userCorrectable category', () => {
        const error = classifyParseError('multipleFilesDropped');
        expect(translateParseErrorDescription(error, translationService)).toBe('failure.description.multipleFilesDropped');
    });

    it.each<[ParseFailureCode, TranslationKey]>([
        ['cancelled', 'failure.description.platformFailure'],
        ['rootCertificateMissing', 'failure.description.integrityLimitation'],
        ['normalizationFailed', 'failure.description.internalDefect'],
        ['parseFailed', 'failure.description.parserFailure'],
        ['documentCleanupFailed', 'failure.description.platformFailure'],
        ['unsupportedContent', 'failure.description.unsupportedData'],
        ['fileTooLarge', 'failure.description.userCorrectable'],
    ])('maps failure code %s to %s', (code, expectedKey) => {
        const error = classifyParseError(code);
        expect(translateParseErrorDescription(error, translationService)).toBe(expectedKey);
    });
});
