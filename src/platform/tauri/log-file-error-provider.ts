import { decodeErrorEvent, type IErrorEvent, type NativeCommandInvoker, type Result } from '#contracts';
import type { IErrorEventBase, IErrorProvider, IErrorRecord } from '#error-reporting';
import { invoke } from '@tauri-apps/api/core';

export class LogFileErrorProvider<TEvent extends IErrorEventBase = IErrorEvent> implements IErrorProvider<TEvent> {
    private readonly _invoke: NativeCommandInvoker;
    private readonly _decodeEvent: ((value: unknown) => Result<TEvent, unknown>) | undefined;

    public constructor(invokeFn: NativeCommandInvoker = invoke, decodeEvent?: (value: unknown) => Result<TEvent, unknown>) {
        this._invoke = invokeFn;
        this._decodeEvent = decodeEvent;
    }

    // Omits `detail` intentionally: raw error text must not be persisted to exportable app.log.
    public async report(error: IErrorRecord<TEvent>): Promise<void> {
        try {
            const { occurredAt, traceId, ...eventPayload } = error;
            const decoded = this._decodeEvent === undefined ? decodeErrorEvent(eventPayload) : this._decodeEvent(eventPayload);
            if (!decoded.ok) {
                return;
            }

            await this._invoke('report_error_event', {
                event: { ...decoded.value, occurredAt, traceId },
            });
        } catch {
            // Provider failures must be contained and never throw into the caller.
        }
    }
}
