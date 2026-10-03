import type { IErrorEvent, NativeCommandInvoker } from '#contracts';
import type { IErrorEventBase, IErrorProvider, IErrorRecord } from '#error-reporting';
import { invoke } from '@tauri-apps/api/core';
import { stringifyDetail } from './stringify-detail.js';

// Persists raw error details to native-debug.log, correlated by traceId with app.log.
export class NativeDebugLogErrorProvider<TEvent extends IErrorEventBase = IErrorEvent> implements IErrorProvider<TEvent> {
    private readonly _invoke: NativeCommandInvoker;

    public constructor(invokeFn: NativeCommandInvoker = invoke) {
        this._invoke = invokeFn;
    }

    public async report(error: IErrorRecord<TEvent>, detail?: unknown): Promise<void> {
        if (detail === undefined) {
            return;
        }

        try {
            await this._invoke('append_native_debug_log', {
                component: error.code,
                message: stringifyDetail(detail),
                severity: error.severity,
                traceId: error.traceId,
            });
        } catch {
            // Provider failures must be contained and never throw into the caller.
        }
    }
}
