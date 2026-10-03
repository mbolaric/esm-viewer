import { err, type IJsonRecord, isBoundaryRecord, ok, type ParserDataFileSourcePaths, type Result } from '#contracts';
import {
    classifyIntegrityItems,
    createSourceReference,
    isJsonPointer,
    type IntegrityAssessment,
    type IntegrityItem,
    type VerificationGeneration,
} from '#viewer-domain';

import type { VerifyItem, VerifyResult } from '../generated/esm_parser.js';
import { hasVerifyResultShape, isExpectedAggregateStatus } from './parser-verification-status.js';

export type ParserVerificationDecodeError =
    | 'aggregateStatusMismatch'
    | 'duplicateVerificationItem'
    | 'invalidVerificationResult'
    | 'invalidVerificationSource'
    | 'missingSourceData'
    | 'verificationResultOutsideBounds';

export interface IParserVerificationEvidence {
    readonly assessment: IntegrityAssessment;
    readonly rawTree: IJsonRecord;
}

function decodeIntegrityItem(
    value: VerifyItem,
    generation: VerificationGeneration,
    dataFiles: IJsonRecord,
    dataFileSourcePaths: ParserDataFileSourcePaths,
): Result<IntegrityItem, ParserVerificationDecodeError> {
    const cardFileId = value.card_file_id;
    if (!Object.hasOwn(dataFiles, cardFileId) || !Object.hasOwn(dataFileSourcePaths, cardFileId)) {
        return err('missingSourceData');
    }

    const path = dataFileSourcePaths[cardFileId];
    if (!isJsonPointer(path)) {
        return err('invalidVerificationSource');
    }
    const source = createSourceReference('driverCard', generation, path);
    return ok({
        generation,
        recordId: cardFileId,
        source,
        status: value.status === 'Valid' ? 'valid' : 'invalid',
    });
}

export function isVerifyResult(value: unknown): value is VerifyResult {
    return hasVerifyResultShape(value);
}

export function decodeParserVerification(
    value: VerifyResult,
    generation: VerificationGeneration,
    dataFiles: IJsonRecord,
    dataFileSourcePaths: ParserDataFileSourcePaths,
): Result<IParserVerificationEvidence, ParserVerificationDecodeError> {
    if (!isBoundaryRecord(value)) {
        return err('verificationResultOutsideBounds');
    }

    if (value.status === 'Unsigned') {
        if (value.result.length !== 0) {
            return err('aggregateStatusMismatch');
        }

        return ok({
            assessment: {
                reason: 'unsupportedCardApplication',
                status: 'unsupported',
            },
            rawTree: value,
        });
    }

    const items: IntegrityItem[] = [];
    const recordIds = new Set<string>();
    const sourcePaths = new Set<string>();
    for (const rawItem of value.result) {
        const item = decodeIntegrityItem(rawItem, generation, dataFiles, dataFileSourcePaths);
        if (!item.ok) {
            return item;
        }
        if (recordIds.has(item.value.recordId) || sourcePaths.has(item.value.source.path)) {
            return err('duplicateVerificationItem');
        }
        recordIds.add(item.value.recordId);
        sourcePaths.add(item.value.source.path);
        items.push(item.value);
    }

    const assessment = classifyIntegrityItems(items);
    if (assessment === null) {
        return err('invalidVerificationResult');
    }
    if (!isExpectedAggregateStatus(value.status, assessment.status)) {
        return err('aggregateStatusMismatch');
    }

    return ok({
        assessment,
        rawTree: value,
    });
}
