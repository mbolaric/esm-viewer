// Formats an arbitrary caught value as text for local debug logging.
export function stringifyDetail(detail: unknown): string {
    if (detail instanceof Error) {
        // Prepend error header if not already present in the stack trace (e.g. WebKitGTK).
        const header = `${detail.name}: ${detail.message}`;
        if (detail.stack === undefined) {
            return header;
        }
        return detail.stack.startsWith(header) ? detail.stack : `${header}\n${detail.stack}`;
    }
    if (typeof detail === 'string') {
        return detail;
    }
    try {
        return JSON.stringify(detail);
    } catch {
        return String(detail);
    }
}
