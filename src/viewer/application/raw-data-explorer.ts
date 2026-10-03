import { err, type JsonValue, ok, type Result } from '#contracts';
import {
    decodeJsonPointerToken,
    encodeJsonPointerToken,
    isJsonPointer,
    readJsonPointerArrayIndex,
    type JsonPointer,
} from '#viewer-domain';

import { isJsonArray, isJsonRecord, resolveJsonPointer, type JsonPointerResolutionError } from './json-pointer-resolver.js';
import type { OpenedTachographDocument } from './opened-document.js';

export const rawDataChildPageSize = 100;

export type RawDataExplorationError = JsonPointerResolutionError | 'invalidPageOffset';
export type RawDataNodeKind = 'array' | 'boolean' | 'null' | 'number' | 'object' | 'string';
export type RawDataScalar = boolean | null | number | string;

export interface IRawDataNodeProjection {
    readonly childCount: number;
    readonly key: string | null;
    readonly kind: RawDataNodeKind;
    readonly pageOffset: number;
    readonly parentPath: JsonPointer | null;
    readonly path: JsonPointer;
    readonly positionInSet: number;
    readonly setSize: number;
    readonly value: RawDataScalar | null;
}

export interface IRawDataChildPage {
    readonly items: readonly IRawDataNodeProjection[];
    readonly nextOffset: number | null;
    readonly offset: number;
    readonly previousOffset: number | null;
    readonly totalCount: number;
}

export interface IRawDataExplorer {
    readonly root: IRawDataNodeProjection;
    getChildPage(path: JsonPointer, offset: number): Result<IRawDataChildPage, RawDataExplorationError>;
    getLineage(path: JsonPointer): Result<readonly IRawDataNodeProjection[], JsonPointerResolutionError>;
    nodes(): Iterable<IRawDataNodeProjection>;
}

function appendPointer(parent: JsonPointer, key: string): JsonPointer {
    const candidate = `${parent}/${encodeJsonPointerToken(key)}`;
    if (!isJsonPointer(candidate)) {
        throw new TypeError('A raw-data child path must be a canonical JSON Pointer.');
    }
    return candidate;
}

function childCount(value: JsonValue): number {
    if (isJsonArray(value)) {
        return value.length;
    }
    if (isJsonRecord(value)) {
        return Object.keys(value).length;
    }
    return 0;
}

function nodeKind(value: JsonValue): RawDataNodeKind {
    if (value === null) {
        return 'null';
    }
    if (isJsonArray(value)) {
        return 'array';
    }
    if (typeof value === 'object') {
        return 'object';
    }
    if (typeof value === 'boolean') {
        return 'boolean';
    }
    if (typeof value === 'number') {
        return 'number';
    }
    if (typeof value === 'string') {
        return 'string';
    }
    throw new TypeError('A raw-data node must contain a JSON value.');
}

function scalarValue(value: JsonValue): RawDataScalar | null {
    if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
        return value;
    }
    return null;
}

function createNode(
    value: JsonValue,
    path: JsonPointer,
    key: string | null,
    parentPath: JsonPointer | null,
    positionInSet: number,
    setSize: number,
): IRawDataNodeProjection {
    const position = Math.max(positionInSet - 1, 0);
    return {
        childCount: childCount(value),
        key,
        kind: nodeKind(value),
        pageOffset: Math.floor(position / rawDataChildPageSize) * rawDataChildPageSize,
        parentPath,
        path,
        positionInSet,
        setSize,
        value: scalarValue(value),
    };
}

function childAt(
    parent: JsonValue,
    token: string,
): Result<
    {
        readonly position: number;
        readonly setSize: number;
        readonly value: JsonValue;
    },
    JsonPointerResolutionError
> {
    if (isJsonArray(parent)) {
        const index = readJsonPointerArrayIndex(token);
        if (index === null) {
            return err('invalidArrayIndex');
        }
        const value = parent[index];
        if (value === undefined) {
            return err('missingArrayEntry');
        }
        return ok({
            position: index,
            setSize: parent.length,
            value,
        });
    }

    if (isJsonRecord(parent)) {
        if (!Object.hasOwn(parent, token)) {
            return err('missingObjectEntry');
        }
        const value = parent[token];
        if (value === undefined) {
            return err('missingObjectEntry');
        }
        return ok({
            position: Object.keys(parent).indexOf(token),
            setSize: Object.keys(parent).length,
            value,
        });
    }

    return err('scalarTraversal');
}

function childEntries(value: JsonValue, path: JsonPointer, offset: number): readonly IRawDataNodeProjection[] {
    if (isJsonArray(value)) {
        const end = Math.min(offset + rawDataChildPageSize, value.length);
        const items: IRawDataNodeProjection[] = [];
        for (let index = offset; index < end; index += 1) {
            const child = value[index];
            if (child !== undefined) {
                const key = String(index);
                items.push(createNode(child, appendPointer(path, key), key, path, index + 1, value.length));
            }
        }
        return items;
    }

    if (isJsonRecord(value)) {
        const keys = Object.keys(value);
        return keys.slice(offset, offset + rawDataChildPageSize).flatMap((key, pageIndex) => {
            const child = value[key];
            return child === undefined
                ? []
                : [createNode(child, appendPointer(path, key), key, path, offset + pageIndex + 1, keys.length)];
        });
    }

    return [];
}

function* walkNode(value: JsonValue, node: IRawDataNodeProjection): Generator<IRawDataNodeProjection> {
    yield node;

    if (isJsonArray(value)) {
        for (let index = 0; index < value.length; index += 1) {
            const child = value[index];
            if (child !== undefined) {
                const key = String(index);
                yield* walkNode(child, createNode(child, appendPointer(node.path, key), key, node.path, index + 1, value.length));
            }
        }
        return;
    }

    if (isJsonRecord(value)) {
        const keys = Object.keys(value);
        for (let index = 0; index < keys.length; index += 1) {
            const key = keys[index];
            if (key !== undefined) {
                const child = value[key];
                if (child !== undefined) {
                    yield* walkNode(
                        child,
                        createNode(child, appendPointer(node.path, key), key, node.path, index + 1, keys.length),
                    );
                }
            }
        }
    }
}

export function createRawDataExplorer(document: OpenedTachographDocument): IRawDataExplorer {
    const rootValue = document.raw;
    const rootPathCandidate = '';
    if (!isJsonPointer(rootPathCandidate)) {
        throw new TypeError('The raw-data root path must be a canonical JSON Pointer.');
    }
    const rootPath = rootPathCandidate;
    const root = createNode(rootValue, rootPath, null, null, 1, 1);

    const explorer: IRawDataExplorer = {
        getChildPage(path: JsonPointer, offset: number): Result<IRawDataChildPage, RawDataExplorationError> {
            if (!Number.isSafeInteger(offset) || offset < 0 || offset % rawDataChildPageSize !== 0) {
                return err('invalidPageOffset');
            }
            const resolved = resolveJsonPointer(rootValue, path);
            if (!resolved.ok) {
                return resolved;
            }
            if (!isJsonArray(resolved.value) && !isJsonRecord(resolved.value)) {
                return err('scalarTraversal');
            }
            const totalCount = childCount(resolved.value);
            if (offset >= totalCount && !(offset === 0 && totalCount === 0)) {
                return err('invalidPageOffset');
            }

            return ok({
                items: childEntries(resolved.value, path, offset),
                nextOffset: offset + rawDataChildPageSize < totalCount ? offset + rawDataChildPageSize : null,
                offset,
                previousOffset: offset === 0 ? null : Math.max(offset - rawDataChildPageSize, 0),
                totalCount,
            });
        },
        getLineage(path: JsonPointer): Result<readonly IRawDataNodeProjection[], JsonPointerResolutionError> {
            if (path === '') {
                return ok([root]);
            }

            const nodes: IRawDataNodeProjection[] = [root];
            const tokens = path.slice(1).split('/').map(decodeJsonPointerToken);
            let currentPath: JsonPointer = rootPath;
            let currentValue: JsonValue = rootValue;

            for (const token of tokens) {
                const child = childAt(currentValue, token);
                if (!child.ok) {
                    return child;
                }
                currentPath = appendPointer(currentPath, token);
                currentValue = child.value.value;
                nodes.push(
                    createNode(
                        currentValue,
                        currentPath,
                        token,
                        nodes.at(-1)?.path ?? rootPath,
                        child.value.position + 1,
                        child.value.setSize,
                    ),
                );
            }

            return ok(nodes);
        },
        nodes(): Iterable<IRawDataNodeProjection> {
            return walkNode(rootValue, root);
        },
        root,
    };
    return explorer;
}
