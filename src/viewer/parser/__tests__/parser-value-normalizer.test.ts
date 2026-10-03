import { describe, expect, it } from 'vitest';

import { isJsonPointer, type ITachographWarning, type JsonPointer } from '#viewer-domain';

import {
    decodeParserNationAlphaCodes,
    isRecordedParserTimestamp,
    normalizeParserNation,
    normalizeParserOdometerWithWarning,
    normalizeParserUtcTimestamp,
    type ParserWarningFactory,
} from '../normalizers/parser-value-normalizer.js';

function rawPointer(value: string): JsonPointer {
    if (!isJsonPointer(value)) {
        throw new TypeError(`Fixture path "${value}" is not a valid JSON pointer.`);
    }
    return value;
}

const testWarning: ParserWarningFactory = (code, generation, pathTokens) => ({
    code,
    source: {
        documentKind: 'vehicleUnit',
        generation,
        path: rawPointer(`/${pathTokens.join('/')}`),
    },
});

describe('parser value normalization', () => {
    it('decodes and freezes parser-owned NationAlpha metadata', () => {
        const result = decodeParserNationAlphaCodes({
            Germany: 'D',
            Israel: 'IL',
            Montenegro: 'MNE',
        });

        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }

        expect(normalizeParserNation('Germany', result.value)).toBe('D');
        expect(normalizeParserNation('RFU3A', result.value)).toBeNull();
    });

    it.each([null, {}, { Germany: '' }, { Germany: 'TOO-LONG' }, { 'not a parser nation': 'D' }])(
        'rejects malformed parser-owned NationAlpha metadata %#',
        (value) => {
            expect(decodeParserNationAlphaCodes(value)).toEqual({
                error: 'invalidParserNationAlphaCodes',
                ok: false,
            });
        },
    );

    it('normalizes exact parser UTC timestamps and rejects calendar overflow', () => {
        expect(normalizeParserUtcTimestamp('2024-02-29 12:34:56 UTC')).toBe(Date.UTC(2024, 1, 29, 12, 34, 56));
        expect(normalizeParserUtcTimestamp('0000-00-00 00:00:00 UTC')).toBe(0);
        expect(normalizeParserUtcTimestamp('2023-02-29 12:34:56 UTC')).toBeNull();
        expect(normalizeParserUtcTimestamp('2024-02-29T12:34:56Z')).toBeNull();
        expect(normalizeParserUtcTimestamp(null)).toBeNull();
    });

    it('normalizes bounded nullable parser odometers, warning only on invalid values', () => {
        const warnings: ITachographWarning[] = [];

        expect(normalizeParserOdometerWithWarning(12_340, 'g1', ['odometer'], warnings, testWarning)).toBe(12_340);
        expect(normalizeParserOdometerWithWarning(null, 'g1', ['odometer'], warnings, testWarning)).toBeNull();
        expect(warnings).toHaveLength(0);

        expect(normalizeParserOdometerWithWarning(0xff_ff_ff, 'g1', ['odometer'], warnings, testWarning)).toBeNull();
        expect(warnings).toHaveLength(1);
        expect(warnings[0]?.code).toBe('invalidValue');
    });

    it('identifies unrecorded timestamps (null, 0, and TimeReal max sentinel)', () => {
        expect(isRecordedParserTimestamp(null)).toBe(false);
        expect(isRecordedParserTimestamp(normalizeParserUtcTimestamp('0000-00-00 00:00:00 UTC'))).toBe(false);
        expect(isRecordedParserTimestamp(normalizeParserUtcTimestamp('2106-02-07 06:28:15 UTC'))).toBe(false);
        expect(isRecordedParserTimestamp(normalizeParserUtcTimestamp('2024-01-01 00:00:00 UTC'))).toBe(true);
    });
});
