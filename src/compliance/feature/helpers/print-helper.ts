import type { IPdfDocumentRequest, SourceToken } from '#contracts';
import type { IViewerExportPort, IViewerPdfPort, ViewerExportOutcome } from '#viewer-application';

// Triggers native print panel via Rust backend, falling back to DOM printing on unsupported hosts.
export async function printDocument(html: string, pdfPort: IViewerPdfPort): Promise<void> {
    try {
        await pdfPort.print(html);
    } catch {
        // Native print is unavailable on this host: fall back to DOM printing.
        printHtmlContent(html);
    }
}

function printHtmlContent(html: string): void {
    if (typeof document === 'undefined') {
        return;
    }

    // Full-viewport off-screen iframe preserves @page print styles without collapsing page width.
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '-10000px';
    iframe.style.width = '100vw';
    iframe.style.height = '100vh';
    iframe.style.border = '0';
    iframe.style.opacity = '0.01';
    iframe.style.pointerEvents = 'none';

    iframe.onload = () => {
        setTimeout(() => {
            try {
                const iframeWin = iframe.contentWindow;
                if (iframeWin !== null) {
                    iframeWin.focus();
                    iframeWin.print();
                }
            } catch {
                // Ignore if print was blocked by host
            } finally {
                setTimeout(() => {
                    iframe.remove();
                }, 2000);
            }
        }, 200);
    };

    document.body.appendChild(iframe);
    iframe.srcdoc = html;
}

export async function saveDocumentHtml(
    html: string,
    suggestedName: string,
    exportPort: IViewerExportPort,
    sourceToken: SourceToken | null,
): Promise<ViewerExportOutcome> {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(html);
    return await exportPort.save({
        bytes,
        sourceToken,
        suggestedName,
    });
}

export type PdfSaveOutcome = ViewerExportOutcome | { readonly status: 'printed' };

// Renders PDF via native PDF engine and saves file bytes through the export port.
export async function saveDocumentPdf(
    suggestedName: string,
    exportPort: IViewerExportPort,
    pdfPort: IViewerPdfPort,
    sourceToken: SourceToken | null,
    pdfRequest: IPdfDocumentRequest,
): Promise<PdfSaveOutcome> {
    const generation = await pdfPort.generatePdf(pdfRequest);
    if (generation.status === 'converted') {
        return await exportPort.save({
            bytes: generation.bytes,
            sourceToken,
            suggestedName,
        });
    }
    if (generation.status === 'printed') {
        return { status: 'printed' };
    }
    return { code: 'exportFailed', status: 'failed' };
}
