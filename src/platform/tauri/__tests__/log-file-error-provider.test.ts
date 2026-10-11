import { describe, expect, it, vi } from 'vitest';

import { ERROR_CODES, type IErrorEvent } from '#contracts';
import { LogFileErrorProvider } from '../log-file-error-provider.js';

describe('LogFileErrorProvider', () => {
    it.each<IErrorEvent>([
        { code: ERROR_CODES.chartRenderFailed, severity: 'error', source: 'viewer' },
        { code: ERROR_CODES.menuStateSyncFailed, severity: 'error', source: 'desktop' },
    ])('invokes report_error_event with the $code error record', async (event) => {
        const invokeFn = vi.fn().mockResolvedValue(undefined);
        const provider = new LogFileErrorProvider(invokeFn);
        const record = {
            ...event,
            occurredAt: '2026-08-16T12:00:00.000Z',
            traceId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
        };

        await provider.report(record);

        expect(invokeFn).toHaveBeenCalledWith('report_error_event', { event: record });
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
