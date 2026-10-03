import { describe, expect, it } from 'vitest';

import { createSourceReference, isJsonPointer } from '../index.js';

describe('createSourceReference', () => {
    it('preserves the concrete source generation and canonical path', () => {
        const pathValue = '/driverCard/gen2/activities/0';
        if (!isJsonPointer(pathValue)) {
            throw new TypeError('The test source path must be a canonical JSON Pointer.');
        }

        const source = createSourceReference('driverCard', 'g2', pathValue);

        expect(source).toEqual({
            documentKind: 'driverCard',
            generation: 'g2',
            path: pathValue,
        });
    });
});
