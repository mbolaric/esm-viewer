import { describe, expect, it } from 'vitest';

import { decodePackageVersion } from '../package-manifest.js';

describe('package version boundary', () => {
    it('reads a version without changing its prerelease or build metadata', () => {
        expect(decodePackageVersion({ version: '1.2.3-beta.1+build.4' })).toBe('1.2.3-beta.1+build.4');
    });

    it.each([null, [], {}, { version: null }, { version: 123 }, { version: '' }, { version: '   ' }])(
        'rejects a missing or invalid version: %j',
        (value: unknown) => {
            expect(() => decodePackageVersion(value)).toThrow(TypeError);
        },
    );
});
