import type { IRawDataExplorerViewModel, IRawDataNodeViewModel } from '#viewer-presentation';
import { rawDataChildPageSize } from '#viewer-application';
import { isJsonPointer, type JsonPointer } from '#viewer-domain';
import { describe, expect, it } from 'vitest';

import { RawDataController } from '../controllers/raw-data-controller.svelte.js';

const maximumRawDataFindMatches = 500;

function pointer(value: string): JsonPointer {
    if (!isJsonPointer(value)) {
        throw new TypeError('The raw-data controller pointer fixture must be valid.');
    }
    return value;
}

function scalarNode(index: number, setSize: number, searchValue?: string): IRawDataNodeViewModel {
    const value = searchValue ?? `match-${String(index)}`;
    return {
        childCount: {
            display: '0',
            value: 0,
        },
        clipboardValue: value,
        displayValue: JSON.stringify(value),
        key: String(index),
        kind: 'string',
        pageOffset: Math.floor(index / rawDataChildPageSize) * rawDataChildPageSize,
        parentPath: pointer(''),
        path: pointer(`/${String(index)}`),
        positionInSet: index + 1,
        searchValues: [value],
        setSize,
    };
}

function explorerWithMatches(matchCount: number, searchValues?: readonly string[]): IRawDataExplorerViewModel {
    const nodes = Array.from({ length: matchCount }, (_, index) => scalarNode(index, matchCount, searchValues?.[index]));
    const root: IRawDataNodeViewModel = {
        childCount: {
            display: String(matchCount),
            value: matchCount,
        },
        clipboardValue: null,
        displayValue: null,
        key: null,
        kind: 'array',
        pageOffset: 0,
        parentPath: null,
        path: pointer(''),
        positionInSet: 1,
        searchValues: ['root'],
        setSize: 1,
    };

    return {
        getChildPage: (path, offset) => {
            if (path !== '') {
                return { error: 'scalarTraversal', ok: false };
            }
            if (offset < 0 || offset % rawDataChildPageSize !== 0 || offset >= matchCount) {
                return { error: 'invalidPageOffset', ok: false };
            }
            return {
                ok: true,
                value: {
                    items: nodes.slice(offset, offset + rawDataChildPageSize),
                    nextOffset: offset + rawDataChildPageSize < matchCount ? offset + rawDataChildPageSize : null,
                    offset,
                    previousOffset: offset === 0 ? null : offset - rawDataChildPageSize,
                    totalCount: {
                        display: String(matchCount),
                        value: matchCount,
                    },
                },
            };
        },
        getLineage: (path) => {
            if (path === '') {
                return { ok: true, value: [root] };
            }
            const node = nodes.find((candidate) => candidate.path === path);
            return node === undefined ? { error: 'missingArrayEntry', ok: false } : { ok: true, value: [root, node] };
        },
        nodes: function* () {
            yield root;
            yield* nodes;
        },
        root,
    };
}

describe('RawDataController', () => {
    it('reveals a canonical source in its bounded child page', () => {
        const explorer = explorerWithMatches(501);
        const controller = new RawDataController(explorer, pointer('/450'));

        expect(controller.snapshot.error).toBeNull();
        expect(controller.snapshot.selectedNode.path).toBe('/450');
        expect(controller.snapshot.visibleItems.some((item) => item.itemType === 'node' && item.node.path === '/450')).toBe(true);
        expect(controller.snapshot.visibleItems.some((item) => item.itemType === 'node' && item.node.path === '/50')).toBe(false);

        expect(controller.collapseAll().visibleItems).toHaveLength(1);
        expect(
            controller.expandOneLevel().visibleItems.some((item) => item.itemType === 'node' && item.node.path === '/400'),
        ).toBe(true);
    });

    it('bounds broad searches and supports refinement to later evidence', () => {
        const controller = new RawDataController(explorerWithMatches(maximumRawDataFindMatches + 1));

        expect(controller.find('match').find).toEqual({
            currentMatchNumber: 1,
            matchCount: maximumRawDataFindMatches,
            query: 'match',
            truncated: true,
        });
        expect(controller.find('match-500')).toMatchObject({
            find: {
                currentMatchNumber: 1,
                matchCount: 1,
                truncated: false,
            },
            selectedNode: {
                path: '/500',
            },
        });
    });

    it('matches folded diacritics the same way every table does', () => {
        const controller = new RawDataController(explorerWithMatches(2, ['Čačić', 'Bjørn Straße']));

        expect(controller.find('cacic').find.matchCount).toBe(1);
        expect(controller.find('bjorn').find.matchCount).toBe(1);
        expect(controller.find('  BJORN STRASSE  ')).toMatchObject({
            find: {
                currentMatchNumber: 1,
                matchCount: 1,
            },
            selectedNode: {
                path: '/1',
            },
        });
    });

    it('ignores a repeated reveal request for the path it already revealed', () => {
        const controller = new RawDataController(explorerWithMatches(3), pointer('/2'));
        expect(controller.snapshot.selectedNode.path).toBe('/2');

        controller.collapseAll();
        expect(controller.snapshot.visibleItems).toHaveLength(1);

        // The same request must not re-expand the tree the user folded away.
        controller.revealRequest(pointer('/2'));
        expect(controller.snapshot.visibleItems).toHaveLength(1);

        // A different request still re-points the tree.
        expect(controller.revealRequest(pointer('/1')).selectedNode.path).toBe('/1');
    });

    it('reports a missing requested source instead of guessing a path', () => {
        const controller = new RawDataController(explorerWithMatches(2), pointer('/9'));

        expect(controller.snapshot).toMatchObject({
            error: 'missingArrayEntry',
            requestedPath: '/9',
            selectedNode: {
                path: '',
            },
        });
    });
});
