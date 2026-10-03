import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AboutDialog from '../components/dialogs/AboutDialog.svelte';
import { createViewerTestRenderOptions } from './viewer-test-render.js';

const versions = {
    application: '0.0.0-test',
    architecture: 'arm64',
    parserCommit: 'c'.repeat(40),
    parserVersion: '0.2.0',
    platform: 'darwin',
    runtime: '43',
};

afterEach(() => {
    cleanup();
});

describe('AboutDialog', () => {
    it('shows runtime and parser versions with a diagnostics copy action', async () => {
        const close = vi.fn();
        const copy = vi.fn();
        const rendered = render(
            AboutDialog,
            {
                props: {
                    copied: false,
                    copyFailed: false,
                    loading: false,
                    onclose: close,
                    oncopy: copy,
                    versions,
                    versionsFailed: false,
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByRole('dialog', { name: 'About ESM Viewer' })).toBeTruthy();
        expect(rendered.container.querySelector('img.app-logo')?.getAttribute('src')).toBeTruthy();
        expect(screen.getByText('0.2.0')).toBeTruthy();
        expect(screen.getByText('c'.repeat(40))).toBeTruthy();
        expect(screen.getAllByText(/GNU General Public License version 3/).length).toBe(2);

        await fireEvent.click(screen.getByRole('button', { name: 'Copy privacy-safe diagnostics' }));
        expect(copy).toHaveBeenCalledOnce();
        await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(close).toHaveBeenCalledOnce();
    });

    it('announces clipboard success and version-load failure states', () => {
        render(
            AboutDialog,
            {
                props: {
                    copied: true,
                    copyFailed: false,
                    loading: false,
                    onclose: () => undefined,
                    oncopy: () => undefined,
                    versions,
                    versionsFailed: false,
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByRole('status').textContent).toContain('Privacy-safe diagnostics copied to the clipboard.');
    });

    it('shows the version-load failure notice', () => {
        render(
            AboutDialog,
            {
                props: {
                    copied: false,
                    copyFailed: false,
                    loading: false,
                    onclose: () => undefined,
                    oncopy: () => undefined,
                    versions: null,
                    versionsFailed: true,
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByRole('status').textContent).toContain('Version information could not be loaded.');
    });
});
