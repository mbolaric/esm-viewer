import { describe, expect, it } from 'vitest';

import { createSourceReference, createTachographWarning, isJsonPointer, type TachographWarningCode } from '../index.js';

describe('createTachographWarning', () => {
    it('preserves every typed warning code with exact source evidence', () => {
        const pathValue = '/driverCard/gen2/activities/0';
        if (!isJsonPointer(pathValue)) {
            throw new TypeError('The test source path must be a canonical JSON Pointer.');
        }

        const source = createSourceReference('driverCard', 'g2', pathValue);
        const codes = [
            'duplicateEvidence',
            'inconsistentData',
            'invalidValue',
            'missingValue',
            'unsupportedData',
        ] satisfies readonly TachographWarningCode[];
        const codeCoverage = {
            duplicateEvidence: true,
            inconsistentData: true,
            invalidValue: true,
            missingValue: true,
            unsupportedData: true,
        } satisfies Record<TachographWarningCode, true>;
        const warnings = codes.map((code) => createTachographWarning(code, source));

        expect(Object.keys(codeCoverage)).toEqual(codes);
        expect(warnings.map((warning) => warning.code)).toEqual(codes);
    });
});
