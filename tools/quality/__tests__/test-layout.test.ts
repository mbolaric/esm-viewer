import { describe, expect, it } from 'vitest';

import { findTestLayoutViolations } from '../test-layout.js';

describe('findTestLayoutViolations', () => {
    it('accepts TypeScript tests inside a __tests__ folder', () => {
        expect(
            findTestLayoutViolations(['src/domain/__tests__/activity.test.ts', 'tools/quality/__tests__/policy.test.ts']),
        ).toEqual([]);
    });

    it('rejects colocated, spec-named, and unsupported test files', () => {
        expect(
            findTestLayoutViolations([
                'src/domain/activity.test.ts',
                'src/domain/__tests__/activity.spec.ts',
                'src/domain/__tests__/activity.test.js',
            ]),
        ).toEqual([
            'src/domain/__tests__/activity.spec.ts',
            'src/domain/__tests__/activity.test.js',
            'src/domain/activity.test.ts',
        ]);
    });
});
