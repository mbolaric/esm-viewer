import { decodeFileMetadata } from '#contracts';
import {
    createSourceReference,
    isJsonPointer,
    isUtcTimestamp,
    type ISourceReference,
    type TachographGeneration,
    type UtcTimestamp,
    type VerificationGeneration,
} from '#viewer-domain';
import { describe, expect, it } from 'vitest';

import {
    createDocumentIntegrityProjection,
    createDocumentSource,
    createOpenedTachographDocument,
    type IDriverCardApplication,
    type IParsedDriverCardDocument,
    type OpenedTachographDocument,
} from '../index.js';

function timestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The integrity projection timestamp fixture must be valid.');
    }
    return value;
}

function cardSource<TGeneration extends TachographGeneration>(
    generation: TGeneration,
    path: string,
): ISourceReference<TGeneration, 'driverCard'> {
    if (!isJsonPointer(path)) {
        throw new TypeError('The integrity projection source fixture must be valid.');
    }
    return createSourceReference('driverCard', generation, path);
}

function application(
    applicationGeneration: TachographGeneration,
    verificationGeneration: VerificationGeneration,
    path: string,
): IDriverCardApplication {
    return {
        activityDays: [],
        cardNotes: null,
        events: [],
        faults: [],
        generation: applicationGeneration,
        identity: null,
        locations: [],
        source: cardSource(applicationGeneration, path),
        technicalRecords: [],
        verification: {
            dataFiles: {},
            dataFileSourcePaths: {},
            generation: verificationGeneration,
        },
        vehicleUses: [],
        vehicleUnitUses: [],
        warnings: [],
    };
}

function combinedDocument(): OpenedTachographDocument {
    const metadata = decodeFileMetadata({
        byteLength: 3,
        displayName: 'combined.ddd',
        sha256: 'c'.repeat(64),
    });
    if (!metadata.ok) {
        throw new TypeError('The integrity projection metadata fixture must be valid.');
    }

    const content: IParsedDriverCardDocument = {
        applications: [application('g1', 'g1', '/cardDataResponses/gen1'), application('g2v2', 'g2', '/cardDataResponses/gen2')],
        cardType: 'driverCard',
        documentKind: 'driverCard',
        generation: 'combined',
        parserVariant: 'cardGen2',
        rawTree: {},
        sections: [],
    };
    const opened = createOpenedTachographDocument(
        createDocumentSource(metadata.value, timestamp(Date.UTC(2026, 6, 28))),
        content,
    );

    return {
        ...opened,
        integrity: {
            items: [
                {
                    generation: 'g1',
                    recordId: 'CardDownload',
                    source: cardSource('g1', '/cardDataResponses/gen1/cardDownload'),
                    status: 'valid',
                },
                {
                    generation: 'g2',
                    recordId: 'ApplicationIdentification',
                    source: cardSource('g2', '/cardDataResponses/gen2/identification'),
                    status: 'invalid',
                },
            ],
            status: 'partiallyValid',
        },
    };
}

describe('createDocumentIntegrityProjection', () => {
    it('keeps combined-card generations, item results, and scope assessments separate', () => {
        const projection = createDocumentIntegrityProjection(combinedDocument());

        expect(projection.counts).toEqual({
            checkedItems: 2,
            invalidItems: 1,
            validItems: 1,
        });
        expect(projection.items.map((item) => item.recordId)).toEqual(['CardDownload', 'ApplicationIdentification']);
        expect(projection.scopes).toMatchObject([
            {
                applicationGeneration: 'g1',
                assessment: {
                    items: [{ recordId: 'CardDownload', status: 'valid' }],
                    status: 'valid',
                },
                source: {
                    path: '/cardDataResponses/gen1',
                },
                verificationGeneration: 'g1',
            },
            {
                applicationGeneration: 'g2v2',
                assessment: {
                    items: [{ recordId: 'ApplicationIdentification', status: 'invalid' }],
                    status: 'invalid',
                },
                source: {
                    path: '/cardDataResponses/gen2',
                },
                verificationGeneration: 'g2',
            },
        ]);
    });

    it('does not invent checked evidence for a document that was not verified', () => {
        const document = combinedDocument();
        const uncheckedDocument: OpenedTachographDocument = {
            ...document,
            integrity: {
                reason: 'notRequested',
                status: 'notChecked',
            },
        };
        const projection = createDocumentIntegrityProjection(uncheckedDocument);

        expect(projection.counts.checkedItems).toBe(0);
        expect(projection.items).toEqual([]);
        expect(projection.scopes.map((scope) => scope.assessment)).toEqual([null, null]);
    });
});
