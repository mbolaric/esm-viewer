import { expect, vi } from 'vitest';

import { createExportReportViewModel, type IExportReportViewModel } from '#viewer-presentation';
import type { OpenedTachographDocument } from '#viewer-application';
import {
    createDailyWorkPeriodPlace,
    createSourceReference,
    isIssuingMemberState,
    isJsonPointer,
    isOdometerKilometres,
    isUtcTimestamp,
    type ISourceReference,
    type TachographLocationRecord,
    type UtcTimestamp,
} from '#viewer-domain';
import { createComplianceViewModel, evaluateDocumentCompliance } from '#compliance';

import { createViewerTestContext } from './viewer-test-context.js';
import type { createViewerDocumentHarness } from './viewer-document-harness.js';

export interface IOpenedDocumentFixture {
    readonly context: ReturnType<typeof createViewerTestContext>;
    readonly document: NonNullable<ReturnType<typeof createViewerDocumentHarness>['controller']['snapshot']['current']>;
}

export async function openDocumentFixture(
    harness: ReturnType<typeof createViewerDocumentHarness>,
    parserResult?: () => Parameters<ReturnType<typeof createViewerDocumentHarness>['completeLatestParser']>[0],
): Promise<IOpenedDocumentFixture> {
    const context = createViewerTestContext(harness.controller);
    void harness.controller.open();
    await vi.waitFor(() => {
        expect(harness.parserRequestCount()).toBe(1);
    });
    harness.completeLatestParser(parserResult === undefined ? harness.successfulParserResult() : parserResult());
    await vi.waitFor(() => {
        expect(harness.controller.snapshot.status).toBe('ready');
    });
    const document = harness.controller.snapshot.current;
    if (document === null) {
        throw new TypeError('The document fixture must open a document.');
    }
    return { context, document };
}

export function reportViewModelFor(
    document: OpenedTachographDocument,
    context: ReturnType<typeof createViewerTestContext>,
    parserVersions: { readonly commit: string | null; readonly version: string | null },
): IExportReportViewModel {
    const profile = context.complianceProfileController.selectedProfile;
    return createExportReportViewModel(
        document,
        context.localisationService,
        parserVersions,
        createComplianceViewModel(document, context.translationService, profile),
        evaluateDocumentCompliance(document, profile),
    );
}

export function reportFixtureTimestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The export report timestamp fixture must be valid.');
    }
    return value;
}

export function reportFixtureCardPlaceSource(path: string): ISourceReference<'g1', 'driverCard'> {
    if (!isJsonPointer(path)) {
        throw new TypeError('The export report place source fixture must be valid.');
    }
    return createSourceReference('driverCard', 'g1', path);
}

export function reportFixturePlaceRecord(): TachographLocationRecord {
    const country = 'HR';
    const odometer = 477_499;
    if (!isIssuingMemberState(country) || !isOdometerKilometres(odometer)) {
        throw new TypeError('The export report place fixture must be valid.');
    }
    return createDailyWorkPeriodPlace({
        card: null,
        country,
        entryAt: reportFixtureTimestamp(Date.UTC(2026, 6, 27, 8, 3, 36)),
        entryType: 'endCardWithdrawal',
        odometer,
        position: null,
        region: null,
        source: reportFixtureCardPlaceSource('/cardDataResponses/places/placeRecords/0'),
    });
}
