import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRawSnippet } from 'svelte';

import ViewerApp from '../components/shell/ViewerApp.svelte';
import ViewerRoot from '../components/shell/ViewerRoot.svelte';
import { ViewerCompositionError } from '../viewer-context.js';
import { createViewerDocumentHarness } from './viewer-document-harness.js';
import { createViewerTestContext } from './viewer-test-context.js';

afterEach(cleanup);

describe('ViewerRoot', () => {
    it('renders host controls in an existing preference category without adding a new tab', async () => {
        const context = createViewerTestContext(createViewerDocumentHarness().controller);
        render(ViewerRoot, {
            props: {
                context,
                title: 'Test host',
                preferencesContributions: [
                    {
                        targetTab: 'general',
                        content: createRawSnippet(() => ({ render: () => '<p>Host notification settings</p>' })),
                        icon: 'layers',
                        id: 'host-notifications',
                        label: 'Host controls',
                        onapply: () => true,
                        oncancel: () => undefined,
                    },
                ],
            },
        });
        context.commandController.execute('application.preferences');
        await waitFor(() => {
            expect(screen.getByText('Host notification settings')).toBeTruthy();
        });
        expect(screen.queryByRole('tab', { name: 'Host controls' })).toBeNull();
        expect(screen.getByRole('tab', { name: 'General' }).getAttribute('aria-selected')).toBe('true');
        const fieldContainer = screen.getByLabelText('Verify signatures automatically').closest('label')?.parentElement;
        const hostFields = screen.getByRole('group', { name: 'Host controls' });
        if (!(fieldContainer instanceof HTMLElement)) {
            throw new TypeError('Built-in preference fields must render inside their layout container.');
        }
        expect(fieldContainer.classList.contains('preferences-section')).toBe(true);
        expect(hostFields.parentElement).toBe(fieldContainer);
        expect(screen.getByRole('tabpanel').children).toHaveLength(1);
    });

    it('allows a host welcome action without adding a toolbar to the empty screen', () => {
        render(ViewerRoot, {
            props: {
                context: createViewerTestContext(createViewerDocumentHarness().controller),
                title: 'Test host',
                welcomeActions: createRawSnippet(() => ({ render: () => '<button>Host archive action</button>' })),
            },
        });
        expect(screen.getByRole('heading', { name: 'Open a tachograph file' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Host archive action' })).toBeTruthy();
        expect(screen.queryByRole('navigation', { name: 'Application commands' })).toBeNull();
    });

    it('keeps shared dialogs usable when a host hides the document workspace and blocks Apply during host operations', async () => {
        const context = createViewerTestContext(createViewerDocumentHarness().controller);
        const apply = vi.fn(() => true);
        const cancel = vi.fn();
        let ready = false;
        render(ViewerRoot, {
            props: {
                context,
                title: 'Test host',
                visible: false,
                preferencesContributions: [
                    {
                        content: createRawSnippet(() => ({ render: () => '<p>Host preferences content</p>' })),
                        icon: 'layers',
                        id: 'general',
                        label: 'Host preferences',
                        canApply: () => ready,
                        onapply: apply,
                        oncancel: cancel,
                    },
                ],
            },
        });
        expect(screen.queryByRole('heading', { name: 'Open a tachograph file' })).toBeNull();
        context.commandController.execute('application.preferences');
        await waitFor(() => {
            expect(screen.getByRole('dialog', { name: 'Preferences' })).toBeTruthy();
        });
        await fireEvent.click(screen.getByRole('tab', { name: 'Host preferences' }));
        expect(screen.getByText('Host preferences content')).toBeTruthy();
        await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
        expect(apply).not.toHaveBeenCalled();
        ready = true;
        // A host's reactive state normally triggers this update; reopen to exercise successful application.
        await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(cancel).toHaveBeenCalledOnce();
        context.commandController.execute('application.preferences');
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Apply' })).toBeTruthy();
        });
        await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
        await waitFor(() => {
            expect(apply).toHaveBeenCalledOnce();
        });
    });

    it('provides shared services to the platform-neutral viewer composition', () => {
        const harness = createViewerDocumentHarness();
        render(ViewerRoot, {
            props: {
                context: createViewerTestContext(harness.controller),
                title: 'ESM Viewer',
            },
        });

        expect(screen.getByRole('heading', { name: 'Open a tachograph file' })).toBeTruthy();
        expect(screen.getByText('View a driver card or Vehicle Unit download locally.')).toBeTruthy();
    });

    it('fails with the typed composition error when no context was provided', () => {
        expect(() =>
            render(ViewerApp, {
                props: {
                    title: 'ESM Viewer',
                },
            }),
        ).toThrow(ViewerCompositionError);
    });
});
