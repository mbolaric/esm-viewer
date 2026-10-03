import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ViewerApplicationDialogs from '../components/shell/ViewerApplicationDialogs.svelte';
import { createViewerDocumentHarness } from './viewer-document-harness.js';
import { createViewerTestContext } from './viewer-test-context.js';

afterEach(cleanup);

describe('Viewer application dialog adapter', () => {
    it('opens settings, guide and About without mounting the document workspace', async () => {
        const context = createViewerTestContext(createViewerDocumentHarness().controller);
        render(ViewerApplicationDialogs, { props: { context } });
        expect(screen.queryByRole('heading', { name: 'Open a tachograph file' })).toBeNull();
        context.commandController.execute('application.preferences');
        await waitFor(() => {
            expect(screen.getByRole('dialog', { name: 'Preferences' })).toBeTruthy();
        });
        await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        await fireEvent.keyDown(window, { key: 'F1' });
        expect(screen.getByRole('dialog', { name: 'User Guide & Reference Handbook' })).toBeTruthy();
        await fireEvent.keyDown(window, { key: 'F1' });
        context.commandController.execute('application.about');
        await waitFor(() => {
            expect(screen.getByRole('dialog', { name: 'About ESM Viewer' })).toBeTruthy();
        });
    });

    it('uses contributed command callbacks and excludes disabled commands from the palette', async () => {
        const execute = vi.fn();
        const context = createViewerTestContext(createViewerDocumentHarness().controller);
        render(ViewerApplicationDialogs, {
            props: {
                context,
                commands: [
                    { id: 'archive.import', label: 'Import archive', icon: 'download', enabled: true, onexecute: execute },
                    { id: 'archive.disabled', label: 'Disabled archive action', enabled: false, onexecute: vi.fn() },
                ],
            },
        });
        await fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
        expect(screen.queryByText('Disabled archive action')).toBeNull();
        await fireEvent.click(screen.getByRole('button', { name: 'Import archive' }));
        expect(execute).toHaveBeenCalledOnce();
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
