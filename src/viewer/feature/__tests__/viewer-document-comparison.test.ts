import { describe, expect, it } from 'vitest';

import { createViewerDocumentHarness, type IViewerDocumentHarness } from './viewer-document-harness.js';

async function openDocument(harness: IViewerDocumentHarness): Promise<void> {
    const requestsBefore = harness.parserRequestCount();
    const opening = harness.controller.open();
    for (let attempt = 0; attempt < 10 && harness.parserRequestCount() === requestsBefore; attempt += 1) {
        await Promise.resolve();
    }
    harness.completeLatestParser(harness.successfulParserResult());
    await opening;
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
});
