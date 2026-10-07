import { afterEach, describe, expect, it, vi } from 'vitest';
import { ERROR_CODES, type IPdfDocumentRequest } from '#contracts';
import type { IErrorService } from '#error-reporting';
import type { IViewerExportPort, IViewerPdfPort } from '#viewer-application';
import { createViewerTestRenderOptions } from '#testing';
import { ToastController } from '#ui';

import { ComplianceExportController } from '../controllers/compliance-export-controller.svelte.js';
import * as printHelpers from '../helpers/print-helper.js';

const printRequest: IPdfDocumentRequest = {
    kind: 'factualReport',
    locale: 'en',
    orientation: 'portrait',
    title: 'Synthetic',
    subtitle: '',
    footerNotice: '',
    headerFields: [],
    sections: [],
    summaryItems: [],
    summaryTitle: '',
};

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
    reportError: ReturnType<typeof vi.fn<IErrorService['report']>>;
    toastController: ToastController;
} {
    const toastController = new ToastController();
    const reportError = vi.fn<IErrorService['report']>(() => Promise.resolve());
    const controller = new ComplianceExportController({
        errorService: { report: reportError },
        exportPort: createExportPort(saveOutcome),
        pdfPort: createPdfPort(),
        toastController,
        translationService,
    });
    return { controller, reportError, toastController };
}

afterEach(() => vi.restoreAllMocks());

// Dialog renders in top layer above fixed toasts. Failures surface via inline error to keep dialog open;
// successful exports close dialog and trigger toast notification.
describe('ComplianceExportController', () => {
    it('keeps a failed print visible in the dialog and reports only a typed diagnostic', async () => {
        const { controller, reportError, toastController } = createTestController({ status: 'saved' });
        vi.spyOn(printHelpers, 'printDocument').mockRejectedValue(new Error('Private document detail'));

        controller.openAttestation();
        await controller.print(printRequest);

        expect(controller.error).toBe('exportFailed');
        expect(controller.isAttestationOpen).toBe(true);
        expect(toastController.toasts).toHaveLength(0);
        expect(reportError).toHaveBeenCalledExactlyOnceWith({
            code: ERROR_CODES.documentPrintFailed,
            severity: 'error',
            source: 'desktop',
        });
    });

    it('clears an earlier error when printing succeeds', async () => {
        const { controller, reportError } = createTestController({ code: 'ioFailure', status: 'failed' });
        vi.spyOn(printHelpers, 'printDocument').mockResolvedValue(undefined);
        controller.openLetter();
        await controller.saveHtml('<html></html>', 'letter.html', null);

        await controller.print(printRequest);

        expect(controller.error).toBeNull();
        expect(reportError).not.toHaveBeenCalled();
    });

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
