import { describe, expect, it } from 'vitest';

import { decodeFileMetadata } from '../index.js';

const validDigest = 'a'.repeat(64);

describe('decodeFileMetadata', () => {
    it('decodes and freezes privacy-safe file metadata', () => {
        const result = decodeFileMetadata({
            byteLength: 1024,
            displayName: 'synthetic.ddd',
            sha256: validDigest,
        });

        expect(result).toEqual({
            ok: true,
            value: {
                byteLength: 1024,
                displayName: 'synthetic.ddd',
                sha256: validDigest,
            },
        });
    });

    it.each<[unknown]>([
        [{ displayName: 'synthetic.ddd', sha256: validDigest }],
        [
            {
                byteLength: 1,
                displayName: 'synthetic.ddd',
                extra: true,
                sha256: validDigest,
            },
        ],
        [{ byteLength: -1, displayName: 'synthetic.ddd', sha256: validDigest }],
        [
            {
                byteLength: Number.MAX_SAFE_INTEGER + 1,
                displayName: 'synthetic.ddd',
                sha256: validDigest,
            },
        ],
        [{ byteLength: 1, displayName: 'folder/file.ddd', sha256: validDigest }],
        [{ byteLength: 1, displayName: 'folder\\file.ddd', sha256: validDigest }],
        [{ byteLength: 1, displayName: 'f'.repeat(257), sha256: validDigest }],
        [{ byteLength: 1, displayName: 'synthetic.ddd', sha256: 'A'.repeat(64) }],
        [{ byteLength: 1, displayName: 'synthetic.ddd', sha256: 'a'.repeat(63) }],
    ])('rejects missing, malformed, oversized, or unexpected metadata', (value: unknown) => {
        expect(decodeFileMetadata(value)).toEqual({
            error: 'invalidFileMetadata',
            ok: false,
        });
    });
});
