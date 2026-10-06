import { isJsonPointer, type JsonPointer } from '#viewer-domain';
import type { IRawDataExplorerViewModel, IRawDataNodeViewModel } from '#viewer-presentation';
import { render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import RawDataScreen from '../components/screens/RawDataScreen.svelte';
import { createViewerTestRenderOptions } from './viewer-test-render.js';

function pointer(value: string): JsonPointer {
    if (!isJsonPointer(value)) {
        throw new TypeError('The raw-data screen pointer fixture must be valid.');
    }
    return value;
}

function scalarNode(key: string, path: JsonPointer, position: number): IRawDataNodeViewModel {
    return {
        childCount: {
            display: '0',
            value: 0,
        },
        clipboardValue: key,
        displayValue: JSON.stringify(key),
        key,
        kind: 'string',
        pageOffset: 0,
        parentPath: pointer(''),
        path,
        positionInSet: position,
        searchValues: [key],
        setSize: 2,
    };
}

function explorer(): IRawDataExplorerViewModel {
    const first = scalarNode('a', pointer('/a'), 1);
    const second = scalarNode('b', pointer('/b'), 2);
    const root: IRawDataNodeViewModel = {
        childCount: {
            display: '2',
            value: 2,
        },
        clipboardValue: null,
        displayValue: null,
        key: null,
        kind: 'object',
        pageOffset: 0,
        parentPath: null,
        path: pointer(''),
        positionInSet: 1,
        searchValues: ['root'],
        setSize: 1,
    };

    return {
        getChildPage: (path) => {
            if (path !== '') {
                return { error: 'scalarTraversal', ok: false };
            }
            return {
                ok: true,
                value: {
                    items: [first, second],
                    nextOffset: null,
                    offset: 0,
                    previousOffset: null,
                    totalCount: {
                        display: '2',
                        value: 2,
                    },
                },
            };
        },
        getLineage: (path) => {
            if (path === '') {
                return { ok: true, value: [root] };
            }
            const node = [first, second].find((candidate) => candidate.path === path);
            return node === undefined ? { error: 'missingObjectEntry', ok: false } : { ok: true, value: [root, node] };
        },
        nodes: function* () {
            yield root;
            yield first;
            yield second;
        },
        root,
    };
}

function selectedPath(): string | null {
    const text = document.querySelector('.pointer-path-cell code')?.textContent ?? null;
    return text === null ? null : text.trim();
}

describe('RawDataScreen', () => {
    it('re-reveals a new source request without remounting the tree', async () => {
        const oncopy = vi.fn(() => Promise.resolve(true));
        const rendered = render(
            RawDataScreen,
            {
                props: {
                    explorer: explorer(),
                    initialPath: pointer('/a'),
                    oncopy,
                },
            },
            createViewerTestRenderOptions(),
        );
        expect(selectedPath()).toBe('/a');

        await rendered.rerender({
            explorer: explorer(),
            initialPath: pointer('/b'),
            oncopy,
        });
        expect(selectedPath()).toBe('/b');
    });
});
