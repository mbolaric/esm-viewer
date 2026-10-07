import type { IPdfDocumentRequest } from '#contracts';
import type { IViewerExportPort, IViewerExportSource, IViewerPdfPort, ViewerExportOutcome } from '#viewer-application';

export async function printDocument(request: IPdfDocumentRequest, pdfPort: IViewerPdfPort): Promise<void> {
    await pdfPort.print(request);
}

export async function saveDocumentHtml(
    html: string,
    suggestedName: string,
    exportPort: IViewerExportPort,
    source: IViewerExportSource | null,
): Promise<ViewerExportOutcome> {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(html);
    return await exportPort.save({
        bytes,
        source,
        suggestedName,
    });
}

export type PdfSaveOutcome = ViewerExportOutcome | { readonly status: 'printed' };

// Renders PDF via native PDF engine and saves file bytes through the export port.
export async function saveDocumentPdf(
    suggestedName: string,
    exportPort: IViewerExportPort,
    pdfPort: IViewerPdfPort,
    source: IViewerExportSource | null,
    pdfRequest: IPdfDocumentRequest,
): Promise<PdfSaveOutcome> {
    const generation = await pdfPort.generatePdf(pdfRequest);
    if (generation.status === 'converted') {
        return await exportPort.save({
            bytes: generation.bytes,
            source,
            suggestedName,
        });
    }
    if (generation.status === 'printed') {
        return { status: 'printed' };
    }
    return { code: 'exportFailed', status: 'failed' };
}
