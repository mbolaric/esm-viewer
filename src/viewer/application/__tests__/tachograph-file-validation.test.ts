import { describe, expect, it } from 'vitest';

import { hasRecognizedTachographHeader } from '../index.js';

describe('hasRecognizedTachographHeader', () => {
    it.each([
        [0x00, 0x02],
        [0x76, 0x01],
        [0x76, 0x06],
        [0x76, 0x21],
        [0x76, 0x31],
    ])('accepts a recognized tachograph header', (first, second) => {
        expect(hasRecognizedTachographHeader(new Uint8Array([first, second]))).toBe(true);
    });

    it('rejects unrecognized content', () => {
        const unrecognizedHeaders: readonly (readonly number[])[] = [[], [0x00], [0x00, 0x03], [0x76, 0x20], [0xff, 0xff]];

        for (const bytes of unrecognizedHeaders) {
            expect(hasRecognizedTachographHeader(new Uint8Array(bytes))).toBe(false);
        }
    });
});
