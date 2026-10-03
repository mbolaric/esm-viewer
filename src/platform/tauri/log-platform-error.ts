import { invoke } from '@tauri-apps/api/core';
import { logBoundaryError } from '#error-reporting';
import { stringifyDetail } from './stringify-detail.js';

// Logs raw native/IPC error details to devtools and native-debug.log before mapping to typed results.
export function logPlatformError(component: string, error: unknown): void {
    logBoundaryError(component, error);
    void (async () => {
        try {
            await invoke('append_native_debug_log', {
                component,
                message: stringifyDetail(error),
            });
        } catch {
            // Best-effort - never let a logging failure affect the caller.
        }
    })();
}
