import { decodeFileMetadata } from '#contracts';
import { isUtcTimestamp } from '#viewer-domain';
import { describe, expect, it } from 'vitest';

import { createDocumentSource } from '../index.js';

describe('createDocumentSource', () => {
    it('combines decoded metadata with an immutable domain timestamp', () => {
        const metadata = decodeFileMetadata({
            byteLength: 1024,
            displayName: 'synthetic.ddd',
            sha256: 'a'.repeat(64),
        });
        const openedAtValue = 1_700_000_000_000;

        if (!metadata.ok || !isUtcTimestamp(openedAtValue)) {
            throw new TypeError('The document source fixture must be valid.');
        }

        const source = createDocumentSource(metadata.value, openedAtValue);

        expect(source).toEqual({
            byteLength: 1024,
            displayName: 'synthetic.ddd',
            openedAt: openedAtValue,
            reopenToken: null,
            sha256: 'a'.repeat(64),
            sourceToken: null,
        });
    });
});
