import { beforeEach, describe, expect, it, vi } from 'vitest';

const { saveDialogMock, openDialogMock, statMock, writeFileMock, renameMock, removeMock, invokeMock } = vi.hoisted(() => ({
    invokeMock: vi.fn(),
    openDialogMock: vi.fn(),
    removeMock: vi.fn(),
    renameMock: vi.fn(),
    saveDialogMock: vi.fn(),
    statMock: vi.fn(),
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
    stat: statMock,
    writeFile: writeFileMock,
}));

import {
    DEFAULT_VIEWER_PREFERENCES,
    isReopenToken,
    isSourceToken,
    type IViewerPreferences,
    type ReopenToken,
    type SourceToken,
} from '#contracts';
import { TauriPlatformService } from '../tauri-platform-service.js';

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

    beforeEach(() => {
        globalThis.localStorage = new MockStorage();
        vi.clearAllMocks();
        openDialogMock.mockReset();
        removeMock.mockReset();
        renameMock.mockReset();
        saveDialogMock.mockReset();
        statMock.mockReset();
        writeFileMock.mockReset();
        service = new TauriPlatformService();
    });

    it('loads default preferences when nothing is stored', async () => {
        const result = await service.loadPreferences();

        expect(result).toEqual({
            preferences: DEFAULT_VIEWER_PREFERENCES,
            status: 'loaded',
        });
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
        it('rejects a destination path that is literally the source path, without writing', async () => {
            const path = '/Users/driver/tacho.ddd';
            saveDialogMock.mockResolvedValue(path);

            const result = await service.saveExport({
                bytes: new Uint8Array([1, 2, 3]),
                sourceToken: fixtureSourceToken(path),
                suggestedName: 'report.html',
            });

            expect(result).toEqual({ code: 'sourceConflict', status: 'failed' });
            expect(statMock).not.toHaveBeenCalled();
            expect(writeFileMock).not.toHaveBeenCalled();
        });

        it('rejects a destination that resolves to the source file via matching device/inode, even with a different path string', async () => {
            const sourcePath = '/Users/driver/tacho.ddd';
            const destinationPath = '/Users/driver/TACHO.ddd';
            saveDialogMock.mockResolvedValue(destinationPath);
            statMock.mockImplementation((path: string) =>
                Promise.resolve(path === sourcePath || path === destinationPath ? { dev: 1, ino: 42 } : { dev: 2, ino: 99 }),
            );

            const result = await service.saveExport({
                bytes: new Uint8Array([1, 2, 3]),
                sourceToken: fixtureSourceToken(sourcePath),
                suggestedName: 'report.html',
            });

            expect(result).toEqual({ code: 'sourceConflict', status: 'failed' });
            expect(writeFileMock).not.toHaveBeenCalled();
        });

        it('reports a source whose identity cannot be read and still saves, so a denied stat is never silent', async () => {
            const sourcePath = '/Users/driver/tacho.ddd';
            const destinationPath = '/Users/driver/report.html';
            const denied = new Error('fs.stat not allowed. Permissions associated with this command: fs:allow-stat');
            saveDialogMock.mockResolvedValue(destinationPath);
            statMock.mockImplementation((path: string) =>
                path === sourcePath ? Promise.reject(denied) : Promise.resolve({ dev: 2, ino: 99 }),
            );
            writeFileMock.mockResolvedValue(undefined);
            renameMock.mockResolvedValue(undefined);

            const result = await service.saveExport({
                bytes: new Uint8Array([1, 2, 3]),
                sourceToken: fixtureSourceToken(sourcePath),
                suggestedName: 'report.html',
            });

            expect(result).toEqual({ status: 'saved' });
            // The denied check reaches the diagnostic log instead of disappearing.
            expect(invokeMock).toHaveBeenCalledWith(
                'append_native_debug_log',
                expect.objectContaining({ component: 'export-guard' }),
            );
        });

        it('saves to a genuinely different destination', async () => {
            const sourcePath = '/Users/driver/tacho.ddd';
            const destinationPath = '/Users/driver/report.html';
            saveDialogMock.mockResolvedValue(destinationPath);
            statMock.mockImplementation((path: string) =>
                path === destinationPath ? Promise.reject(new Error('ENOENT')) : Promise.resolve({ dev: 1, ino: 42 }),
            );
            writeFileMock.mockResolvedValue(undefined);
            renameMock.mockResolvedValue(undefined);

            const result = await service.saveExport({
                bytes: new Uint8Array([1, 2, 3]),
                sourceToken: fixtureSourceToken(sourcePath),
                suggestedName: 'report.html',
            });

            expect(result).toEqual({ status: 'saved' });
            // A destination that does not exist yet is not the source, so no degraded-check diagnostic is due.
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
            statMock.mockImplementation((path: string) =>
                path === destinationPath ? Promise.reject(new Error('ENOENT')) : Promise.resolve({ dev: 1, ino: 42 }),
            );
        });

        it('never writes to the final destination path directly', async () => {
            writeFileMock.mockResolvedValue(undefined);
            renameMock.mockResolvedValue(undefined);

            await service.saveExport({
                bytes: new Uint8Array([1, 2, 3]),
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
                sourceToken: fixtureSourceToken(sourcePath),
                suggestedName: 'report.html',
            });

            expect(result).toEqual({ code: 'ioFailure', status: 'failed' });
            const writtenPath = firstWriteFileCallPath();
            expect(removeMock).toHaveBeenCalledWith(writtenPath);
        });
    });
});
