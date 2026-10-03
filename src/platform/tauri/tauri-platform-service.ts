import { invoke } from '@tauri-apps/api/core';
import { open as openDialog, save as saveDialog, type OpenDialogOptions } from '@tauri-apps/plugin-dialog';
import { remove, rename, stat, writeFile } from '@tauri-apps/plugin-fs';
import {
    decodeBinaryPayload,
    decodeReadTachographFileFailure,
    decodePdfDocumentRequest,
    decodeRuntimeVersionsResult,
    type ConvertHtmlToPdfResult,
    type GeneratedBinaryDocumentResult,
    type CopyTextToClipboardResult,
    decodeViewerPreferences,
    DEFAULT_VIEWER_PREFERENCES,
    type IOpenTachographPathRequest,
    type IPdfDocumentRequest,
    type IReleaseSourceRequest,
    type ISaveExportRequest,
    type IViewerPreferences,
    isFileDisplayName,
    isReopenToken,
    isSourceToken,
    MAXIMUM_GENERATED_BINARY_BYTES,
    MAXIMUM_OPEN_FILE_BYTES,
    type LoadPreferencesResult,
    type OpenTachographFileResult,
    type RegisterExportSourceResult,
    type ReleaseSourceResult,
    type Result,
    type RuntimeVersionsResult,
    type IKeyValueStore,
    type SaveExportResult,
    type SavePreferencesResult,
} from '#contracts';
import { createBrowserKeyValueStore } from './browser-key-value-store.js';
import { logPlatformError } from './log-platform-error.js';
import { createRandomSourceToken } from './token.js';

const IO_FAILURE = { code: 'ioFailure', status: 'failed' } as const;

// Runs a native document generator; any native failure is logged and reported as a generic I/O failure.
export async function generateNativeDocument<TRequest>(
    command: string,
    decoded: Result<TRequest, unknown>,
    logComponent: string,
): Promise<GeneratedBinaryDocumentResult> {
    if (!decoded.ok) {
        return { code: 'invalidRequest', status: 'failed' };
    }
    try {
        const rawBytes: unknown = await invoke(command, { request: decoded.value });
        const bytes = decodeBinaryPayload(rawBytes, MAXIMUM_GENERATED_BINARY_BYTES);
        return bytes === null || bytes.byteLength === 0 ? IO_FAILURE : { bytes, status: 'converted' };
    } catch (error) {
        logPlatformError(logComponent, error);
        return IO_FAILURE;
    }
}

const PREFERENCES_STORAGE_KEY = 'esm_viewer_preferences';
const LAST_DIRECTORY_STORAGE_KEY = 'esm_viewer_last_directory';

function extractDirectory(filePath: string): string | undefined {
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    if (lastSlash > 0) {
        return filePath.substring(0, lastSlash);
    }
    return undefined;
}

function normalizePathSeparators(path: string): string {
    return path.replace(/\\/gu, '/');
}

// Checks whether export destination matches opened document source via normalized path and stat.
async function isSameFile(destinationPath: string, sourcePath: string): Promise<boolean> {
    // Non-string or undefined source tokens safely resolve to false (not same file).
    if (typeof destinationPath !== 'string' || typeof sourcePath !== 'string') {
        return false;
    }

    if (normalizePathSeparators(destinationPath) === normalizePathSeparators(sourcePath)) {
        return true;
    }

    try {
        const [destinationInfo, sourceInfo] = await Promise.all([stat(destinationPath), stat(sourcePath)]);
        return (
            destinationInfo.dev !== null &&
            destinationInfo.ino !== null &&
            destinationInfo.dev === sourceInfo.dev &&
            destinationInfo.ino === sourceInfo.ino
        );
    } catch {
        return false;
    }
}

// Writes bytes to temporary file first then atomically renames to prevent partial writes.
async function writeFileAtomically(path: string, bytes: Uint8Array): Promise<void> {
    const tempPath = `${path}.${globalThis.crypto.randomUUID()}.tmp`;
    try {
        await writeFile(tempPath, bytes);
        await rename(tempPath, path);
    } catch (error) {
        try {
            await remove(tempPath);
        } catch {
            // Ignore cleanup failure; throw original write error.
        }
        throw error;
    }
}

// Fetches supported tachograph file extensions from the native backend.
async function fetchSupportedTachographDialogExtensions(): Promise<string[]> {
    let raw: unknown;
    try {
        raw = await invoke('get_supported_tachograph_extensions');
    } catch {
        return [];
    }
    if (!Array.isArray(raw)) {
        return [];
    }
    const extensions: string[] = [];
    for (const item of raw) {
        if (typeof item === 'string' && item.length > 0) {
            extensions.push(item, item.toUpperCase());
        }
    }
    return extensions;
}

export class TauriPlatformService {
    private readonly _keyValueStore: IKeyValueStore;
    private _lastDirectory?: string | undefined;
    private _recentFilePathsEnabled = false;

    public constructor(keyValueStore: IKeyValueStore = createBrowserKeyValueStore()) {
        this._keyValueStore = keyValueStore;
        try {
            const stored = this._keyValueStore.getItem(PREFERENCES_STORAGE_KEY);
            if (typeof stored === 'string' && stored.length > 0) {
                const parsed: unknown = JSON.parse(stored);
                const decoded = decodeViewerPreferences(parsed);
                if (decoded.ok && decoded.value.recentFilePathsEnabled) {
                    this._recentFilePathsEnabled = true;
                    this.loadRecentDirectoryState();
                }
            }
        } catch {
            // Safe fallback
        }
    }

    // Restores _lastDirectory from storage if recent-directory tracking is enabled.
    private loadRecentDirectoryState(): void {
        if (!this._recentFilePathsEnabled) {
            return;
        }
        const lastDir = this._keyValueStore.getItem(LAST_DIRECTORY_STORAGE_KEY);
        if (typeof lastDir === 'string' && lastDir.length > 0) {
            this._lastDirectory = lastDir;
        }
    }

    // Remembers directory of path for next dialog if tracking is enabled.
    protected rememberSelectedDirectory(path: string): void {
        if (!this._recentFilePathsEnabled) {
            return;
        }
        const dir = extractDirectory(path);
        if (dir === undefined) {
            return;
        }
        this._lastDirectory = dir;
        this._keyValueStore.setItem(LAST_DIRECTORY_STORAGE_KEY, dir);
    }

    private clearRecentDirectory(): void {
        this._lastDirectory = undefined;
        this._keyValueStore.removeItem(LAST_DIRECTORY_STORAGE_KEY);
    }

    protected async tachographDialogOptions(): Promise<Pick<OpenDialogOptions, 'defaultPath' | 'filters'>> {
        const hasRecentDir = this._recentFilePathsEnabled && typeof this._lastDirectory === 'string';
        const extensions = await fetchSupportedTachographDialogExtensions();

        return {
            ...(hasRecentDir && this._lastDirectory !== undefined ? { defaultPath: this._lastDirectory } : {}),
            ...(extensions.length > 0
                ? {
                      filters: [
                          {
                              extensions,
                              name: 'Tachograph Files',
                          },
                      ],
                  }
                : {}),
        };
    }

    public async selectTachographPaths(options?: { readonly multiple?: boolean }): Promise<readonly string[] | null> {
        try {
            const selected: unknown = await openDialog({
                ...(await this.tachographDialogOptions()),
                multiple: options?.multiple ?? false,
            });

            if (selected === null) {
                return null;
            }

            const paths: readonly string[] = Array.isArray(selected)
                ? (selected as readonly unknown[]).filter((item): item is string => typeof item === 'string' && item.length > 0)
                : typeof selected === 'string' && selected.length > 0
                  ? [selected]
                  : [];
            if (paths.length === 0) {
                return null;
            }
            const first = paths[0];
            if (first !== undefined) {
                this.rememberSelectedDirectory(first);
            }

            return paths;
        } catch {
            return null;
        }
    }

    public async openTachographFile(): Promise<OpenTachographFileResult> {
        const paths = await this.selectTachographPaths({ multiple: false });
        if (paths === null || paths.length === 0) {
            return { status: 'cancelled' };
        }
        const selected = paths[0];
        if (selected === undefined || !isReopenToken(selected)) {
            return { code: 'invalidRequest', status: 'failed' };
        }

        return await this.openTachographPath({ reopenToken: selected });
    }

    public async openTachographPath(request: IOpenTachographPathRequest): Promise<OpenTachographFileResult> {
        try {
            const filePath = request.reopenToken;
            let rawResponse: unknown;
            try {
                rawResponse = await invoke('read_ddd_file', { filePath });
            } catch (failure) {
                // A read failure arrives as the command's typed error value.
                const decodedFailure = decodeReadTachographFileFailure(failure);
                if (!decodedFailure.ok) {
                    return { code: 'invalidResponse', status: 'failed' };
                }
                return {
                    code: decodedFailure.value.code === 'notFound' ? 'fileNotFound' : 'ioFailure',
                    status: 'failed',
                };
            }
            const bytes = decodeBinaryPayload(rawResponse, MAXIMUM_OPEN_FILE_BYTES);
            if (bytes === null) {
                return { code: 'invalidResponse', status: 'failed' };
            }

            const parts = filePath.split(/[/\\]/u);
            const filename = parts[parts.length - 1] ?? 'unnamed.ddd';
            if (!isFileDisplayName(filename)) {
                return { code: 'invalidRequest', status: 'failed' };
            }
            if (!isSourceToken(filePath)) {
                return { code: 'invalidRequest', status: 'failed' };
            }

            return {
                file: {
                    bytes,
                    displayName: filename,
                    reopenToken: request.reopenToken,
                    sourceToken: filePath,
                },
                status: 'opened',
            };
        } catch {
            return IO_FAILURE;
        }
    }

    public async loadPreferences(): Promise<LoadPreferencesResult> {
        await Promise.resolve();
        try {
            const stored = this._keyValueStore.getItem(PREFERENCES_STORAGE_KEY);
            if (typeof stored !== 'string' || stored.length === 0) {
                return { preferences: DEFAULT_VIEWER_PREFERENCES, status: 'loaded' };
            }
            const parsed: unknown = JSON.parse(stored);
            const decoded = decodeViewerPreferences(parsed);
            if (decoded.ok) {
                this._recentFilePathsEnabled = decoded.value.recentFilePathsEnabled;
                if (this._recentFilePathsEnabled) {
                    this.loadRecentDirectoryState();
                } else {
                    this.clearRecentDirectory();
                }
                return { preferences: decoded.value, status: 'loaded' };
            }
            return { preferences: DEFAULT_VIEWER_PREFERENCES, status: 'loaded' };
        } catch {
            return { preferences: DEFAULT_VIEWER_PREFERENCES, status: 'loaded' };
        }
    }

    public async savePreferences(preferences: IViewerPreferences): Promise<SavePreferencesResult> {
        await Promise.resolve();
        try {
            if (!this._keyValueStore.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))) {
                return IO_FAILURE;
            }
            this._recentFilePathsEnabled = preferences.recentFilePathsEnabled;
            if (!this._recentFilePathsEnabled) {
                this.clearRecentDirectory();
            }
            return { status: 'saved' };
        } catch {
            return IO_FAILURE;
        }
    }

    public async copyTextToClipboard(value: string): Promise<CopyTextToClipboardResult> {
        try {
            await navigator.clipboard.writeText(value);
            return { status: 'copied' };
        } catch {
            return IO_FAILURE;
        }
    }

    public async getRuntimeVersions(): Promise<RuntimeVersionsResult> {
        try {
            const raw = await invoke('get_runtime_versions');
            const decoded = decodeRuntimeVersionsResult({ status: 'loaded', versions: raw });
            if (!decoded.ok) {
                return { code: 'invalidResponse', status: 'failed' };
            }
            return decoded.value;
        } catch {
            return IO_FAILURE;
        }
    }

    public registerExportSource(): RegisterExportSourceResult {
        return { sourceToken: createRandomSourceToken(), status: 'registered' };
    }

    public releaseSource(request: IReleaseSourceRequest): ReleaseSourceResult {
        if (typeof request.sourceToken !== 'string') {
            return { code: 'invalidRequest', status: 'failed' };
        }
        return { status: 'released' };
    }

    public isPdfSupported(): boolean {
        return true;
    }

    public async generatePdfDocument(request: IPdfDocumentRequest): Promise<ConvertHtmlToPdfResult> {
        return generateNativeDocument('generate_pdf_document', decodePdfDocumentRequest(request), 'pdf-generation');
    }

    public async printHtmlDocument(html: string): Promise<void> {
        // Opens native print dialog via Rust backend; rejects if unavailable.
        await invoke('print_html_document', { html });
    }

    public async saveExport(request: ISaveExportRequest): Promise<SaveExportResult> {
        try {
            let defaultPath = request.suggestedName;
            if (this._recentFilePathsEnabled && typeof this._lastDirectory === 'string') {
                const sep = this._lastDirectory.includes('\\') ? '\\' : '/';
                defaultPath = `${this._lastDirectory}${sep}${request.suggestedName}`;
            }

            const path = await saveDialog(typeof defaultPath === 'string' && defaultPath.length > 0 ? { defaultPath } : {});
            if (typeof path !== 'string' || path.length === 0) {
                return { status: 'cancelled' };
            }

            // Prevent overwriting active source file with export output.
            if (await isSameFile(path, request.sourceToken)) {
                return { code: 'sourceConflict', status: 'failed' };
            }

            this.rememberSelectedDirectory(path);

            await writeFileAtomically(path, request.bytes);
            return { status: 'saved' };
        } catch (error) {
            logPlatformError('export-save', error);
            return IO_FAILURE;
        }
    }

    public async exportErrorLogs(): Promise<SaveExportResult> {
        try {
            const content = await invoke<string>('read_error_logs');
            const encoder = new TextEncoder();
            const bytes = encoder.encode(content);
            const now = new Date().toISOString().replace(/[:.]/g, '-');
            const suggestedName = `esm-viewer-error-log-${now}.jsonl`;
            return await this.saveExport({
                bytes,
                sourceToken: createRandomSourceToken(),
                suggestedName,
            });
        } catch {
            return IO_FAILURE;
        }
    }
}
