import {
    classifyIntegrityItems,
    type IIntegrityChainVerified,
    type IntegrityAssessment,
    type IntegrityItem,
    type IntegrityItemStatus,
    type ISourceReference,
    type TachographGeneration,
    type VerificationGeneration,
    type VerifiedIntegrityAssessment,
} from '#viewer-domain';

import type { ITachographParserPort } from './document-candidate.js';
import type { OpenedTachographDocument } from './opened-document.js';

export interface IDocumentIntegrityCounts {
    readonly checkedItems: number;
    readonly invalidItems: number;
    readonly validItems: number;
}

export interface IDocumentIntegrityScopeProjection {
    readonly applicationGeneration: TachographGeneration;
    readonly assessment: VerifiedIntegrityAssessment | IIntegrityChainVerified | null;
    readonly source: ISourceReference;
    readonly verificationGeneration: VerificationGeneration | null;
}

export interface IDocumentIntegrityProjection {
    readonly assessment: IntegrityAssessment;
    readonly counts: IDocumentIntegrityCounts;
    readonly items: readonly IntegrityItem[];
    readonly scopes: readonly IDocumentIntegrityScopeProjection[];
}

function integrityItems(assessment: IntegrityAssessment): readonly IntegrityItem[] {
    switch (assessment.status) {
        case 'failed':
        case 'notChecked':
        case 'unsupported':
            return [];
        case 'invalid':
        case 'partiallyValid':
        case 'valid':
        case 'chainVerified':
            return assessment.items;
    }
}

function countItems(items: readonly IntegrityItem[], status: IntegrityItemStatus): number {
    return items.filter((item) => item.status === status).length;
}

function projectCounts(items: readonly IntegrityItem[]): IDocumentIntegrityCounts {
    return {
        checkedItems: items.length,
        invalidItems: countItems(items, 'invalid'),
        validItems: countItems(items, 'valid'),
    };
}

function projectScopes(
    document: OpenedTachographDocument,
    items: readonly IntegrityItem[],
): readonly IDocumentIntegrityScopeProjection[] {
    if (document.content.documentKind === 'vehicleUnit') {
        const assessment =
            document.integrity.status === 'chainVerified' ||
            document.integrity.status === 'valid' ||
            document.integrity.status === 'partiallyValid' ||
            document.integrity.status === 'invalid'
                ? document.integrity
                : null;
        return [
            {
                applicationGeneration: document.content.generation,
                assessment,
                source: document.content.rootSource,
                verificationGeneration: document.content.verification?.generation ?? null,
            },
        ];
    }

    return document.content.applications.map((application) => {
        const scopeItems = items.filter((item) => item.generation === application.verification.generation);

        return {
            applicationGeneration: application.generation,
            assessment: classifyIntegrityItems(scopeItems),
            source: application.source,
            verificationGeneration: application.verification.generation,
        };
    });
}

export function createDocumentIntegrityProjection(document: OpenedTachographDocument): IDocumentIntegrityProjection {
    const items = integrityItems(document.integrity);

    return {
        assessment: document.integrity,
        counts: projectCounts(items),
        items,
        scopes: projectScopes(document, items),
    };
}

export async function verifyDriverCardDocumentIntegrity(
    document: OpenedTachographDocument,
    parser: Pick<ITachographParserPort, 'loadErcRootCertificate' | 'verify'>,
): Promise<IntegrityAssessment> {
    if (document.content.documentKind !== 'driverCard') {
        return document.integrity;
    }

    const allItems: IntegrityItem[] = [];
    for (const app of document.content.applications) {
        const verification = app.verification;
        const certificateResult = await parser.loadErcRootCertificate(verification.generation);

        if (!certificateResult.ok) {
            return {
                code: certificateResult.error,
                status: 'failed',
            };
        }

        const verifyResult = await parser.verify(
            verification.generation,
            verification.dataFiles,
            verification.dataFileSourcePaths,
            certificateResult.value,
        );

        if (!verifyResult.ok) {
            return {
                code: verifyResult.error,
                status: 'failed',
            };
        }

        const assessment = verifyResult.value;
        if (assessment.status === 'failed' || assessment.status === 'unsupported' || assessment.status === 'notChecked') {
            return assessment;
        }

        allItems.push(...assessment.items);
    }

    const combined = classifyIntegrityItems(allItems);
    if (combined !== null) {
        return combined;
    }

    return {
        reason: 'notRequested',
        status: 'notChecked',
    };
}

export async function verifyVehicleUnitDocumentIntegrity(
    document: OpenedTachographDocument,
    parser: Pick<ITachographParserPort, 'loadErcRootCertificate' | 'verifyVehicleUnit'>,
): Promise<IntegrityAssessment> {
    if (document.content.documentKind !== 'vehicleUnit') {
        return document.integrity;
    }

    const verification = document.content.verification;
    if (verification === null) {
        return {
            reason: 'missingVehicleUnitOverview',
            status: 'unsupported',
        };
    }

    const certificateResult = await parser.loadErcRootCertificate(verification.generation);
    if (!certificateResult.ok) {
        return {
            code: certificateResult.error,
            status: 'failed',
        };
    }

    const verifyResult = await parser.verifyVehicleUnit(
        verification.generation,
        verification.memberStateCertificateRaw,
        verification.vuCertificateRaw,
        {
            dataFileSourcePaths: verification.dataFileSourcePaths,
            memberStateCertificate: verification.memberStateCertificateSourcePath,
            vuCertificate: verification.vuCertificateSourcePath,
        },
        verification.dataFiles,
        certificateResult.value,
    );

    if (!verifyResult.ok) {
        return {
            code: verifyResult.error,
            status: 'failed',
        };
    }

    return verifyResult.value;
}
