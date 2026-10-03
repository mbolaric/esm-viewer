import {
    classifyParseError,
    type ConvertHtmlToPdfResult,
    err,
    isSha256Digest,
    ok,
    type ParseError,
    type RegisterExportSourceResult,
    type Sha256Digest,
    type SourceToken,
} from '#contracts';
import type { IErrorService } from '#error-reporting';
import type {
    IFileDigestPort,
    ITextClipboardPort,
    IViewerExportPort,
    IViewerExportSaveRequest,
    IViewerPdfPort,
    IViewerPreferencesStore,
    IViewerRuntimeVersionsPort,
    ViewerExportOutcome,
} from '#viewer-application';

import { DESKTOP_FAILURE_EVENTS, documentGenerationFailure, exactArrayBuffer } from './desktop-failure.js';
import type { TauriPlatformService } from './tauri-platform-service.js';

// Desktop implementations of Viewer ports translate native results into typed outcomes.
export function createPreferencesStore(service: TauriPlatformService): IViewerPreferencesStore {
    return {
        async load() {
            try {
                const result = await service.loadPreferences();
                return result.status === 'loaded' ? ok(result.preferences) : err('preferencesLoadFailed');
            } catch {
                return err('preferencesLoadFailed');
            }
        },
        async save(preferences) {
            try {
                const result = await service.savePreferences(preferences);
                return result.status === 'saved' ? ok(null) : err('preferencesSaveFailed');
            } catch {
                return err('preferencesSaveFailed');
            }
        },
    };
}

function registerExportSourceToken(service: TauriPlatformService): Promise<{ readonly sourceToken: SourceToken } | null> {
    try {
        const registration: RegisterExportSourceResult = service.registerExportSource();
        return Promise.resolve(registration.status === 'registered' ? { sourceToken: registration.sourceToken } : null);
    } catch {
        return Promise.resolve(null);
    }
}

export function createExportPort(service: TauriPlatformService, errorService: IErrorService): IViewerExportPort {
    return {
        async save(request: IViewerExportSaveRequest): Promise<ViewerExportOutcome> {
            // Preserves source token to prevent overwriting source DDD files (PLATFORM-01).
            let sourceToken = request.sourceToken ?? null;
            if (sourceToken === null) {
                const registration = await registerExportSourceToken(service);
                if (registration === null) {
                    void errorService.report(DESKTOP_FAILURE_EVENTS.exportSave);
                    return { code: 'exportFailed', status: 'failed' };
                }
                sourceToken = registration.sourceToken;
            }

            try {
                const result = await service.saveExport({
                    bytes: request.bytes,
                    sourceToken,
                    suggestedName: request.suggestedName,
                });
                switch (result.status) {
                    case 'cancelled':
                        return { status: 'cancelled' };
                    case 'saved':
                        return { status: 'saved' };
                    case 'failed':
                        // Source conflict is handled as expected rejection, not reported to error service.
                        if (result.code !== 'sourceConflict') {
                            void errorService.report(DESKTOP_FAILURE_EVENTS.exportSave);
                        }
                        return result.code === 'ioFailure' ||
                            result.code === 'sourceConflict' ||
                            result.code === 'destinationExists'
                            ? { code: result.code, status: 'failed' }
                            : { code: 'exportFailed', status: 'failed' };
                }
            } catch {
                void errorService.report(DESKTOP_FAILURE_EVENTS.exportSave);
                return { code: 'exportFailed', status: 'failed' };
            }
        },
    };
}

export function createTextClipboardPort(service: TauriPlatformService): ITextClipboardPort {
    return {
        async writeText(value): Promise<void> {
            const result = await service.copyTextToClipboard(value);
            if (result.status !== 'copied') {
                throw new Error('The desktop clipboard write failed.');
            }
        },
    };
}

export function createRuntimeVersionsPort(service: TauriPlatformService): IViewerRuntimeVersionsPort {
    return {
        async load() {
            try {
                const result = await service.getRuntimeVersions();
                return result.status === 'loaded' ? ok(result.versions) : err('runtimeVersionsFailed');
            } catch {
                return err('runtimeVersionsFailed');
            }
        },
    };
}

type NativeGenerationFailure = Extract<ConvertHtmlToPdfResult, { readonly status: 'failed' }>;

function isGenerationFailure(result: { readonly status: string }): result is NativeGenerationFailure {
    return result.status === 'failed';
}

// Generates a document natively. Only the typed failure is reported (PLATFORM-04); native detail stays in the native log.
export async function generateDocument<TDocument extends { readonly status: 'converted' | 'printed' }>(
    generate: () => Promise<TDocument | NativeGenerationFailure>,
    reportFailure: () => void,
): Promise<TDocument | ReturnType<typeof documentGenerationFailure>> {
    try {
        const result = await generate();
        if (isGenerationFailure(result)) {
            reportFailure();
            return documentGenerationFailure(result.code);
        }
        return result;
    } catch {
        reportFailure();
        return { code: 'exportFailed', status: 'failed' };
    }
}

export function createPdfPort(service: TauriPlatformService, errorService: IErrorService): IViewerPdfPort {
    return {
        generatePdf: (request) =>
            generateDocument(
                () => service.generatePdfDocument(request),
                () => void errorService.report(DESKTOP_FAILURE_EVENTS.pdfGeneration),
            ),
        isSupported() {
            return service.isPdfSupported();
        },
        async print(html: string) {
            // Opens native print dialog or rejects to trigger DOM print fallback.
            await service.printHtmlDocument(html);
        },
    };
}

export function createFileDigest(): IFileDigestPort {
    return {
        async sha256(
            bytes: Uint8Array,
        ): Promise<{ readonly error: ParseError; readonly ok: false } | { readonly ok: true; readonly value: Sha256Digest }> {
            try {
                const digest = await globalThis.crypto.subtle.digest('SHA-256', exactArrayBuffer(bytes));
                const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
                if (!isSha256Digest(hex)) {
                    return err(classifyParseError('internalError'));
                }

                return ok(hex);
            } catch {
                return err(classifyParseError('internalError'));
            }
        },
    };
}
