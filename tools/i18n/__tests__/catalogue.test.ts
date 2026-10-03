import { en } from '#i18n';
import { viewerCatalogues } from '#i18n-locales';
import { describe, expect, it } from 'vitest';

import {
    findTranslationCatalogueParityViolations,
    findTranslationCatalogueViolations,
    TRANSLATION_CATALOGUE_VIOLATIONS,
} from '../catalogue.js';

const pseudoCatalogue = {
    ...en,
    'welcome.description': '［Öƥëñ å ţåçĥöĝŕåƥĥ đöŵñļöåđ ţö ïñšƥëçţ ïţš ŕëçöŕđëđ đåţå. ~~~~~］',
} as const satisfies Readonly<Record<keyof typeof en, string>>;

describe('English translation catalogue', () => {
    it('contains non-empty unique translations', () => {
        expect(findTranslationCatalogueViolations(en)).toEqual([]);
    });

    it('keeps every packaged locale aligned with English keys and tokens', () => {
        for (const catalogue of Object.values(viewerCatalogues)) {
            expect(findTranslationCatalogueViolations(catalogue)).toEqual([]);
            expect(findTranslationCatalogueParityViolations(en, catalogue)).toEqual([]);
        }
    });

    it('keeps the long-string pseudo-locale as parity-safe test data', () => {
        expect(findTranslationCatalogueViolations(pseudoCatalogue)).toEqual([]);
        expect(findTranslationCatalogueParityViolations(en, pseudoCatalogue)).toEqual([]);
    });
});

describe('findTranslationCatalogueViolations', () => {
    it('reports an empty catalogue', () => {
        expect(findTranslationCatalogueViolations({})).toEqual([TRANSLATION_CATALOGUE_VIOLATIONS.emptyCatalogue]);
    });

    it('reports blank keys, blank messages, and duplicate messages', () => {
        expect(
            findTranslationCatalogueViolations({
                '': 'Duplicate',
                'empty.message': ' ',
                duplicate: 'Duplicate',
            }),
        ).toEqual([TRANSLATION_CATALOGUE_VIOLATIONS.emptyKeyOrMessage, TRANSLATION_CATALOGUE_VIOLATIONS.duplicateMessage]);
    });
});

describe('findTranslationCatalogueParityViolations', () => {
    it('reports key, placeholder, and terminology-token drift', () => {
        expect(
            findTranslationCatalogueParityViolations(
                {
                    count: '{count} {{termRecord}}',
                    title: 'Title',
                },
                {
                    count: '{total} {{termItem}}',
                    extra: 'Extra',
                },
            ),
        ).toEqual([
            TRANSLATION_CATALOGUE_VIOLATIONS.missingKey,
            TRANSLATION_CATALOGUE_VIOLATIONS.unexpectedKey,
            TRANSLATION_CATALOGUE_VIOLATIONS.placeholderMismatch,
            TRANSLATION_CATALOGUE_VIOLATIONS.terminologyTokenMismatch,
        ]);
    });
});
