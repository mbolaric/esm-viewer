import type { IPdfDocumentRequest, SourceToken } from '#contracts';
import type { ILocalisationService, ITranslationService } from '#localization';
import type {
    IViewerExportPort,
    IViewerPdfPort,
    IViewerRuntimeVersionsPort,
    OpenedTachographDocument,
    ViewerExportFailureCode,
} from '#viewer-application';
import { createExportReportViewModel } from '#viewer-presentation';
import type { DurationMilliseconds, UtcTimestamp } from '#viewer-domain';
import { createComplianceViewModel, evaluateDocumentCompliance, nightWindowFromPreferences } from '#compliance';
import type { ComplianceProfileController } from '#compliance-profile-controller';

import { exportFileName, serializeRawJson } from '../helpers/export-report.js';
import { serializeHtmlReport } from '../helpers/report-html.js';
import { createFactualReportPdfRequest } from '../helpers/report-pdf.js';
import type { IMessageParams, TranslationKey } from '#i18n-locales';
import type { ViewerPreferencesController } from './viewer-preferences-controller.svelte.js';

export type ExportFormat = 'html' | 'pdf' | 'rawJson';

export interface IViewerExportSnapshot {
    readonly error: ViewerExportFailureCode | null;
    readonly format: ExportFormat;
    readonly isPdfSupported: boolean;
    readonly isOpen: boolean;
    readonly saving: boolean;
}

export interface IExportCurrentDocumentResult {
    readonly fileName: string;
    readonly status: 'cancelled' | 'failed' | 'saved';
}

export interface IViewerExportControllerDependencies {
    readonly complianceProfileController: ComplianceProfileController;
    readonly exportPort: IViewerExportPort;
    readonly localisationService: ILocalisationService<UtcTimestamp, DurationMilliseconds>;
    readonly pdfPort: IViewerPdfPort;
    readonly preferencesController: ViewerPreferencesController;
    readonly runtimeVersionsPort: IViewerRuntimeVersionsPort;
    readonly translationService: ITranslationService<TranslationKey, IMessageParams>;
}

export class ViewerExportController {
    private readonly _complianceProfileController: ComplianceProfileController;
    private readonly _exportPort: IViewerExportPort;
    private readonly _isPdfSupported: boolean;
    private readonly _localisationService: ILocalisationService<UtcTimestamp, DurationMilliseconds>;
    private readonly _pdfPort: IViewerPdfPort;
    private readonly _preferencesController: ViewerPreferencesController;
    private readonly _runtimeVersionsPort: IViewerRuntimeVersionsPort;
    private readonly _translationService: ITranslationService<TranslationKey, IMessageParams>;
    #_error = $state<ViewerExportFailureCode | null>(null);
    #_format = $state<ExportFormat>('html');
    #_isOpen = $state(false);
    #_saving = $state(false);

    public constructor(dependencies: IViewerExportControllerDependencies) {
        this._complianceProfileController = dependencies.complianceProfileController;
        this._exportPort = dependencies.exportPort;
        this._localisationService = dependencies.localisationService;
        this._pdfPort = dependencies.pdfPort;
        this._preferencesController = dependencies.preferencesController;
        this._runtimeVersionsPort = dependencies.runtimeVersionsPort;
        this._translationService = dependencies.translationService;
        this._isPdfSupported = typeof this._pdfPort.isSupported === 'function' ? this._pdfPort.isSupported() : false;
    }

    public get snapshot(): IViewerExportSnapshot {
        return {
            error: this.#_error,
            format: this.#_format,
            isOpen: this.#_isOpen,
            isPdfSupported: this._isPdfSupported,
            saving: this.#_saving,
        };
    }

    public cancel(): boolean {
        if (!this.#_isOpen || this.#_saving) {
            return false;
        }

        this.#_error = null;
        this.#_isOpen = false;
        this.#_saving = false;
        return true;
    }

    public async export(
        bytes: Uint8Array,
        suggestedName: string,
        sourceToken: SourceToken | null,
    ): Promise<'cancelled' | 'failed' | 'saved'> {
        if (!this.#_isOpen || this.#_saving) {
            return 'failed';
        }

        this.#_error = null;
        this.#_isOpen = true;
        this.#_saving = true;
        return this.completeExport(bytes, suggestedName, sourceToken);
    }

    public async exportPdf(
        pdfRequest: IPdfDocumentRequest,
        suggestedName: string,
        sourceToken: SourceToken | null,
    ): Promise<'cancelled' | 'failed' | 'saved'> {
        if (!this.#_isOpen || this.#_saving) {
            return 'failed';
        }

        this.#_error = null;
        this.#_format = 'pdf';
        this.#_isOpen = true;
        this.#_saving = true;
        const generation = await this._pdfPort.generatePdf(pdfRequest);
        if (generation.status === 'failed') {
            this.#_error = generation.code;
            this.#_saving = false;
            return 'failed';
        }
        if (generation.status === 'printed') {
            this.#_error = null;
            this.#_isOpen = false;
            this.#_saving = false;
            return 'saved';
        }

        return this.completeExport(generation.bytes, suggestedName, sourceToken);
    }

    // Orchestrates report view model construction, serialization, naming, and file export.
    public async exportCurrentDocument(document: OpenedTachographDocument): Promise<IExportCurrentDocumentResult> {
        const format = this.#_format;

        if (format === 'html' || format === 'pdf') {
            const versionsResult = await this._runtimeVersionsPort.load();
            const versions = versionsResult.ok ? versionsResult.value : null;
            // Evaluates compliance using selected profile and preferences before passing to report builder.
            const profile = this._complianceProfileController.selectedProfile;
            const nightWindow = nightWindowFromPreferences(this._preferencesController.snapshot.preferences);
            const evaluation = evaluateDocumentCompliance(document, profile, nightWindow);
            const complianceViewModel = createComplianceViewModel(
                document,
                this._translationService,
                profile,
                'all',
                'all',
                '',
                nightWindow,
                evaluation,
            );
            const reportViewModel = createExportReportViewModel(
                document,
                this._localisationService,
                {
                    commit: versions?.parserCommit ?? null,
                    version: versions?.parserVersion ?? null,
                },
                complianceViewModel,
                evaluation,
            );
            const fileName = exportFileName(document.source.displayName, format === 'pdf' ? '.pdf' : '.html');
            const status =
                format === 'pdf'
                    ? await this.exportPdf(
                          createFactualReportPdfRequest(
                              reportViewModel,
                              this._translationService,
                              this._localisationService.locale,
                          ),
                          fileName,
                          document.source.sourceToken,
                      )
                    : await this.export(
                          new TextEncoder().encode(serializeHtmlReport(reportViewModel, this._translationService)),
                          fileName,
                          document.source.sourceToken,
                      );
            return { fileName, status };
        }

        const fileName = exportFileName(document.source.displayName, '.json');
        const status = await this.export(
            new TextEncoder().encode(serializeRawJson(document.raw)),
            fileName,
            document.source.sourceToken,
        );
        return { fileName, status };
    }

    public open(): boolean {
        if (this.#_isOpen) {
            return false;
        }

        this.#_error = null;
        this.#_format = 'html';
        this.#_isOpen = true;
        this.#_saving = false;
        return true;
    }

    public setFormat(format: ExportFormat): boolean {
        if (!this.#_isOpen || this.#_saving) {
            return false;
        }

        if (format === 'pdf' && !this._isPdfSupported) {
            return false;
        }

        this.#_error = null;
        this.#_format = format;
        return true;
    }

    private async completeExport(
        bytes: Uint8Array,
        suggestedName: string,
        sourceToken: SourceToken | null,
    ): Promise<'cancelled' | 'failed' | 'saved'> {
        const outcome = await this._exportPort.save({
            bytes,
            sourceToken,
            suggestedName,
        });
        if (outcome.status === 'saved') {
            this.#_error = null;
            this.#_isOpen = false;
            this.#_saving = false;
            return 'saved';
        }

        if (outcome.status === 'cancelled') {
            this.#_error = null;
            this.#_saving = false;
            return 'cancelled';
        }

        this.#_error = outcome.code;
        this.#_saving = false;
        return 'failed';
    }
}
