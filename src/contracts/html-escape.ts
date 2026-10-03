// Escapes the five HTML-significant characters for export templates.
export function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/gu, (character) => {
        switch (character) {
            case '&':
                return '&amp;';
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '"':
                return '&quot;';
            default:
                return '&#39;';
        }
    });
}
