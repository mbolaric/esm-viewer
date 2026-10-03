import { describe, expect, it } from 'vitest';

import {
    classifyIntegrityItems,
    type ISourceReference,
    type IntegrityAssessment,
    type IntegrityItem,
    type VerificationGeneration,
    isJsonPointer,
} from '../index.js';

function createTestSource(
    generation: VerificationGeneration,
    pathValue: string,
): ISourceReference<VerificationGeneration, 'driverCard'> {
    if (!isJsonPointer(pathValue)) {
        throw new TypeError('The test source path must be a canonical JSON Pointer.');
    }

    return {
        documentKind: 'driverCard',
        generation,
        path: pathValue,
    };
}

describe('classifyIntegrityItems', () => {
    const validGen1Item: IntegrityItem = {
        generation: 'g1',
        recordId: 'CardDownload',
        source: createTestSource('g1', '/driverCard/gen1/cardDownload'),
        status: 'valid',
    };
    const validGen2Item: IntegrityItem = {
        generation: 'g2',
        recordId: 'CardDownload',
        source: createTestSource('g2', '/driverCard/gen2/cardDownload'),
        status: 'valid',
    };
    const invalidGen2Item: IntegrityItem = {
        generation: 'g2',
        recordId: 'ApplicationIdentification',
        source: createTestSource('g2', '/driverCard/gen2/cardDownload'),
        status: 'invalid',
    };

    it('does not invent an assessment when no item was verified', () => {
        expect(classifyIntegrityItems([])).toBeNull();
    });

    it('classifies all valid items as valid', () => {
        expect(classifyIntegrityItems([validGen1Item, validGen2Item])).toEqual({
            items: [validGen1Item, validGen2Item],
            status: 'valid',
        });
    });

    it('classifies mixed Gen1 and Gen2 results as partially valid', () => {
        expect(classifyIntegrityItems([validGen1Item, invalidGen2Item])).toEqual({
            items: [validGen1Item, invalidGen2Item],
            status: 'partiallyValid',
        });
    });

    it('classifies results with no valid item as invalid', () => {
        expect(classifyIntegrityItems([invalidGen2Item])).toEqual({
            items: [invalidGen2Item],
            status: 'invalid',
        });
    });

    it('takes a frozen snapshot of the per-item evidence', () => {
        const items: IntegrityItem[] = [validGen1Item];
        const assessment = classifyIntegrityItems(items);

        items.push(invalidGen2Item);

        expect(assessment).toEqual({
            items: [validGen1Item],
            status: 'valid',
        });
    });
});

describe('IntegrityAssessment', () => {
    it('preserves explicit non-verified outcomes', () => {
        const assessments = [
            {
                reason: 'notRequested',
                status: 'notChecked',
            },
            {
                reason: 'unsupportedCertificateChain',
                status: 'unsupported',
            },
            {
                code: 'verificationFailed',
                status: 'failed',
            },
        ] satisfies readonly IntegrityAssessment[];

        expect(assessments.map((assessment) => assessment.status)).toEqual(['notChecked', 'unsupported', 'failed']);
    });
});
