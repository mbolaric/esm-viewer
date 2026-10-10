import { beforeEach, describe, expect, it, vi } from 'vitest';

const { saveDialogMock, openDialogMock, writeFileMock, renameMock, removeMock, invokeMock } = vi.hoisted(() => ({
    invokeMock: vi.fn(),
    openDialogMock: vi.fn(),
    removeMock: vi.fn(),
    renameMock: vi.fn(),
    saveDialogMock: vi.fn(),
    writeFileMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
    invoke: invokeMock,
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
    open: openDialogMock,
    save: saveDialogMock,
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
    remove: removeMock,
    rename: renameMock,
    writeFile: writeFileMock,
}));

import {
    classifyParseError,
    createMemoryKeyValueStore,
    DEFAULT_VIEWER_PREFERENCES,
    err,
    type IFactualReportPdfRequest,
    type IKeyValueStore,
    isReopenToken,
    isSourceToken,
    type IViewerPreferences,
    type ReopenToken,
    type SourceToken,
} from '#contracts';
import { createBrowserKeyValueStore } from '../browser-key-value-store.js';
import { createPreferencesStore } from '../desktop-ports.js';
import { TauriTachographFilePicker } from '../tauri-file-pickers.js';
import { TauriPlatformService } from '../tauri-platform-service.js';

const DIGEST = 'a'.repeat(64);

function fixtureSourceToken(value: string): SourceToken {
    if (!isSourceToken(value)) {
        throw new TypeError(`Fixture source token "${value}" is not valid.`);
    }
    return value;
}

function fixtureReopenToken(value: string): ReopenToken {
    if (!isReopenToken(value)) {
        throw new TypeError(`Fixture reopen token "${value}" is not valid.`);
    }
    return value;
}

function firstWriteFileCallPath(): string {
    const arg: unknown = writeFileMock.mock.calls[0]?.[0];
    if (typeof arg !== 'string') {
        throw new TypeError('writeFile was not called with a path.');
    }
    return arg;
}

class MockStorage implements Storage {
    private readonly _store = new Map<string, string>();

    public get length(): number {
        return this._store.size;
    }

    public clear(): void {
        this._store.clear();
    }

    public getItem(key: string): string | null {
        return this._store.get(key) ?? null;
    }

    public key(index: number): string | null {
        return Array.from(this._store.keys())[index] ?? null;
    }

    public removeItem(key: string): void {
        this._store.delete(key);
    }

    public setItem(key: string, value: string): void {
        this._store.set(key, value);
    }
}

describe('TauriPlatformService', () => {
    // Shared service instance reused across tests; mocks are reconfigured per-test.
    let service: TauriPlatformService;

    const printRequest: IFactualReportPdfRequest = {
        footerNotice: '',
        headerFields: [],
        kind: 'factualReport',
        locale: 'en',
        orientation: 'portrait',
        sections: [],
        subtitle: '',
        summaryItems: [],
        summaryTitle: '',
        title: 'Synthetic PDF',
    };

    it('prints the typed PDF request through the native command and decodes completion', async () => {
        invokeMock.mockResolvedValueOnce(null);
        await expect(service.printPdfDocument(printRequest)).resolves.toBeUndefined();
        expect(invokeMock).toHaveBeenCalledExactlyOnceWith('print_pdf_document', { request: printRequest });
    });

    it('rejects an invalid native print response or a failed print command', async () => {
        invokeMock.mockResolvedValueOnce({ status: 'printed' });
        await expect(service.printPdfDocument(printRequest)).rejects.toThrow('Invalid native print response.');
        invokeMock.mockRejectedValueOnce(new Error('Native print failed'));
        await expect(service.printPdfDocument(printRequest)).rejects.toThrow('Native print failed');
    });

    beforeEach(() => {
        globalThis.localStorage = new MockStorage();
        vi.clearAllMocks();
        openDialogMock.mockReset();
        removeMock.mockReset();
        renameMock.mockReset();
        saveDialogMock.mockReset();
        writeFileMock.mockReset();
        // The export guard answers natively; tests override it per case.
        invokeMock.mockImplementation((command: string) =>
            Promise.resolve(command === 'export_destination_is_source' ? false : undefined),
        );
        service = new TauriPlatformService();
    });

    it('loads default preferences when nothing is stored', async () => {
        const result = await service.loadPreferences();

        expect(result).toEqual({
            preferences: DEFAULT_VIEWER_PREFERENCES,
            status: 'loaded',
        });
    });

    it.each(['', '{broken', 'null', '{}', JSON.stringify({ ...DEFAULT_VIEWER_PREFERENCES, version: 2 })])(
        'reports invalid stored preferences without overwriting them %#',
        async (stored) => {
            localStorage.setItem('esm_viewer_preferences', stored);

            expect(await service.loadPreferences()).toEqual({ code: 'invalidPreferences', status: 'failed' });
            expect(await createPreferencesStore(service).load()).toEqual(err('preferencesLoadFailed'));
            expect(localStorage.getItem('esm_viewer_preferences')).toBe(stored);
        },
    );

    it('reports blocked browser storage reads and recovers when storage becomes available', async () => {
        const storage = new MockStorage();
        const keyValueStore = createBrowserKeyValueStore(() => storage);
        const preferencesService = new TauriPlatformService(keyValueStore);
        const read = vi.spyOn(storage, 'getItem').mockImplementationOnce(() => {
            throw new Error('Synthetic storage failure.');
        });

        expect(await preferencesService.loadPreferences()).toEqual({ code: 'ioFailure', status: 'failed' });
        expect(read).toHaveBeenCalledWith('esm_viewer_preferences');
        expect(await preferencesService.loadPreferences()).toEqual({ preferences: DEFAULT_VIEWER_PREFERENCES, status: 'loaded' });
    });

    it('keeps legacy best-effort storage implementations compatible', async () => {
        const store: IKeyValueStore = {
            getItem: () => JSON.stringify(DEFAULT_VIEWER_PREFERENCES),
            removeItem: () => undefined,
            setItem: () => true,
        };
        expect(await new TauriPlatformService(store).loadPreferences()).toEqual({
            preferences: DEFAULT_VIEWER_PREFERENCES,
            status: 'loaded',
        });
    });

    it('contains an unexpected legacy storage exception without claiming a successful load', async () => {
        const store = createMemoryKeyValueStore();
        vi.spyOn(store, 'getItem').mockImplementation(() => {
            throw new Error('Synthetic legacy storage exception.');
        });

        expect(await new TauriPlatformService(store).loadPreferences()).toEqual({ code: 'ioFailure', status: 'failed' });
    });

    it('discards directory memory when a previously valid preference load fails', async () => {
        await service.savePreferences({ ...DEFAULT_VIEWER_PREFERENCES, recentFilePathsEnabled: true });
        localStorage.setItem('esm_viewer_last_directory', '/synthetic/recent');
        await service.loadPreferences();
        localStorage.setItem('esm_viewer_preferences', '{broken');
        expect(await service.loadPreferences()).toEqual({ code: 'invalidPreferences', status: 'failed' });
        openDialogMock.mockResolvedValueOnce(null);

        expect(await service.openTachographFile()).toEqual({ status: 'cancelled' });
        expect(openDialogMock.mock.lastCall?.[0]).not.toHaveProperty('defaultPath');
    });

    it('reports a directory-state read failure rather than enabling incomplete preferences', async () => {
        const storage = new MockStorage();
        storage.setItem(
            'esm_viewer_preferences',
            JSON.stringify({ ...DEFAULT_VIEWER_PREFERENCES, recentFilePathsEnabled: true }),
        );
        storage.setItem('esm_viewer_last_directory', '/synthetic/recent');
        const preferencesService = new TauriPlatformService(createBrowserKeyValueStore(() => storage));
        const read = vi.spyOn(storage, 'getItem');
        read.mockReturnValueOnce(JSON.stringify({ ...DEFAULT_VIEWER_PREFERENCES, recentFilePathsEnabled: true }));
        read.mockImplementationOnce(() => {
            throw new Error('Synthetic directory storage failure.');
        });

        expect(await preferencesService.loadPreferences()).toEqual({ code: 'ioFailure', status: 'failed' });
        openDialogMock.mockResolvedValueOnce(null);
        await preferencesService.openTachographFile();
        expect(openDialogMock.mock.lastCall?.[0]).not.toHaveProperty('defaultPath');
    });

    it('distinguishes native dialog cancellation from exceptions', async () => {
        openDialogMock.mockResolvedValueOnce(null);
        expect(await service.selectTachographPathsResult()).toEqual({ ok: true, value: null });
        openDialogMock.mockResolvedValueOnce(null);
        expect(await service.selectTachographPaths()).toBeNull();
        openDialogMock.mockResolvedValueOnce(null);
        expect(await service.openTachographFile()).toEqual({ status: 'cancelled' });

        openDialogMock.mockRejectedValue(new Error('Synthetic dialog failure.'));
        expect(await service.selectTachographPathsResult()).toEqual(err('ioFailure'));
        await expect(service.selectTachographPaths()).rejects.toMatchObject({ cause: 'ioFailure' });
        expect(await service.openTachographFile()).toEqual({ code: 'ioFailure', status: 'failed' });
        expect(await new TauriTachographFilePicker(service).open()).toEqual({
            error: classifyParseError('fileReadFailed'),
            status: 'failed',
        });
        expect(invokeMock).not.toHaveBeenCalledWith('read_ddd_file', expect.anything());
    });

    it.each([
        undefined,
        '',
        [],
        {},
        [null],
        new Array<unknown>(1),
        ['/synthetic/card.ddd', 42],
        ['/synthetic/first.ddd', '/synthetic/second.ddd'],
    ])('rejects an invalid single-file dialog response without reporting cancellation %#', async (selected) => {
        openDialogMock.mockResolvedValue(selected);

        expect(await service.selectTachographPathsResult()).toEqual(err('invalidResponse'));
        expect(await service.openTachographFile()).toEqual({ code: 'invalidResponse', status: 'failed' });
        expect(invokeMock).not.toHaveBeenCalledWith('read_ddd_file', expect.anything());
    });

    it('rejects the entire multiple-file selection when any path is invalid', async () => {
        openDialogMock.mockResolvedValueOnce(['/synthetic/card.ddd', null]);
        expect(await service.selectTachographPathsResult({ multiple: true })).toEqual(err('invalidResponse'));
        expect(localStorage.getItem('esm_viewer_last_directory')).toBeNull();
    });

    it('preserves valid single and multiple selection and remembered directory behavior', async () => {
        await service.savePreferences({ ...DEFAULT_VIEWER_PREFERENCES, recentFilePathsEnabled: true });
        invokeMock.mockResolvedValue(['ddd', 'tgd']);
        openDialogMock.mockResolvedValueOnce('/synthetic/download/card.ddd');
        expect(await service.selectTachographPaths()).toEqual(['/synthetic/download/card.ddd']);

        const paths = ['/synthetic/first.ddd', '/synthetic/second.tgd'];
        openDialogMock.mockResolvedValueOnce(paths);
        expect(await service.selectTachographPathsResult({ multiple: true })).toEqual({ ok: true, value: paths });
        expect(openDialogMock.mock.lastCall?.[0]).toEqual({
            defaultPath: '/synthetic/download',
            filters: [{ extensions: ['ddd', 'DDD', 'tgd', 'TGD'], name: 'Tachograph Files' }],
            multiple: true,
        });
        expect(localStorage.getItem('esm_viewer_last_directory')).toBe('/synthetic');
    });

    it('opens the selected file through native binary reading after successful selection', async () => {
        openDialogMock.mockResolvedValueOnce('/synthetic/card.ddd');
        invokeMock.mockImplementation((command: string) =>
            Promise.resolve(command === 'get_supported_tachograph_extensions' ? ['ddd'] : Uint8Array.from([1, 2]).buffer),
        );

        expect(await service.openTachographFile()).toEqual({
            file: {
                bytes: Uint8Array.from([1, 2]),
                displayName: 'card.ddd',
                reopenToken: '/synthetic/card.ddd',
                sourceToken: '/synthetic/card.ddd',
            },
            status: 'opened',
        });
        expect(invokeMock).toHaveBeenCalledWith('read_ddd_file', { filePath: '/synthetic/card.ddd' });
    });

    it('preserves host overrides of the original path-selection method when opening a file', async () => {
        const select = vi.spyOn(service, 'selectTachographPaths').mockResolvedValue(['/synthetic/host.ddd']);
        invokeMock.mockResolvedValue(Uint8Array.from([1]).buffer);

        expect(await service.openTachographFile()).toMatchObject({ file: { displayName: 'host.ddd' }, status: 'opened' });
        expect(select).toHaveBeenCalledWith({ multiple: false });
        expect(openDialogMock).not.toHaveBeenCalled();
    });

    it('saves and loads preferences properly', async () => {
        const customPreferences: IViewerPreferences = {
            ...DEFAULT_VIEWER_PREFERENCES,
            density: 'comfortable',
            displayDateFormat: 'iso8601',
            displayTimeFormat: '24hour',
            displayTimeZone: 'Europe/Berlin',
            locale: 'de',
            recentFilePathsEnabled: true,
            theme: 'dark',
            verificationAutoRun: true,
            version: 1,
        };

        const saveResult = await service.savePreferences(customPreferences);
        expect(saveResult).toEqual({ status: 'saved' });

        const loadResult = await service.loadPreferences();
        expect(loadResult).toEqual({
            preferences: customPreferences,
            status: 'loaded',
        });
    });

    it('clears stored recent directory when recentFilePathsEnabled is disabled', async () => {
        localStorage.setItem('esm_viewer_last_directory', '/home/user/downloads');

        // Reconstructed to test initialization with existing stored directory.
        service = new TauriPlatformService();
        await service.savePreferences({
            ...DEFAULT_VIEWER_PREFERENCES,
            recentFilePathsEnabled: false,
        });

        expect(localStorage.getItem('esm_viewer_last_directory')).toBeNull();
    });

    it('handles copyTextToClipboard successfully', async () => {
        const writeText = vi.fn().mockReturnValue(Promise.resolve());
        Object.assign(navigator, {
            clipboard: { writeText },
        });

        const result = await service.copyTextToClipboard('test payload');

        expect(result).toEqual({ status: 'copied' });
        expect(writeText).toHaveBeenCalledWith('test payload');
    });

    it('reports a failure when the clipboard write promise rejects (PLATFORM-05)', async () => {
        const writeText = vi.fn().mockReturnValue(Promise.reject(new Error('denied')));
        Object.assign(navigator, {
            clipboard: { writeText },
        });

        const result = await service.copyTextToClipboard('test payload');

        expect(result).toEqual({ code: 'ioFailure', status: 'failed' });
    });

    it('reports a failure when the Clipboard API is unavailable (PLATFORM-05)', async () => {
        Object.assign(navigator, { clipboard: undefined });

        const result = await service.copyTextToClipboard('test payload');

        expect(result).toEqual({ code: 'ioFailure', status: 'failed' });
    });

    it('decodes real runtime version info reported by the native backend', async () => {
        invokeMock.mockResolvedValueOnce({
            application: '1.2.3',
            architecture: 'x86_64',
            parserCommit: 'a'.repeat(40),
            parserVersion: '0.2.0',
            platform: 'linux',
            runtime: 'Tauri 2.11.5',
        });

        const versions = await service.getRuntimeVersions();

        expect(invokeMock).toHaveBeenCalledWith('get_runtime_versions');
        expect(versions.status).toBe('loaded');
        if (versions.status === 'loaded') {
            expect(versions.versions.platform).toBe('linux');
            expect(versions.versions.architecture).toBe('x86_64');
            expect(versions.versions.runtime).toContain('Tauri');
        }
    });

    it('reports a decode failure when the native backend response is malformed', async () => {
        invokeMock.mockResolvedValueOnce({ unexpected: 'shape' });

        const versions = await service.getRuntimeVersions();

        expect(versions).toEqual({ code: 'invalidResponse', status: 'failed' });
    });

    it('reports an I/O failure when the native invoke call rejects', async () => {
        invokeMock.mockRejectedValueOnce(new Error('native command unavailable'));

        const versions = await service.getRuntimeVersions();

        expect(versions).toEqual({ code: 'ioFailure', status: 'failed' });
    });

    it('opens a tachograph path from the raw binary response of the native read', async () => {
        invokeMock.mockResolvedValueOnce(Uint8Array.from([0, 127, 255]).buffer);

        const result = await service.openTachographPath({
            reopenToken: fixtureReopenToken('/home/user/card.ddd'),
        });

        expect(result).toEqual({
            file: {
                bytes: Uint8Array.from([0, 127, 255]),
                displayName: 'card.ddd',
                reopenToken: '/home/user/card.ddd',
                sourceToken: '/home/user/card.ddd',
            },
            status: 'opened',
        });
    });

    it('rejects a malformed native read-file response instead of coercing its bytes', async () => {
        invokeMock.mockResolvedValueOnce([1, 256]);

        const result = await service.openTachographPath({
            reopenToken: fixtureReopenToken('/home/user/card.ddd'),
        });

        expect(result).toEqual({ code: 'invalidResponse', status: 'failed' });
    });

    it('maps only the decoded not-found code to a file-not-found result', async () => {
        invokeMock.mockRejectedValueOnce({ code: 'notFound', error: 'File does not exist' });
        const notFound = await service.openTachographPath({ reopenToken: fixtureReopenToken('/home/user/card.ddd') });
        expect(notFound).toEqual({ code: 'fileNotFound', status: 'failed' });

        invokeMock.mockRejectedValueOnce({ code: null, error: 'File could not be read' });
        const unreadable = await service.openTachographPath({ reopenToken: fixtureReopenToken('/home/user/card.ddd') });
        expect(unreadable).toEqual({ code: 'ioFailure', status: 'failed' });

        invokeMock.mockRejectedValueOnce('unexpected failure shape');
        const malformed = await service.openTachographPath({ reopenToken: fixtureReopenToken('/home/user/card.ddd') });
        expect(malformed).toEqual({ code: 'invalidResponse', status: 'failed' });
    });

    it('manages export source registration and release', () => {
        const registered = service.registerExportSource();
        expect(registered.status).toBe('registered');

        if (registered.status === 'registered') {
            const released = service.releaseSource({ sourceToken: registered.sourceToken });
            expect(released.status).toBe('released');
        }
    });

    describe('saveExport (PLATFORM-01)', () => {
        async function expectRefusedGuardSave(configureGuard: () => void): Promise<void> {
            const sourcePath = '/Users/driver/tacho.ddd';
            saveDialogMock.mockResolvedValue('/Users/driver/report.html');
            configureGuard();
            writeFileMock.mockResolvedValue(undefined);
            renameMock.mockResolvedValue(undefined);

            const result = await service.saveExport({
                bytes: new Uint8Array([1, 2, 3]),
                sourceSha256: DIGEST,
                sourceToken: fixtureSourceToken(sourcePath),
                suggestedName: 'report.html',
            });

            // A guard that cannot run proves nothing about the destination, so nothing is written.
            expect(result).toEqual({ code: 'guardUnavailable', status: 'failed' });
            expect(writeFileMock).not.toHaveBeenCalled();
            expect(invokeMock).toHaveBeenCalledWith(
                'append_native_debug_log',
                expect.objectContaining({ component: 'export-guard' }),
            );
        }

        it('rejects a destination path that is literally the source path, without writing or asking the platform', async () => {
            const path = '/Users/driver/tacho.ddd';
            saveDialogMock.mockResolvedValue(path);

            const result = await service.saveExport({
                bytes: new Uint8Array([1, 2, 3]),
                sourceSha256: DIGEST,
                sourceToken: fixtureSourceToken(path),
                suggestedName: 'report.html',
            });

            expect(result).toEqual({ code: 'sourceConflict', status: 'failed' });
            expect(invokeMock).not.toHaveBeenCalledWith('export_destination_is_source', expect.anything());
            expect(writeFileMock).not.toHaveBeenCalled();
        });

        it('asks the platform with the source digest, so a dropped document is protected too', async () => {
            const destinationPath = '/Users/driver/report.html';
            saveDialogMock.mockResolvedValue(destinationPath);
            writeFileMock.mockResolvedValue(undefined);
            renameMock.mockResolvedValue(undefined);

            await service.saveExport({
                bytes: new Uint8Array([1, 2, 3]),
                sourceSha256: DIGEST,
                // A dropped document registers an opaque token instead of a path.
                sourceToken: fixtureSourceToken('3f2504e0-4f89-11d3-9a0c-0305e82c3301'),
                suggestedName: 'report.html',
            });

            expect(invokeMock).toHaveBeenCalledWith('export_destination_is_source', {
                destinationPath,
                sourceSha256: DIGEST,
                sourcePath: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
            });
        });

        it('rejects a destination the platform reports as the source file, even with a different path string', async () => {
            const sourcePath = '/Users/driver/tacho.ddd';
            const destinationPath = '/Users/driver/TACHO.ddd';
            saveDialogMock.mockResolvedValue(destinationPath);
            invokeMock.mockImplementation((command: string) =>
                Promise.resolve(command === 'export_destination_is_source' ? true : undefined),
            );

            const result = await service.saveExport({
                bytes: new Uint8Array([1, 2, 3]),
                sourceSha256: DIGEST,
                sourceToken: fixtureSourceToken(sourcePath),
                suggestedName: 'report.html',
            });

            expect(result).toEqual({ code: 'sourceConflict', status: 'failed' });
            expect(writeFileMock).not.toHaveBeenCalled();
        });

        it('refuses the export when the guard cannot run, and reports it', async () => {
            // An unavailable guard must never be mistaken for a destination that is provably different.
            await expectRefusedGuardSave(() => invokeMock.mockRejectedValue(new Error('export_destination_is_source failed')));
        });

        it('refuses the export when the guard answers with something other than a verdict', async () => {
            await expectRefusedGuardSave(() =>
                invokeMock.mockImplementation((command: string) =>
                    Promise.resolve(command === 'export_destination_is_source' ? 'yes' : undefined),
                ),
            );
        });

        it('saves to a genuinely different destination', async () => {
            const sourcePath = '/Users/driver/tacho.ddd';
            const destinationPath = '/Users/driver/report.html';
            saveDialogMock.mockResolvedValue(destinationPath);
            writeFileMock.mockResolvedValue(undefined);
            renameMock.mockResolvedValue(undefined);

            const result = await service.saveExport({
                bytes: new Uint8Array([1, 2, 3]),
                sourceSha256: DIGEST,
                sourceToken: fixtureSourceToken(sourcePath),
                suggestedName: 'report.html',
            });

            expect(result).toEqual({ status: 'saved' });
            // A destination the platform reports as a different file is not the source, so no diagnostic is due.
            expect(invokeMock).not.toHaveBeenCalledWith(
                'append_native_debug_log',
                expect.objectContaining({ component: 'export-guard' }),
            );
            // Written to temp file first, then atomically renamed to destination.
            const writtenPath = firstWriteFileCallPath();
            expect(writtenPath.startsWith(`${destinationPath}.`)).toBe(true);
            expect(writtenPath.endsWith('.tmp')).toBe(true);
            expect(renameMock).toHaveBeenCalledWith(writtenPath, destinationPath);
        });
    });

    describe('saveExport atomic writes (PLATFORM-02)', () => {
        const sourcePath = '/Users/driver/tacho.ddd';
        const destinationPath = '/Users/driver/report.html';

        beforeEach(() => {
            saveDialogMock.mockResolvedValue(destinationPath);
        });

        it('never writes to the final destination path directly', async () => {
            writeFileMock.mockResolvedValue(undefined);
            renameMock.mockResolvedValue(undefined);

            await service.saveExport({
                bytes: new Uint8Array([1, 2, 3]),
                sourceSha256: DIGEST,
                sourceToken: fixtureSourceToken(sourcePath),
                suggestedName: 'report.html',
            });

            expect(writeFileMock).not.toHaveBeenCalledWith(destinationPath, expect.anything());
        });

        it('cleans up the temp file, fails without renaming, and persists the raw error when the write itself fails', async () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
            const error = new Error('disk full');
            writeFileMock.mockRejectedValue(error);
            removeMock.mockResolvedValue(undefined);

            const result = await service.saveExport({
                bytes: new Uint8Array([1, 2, 3]),
                sourceSha256: DIGEST,
                sourceToken: fixtureSourceToken(sourcePath),
                suggestedName: 'report.html',
            });

            expect(result).toEqual({ code: 'ioFailure', status: 'failed' });
            expect(renameMock).not.toHaveBeenCalled();
            const writtenPath = firstWriteFileCallPath();
            expect(removeMock).toHaveBeenCalledWith(writtenPath);
            expect(invokeMock).toHaveBeenCalledWith('append_native_debug_log', {
                component: 'export-save',
                message: error.stack,
            });

            spy.mockRestore();
        });

        it('cleans up the temp file and fails when the atomic rename itself fails, leaving no destination write', async () => {
            writeFileMock.mockResolvedValue(undefined);
            renameMock.mockRejectedValue(new Error('permission denied'));
            removeMock.mockResolvedValue(undefined);

            const result = await service.saveExport({
                bytes: new Uint8Array([1, 2, 3]),
                sourceSha256: DIGEST,
                sourceToken: fixtureSourceToken(sourcePath),
                suggestedName: 'report.html',
            });

            expect(result).toEqual({ code: 'ioFailure', status: 'failed' });
            const writtenPath = firstWriteFileCallPath();
            expect(removeMock).toHaveBeenCalledWith(writtenPath);
        });
    });
});
