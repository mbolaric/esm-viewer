import { decodeFileMetadata, type IJsonRecord } from '#contracts';
import { createSourceReference, isJsonPointer, isUtcTimestamp, type JsonPointer } from '#viewer-domain';
import { describe, expect, it } from 'vitest';

import {
    createDocumentSource,
    createOpenedTachographDocument,
    createRawDataExplorer,
    rawDataChildPageSize,
    type IParsedVehicleUnitDocument,
    type OpenedTachographDocument,
} from '../index.js';

function pointer(value: string): JsonPointer {
    if (!isJsonPointer(value)) {
        throw new TypeError('The raw-data pointer fixture must be valid.');
    }
    return value;
}

function openedDocument(rawTree: IJsonRecord): OpenedTachographDocument {
    const metadata = decodeFileMetadata({
        byteLength: 3,
        displayName: 'raw-data.ddd',
        sha256: 'c'.repeat(64),
    });
    const openedAtCandidate = Date.UTC(2026, 6, 28);
    const rootPath = pointer('/vehicleUnit');
    if (!metadata.ok || !isUtcTimestamp(openedAtCandidate)) {
        throw new TypeError('The raw-data document fixture must be valid.');
    }
    const content: IParsedVehicleUnitDocument = {
        cardUses: [],
        detailedSpeedSamples: [],
        documentKind: 'vehicleUnit',
        companyLocks: [],
        events: [],
        faults: [],
        generation: 'g1',
        overspeedControl: null,
        overspeedRecords: [],

        identity: null,
        locations: [],
        parserVariant: 'vuGen1',
        verification: null,
        rawTree,
        rootSource: createSourceReference('vehicleUnit', 'g1', rootPath),
        sections: [],
        technicalRecords: [],
        warnings: [],
    };
    return createOpenedTachographDocument(createDocumentSource(metadata.value, openedAtCandidate), content);
}

describe('raw-data explorer', () => {
    it('projects canonical escaped paths and exact scalar evidence', () => {
        const explorer = createRawDataExplorer(
            openedDocument({
                'a/b': {
                    '~key': ['first', { value: 42 }],
                },
            }),
        );
        const lineage = explorer.getLineage(pointer('/a~1b/~0key/1/value'));

        expect(lineage.ok).toBe(true);
        if (!lineage.ok) {
            return;
        }
        expect(lineage.value.map((node) => node.path)).toEqual([
            '',
            '/a~1b',
            '/a~1b/~0key',
            '/a~1b/~0key/1',
            '/a~1b/~0key/1/value',
        ]);
        expect(lineage.value.at(-1)).toMatchObject({
            childCount: 0,
            key: 'value',
            kind: 'number',
            value: 42,
        });
        expect([...explorer.nodes()].map((node) => node.path)).toContain('/a~1b/~0key/0');
    });

    it('pages large branches without materializing every child for display', () => {
        const entries = Array.from({ length: rawDataChildPageSize * 2 + 5 }, (_, index) => index);
        const explorer = createRawDataExplorer(openedDocument({ entries }));

        const first = explorer.getChildPage(pointer('/entries'), 0);
        const second = explorer.getChildPage(pointer('/entries'), rawDataChildPageSize);
        const third = explorer.getChildPage(pointer('/entries'), rawDataChildPageSize * 2);

        expect(first).toMatchObject({
            ok: true,
            value: {
                items: { length: rawDataChildPageSize },
                nextOffset: rawDataChildPageSize,
                previousOffset: null,
                totalCount: rawDataChildPageSize * 2 + 5,
            },
        });
        expect(second).toMatchObject({
            ok: true,
            value: {
                items: { length: rawDataChildPageSize },
                nextOffset: rawDataChildPageSize * 2,
                previousOffset: 0,
            },
        });
        expect(third).toMatchObject({
            ok: true,
            value: {
                items: { length: 5 },
                nextOffset: null,
                previousOffset: rawDataChildPageSize,
            },
        });
    });

    it('reports invalid paging and unresolved source paths explicitly', () => {
        const explorer = createRawDataExplorer(openedDocument({ value: 'evidence' }));

        expect(explorer.getChildPage(pointer('/value'), 0)).toEqual({
            error: 'scalarTraversal',
            ok: false,
        });
        expect(explorer.getChildPage(pointer(''), 1)).toEqual({
            error: 'invalidPageOffset',
            ok: false,
        });
        expect(explorer.getLineage(pointer('/missing'))).toEqual({
            error: 'missingObjectEntry',
            ok: false,
        });
    });
});
