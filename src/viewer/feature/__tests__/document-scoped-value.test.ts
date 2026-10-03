import { describe, expect, it } from 'vitest';

import { createDocumentScopedValue } from '../controllers/document-scoped-value.svelte.js';

describe('createDocumentScopedValue', () => {
    it('starts at the initial value', () => {
        const filter = createDocumentScopedValue<'all' | 'gen1'>('all');

        expect(filter.value).toBe('all');
    });

    it('keeps a set value across repeated syncs with the same document key', () => {
        const filter = createDocumentScopedValue<'all' | 'gen1'>('all');

        filter.syncDocumentKey('doc-a');
        filter.set('gen1');
        filter.syncDocumentKey('doc-a');
        filter.syncDocumentKey('doc-a');

        expect(filter.value).toBe('gen1');
    });

    it('resets to the initial value exactly once when the document key changes', () => {
        const filter = createDocumentScopedValue<'all' | 'gen1'>('all');

        filter.syncDocumentKey('doc-a');
        filter.set('gen1');
        filter.syncDocumentKey('doc-b');

        expect(filter.value).toBe('all');
    });

    it('does not reset again on a subsequent sync with the same new document key', () => {
        const filter = createDocumentScopedValue<'all' | 'gen1'>('all');

        filter.syncDocumentKey('doc-a');
        filter.set('gen1');
        filter.syncDocumentKey('doc-b');
        filter.set('gen1');
        filter.syncDocumentKey('doc-b');

        expect(filter.value).toBe('gen1');
    });
});
