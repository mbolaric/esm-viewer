import { encodeJsonPointerToken, isJsonPointer, type JsonPointer } from '#viewer-domain';

export function createJsonPointer(tokens: readonly (number | string)[]): JsonPointer {
    const value = tokens.length === 0 ? '' : `/${tokens.map((token) => encodeJsonPointerToken(String(token))).join('/')}`;

    if (!isJsonPointer(value)) {
        throw new Error('Failed to create a canonical JSON Pointer.');
    }

    return value;
}
