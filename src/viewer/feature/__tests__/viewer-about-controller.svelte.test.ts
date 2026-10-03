import { describe, expect, it, vi } from 'vitest';

import type { IViewerRuntimeVersionsPort } from '#viewer-application';

import { ViewerAboutController } from '../controllers/viewer-about-controller.svelte.js';
import { createViewerDocumentHarness } from './viewer-document-harness.js';
import { createViewerTestContext } from './viewer-test-context.js';

function runtimeVersionsPort(): IViewerRuntimeVersionsPort {
    return {
        load: () =>
            Promise.resolve({
                ok: true,
                value: {
                    application: '0.0.0-test',
                    architecture: 'arm64',
                    parserCommit: 'b'.repeat(40),
                    parserVersion: '0.2.0',
                    platform: 'darwin',
                    runtime: '43',
                },
            }),
    };
}

describe('ViewerAboutController', () => {
    it('loads privacy-safe runtime versions and copies diagnostics', async () => {
        const writeText = vi.fn(() => Promise.resolve());
        const harness = createViewerDocumentHarness();
        const context = createViewerTestContext(harness.controller);
        const controller = new ViewerAboutController({
            clipboard: { writeText },
            localisationService: context.localisationService,
            runtimeVersionsPort: runtimeVersionsPort(),
        });

        await controller.open();

        expect(controller.snapshot).toMatchObject({
            isOpen: true,
            loading: false,
            versionsFailed: false,
        });
        expect(controller.snapshot.versions?.parserVersion).toBe('0.2.0');

        await controller.copyDiagnostics();

        expect(writeText).toHaveBeenCalledWith(expect.stringContaining('ESM Viewer 0.0.0-test'));
        expect(writeText).toHaveBeenCalledWith(
            expect.stringContaining('Parser: 0.2.0 @ bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'),
        );
        expect(controller.snapshot.copied).toBe(true);
        expect(controller.cancel()).toBe(true);
    });

    it('reports version load and clipboard failures without throwing', async () => {
        const harness = createViewerDocumentHarness();
        const context = createViewerTestContext(harness.controller);
        const controller = new ViewerAboutController({
            clipboard: {
                writeText: () => Promise.reject(new Error('clipboard unavailable')),
            },
            localisationService: context.localisationService,
            runtimeVersionsPort: {
                load: () => Promise.resolve({ error: 'runtimeVersionsFailed', ok: false }),
            },
        });

        await controller.open();
        expect(controller.snapshot.versionsFailed).toBe(true);

        await expect(controller.copyDiagnostics()).resolves.toBe(false);
        expect(controller.snapshot.copyFailed).toBe(true);
    });
});
