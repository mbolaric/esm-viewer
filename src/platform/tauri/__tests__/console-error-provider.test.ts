import { describe, expect, it, vi } from 'vitest';

import { ConsoleErrorProvider } from '../console-error-provider.js';

describe('ConsoleErrorProvider', () => {
    it('reports typed errors without logging sensitive payloads', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const provider = new ConsoleErrorProvider();

        provider.report({
            code: 'viewer.chart-render-failed',
            occurredAt: '2026-08-16T12:00:00.000Z',
            severity: 'error',
            source: 'viewer',
            traceId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
        });

        expect(spy).toHaveBeenCalledWith(
            '[tauri-viewer] 2026-08-16T12:00:00.000Z [error] viewer.chart-render-failed trace=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
        );

        provider.report({
            code: 'translation.missing-key',
            context: { key: 'sample.key' },
            occurredAt: '2026-08-16T12:00:00.000Z',
            severity: 'error',
            source: 'translation',
            traceId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
        });

        expect(spy).toHaveBeenCalledWith(
            '[tauri-viewer] 2026-08-16T12:00:00.000Z [error] translation.missing-key (sample.key) trace=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
        );

        spy.mockRestore();
    });

    it('logs the raw detail as its own line when the caller gives one', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const provider = new ConsoleErrorProvider();
        const rawError = new Error('platform IPC rejected');

        provider.report(
            {
                code: 'viewer.chart-render-failed',
                occurredAt: '2026-08-16T12:00:00.000Z',
                severity: 'error',
                source: 'viewer',
                traceId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
            },
            rawError,
        );

        expect(spy).toHaveBeenCalledWith('[tauri-viewer] trace=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4 detail:', rawError);

        spy.mockRestore();
    });

    it('does not log a second line when no detail is given', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const provider = new ConsoleErrorProvider();

        provider.report({
            code: 'viewer.chart-render-failed',
            occurredAt: '2026-08-16T12:00:00.000Z',
            severity: 'error',
            source: 'viewer',
            traceId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
        });

        expect(spy).toHaveBeenCalledTimes(1);

        spy.mockRestore();
    });
});
