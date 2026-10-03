import type { ExportFailureCode, IPdfDocumentRequest, SourceToken } from '#contracts';

export type ViewerExportFailureCode = ExportFailureCode;

export interface IViewerExportSaveRequest {
    readonly bytes: Uint8Array;
    readonly sourceToken: SourceToken | null;
    readonly suggestedName: string;
}

export type ViewerExportOutcome =
    | { readonly status: 'cancelled' }
    | { readonly code: ViewerExportFailureCode; readonly status: 'failed' }
    | { readonly status: 'saved' };

export interface IViewerExportPort {
    save(request: IViewerExportSaveRequest): Promise<ViewerExportOutcome>;
}

export type ViewerPdfOutcome =
    | { readonly bytes: Uint8Array; readonly status: 'converted' }
    | { readonly status: 'printed' }
    | { readonly code: ViewerExportFailureCode; readonly status: 'failed' };

export interface IViewerPdfPort {
    generatePdf(request: IPdfDocumentRequest): Promise<ViewerPdfOutcome>;
    isSupported(): boolean;
    // Opens native print dialog for the HTML document; rejects if unavailable.
    print(html: string): Promise<void>;
}
