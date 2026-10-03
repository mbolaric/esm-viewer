import { classifyParseError, decodeFileMetadata, type FileDisplayName } from '#contracts';
import { isUtcTimestamp } from '#viewer-domain';
import { describe, expect, it } from 'vitest';

import {
    createDocumentSource,
    createOpenedTachographDocument,
    DocumentLifecycleController,
    type DocumentOpenResult,
    type IDocumentOpenOperation,
    type IOpenedDocumentSession,
    type IParsedDriverCardDocument,
    type OpenedTachographDocument,
} from '../index.js';

interface IOperationHarness {
    readonly cancelCount: () => number;
    readonly complete: (result: DocumentOpenResult) => void;
    readonly operation: IDocumentOpenOperation;
}

interface ISessionHarness {
    readonly disposeCount: () => number;
    readonly session: IOpenedDocumentSession;
}

function openedDocument(displayName: string, digestCharacter: string): OpenedTachographDocument {
    const metadata = decodeFileMetadata({
        byteLength: 512,
        displayName,
        sha256: digestCharacter.repeat(64),
    });
    const openedAt = Date.UTC(2026, 6, 27);
    if (!metadata.ok || !isUtcTimestamp(openedAt)) {
        throw new TypeError('The lifecycle document fixture must be valid.');
    }

    const content: IParsedDriverCardDocument = {
        applications: [],
        cardType: 'driverCard',
        documentKind: 'driverCard',
        generation: 'g1',
        parserVariant: 'cardGen1',
        rawTree: {
            fixture: displayName,
        },
        sections: [],
    };

    return createOpenedTachographDocument(createDocumentSource(metadata.value, openedAt), content);
}

function operation(displayName: FileDisplayName): IOperationHarness {
    const deferred = Promise.withResolvers<DocumentOpenResult>();
    let cancellations = 0;

    return {
        cancelCount: () => cancellations,
        complete: deferred.resolve,
        operation: {
            cancel: () => {
                cancellations += 1;
            },
            completion: deferred.promise,
            displayName,
        },
    };
}

function session(document: OpenedTachographDocument): ISessionHarness {
    let disposals = 0;

    return {
        disposeCount: () => disposals,
        session: {
            dispose: () => {
                disposals += 1;
                return Promise.resolve({
                    ok: true,
                    value: null,
                });
            },
            document,
        },
    };
}

async function openSession(controller: DocumentLifecycleController, sessionHarness: ISessionHarness): Promise<IOperationHarness> {
    const operationHarness = operation(sessionHarness.session.document.source.displayName);
    const completion = controller.openCandidate(operationHarness.operation);
    operationHarness.complete({
        ok: true,
        value: sessionHarness.session,
    });
    await completion;
    return operationHarness;
}

describe('DocumentLifecycleController', () => {
    it('opens and atomically replaces documents while disposing the prior session', async () => {
        const controller = new DocumentLifecycleController();
        const first = session(openedDocument('first.ddd', 'a'));
        const second = session(openedDocument('second.ddd', 'b'));

        await openSession(controller, first);
        await openSession(controller, second);

        expect(controller.snapshot).toMatchObject({
            candidateDisplayName: null,
            current: second.session.document,
            error: null,
            status: 'ready',
        });
        expect(first.disposeCount()).toBe(1);
        expect(second.disposeCount()).toBe(0);
    });

    it('preserves the current document when a replacement fails', async () => {
        const controller = new DocumentLifecycleController();
        const current = session(openedDocument('current.ddd', 'a'));
        const replacement = openedDocument('broken.ddd', 'b');
        await openSession(controller, current);
        const replacementOperation = operation(replacement.source.displayName);

        const completion = controller.openCandidate(replacementOperation.operation);
        replacementOperation.complete({
            error: classifyParseError('malformedData'),
            ok: false,
        });
        await completion;

        expect(controller.snapshot).toEqual({
            candidateDisplayName: replacement.source.displayName,
            current: current.session.document,
            error: classifyParseError('malformedData'),
            status: 'failed',
        });
        expect(current.disposeCount()).toBe(0);
    });

    it('records acquisition failures and dismisses them without losing the current document', async () => {
        const controller = new DocumentLifecycleController();
        const current = session(openedDocument('current.ddd', 'a'));
        await openSession(controller, current);

        expect(controller.reportOpenFailure(classifyParseError('fileReadFailed'))).toEqual({
            candidateDisplayName: null,
            current: current.session.document,
            error: classifyParseError('fileReadFailed'),
            status: 'failed',
        });
        expect(controller.dismissFailure()).toBe(true);
        expect(controller.snapshot).toEqual({
            candidateDisplayName: null,
            current: current.session.document,
            error: null,
            status: 'ready',
        });
        expect(controller.dismissFailure()).toBe(false);
        expect(current.disposeCount()).toBe(0);
    });

    it('cancels immediately and disposes a stale successful completion', async () => {
        const controller = new DocumentLifecycleController();
        const current = session(openedDocument('current.ddd', 'a'));
        const candidate = session(openedDocument('candidate.ddd', 'b'));
        await openSession(controller, current);
        const candidateOperation = operation(candidate.session.document.source.displayName);

        const completion = controller.openCandidate(candidateOperation.operation);
        expect(controller.cancelCandidate()).toBe(true);
        expect(controller.snapshot).toMatchObject({
            current: current.session.document,
            status: 'ready',
        });
        candidateOperation.complete({
            ok: true,
            value: candidate.session,
        });
        await completion;

        expect(candidateOperation.cancelCount()).toBe(1);
        expect(candidate.disposeCount()).toBe(1);
        expect(controller.snapshot.current).toBe(current.session.document);
    });

    it('rejects an older completion after a newer candidate starts', async () => {
        const controller = new DocumentLifecycleController();
        const older = session(openedDocument('older.ddd', 'a'));
        const newer = session(openedDocument('newer.ddd', 'b'));
        const olderOperation = operation(older.session.document.source.displayName);
        const newerOperation = operation(newer.session.document.source.displayName);

        const olderCompletion = controller.openCandidate(olderOperation.operation);
        const newerCompletion = controller.openCandidate(newerOperation.operation);
        newerOperation.complete({
            ok: true,
            value: newer.session,
        });
        await newerCompletion;
        olderOperation.complete({
            ok: true,
            value: older.session,
        });
        await olderCompletion;

        expect(olderOperation.cancelCount()).toBe(1);
        expect(older.disposeCount()).toBe(1);
        expect(controller.snapshot.current).toBe(newer.session.document);
    });

    it('closes the current document and cleans up a pending candidate', async () => {
        const controller = new DocumentLifecycleController();
        const current = session(openedDocument('current.ddd', 'a'));
        const candidate = session(openedDocument('candidate.ddd', 'b'));
        await openSession(controller, current);
        const candidateOperation = operation(candidate.session.document.source.displayName);
        const candidateCompletion = controller.openCandidate(candidateOperation.operation);

        await controller.close();
        candidateOperation.complete({
            ok: true,
            value: candidate.session,
        });
        await candidateCompletion;

        expect(controller.snapshot).toEqual({
            candidateDisplayName: null,
            current: null,
            error: null,
            status: 'empty',
        });
        expect(candidateOperation.cancelCount()).toBe(1);
        expect(current.disposeCount()).toBe(1);
        expect(candidate.disposeCount()).toBe(1);
    });

    it('surfaces a cleanup failure from a stale cancelled candidate', async () => {
        const controller = new DocumentLifecycleController();
        const candidate = openedDocument('candidate.ddd', 'a');
        const candidateOperation = operation(candidate.source.displayName);
        const completion = controller.openCandidate(candidateOperation.operation);

        controller.cancelCandidate();
        candidateOperation.complete({
            error: classifyParseError('documentCleanupFailed'),
            ok: false,
        });
        await completion;

        expect(controller.snapshot).toEqual({
            candidateDisplayName: null,
            current: null,
            error: classifyParseError('documentCleanupFailed'),
            status: 'empty',
        });
    });
});
