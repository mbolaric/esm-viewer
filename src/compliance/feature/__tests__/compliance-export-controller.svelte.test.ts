import { describe, expect, it } from 'vitest';
import type { IViewerExportPort, IViewerPdfPort } from '#viewer-application';
import { createViewerTestRenderOptions } from '#testing';
import { ToastController } from '#ui';

import { ComplianceExportController } from '../controllers/compliance-export-controller.svelte.js';

const { translationService } = createViewerTestRenderOptions().wrapperProps.context;

function createExportPort(outcome: Awaited<ReturnType<IViewerExportPort['save']>>): IViewerExportPort {
    return { save: () => Promise.resolve(outcome) };
}

function createPdfPort(): IViewerPdfPort {
    return {
        generatePdf: () => Promise.resolve({ bytes: new Uint8Array(), status: 'converted' }),
        isSupported: () => true,
        print: () => Promise.resolve(),
    };
}

function createTestController(saveOutcome: Awaited<ReturnType<IViewerExportPort['save']>>): {
    controller: ComplianceExportController;
    toastController: ToastController;
} {
    const toastController = new ToastController();
    const controller = new ComplianceExportController({
        exportPort: createExportPort(saveOutcome),
        pdfPort: createPdfPort(),
        toastController,
        translationService,
    });
    return { controller, toastController };
}

// Dialog renders in top layer above fixed toasts. Failures surface via inline error to keep dialog open;
// successful exports close dialog and trigger toast notification.
describe('ComplianceExportController', () => {
    it('surfaces a failed save as `error` instead of a toast, and leaves the dialog open', async () => {
        const { controller, toastController } = createTestController({
            code: 'ioFailure',
            status: 'failed',
        });

        controller.openLetter();
        await controller.saveHtml('<html></html>', 'letter.html', null);

        expect(controller.error).toBe('ioFailure');
        expect(controller.isLetterOpen).toBe(true);
        expect(toastController.toasts.length).toBe(0);
    });

    it('clears `error`, closes the dialog, and toasts on a successful save', async () => {
        const { controller, toastController } = createTestController({ status: 'saved' });

        controller.openLetter();
        await controller.saveHtml('<html></html>', 'letter.html', null);

        expect(controller.error).toBeNull();
        expect(controller.isLetterOpen).toBe(false);
        expect(toastController.toasts.length).toBe(1);
    });

    it('surfaces a failed save as `error` without a toast for the attestation dialog too', async () => {
        const { controller, toastController } = createTestController({
            code: 'sourceConflict',
            status: 'failed',
        });

        controller.openAttestation();
        await controller.saveHtml('<html></html>', 'attestation.html', null);

        expect(controller.error).toBe('sourceConflict');
        expect(controller.isAttestationOpen).toBe(true);
        expect(toastController.toasts.length).toBe(0);
    });

    it('clears a stale error when a dialog is reopened', async () => {
        const { controller } = createTestController({ code: 'ioFailure', status: 'failed' });

        controller.openLetter();
        await controller.saveHtml('<html></html>', 'letter.html', null);
        expect(controller.error).toBe('ioFailure');

        controller.closeLetter();
        controller.openLetter();

        expect(controller.error).toBeNull();
    });
});
