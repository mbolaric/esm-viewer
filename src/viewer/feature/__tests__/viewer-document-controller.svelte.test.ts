import { waitFor } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import type { ReopenToken, Result } from '#contracts';
import { isReopenToken } from '#contracts';
import { isJsonPointer, type IntegrityAssessment, type IntegrityFailureCode, type JsonPointer } from '#viewer-domain';

import { createViewerDocumentHarness, type IViewerDocumentHarness } from './viewer-document-harness.js';

async function openSyntheticCardWithReopenToken(): Promise<{
    readonly candidate: ReopenToken;
    readonly harness: IViewerDocumentHarness;
}> {
    const candidate = '00000000-0000-4000-8000-000000000000';
    if (!isReopenToken(candidate)) {
        throw new TypeError('The reopen-token fixture must be valid.');
    }
    const harness = createViewerDocumentHarness({ reopenToken: candidate });
    const opening = harness.controller.open();

    await waitFor(() => {
        expect(harness.parserRequestCount()).toBe(1);
    });
    harness.completeLatestParser(harness.successfulParserResult());
    await opening;

    return { candidate, harness };
}

function successfulVerifyMock(onVerify: () => void): () => Promise<Result<IntegrityAssessment, IntegrityFailureCode>> {
    const path = '/cardDataResponses';
    if (!isJsonPointer(path)) {
        throw new TypeError('The verification source fixture must be a valid JSON pointer.');
    }
    const sourcePath: JsonPointer = path;
    const value: IntegrityAssessment = {
        items: [
            {
                generation: 'g1',
                recordId: '1',
                status: 'valid',
                source: {
                    documentKind: 'driverCard',
                    generation: 'g1',
                    path: sourcePath,
                },
            },
        ],
        status: 'valid',
    };
    return () => {
        onVerify();
        return Promise.resolve({
            ok: true,
            value,
        });
    };
}

function successfulCertificateLoader(): () => Promise<Result<ArrayBuffer, IntegrityFailureCode>> {
    return () =>
        Promise.resolve({
            ok: true,
            value: new ArrayBuffer(10),
        });
}

describe('ViewerDocumentController', () => {
    it('opens a normalized document and disposes its source and parser owner', async () => {
        const harness = createViewerDocumentHarness();
        const opening = harness.controller.open();

        await waitFor(() => {
            expect(harness.parserRequestCount()).toBe(1);
        });
        expect(harness.controller.snapshot).toMatchObject({
            candidateDisplayName: 'synthetic-card.ddd',
            status: 'opening',
        });

        harness.completeLatestParser(harness.successfulParserResult());
        await opening;

        expect(harness.controller.snapshot).toMatchObject({
            current: {
                content: {
                    documentKind: 'driverCard',
                },
                source: {
                    displayName: 'synthetic-card.ddd',
                },
            },
            status: 'ready',
        });
        expect(harness.controller.comparisonSnapshot.records).toMatchObject([
            {
                displayName: 'synthetic-card.ddd',
                documentKind: 'driverCard',
            },
        ]);
        expect(harness.controller.selectionSnapshot).toMatchObject({
            availableSections: [
                'overview',
                'activities',
                'compliance',
                'associations',
                'places',
                'eventsAndFaults',
                'technical',
                'comparison',
                'integrity',
                'rawData',
            ],
            projection: {
                section: 'overview',
            },
        });
        expect(harness.controller.selectSection('activities')).toBe(true);
        const activityRecord = harness.controller.selectionSnapshot?.projection.records[0];
        if (activityRecord === undefined) {
            throw new TypeError('The activity selection fixture must contain a record.');
        }
        expect(harness.controller.selectRecord(activityRecord)).toBe(true);
        expect(harness.controller.selectionSnapshot?.selectedRecord).toBe(activityRecord);
        expect(harness.controller.clearRecord()).toBe(true);
        expect(harness.controller.selectionSnapshot?.selectedRecord).toBeNull();
        expect(harness.controller.selectSection('eventsAndFaults')).toBe(true);
        expect(harness.controller.selectionSnapshot?.projection.section).toBe('eventsAndFaults');
        expect(harness.controller.selectSection('speed')).toBe(false);

        await harness.controller.dispose();

        expect(harness.releaseCount()).toBe(1);
        expect(harness.parserWasDisposed()).toBe(true);
        expect(harness.controller.selectionSnapshot).toBeNull();
    });

    it('cancels parser work and returns to the prior empty state', async () => {
        const harness = createViewerDocumentHarness();
        const opening = harness.controller.open();

        await waitFor(() => {
            expect(harness.parserRequestCount()).toBe(1);
        });
        expect(harness.controller.cancel()).toBe(true);
        await opening;

        expect(harness.controller.snapshot).toMatchObject({
            current: null,
            error: null,
            status: 'empty',
        });
        expect(harness.releaseCount()).toBe(1);

        await harness.controller.dispose();
    });

    it('reopens a comparison record through the session reopen picker', async () => {
        const { harness } = await openSyntheticCardWithReopenToken();

        const record = harness.controller.comparisonSnapshot.records[0];
        if (record === undefined) {
            throw new TypeError('The comparison fixture must contain an opened record.');
        }
        const reopening = harness.controller.reopenComparisonRecord(record.key);
        await waitFor(() => {
            expect(harness.parserRequestCount()).toBe(2);
        });
        harness.completeLatestParser(harness.successfulParserResult());
        await reopening;

        expect(harness.reopenPickerCallCount()).toBe(1);
        expect(harness.controller.comparisonSnapshot.records).toHaveLength(1);

        await harness.controller.dispose();
    });

    it('records a recent-files entry only for a picker with a genuine reopenable path', async () => {
        const { candidate, harness } = await openSyntheticCardWithReopenToken();

        const recentFileCalls = harness.recentFileCalls();
        expect(recentFileCalls).toHaveLength(1);
        const [recordedCall] = recentFileCalls;
        expect(recordedCall?.displayName).toBe('synthetic-card.ddd');
        expect(recordedCall?.reopenToken).toBe(candidate);
        expect(typeof recordedCall?.openedAtEpochMs).toBe('number');

        await harness.controller.dispose();
    });

    it('never records a recent-files entry for a document opened with no reopenable path', async () => {
        const harness = createViewerDocumentHarness();
        const opening = harness.controller.open();

        await waitFor(() => {
            expect(harness.parserRequestCount()).toBe(1);
        });
        harness.completeLatestParser(harness.successfulParserResult());
        await opening;

        expect(harness.recentFileCalls()).toEqual([]);

        await harness.controller.dispose();
    });

    it('never records a recent-files entry for a drag-and-dropped file, even with a reopenable path', async () => {
        const candidate = '00000000-0000-4000-8000-000000000000';
        if (!isReopenToken(candidate)) {
            throw new TypeError('The reopen-token fixture must be valid.');
        }
        const harness = createViewerDocumentHarness({ reopenToken: candidate });
        const droppedFile = {
            name: 'dropped.ddd',
            size: 3,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(3)),
        };
        const opening = harness.controller.openDroppedFiles([droppedFile]);

        await waitFor(() => {
            expect(harness.parserRequestCount()).toBe(1);
        });
        harness.completeLatestParser(harness.successfulParserResult());
        await opening;

        expect(harness.recentFileCalls()).toEqual([]);

        await harness.controller.dispose();
    });

    it('verifies signatures manually on request', async () => {
        let verifyCalled = 0;
        const harness = createViewerDocumentHarness({
            loadErcRootCertificateMock: successfulCertificateLoader(),
            verifyMock: successfulVerifyMock(() => {
                verifyCalled += 1;
            }),
        });
        const opening = harness.controller.open();

        await waitFor(() => {
            expect(harness.parserRequestCount()).toBe(1);
        });
        harness.completeLatestParser(harness.successfulParserResult());
        await opening;

        expect(harness.controller.snapshot.current?.integrity.status).toBe('notChecked');

        const verificationPromise = harness.controller.verifyDocument();
        expect(harness.controller.verifying).toBe(true);
        await verificationPromise;

        expect(harness.controller.verifying).toBe(false);
        expect(verifyCalled).toBe(1);
        expect(harness.controller.snapshot.current?.integrity.status).toBe('valid');

        await harness.controller.dispose();
    });

    it('verifies signatures automatically on open if enabled', async () => {
        let verifyCalled = 0;
        const harness = createViewerDocumentHarness({
            loadErcRootCertificateMock: successfulCertificateLoader(),
            preferencesAutoRun: true,
            verifyMock: successfulVerifyMock(() => {
                verifyCalled += 1;
            }),
        });
        const opening = harness.controller.open();

        await waitFor(() => {
            expect(harness.parserRequestCount()).toBe(1);
        });
        harness.completeLatestParser(harness.successfulParserResult());
        await opening;

        await waitFor(() => {
            expect(verifyCalled).toBe(1);
            expect(harness.controller.snapshot.current?.integrity.status).toBe('valid');
        });

        await harness.controller.dispose();
    });

    it('keeps a replacement opening when verification of the current document finishes', async () => {
        const pendingCertificate = Promise.withResolvers<Result<ArrayBuffer, IntegrityFailureCode>>();
        let verifyCalled = 0;
        const harness = createViewerDocumentHarness({
            loadErcRootCertificateMock: () => pendingCertificate.promise,
            preferencesAutoRun: true,
            verifyMock: successfulVerifyMock(() => {
                verifyCalled += 1;
            }),
        });
        const firstOpening = harness.controller.open();
        await waitFor(() => {
            expect(harness.parserRequestCount()).toBe(1);
        });
        harness.completeLatestParser(harness.successfulParserResult());
        await firstOpening;
        expect(harness.controller.verifying).toBe(true);

        const replacementOpening = harness.controller.open();
        await waitFor(() => {
            expect(harness.parserRequestCount()).toBe(2);
        });
        const openingSnapshot = harness.controller.snapshot;
        pendingCertificate.resolve({ ok: true, value: new ArrayBuffer(10) });
        await waitFor(() => {
            expect(harness.controller.snapshot.current?.integrity.status).toBe('valid');
            expect(harness.controller.verifying).toBe(false);
        });

        expect(harness.controller.snapshot).toMatchObject({
            candidateDisplayName: openingSnapshot.candidateDisplayName,
            error: openingSnapshot.error,
            status: 'opening',
        });
        expect(harness.controller.snapshot.current?.source).toBe(openingSnapshot.current?.source);
        expect(verifyCalled).toBe(1);

        harness.completeLatestParser(harness.successfulParserResult());
        await replacementOpening;
        await waitFor(() => {
            expect(harness.controller.snapshot.status).toBe('ready');
            expect(verifyCalled).toBe(2);
            expect(harness.controller.verifying).toBe(false);
        });
        await harness.controller.dispose();
    });

    it('verifies a newly opened document while an older verification is still running', async () => {
        let verifyCalled = 0;
        const pendingCertificates: ((result: Result<ArrayBuffer, IntegrityFailureCode>) => void)[] = [];
        const harness = createViewerDocumentHarness({
            loadErcRootCertificateMock: () =>
                new Promise((resolve) => {
                    pendingCertificates.push(resolve);
                }),
            preferencesAutoRun: true,
            verifyMock: successfulVerifyMock(() => {
                verifyCalled += 1;
            }),
        });

        const firstOpening = harness.controller.open();
        await waitFor(() => {
            expect(harness.parserRequestCount()).toBe(1);
        });
        harness.completeLatestParser(harness.successfulParserResult());
        await firstOpening;
        expect(pendingCertificates).toHaveLength(1);

        const secondOpening = harness.controller.open();
        await waitFor(() => {
            expect(harness.parserRequestCount()).toBe(2);
        });
        harness.completeLatestParser(harness.successfulParserResult());
        await secondOpening;
        expect(pendingCertificates).toHaveLength(2);
        expect(harness.controller.verifying).toBe(true);

        pendingCertificates[0]?.({ ok: true, value: new ArrayBuffer(10) });
        await waitFor(() => {
            expect(verifyCalled).toBe(1);
        });
        expect(harness.controller.snapshot.current?.integrity.status).toBe('notChecked');
        expect(harness.controller.verifying).toBe(true);

        pendingCertificates[1]?.({ ok: true, value: new ArrayBuffer(10) });
        await waitFor(() => {
            expect(verifyCalled).toBe(2);
            expect(harness.controller.snapshot.current?.integrity.status).toBe('valid');
            expect(harness.controller.verifying).toBe(false);
        });

        await harness.controller.dispose();
    });

    it('reports a failed certificate load without contacting the parser', async () => {
        const harness = createViewerDocumentHarness({
            loadErcRootCertificateMock: () =>
                Promise.resolve({
                    error: 'internalError',
                    ok: false,
                }),
            verifyMock: () => {
                throw new TypeError('The parser must not be reached after a certificate failure.');
            },
        });
        const opening = harness.controller.open();

        await waitFor(() => {
            expect(harness.parserRequestCount()).toBe(1);
        });
        harness.completeLatestParser(harness.successfulParserResult());
        await opening;

        await harness.controller.verifyDocument();

        expect(harness.controller.snapshot.current?.integrity.status).toBe('failed');
        await harness.controller.dispose();
    });
});
