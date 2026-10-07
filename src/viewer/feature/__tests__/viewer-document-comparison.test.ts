import { describe, expect, it } from 'vitest';
import { classifyParseError } from '#contracts';
import type { ParsedDocumentResult } from '#viewer-application';

import { createViewerDocumentHarness, type IViewerDocumentHarness } from './viewer-document-harness.js';

async function startOpeningDocument(harness: IViewerDocumentHarness): Promise<{ readonly completion: Promise<void> }> {
    const requestsBefore = harness.parserRequestCount();
    const opening = harness.controller.open();
    for (let attempt = 0; attempt < 10 && harness.parserRequestCount() === requestsBefore; attempt += 1) {
        await Promise.resolve();
    }
    return { completion: opening };
}

async function openDocument(
    harness: IViewerDocumentHarness,
    result: ParsedDocumentResult = harness.successfulParserResult(),
): Promise<void> {
    const opening = await startOpeningDocument(harness);
    harness.completeLatestParser(result);
    await opening.completion;
}

describe('ViewerDocumentController comparison history', () => {
    it('keeps a removed entry removed until its file is opened again', async () => {
        const harness = createViewerDocumentHarness();
        await openDocument(harness);
        const key = harness.controller.comparisonSnapshot.records[0]?.key ?? '';
        expect(key).not.toBe('');

        expect(harness.controller.removeComparisonRecord(key)).toBe(true);
        expect(harness.controller.comparisonSnapshot.records).toHaveLength(0);

        // Every later synchronisation must not resurrect the entry the user removed.
        harness.controller.selectSection('comparison');
        harness.controller.clearRecord();
        expect(harness.controller.comparisonSnapshot.records).toHaveLength(0);

        // Opening the file again restores it, because the user asked for that document.
        await harness.controller.close();
        await openDocument(harness);
        expect(harness.controller.comparisonSnapshot.records.map((record) => record.key)).toEqual([key]);
    });

    it('refuses to remove an entry that is not in the history', () => {
        const harness = createViewerDocumentHarness();

        expect(harness.controller.removeComparisonRecord('missing')).toBe(false);
    });

    it('restores a removed entry when the current file is opened again without closing it first', async () => {
        const harness = createViewerDocumentHarness();
        await openDocument(harness);
        const key = harness.controller.comparisonSnapshot.records[0]?.key ?? '';
        expect(harness.controller.removeComparisonRecord(key)).toBe(true);

        await openDocument(harness);

        expect(harness.controller.comparisonSnapshot.records.map((record) => record.key)).toEqual([key]);
    });

    it('keeps a removed entry suppressed when verification updates the current document', async () => {
        const harness = createViewerDocumentHarness();
        await openDocument(harness);
        const key = harness.controller.comparisonSnapshot.records[0]?.key ?? '';
        expect(harness.controller.removeComparisonRecord(key)).toBe(true);
        const previous = harness.controller.snapshot.current;

        await harness.controller.verifyDocument();

        expect(harness.controller.snapshot.current).not.toBe(previous);
        expect(harness.controller.comparisonSnapshot.records).toHaveLength(0);
    });

    it('keeps a removed entry suppressed when reopening fails', async () => {
        const harness = createViewerDocumentHarness();
        await openDocument(harness);
        const key = harness.controller.comparisonSnapshot.records[0]?.key ?? '';
        expect(harness.controller.removeComparisonRecord(key)).toBe(true);
        const previous = harness.controller.snapshot.current;

        await openDocument(harness, { error: classifyParseError('parseFailed'), ok: false });

        expect(harness.controller.snapshot.current).toBe(previous);
        expect(harness.controller.comparisonSnapshot.records).toHaveLength(0);
    });

    it('keeps a removed entry suppressed when reopening is cancelled', async () => {
        const harness = createViewerDocumentHarness();
        await openDocument(harness);
        const key = harness.controller.comparisonSnapshot.records[0]?.key ?? '';
        expect(harness.controller.removeComparisonRecord(key)).toBe(true);
        const previous = harness.controller.snapshot.current;
        const opening = await startOpeningDocument(harness);

        harness.controller.cancel();
        await opening.completion;

        expect(harness.controller.snapshot.current).toBe(previous);
        expect(harness.controller.comparisonSnapshot.records).toHaveLength(0);
    });
});
