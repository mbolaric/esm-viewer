import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { expect } from 'vitest';

import ViewerRoot from '../components/shell/ViewerRoot.svelte';
import type { IViewerContext } from '../viewer-context.js';
import type { createViewerDocumentHarness } from './viewer-document-harness.js';
import { createViewerTestContext } from './viewer-test-context.js';

export type ViewerDocumentHarness = ReturnType<typeof createViewerDocumentHarness>;

export function renderWorkflow(
    harness: ViewerDocumentHarness,
    ondocumentstatuschange?: (status: { warningCount: string } | null) => void,
): IViewerContext {
    const context = createViewerTestContext(harness.controller);
    render(ViewerRoot, {
        props: {
            context,
            title: 'ESM Viewer',
            ...(ondocumentstatuschange !== undefined ? { ondocumentstatuschange } : {}),
        },
    });
    return context;
}

export async function startOpen(harness: ViewerDocumentHarness): Promise<void> {
    await fireEvent.click(within(screen.getByRole('main')).getByRole('button', { name: 'Open file…' }));
    await waitFor(() => {
        expect(harness.parserRequestCount()).toBe(1);
    });
}
