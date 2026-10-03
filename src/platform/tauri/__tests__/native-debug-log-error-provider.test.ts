import { describe, expect, it, vi } from 'vitest';

import { NativeDebugLogErrorProvider } from '../native-debug-log-error-provider.js';

const baseRecord = {
    code: 'viewer.chart-render-failed' as const,
    occurredAt: '2026-08-16T12:00:00.000Z',
    severity: 'error' as const,
    source: 'viewer' as const,
    traceId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
};

describe('NativeDebugLogErrorProvider', () => {
    it('does nothing when no detail is given', async () => {
        const invokeFn = vi.fn().mockResolvedValue(undefined);
        const provider = new NativeDebugLogErrorProvider(invokeFn);

        await provider.report(baseRecord);

        expect(invokeFn).not.toHaveBeenCalled();
    });

    it('writes an Error detail using its stack, keyed by the event code and trace id', async () => {
        const invokeFn = vi.fn().mockResolvedValue(undefined);
        const provider = new NativeDebugLogErrorProvider(invokeFn);
        const detail = new Error('platform IPC rejected');

        await provider.report(baseRecord, detail);

        expect(invokeFn).toHaveBeenCalledWith('append_native_debug_log', {
            component: 'viewer.chart-render-failed',
            message: detail.stack,
            severity: 'error',
            traceId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
        });
    });

    it('writes a string detail verbatim', async () => {
        const invokeFn = vi.fn().mockResolvedValue(undefined);
        const provider = new NativeDebugLogErrorProvider(invokeFn);

        await provider.report(baseRecord, 'invoke: notification plugin not registered');

        expect(invokeFn).toHaveBeenCalledWith('append_native_debug_log', {
            component: 'viewer.chart-render-failed',
            message: 'invoke: notification plugin not registered',
            severity: 'error',
            traceId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
        });
    });

    it('JSON-stringifies a non-Error, non-string detail', async () => {
        const invokeFn = vi.fn().mockResolvedValue(undefined);
        const provider = new NativeDebugLogErrorProvider(invokeFn);

        await provider.report(baseRecord, { reason: 'ioFailure', retryable: false });

        expect(invokeFn).toHaveBeenCalledWith('append_native_debug_log', {
            component: 'viewer.chart-render-failed',
            message: '{"reason":"ioFailure","retryable":false}',
            severity: 'error',
            traceId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
        });
    });

    it('passes through an error-severity record', async () => {
        const invokeFn = vi.fn().mockResolvedValue(undefined);
        const provider = new NativeDebugLogErrorProvider(invokeFn);

        await provider.report(
            {
                code: 'viewer.chart-render-failed' as const,
                occurredAt: '2026-08-16T12:00:00.000Z',
                severity: 'error' as const,
                source: 'viewer' as const,
                traceId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
            },
            'detail',
        );

        expect(invokeFn).toHaveBeenCalledWith('append_native_debug_log', {
            component: 'viewer.chart-render-failed',
            message: 'detail',
            severity: 'error',
            traceId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
        });
    });

    it('contains IPC invocation failures so callers do not reject', async () => {
        const invokeFn = vi.fn().mockRejectedValue(new Error('IPC error'));
        const provider = new NativeDebugLogErrorProvider(invokeFn);

        await expect(provider.report(baseRecord, 'detail')).resolves.toBeUndefined();
    });
});
