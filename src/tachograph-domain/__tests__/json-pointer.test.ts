import { describe, expect, it } from 'vitest';

import { decodeJsonPointerToken, encodeJsonPointerToken, isJsonPointer, readJsonPointerArrayIndex } from '../json-pointer.js';

describe('isJsonPointer', () => {
    it.each(['', '/', '/card/activities/0', '/escaped~0value', '/path~1segment'])(
        'accepts a canonical JSON Pointer',
        (value: string) => {
            expect(isJsonPointer(value)).toBe(true);
        },
    );

    it.each(['card/activities/0', '#/card', '/invalid~', '/invalid~2escape', '/invalid~~0'])(
        'rejects a non-canonical JSON Pointer',
        (value: string) => {
            expect(isJsonPointer(value)).toBe(false);
        },
    );
});

describe('encodeJsonPointerToken / decodeJsonPointerToken', () => {
    it.each([
        ['plain', 'plain'],
        ['a/b', 'a~1b'],
        ['~key', '~0key'],
        ['a/~b', 'a~1~0b'],
        ['', ''],
    ])('round-trips %j through encode then decode', (raw, encoded) => {
        expect(encodeJsonPointerToken(raw)).toBe(encoded);
        expect(decodeJsonPointerToken(encoded)).toBe(raw);
    });

    it('decodes ~1 before ~0 so an encoded ~ is never mistaken for a separator', () => {
        // Escapes must decode ~1 before ~0 per RFC 6901 order.
        expect(decodeJsonPointerToken('~01')).toBe('~1');
    });
});

describe('readJsonPointerArrayIndex', () => {
    it.each(['0', '1', '42'])('accepts %j as a valid array index', (token) => {
        expect(readJsonPointerArrayIndex(token)).toBe(Number(token));
    });

    it.each(['01', '00', '-1', '1.5', 'a', ' 1', '1 ', ''])('rejects %j as an invalid array index', (token) => {
        expect(readJsonPointerArrayIndex(token)).toBeNull();
    });

    it('rejects an index beyond the safe-integer range', () => {
        expect(readJsonPointerArrayIndex(String(Number.MAX_SAFE_INTEGER + 1))).toBeNull();
    });
});
