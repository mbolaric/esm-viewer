import { ERROR_CODES, type ExportFailureCode, type IPdfDocumentRequest } from '#contracts';
import type { IErrorService } from '#error-reporting';
import type { IViewerExportPort, IViewerPdfPort } from '#viewer-application';
import type { AttestationReason, IComplianceTranslationService } from '#compliance';
import type { ToastController } from '#ui';
import type { IViewerExportSource } from '#viewer-application';

import { translateExportFailure } from '#localization';

import { printDocument, saveDocumentHtml, saveDocumentPdf } from '../helpers/print-helper.js';

export interface IComplianceExportControllerDependencies {
    readonly errorService: IErrorService;
    readonly exportPort: IViewerExportPort;
    readonly pdfPort: IViewerPdfPort;
    readonly toastController: ToastController;
    readonly translationService: IComplianceTranslationService;
}

// Manages dialog open state and save/print orchestration for infringement letters and attestation forms.
export class ComplianceExportController {
    private readonly _errorService: IErrorService;
    private readonly _exportPort: IViewerExportPort;
    private readonly _pdfPort: IViewerPdfPort;
    private readonly _toastController: ToastController;
    private readonly _translationService: IComplianceTranslationService;
    #_isLetterOpen = $state(false);
    #_isAttestationOpen = $state(false);
    #_attestationReason = $state<AttestationReason>('leaveOrRest');
    #_error = $state<ExportFailureCode | null>(null);

    public constructor(dependencies: IComplianceExportControllerDependencies) {
        this._errorService = dependencies.errorService;
        this._exportPort = dependencies.exportPort;
        this._pdfPort = dependencies.pdfPort;
        this._toastController = dependencies.toastController;
        this._translationService = dependencies.translationService;
    }

    public get attestationReason(): AttestationReason {
        return this.#_attestationReason;
    }

    // Inline export failure code for modal dialog display (native dialogs occlude fixed toasts).
    public get error(): ExportFailureCode | null {
        return this.#_error;
    }

    public get isAttestationOpen(): boolean {
        return this.#_isAttestationOpen;
    }

    public get isLetterOpen(): boolean {
        return this.#_isLetterOpen;
    }

    public openLetter(): void {
        this.#_error = null;
        this.#_isLetterOpen = true;
    }

    public closeLetter(): void {
        this.#_isLetterOpen = false;
    }

    public openAttestation(): void {
        this.#_error = null;
        this.#_isAttestationOpen = true;
    }

    public closeAttestation(): void {
        this.#_isAttestationOpen = false;
    }

    public setAttestationReason(reason: AttestationReason): void {
        this.#_attestationReason = reason;
    }

    public async saveHtml(html: string, suggestedName: string, source: IViewerExportSource | null): Promise<void> {
        this.#_error = null;
        const result = await saveDocumentHtml(html, suggestedName, this._exportPort, source);
        if (result.status === 'saved') {
            this.#_isLetterOpen = false;
            this.#_isAttestationOpen = false;
            this._toastController.success(
                this._translationService.translate('export.toast.success', {
                    fileName: suggestedName,
                }),
            );
        } else if (result.status === 'failed') {
            this.#_error = result.code;
        }
    }

    public async print(request: IPdfDocumentRequest): Promise<void> {
        this.#_error = null;
        try {
            await printDocument(request, this._pdfPort);
        } catch {
            this.#_error = 'exportFailed';
            void this._errorService.report({ code: ERROR_CODES.documentPrintFailed, severity: 'error', source: 'desktop' });
        }
    }

    public async savePdf(
        suggestedName: string,
        source: IViewerExportSource | null,
        pdfRequest: IPdfDocumentRequest,
    ): Promise<void> {
        this.#_error = null;
        const result = await saveDocumentPdf(suggestedName, this._exportPort, this._pdfPort, source, pdfRequest);
        if (result.status === 'saved') {
            this.#_isLetterOpen = false;
            this.#_isAttestationOpen = false;
            this._toastController.success(
                this._translationService.translate('export.toast.success', {
                    fileName: suggestedName,
                }),
            );
        } else if (result.status === 'printed') {
            this.#_isLetterOpen = false;
            this.#_isAttestationOpen = false;
            this._toastController.info(this._translationService.translate('export.toast.printed'));
        } else if (result.status === 'failed') {
            this.#_error = result.code;
        }
    }

    public exportFailureReason(code: ExportFailureCode): string {
        return translateExportFailure(code, this._translationService);
    }
}
