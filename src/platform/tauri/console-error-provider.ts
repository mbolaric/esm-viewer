import type { IErrorEvent } from '#contracts';
import { isUnknownRecord } from '#contracts';
import type { IErrorEventBase, IErrorProvider, IErrorRecord } from '#error-reporting';

export class ConsoleErrorProvider<TEvent extends IErrorEventBase = IErrorEvent> implements IErrorProvider<TEvent> {
    public report(error: IErrorRecord<TEvent>, detail?: unknown): void {
        // Privacy-safe: logs code and timestamp; raw detail is kept only in local console.
        const context: unknown = 'context' in error ? error.context : undefined;
        const suffix =
            error.code === 'translation.missing-key' && isUnknownRecord(context) && typeof context['key'] === 'string'
                ? ` (${context['key']})`
                : '';
        console.error(`[tauri-viewer] ${error.occurredAt} [${error.severity}] ${error.code}${suffix} trace=${error.traceId}`);

        if (detail !== undefined) {
            console.error(`[tauri-viewer] trace=${error.traceId} detail:`, detail);
        }
    }
}
