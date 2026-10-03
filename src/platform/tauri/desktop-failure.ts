import { ERROR_CODES, type IErrorEvent } from '#contracts';

// Failures the desktop ports report by typed code only; native detail never crosses into the error log.
export const DESKTOP_FAILURE_EVENTS = {
    exportSave: { code: ERROR_CODES.exportSaveFailed, severity: 'error', source: 'desktop' },
    pdfGeneration: { code: ERROR_CODES.pdfGenerationFailed, severity: 'error', source: 'desktop' },
} as const satisfies Readonly<Record<string, IErrorEvent>>;

// Document generators surface only an I/O failure distinctly; every other native failure is a generic export failure.
export function documentGenerationFailure(code: string): {
    readonly code: 'exportFailed' | 'ioFailure';
    readonly status: 'failed';
} {
    return { code: code === 'ioFailure' ? 'ioFailure' : 'exportFailed', status: 'failed' };
}

// Hands a byte view to APIs that need a whole ArrayBuffer, copying only when the view is a slice of a larger buffer.
export function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer instanceof ArrayBuffer && bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
        ? bytes.buffer
        : bytes.slice().buffer;
}
