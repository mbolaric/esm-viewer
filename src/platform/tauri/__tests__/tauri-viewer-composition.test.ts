import { describe, expect, it, vi } from 'vitest';

import { isSourceToken, type IErrorEvent, type SourceToken } from '#contracts';
import type { IErrorService } from '#error-reporting';
import { TauriPlatformService } from '#tauri-platform';
import { createExportPort, createTextClipboardPort } from '../desktop-ports.js';

function fixtureSourceToken(value: string): SourceToken {
    if (!isSourceToken(value)) {
        throw new TypeError(`Fixture source token "${value}" is not valid.`);
    }
    return value;
}

type ReportSpy = ReturnType<typeof vi.fn<(error: IErrorEvent) => Promise<void>>>;

interface IFixtureErrorService {
    readonly errorService: IErrorService;
    readonly reportSpy: ReportSpy;
}

function fixtureErrorService(): IFixtureErrorService {
    const reportSpy = vi.fn<(error: IErrorEvent) => Promise<void>>().mockResolvedValue(undefined);
    const errorService: IErrorService = { report: reportSpy };
    return { errorService, reportSpy };
}

const DIGEST = 'a'.repeat(64);

describe('createExportPort', () => {
    it('forwards the opened document real source token unchanged to saveExport (PLATFORM-01)', async () => {
        const service = new TauriPlatformService();
        const saveExportSpy = vi.spyOn(service, 'saveExport').mockResolvedValue({ status: 'saved' });
        const registerSpy = vi.spyOn(service, 'registerExportSource');

        const port = createExportPort(service, fixtureErrorService().errorService);
        const realToken = fixtureSourceToken('/Users/driver/tacho.ddd');

        const outcome = await port.save({
            bytes: new Uint8Array([1, 2, 3]),
            source: { sha256: DIGEST, sourceToken: realToken },
            suggestedName: 'report.html',
        });

        expect(outcome).toEqual({ status: 'saved' });
        expect(saveExportSpy).toHaveBeenCalledWith(expect.objectContaining({ sourceToken: realToken }));
        // Prevents replacing the real source token with a fresh token (PLATFORM-01).
        expect(registerSpy).not.toHaveBeenCalled();
    });

    it('registers a placeholder token only when no document is open (sourceToken is null)', async () => {
        const service = new TauriPlatformService();
        const placeholder = fixtureSourceToken('placeholder-token');
        const saveExportSpy = vi.spyOn(service, 'saveExport').mockResolvedValue({ status: 'saved' });
        const registerSpy = vi
            .spyOn(service, 'registerExportSource')
            .mockReturnValue({ sourceToken: placeholder, status: 'registered' });

        const port = createExportPort(service, fixtureErrorService().errorService);
        await port.save({
            bytes: new Uint8Array([1]),
            source: null,
            suggestedName: 'report.html',
        });

        expect(registerSpy).toHaveBeenCalledOnce();
        expect(saveExportSpy).toHaveBeenCalledWith(expect.objectContaining({ sourceToken: placeholder }));
    });

    it('passes the sourceConflict failure code through instead of collapsing it to a generic failure, without reporting it as an error (PLATFORM-01/04)', async () => {
        const service = new TauriPlatformService();
        vi.spyOn(service, 'saveExport').mockResolvedValue({
            code: 'sourceConflict',
            status: 'failed',
        });
        const { errorService, reportSpy } = fixtureErrorService();

        const port = createExportPort(service, errorService);
        const outcome = await port.save({
            bytes: new Uint8Array([1]),
            source: { sha256: DIGEST, sourceToken: fixtureSourceToken('/Users/driver/tacho.ddd') },
            suggestedName: 'report.html',
        });

        expect(outcome).toEqual({ code: 'sourceConflict', status: 'failed' });
        // Expected rejections are not reported as unexpected application errors.
        expect(reportSpy).not.toHaveBeenCalled();
    });

    it('passes the destinationExists failure code through instead of collapsing it to a generic failure', async () => {
        const service = new TauriPlatformService();
        vi.spyOn(service, 'saveExport').mockResolvedValue({
            code: 'destinationExists',
            status: 'failed',
        });

        const port = createExportPort(service, fixtureErrorService().errorService);
        const outcome = await port.save({
            bytes: new Uint8Array([1]),
            source: { sha256: DIGEST, sourceToken: fixtureSourceToken('/Users/driver/tacho.ddd') },
            suggestedName: 'report.html',
        });

        expect(outcome).toEqual({ code: 'destinationExists', status: 'failed' });
    });

    it('reports a typed, contextless error event for an unexpected save failure without logging the raw exception (PLATFORM-04)', async () => {
        const service = new TauriPlatformService();
        vi.spyOn(service, 'saveExport').mockResolvedValue({
            code: 'ioFailure',
            status: 'failed',
        });
        const { errorService, reportSpy } = fixtureErrorService();
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        const port = createExportPort(service, errorService);
        const outcome = await port.save({
            bytes: new Uint8Array([1]),
            source: { sha256: DIGEST, sourceToken: fixtureSourceToken('/Users/driver/tacho.ddd') },
            suggestedName: 'report.html',
        });

        expect(outcome).toEqual({ code: 'ioFailure', status: 'failed' });
        expect(reportSpy).toHaveBeenCalledWith({
            code: 'desktop.export-save-failed',
            severity: 'error',
            source: 'desktop',
        });
        expect(consoleErrorSpy).not.toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
    });
});

describe('createTextClipboardPort', () => {
    it('resolves once the underlying clipboard write actually succeeds (PLATFORM-05)', async () => {
        const service = new TauriPlatformService();
        vi.spyOn(service, 'copyTextToClipboard').mockResolvedValue({ status: 'copied' });

        const port = createTextClipboardPort(service);

        await expect(port.writeText('value')).resolves.toBeUndefined();
    });

    it('rejects instead of resolving when the underlying clipboard write fails (PLATFORM-05)', async () => {
        const service = new TauriPlatformService();
        vi.spyOn(service, 'copyTextToClipboard').mockResolvedValue({
            code: 'ioFailure',
            status: 'failed',
        });

        const port = createTextClipboardPort(service);

        // Rejection signals failure to caller to prevent false success reporting.
        await expect(port.writeText('value')).rejects.toThrow('The desktop clipboard write failed.');
    });
});
