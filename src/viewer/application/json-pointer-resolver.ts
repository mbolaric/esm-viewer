import { err, type IJsonRecord, type JsonValue, ok, type Result } from '#contracts';
import { decodeJsonPointerToken, readJsonPointerArrayIndex, type JsonPointer } from '#viewer-domain';

export type JsonPointerResolutionError = 'invalidArrayIndex' | 'missingArrayEntry' | 'missingObjectEntry' | 'scalarTraversal';

export function isJsonRecord(value: JsonValue): value is IJsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isJsonArray(value: JsonValue): value is readonly JsonValue[] {
    return Array.isArray(value);
}

export function resolveJsonPointer(root: JsonValue, pointer: JsonPointer): Result<JsonValue, JsonPointerResolutionError> {
    if (pointer === '') {
        return ok(root);
    }

    let current = root;
    const tokens = pointer.slice(1).split('/').map(decodeJsonPointerToken);

    for (const token of tokens) {
        if (isJsonArray(current)) {
            const index = readJsonPointerArrayIndex(token);
            if (index === null) {
                return err('invalidArrayIndex');
            }

            const entry = current[index];
            if (entry === undefined) {
                return err('missingArrayEntry');
            }
            current = entry;
            continue;
        }

        if (isJsonRecord(current)) {
            if (!Object.hasOwn(current, token)) {
                return err('missingObjectEntry');
            }

            const entry = current[token];
            if (entry === undefined) {
                return err('missingObjectEntry');
            }
            current = entry;
            continue;
        }

        return err('scalarTraversal');
    }

    return ok(current);
}
