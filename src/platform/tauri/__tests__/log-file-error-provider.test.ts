import { describe, expect, it, vi } from 'vitest';

import { LogFileErrorProvider } from '../log-file-error-provider.js';

describe('LogFileErrorProvider', () => {
    it('invokes report_error_event with the error record', async () => {
        const invokeFn = vi.fn().mockResolvedValue(undefined);
        const provider = new LogFileErrorProvider(invokeFn);

        await provider.report({
            code: 'viewer.chart-render-failed',
            occurredAt: '2026-08-16T12:00:00.000Z',
            severity: 'error',
            source: 'viewer',
            traceId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
        });

        expect(invokeFn).toHaveBeenCalledWith('report_error_event', {
            event: {
                code: 'viewer.chart-render-failed',
                occurredAt: '2026-08-16T12:00:00.000Z',
                severity: 'error',
                source: 'viewer',
                traceId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
            },
        });
    });

    it('contains IPC invocation failures so callers do not reject', async () => {
        const invokeFn = vi.fn().mockRejectedValue(new Error('IPC error'));
        const provider = new LogFileErrorProvider(invokeFn);

        await expect(
            provider.report({
                code: 'viewer.chart-render-failed',
                occurredAt: '2026-08-16T12:00:00.000Z',
                severity: 'error',
                source: 'viewer',
                traceId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
            }),
        ).resolves.toBeUndefined();
    });
});
