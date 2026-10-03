import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({
    invoke: invokeMock,
}));

import { logPlatformError } from '../log-platform-error.js';

describe('logPlatformError', () => {
    beforeEach(() => {
        invokeMock.mockReset();
    });

    it('logs the raw error to devtools console, keyed by component', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const error = new Error('native command unavailable');

        logPlatformError('xlsx-generation', error);

        expect(spy).toHaveBeenCalledWith('[boundary:xlsx-generation] uncaught render error', error);

        spy.mockRestore();
    });

    it('persists the raw error to native-debug.log via append_native_debug_log', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        invokeMock.mockResolvedValueOnce(undefined);
        const error = new Error('disk full');

        logPlatformError('export-save', error);
        await Promise.resolve();
        await Promise.resolve();

        expect(invokeMock).toHaveBeenCalledWith('append_native_debug_log', {
            component: 'export-save',
            message: error.stack,
        });

        vi.restoreAllMocks();
    });

    it('never throws when the native-debug write itself fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        invokeMock.mockRejectedValueOnce(new Error('IPC error'));

        expect(() => {
            logPlatformError('viewer-export', 'plain string failure');
        }).not.toThrow();
        await Promise.resolve();
        await Promise.resolve();

        vi.restoreAllMocks();
    });
});
