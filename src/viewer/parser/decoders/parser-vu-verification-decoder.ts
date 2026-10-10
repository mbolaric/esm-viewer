import { err, type IParserVuVerificationSourcePaths, isBoundaryRecord, ok, type Result } from '#contracts';
import {
    classifyChainVerifiedItems,
    classifyIntegrityItems,
    createSourceReference,
    isJsonPointer,
    type IIntegrityChainVerified,
    type IntegrityItem,
    type VerificationGeneration,
    type VerifiedIntegrityAssessment,
} from '#viewer-domain';

import type { VUTransferResponseParameterID, VuCertificateKind, VuVerifyItem, VuVerifyResult } from '../generated/esm_parser.js';
import { hasVerifyResultShape, isExpectedAggregateStatus } from './parser-verification-status.js';

export type ParserVuVerificationDecodeError =
    | 'aggregateStatusMismatch'
    | 'duplicateVerificationItem'
    | 'invalidVerificationResult'
    | 'invalidVerificationSource'
    | 'verificationResultOutsideBounds';

const recordIdByCertificateKind: Readonly<Record<VuCertificateKind, string>> = {
    MemberStateCertificate: 'memberStateCertificate',
    VuCertificate: 'vuCertificate',
};

type VuCertificateVerifyItem = Extract<VuVerifyItem, { certificate: VuCertificateKind }>;
type VuRecordVerifyItem = Extract<VuVerifyItem, { trepId: VUTransferResponseParameterID }>;

function isVuCertificateVerifyItem(value: VuVerifyItem): value is VuCertificateVerifyItem {
    return 'certificate' in value;
}

function isVuRecordVerifyItem(value: VuVerifyItem): value is VuRecordVerifyItem {
    return 'trepId' in value;
}

function decodeIntegrityItem(
    value: VuVerifyItem,
    generation: VerificationGeneration,
    sourcePaths: IParserVuVerificationSourcePaths,
): Result<IntegrityItem, ParserVuVerificationDecodeError> {
    if (isVuCertificateVerifyItem(value)) {
        const path =
            value.certificate === 'MemberStateCertificate' ? sourcePaths.memberStateCertificate : sourcePaths.vuCertificate;
        if (!isJsonPointer(path)) {
            return err('invalidVerificationSource');
        }

        return ok({
            generation,
            recordId: recordIdByCertificateKind[value.certificate],
            source: createSourceReference('vehicleUnit', generation, path),
            status: value.status === 'Valid' ? 'valid' : 'invalid',
        });
    }

    if (isVuRecordVerifyItem(value)) {
        const key = `${value.trepId}.${String(value.position)}`;
        const path = sourcePaths.dataFileSourcePaths?.[key] ?? sourcePaths.dataFileSourcePaths?.[value.trepId];
        if (path === undefined || !isJsonPointer(path)) {
            return err('invalidVerificationSource');
        }

        return ok({
            generation,
            recordId: key,
            source: createSourceReference('vehicleUnit', generation, path),
            status: value.status === 'Valid' ? 'valid' : 'invalid',
        });
    }

    return err('invalidVerificationResult');
}

export function isVuVerifyResult(value: unknown): value is VuVerifyResult {
    return hasVerifyResultShape(value);
}

export function decodeParserVuVerification(
    value: unknown,
    generation: VerificationGeneration,
    sourcePaths: IParserVuVerificationSourcePaths,
): Result<VerifiedIntegrityAssessment | IIntegrityChainVerified, ParserVuVerificationDecodeError> {
    if (!isVuVerifyResult(value)) {
        return err('invalidVerificationResult');
    }
    if (!isBoundaryRecord(value) || value.status === 'Unsigned') {
        return err('verificationResultOutsideBounds');
    }

    const items: IntegrityItem[] = [];
    const recordIds = new Set<string>();
    for (const rawItem of value.result) {
        const item = decodeIntegrityItem(rawItem, generation, sourcePaths);
        if (!item.ok) {
            return item;
        }
        if (recordIds.has(item.value.recordId)) {
            return err('duplicateVerificationItem');
        }
        recordIds.add(item.value.recordId);
        items.push(item.value);
    }

    const hasRecordItems = items.some((item) => item.recordId !== 'memberStateCertificate' && item.recordId !== 'vuCertificate');
    const assessment = hasRecordItems ? classifyIntegrityItems(items) : classifyChainVerifiedItems(items);
    if (assessment === null) {
        return err('invalidVerificationResult');
    }
    const assessmentStatus = assessment.status === 'chainVerified' ? assessment.chainStatus : assessment.status;
    if (!isExpectedAggregateStatus(value.status, assessmentStatus)) {
        return err('aggregateStatusMismatch');
    }

    return ok(assessment);
}
