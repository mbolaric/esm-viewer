import type { ExportFailureCode, IPdfDocumentRequest, SourceToken } from '#contracts';

export type ViewerExportFailureCode = ExportFailureCode;

// What the export guard needs to recognise the opened document: its path token where one exists, and always the
// digest of its bytes, because a dropped document never discloses a path.
export interface IViewerExportSource {
    readonly sha256: string;
    readonly sourceToken: SourceToken | null;
}

export interface IViewerExportSaveRequest {
    readonly bytes: Uint8Array;
    readonly source: IViewerExportSource | null;
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
    // Prints the same native PDF layout as generatePdf; resolves after printing or cancellation.
    print(request: IPdfDocumentRequest): Promise<void>;
}
