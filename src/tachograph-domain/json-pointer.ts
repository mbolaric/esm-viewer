declare const jsonPointerBrand: unique symbol;

export type JsonPointer = string & {
    readonly [jsonPointerBrand]: 'JsonPointer';
};

const invalidEscapePattern = /~(?:[^01]|$)/u;

export function isJsonPointer(value: unknown): value is JsonPointer {
    return typeof value === 'string' && (value.length === 0 || (value.startsWith('/') && !invalidEscapePattern.test(value)));
}

const arrayIndexPattern = /^(?:0|[1-9]\d*)$/u;

// RFC 6901 §4: encodes ~ and / in a reference token.
export function encodeJsonPointerToken(token: string): string {
    return token.replaceAll('~', '~0').replaceAll('/', '~1');
}

// RFC 6901 §4: decodes ~1 and ~0 escapes in order.
export function decodeJsonPointerToken(token: string): string {
    return token.replaceAll('~1', '/').replaceAll('~0', '~');
}

// Parses reference token as an RFC 6901 array index.
export function readJsonPointerArrayIndex(token: string): number | null {
    if (!arrayIndexPattern.test(token)) {
        return null;
    }

    const index = Number(token);
    return Number.isSafeInteger(index) ? index : null;
}
