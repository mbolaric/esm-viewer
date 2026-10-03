import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ExportDialog from '../components/dialogs/ExportDialog.svelte';
import type { ExportFormat } from '../controllers/viewer-export-controller.svelte.js';
import { createViewerTestRenderOptions } from './viewer-test-render.js';

afterEach(() => {
    cleanup();
});

describe('ExportDialog', () => {
    it('switches formats, shows the derived file name, and exports', async () => {
        const cancel = vi.fn();
        const export_ = vi.fn();
        const format = vi.fn<(format: ExportFormat) => void>();
        render(
            ExportDialog,
            {
                props: {
                    error: null,
                    fileName: 'driver-card.ddd.html',
                    format: 'html',
                    oncancel: cancel,
                    onexport: export_,
                    onformat: format,
                    saving: false,
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByRole('dialog', { name: 'Export document' })).toBeTruthy();
        expect(screen.getByText('driver-card.ddd.html')).toBeTruthy();
        const htmlRadio = screen.getByRole('radio', { name: /HTML report/ });
        if (!(htmlRadio instanceof HTMLInputElement)) {
            throw new TypeError('The HTML report format radio must be an input element.');
        }
        expect(htmlRadio.checked).toBe(true);

        await fireEvent.click(screen.getByRole('radio', { name: /Raw JSON/ }));
        await fireEvent.click(screen.getByRole('button', { name: 'Export' }));

        expect(format).toHaveBeenCalledWith('rawJson');
        expect(export_).toHaveBeenCalledOnce();
        expect(cancel).not.toHaveBeenCalled();
    });

    it('shows a typed export error and disables actions while saving', () => {
        const cancel = vi.fn();
        render(
            ExportDialog,
            {
                props: {
                    error: 'destinationExists',
                    fileName: 'driver-card.ddd.html',
                    format: 'html',
                    oncancel: cancel,
                    onexport: () => undefined,
                    onformat: () => undefined,
                    saving: true,
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByRole('alert').textContent).toContain('A file with that name already exists at the destination.');
        expect(screen.getByRole('button', { name: 'Exporting…' }).hasAttribute('disabled')).toBe(true);
        expect(screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(true);

        const dialog = screen.getByRole('dialog', { name: 'Export document' });
        dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
        expect(cancel).toHaveBeenCalledOnce();
    });

    it('hides the PDF format option when isPdfSupported is false', () => {
        render(
            ExportDialog,
            {
                props: {
                    error: null,
                    fileName: 'driver-card.ddd.html',
                    format: 'html',
                    isPdfSupported: false,
                    oncancel: () => undefined,
                    onexport: () => undefined,
                    onformat: () => undefined,
                    saving: false,
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.queryByRole('radio', { name: /PDF document/ })).toBeNull();
        expect(screen.getByRole('radio', { name: /HTML report/ })).toBeTruthy();
        expect(screen.getByRole('radio', { name: /Raw JSON/ })).toBeTruthy();
    });

    it('hides the Raw JSON format option when showRawJson is false', () => {
        render(
            ExportDialog,
            {
                props: {
                    error: null,
                    fileName: 'document-comparison-report-2026-09-08.pdf',
                    format: 'pdf',
                    oncancel: () => undefined,
                    onexport: () => undefined,
                    onformat: () => undefined,
                    saving: false,
                    showRawJson: false,
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByRole('radio', { name: /HTML report/ })).toBeTruthy();
        expect(screen.getByRole('radio', { name: /PDF report/ })).toBeTruthy();
        expect(screen.queryByRole('radio', { name: /Raw JSON/ })).toBeNull();
    });
});
