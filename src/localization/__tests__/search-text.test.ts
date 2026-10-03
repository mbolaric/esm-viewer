import { describe, expect, it } from 'vitest';

import { createSearchMatcher, normalizeSearchText } from '../search-text.js';

describe('normalizeSearchText', () => {
    it('ignores case and combining diacritics so accented and plain spellings match', () => {
        expect(normalizeSearchText('Bölar')).toBe('bolar');
        expect(normalizeSearchText('ČAĆIĆ Zoë')).toBe('cacic zoe');
        expect(normalizeSearchText('Bolar')).toBe(normalizeSearchText('bÖLAR'));
    });

    it('folds letters that do not decompose so Polish, Croatian and Nordic names match plain spelling', () => {
        expect(normalizeSearchText('Łukasz')).toBe('lukasz');
        expect(normalizeSearchText('Đorđević')).toBe('dordevic');
        expect(normalizeSearchText('Bjørn Straße')).toBe('bjorn strasse');
        expect(normalizeSearchText('Dordevic')).toBe(normalizeSearchText('ĐORĐEVIĆ'));
    });

    it('leaves digits, punctuation and identifiers untouched apart from case', () => {
        expect(normalizeSearchText('WVWZZZ1JZXW000001')).toBe('wvwzzz1jzxw000001');
        expect(normalizeSearchText('/cardDataResponses/places')).toBe('/carddataresponses/places');
    });

    it('normalises text that mixes plain ASCII with accented or control characters the same way as pure ASCII', () => {
        expect(normalizeSearchText('Route 66 / Čačak')).toBe('route 66 / cacak');
        expect(normalizeSearchText('Line\tBREAK\nÉnd')).toBe('line\tbreak\nend');
        expect(normalizeSearchText('')).toBe('');
    });

    it('does not depend on the host locale for lower-casing', () => {
        expect(normalizeSearchText('TITLE')).toBe('title');
        expect(normalizeSearchText('I')).toBe('i');
    });
});

describe('createSearchMatcher', () => {
    it('matches any field ignoring case, diacritics and surrounding spaces', () => {
        const matches = createSearchMatcher('  bolar ');

        expect(matches(['D123', 'Milan Bölar'])).toBe(true);
        expect(matches(['D123', 'Someone Else'])).toBe(false);
    });

    it('matches every record for an empty query and never matches a null field', () => {
        expect(createSearchMatcher('   ')([null])).toBe(true);
        expect(createSearchMatcher('d1')([null, 'X9'])).toBe(false);
    });
});
