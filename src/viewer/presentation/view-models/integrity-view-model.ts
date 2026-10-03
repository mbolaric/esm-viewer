import {
    createDocumentIntegrityProjection,
    type IDocumentIntegrityCounts,
    type OpenedTachographDocument,
} from '#viewer-application';
import type {
    IIntegrityChainVerified,
    IntegrityAssessment,
    IntegrityItem,
    ISourceReference,
    TachographGeneration,
    VerificationGeneration,
    VerifiedIntegrityAssessment,
} from '#viewer-domain';

import { formatNumber, type IFormattedValue } from './document-view-model.js';
import type { ViewerLocalisationService } from '../helpers/view-model-formatting.js';

export interface IIntegrityCountsViewModel {
    readonly checkedItems: IFormattedValue<number>;
    readonly invalidItems: IFormattedValue<number>;
    readonly validItems: IFormattedValue<number>;
}

export interface IIntegrityScopeViewModel extends IIntegrityCountsViewModel {
    readonly applicationGeneration: TachographGeneration;
    readonly assessment: VerifiedIntegrityAssessment | IIntegrityChainVerified | null;
    readonly source: ISourceReference;
    readonly verificationGeneration: VerificationGeneration | null;
}

export interface IIntegrityDetailViewModel extends IIntegrityCountsViewModel {
    readonly assessment: IntegrityAssessment;
    readonly items: readonly IntegrityItem[];
    readonly scopes: readonly IIntegrityScopeViewModel[];
}

function mapCounts(counts: IDocumentIntegrityCounts, localisation: ViewerLocalisationService): IIntegrityCountsViewModel {
    return {
        checkedItems: formatNumber(counts.checkedItems, localisation),
        invalidItems: formatNumber(counts.invalidItems, localisation),
        validItems: formatNumber(counts.validItems, localisation),
    };
}

export function createIntegrityDetailViewModel(
    document: OpenedTachographDocument,
    localisation: ViewerLocalisationService,
): IIntegrityDetailViewModel {
    const projection = createDocumentIntegrityProjection(document);

    return {
        assessment: projection.assessment,
        ...mapCounts(projection.counts, localisation),
        items: projection.items,
        scopes: projection.scopes.map((scope) => ({
            applicationGeneration: scope.applicationGeneration,
            assessment: scope.assessment,
            ...mapCounts(
                {
                    checkedItems: scope.assessment?.items.length ?? 0,
                    invalidItems: scope.assessment?.items.filter((item) => item.status === 'invalid').length ?? 0,
                    validItems: scope.assessment?.items.filter((item) => item.status === 'valid').length ?? 0,
                },
                localisation,
            ),
            source: scope.source,
            verificationGeneration: scope.verificationGeneration,
        })),
    };
}
