import { describe, expect, it } from 'vitest';

import { isJsonPointer, type JsonPointer } from '#viewer-domain';

import { resolveJsonPointer } from '../index.js';

function pointer(value: string): JsonPointer {
    if (!isJsonPointer(value)) {
        throw new Error('Invalid test pointer.');
    }

    return value;
}

describe('resolveJsonPointer', () => {
    const evidence = {
        'a/b': {
            '~key': ['first', { value: 42 }],
        },
    };

    it('resolves the root and escaped object/array tokens', () => {
        expect(resolveJsonPointer(evidence, pointer(''))).toEqual({
            ok: true,
            value: evidence,
        });
        expect(resolveJsonPointer(evidence, pointer('/a~1b/~0key/1/value'))).toEqual({
            ok: true,
            value: 42,
        });
    });

    it('rejects non-canonical or missing array entries', () => {
        expect(resolveJsonPointer(['value'], pointer('/00'))).toEqual({
            error: 'invalidArrayIndex',
            ok: false,
        });
        expect(resolveJsonPointer(['value'], pointer('/1'))).toEqual({
            error: 'missingArrayEntry',
            ok: false,
        });
    });

    it('reports missing properties and scalar traversal', () => {
        expect(resolveJsonPointer(evidence, pointer('/missing'))).toEqual({
            error: 'missingObjectEntry',
            ok: false,
        });
        expect(resolveJsonPointer({ value: 1 }, pointer('/value/child'))).toEqual({
            error: 'scalarTraversal',
            ok: false,
        });
    });
});
