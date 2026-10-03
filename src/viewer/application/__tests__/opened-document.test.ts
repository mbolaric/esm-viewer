import { decodeFileMetadata } from '#contracts';
import { createSourceReference, isJsonPointer, isUtcTimestamp } from '#viewer-domain';
import { describe, expect, it } from 'vitest';

import {
    createDocumentSource,
    createOpenedTachographDocument,
    type IDocumentSource,
    type IParsedDriverCardDocument,
    type IParsedVehicleUnitDocument,
} from '../index.js';

function documentSource(): IDocumentSource {
    const metadata = decodeFileMetadata({
        byteLength: 512,
        displayName: 'synthetic.ddd',
        sha256: 'a'.repeat(64),
    });
    const openedAt = Date.UTC(2026, 6, 27);
    if (!metadata.ok || !isUtcTimestamp(openedAt)) {
        throw new TypeError('The opened-document fixture must be valid.');
    }

    return createDocumentSource(metadata.value, openedAt);
}

describe('createOpenedTachographDocument', () => {
    it('opens driver-card content with implemented capabilities and unchecked integrity', () => {
        const content: IParsedDriverCardDocument = {
            applications: [],
            cardType: 'driverCard',
            documentKind: 'driverCard',
            generation: 'g1',
            parserVariant: 'cardGen1',
            rawTree: {},
            sections: [],
        };

        const document = createOpenedTachographDocument(documentSource(), content);

        expect(document).toMatchObject({
            capabilities: {
                applicable: [
                    'identity',
                    'activities',
                    'vehicles',
                    'places',
                    'events',
                    'faults',
                    'controlActivities',
                    'specificConditions',
                    'technicalData',
                ],
                documentKind: 'driverCard',
            },
            content,
            integrity: {
                reason: 'notRequested',
                status: 'notChecked',
            },
        });
        expect(document.raw).toBe(content.rawTree);
    });

    it('opens vehicle-unit content with supported normalized capabilities', () => {
        const rootPath = '';
        if (!isJsonPointer(rootPath)) {
            throw new TypeError('The root JSON Pointer fixture must be valid.');
        }
        const emptyRecords = [] as const;
        const content: IParsedVehicleUnitDocument = {
            cardUses: emptyRecords,
            detailedSpeedSamples: emptyRecords,
            documentKind: 'vehicleUnit',
            companyLocks: emptyRecords,
            events: emptyRecords,
            faults: emptyRecords,
            generation: 'g2',
            overspeedControl: null,
            overspeedRecords: emptyRecords,

            identity: null,
            locations: emptyRecords,
            parserVariant: 'vuGen2',
            verification: null,
            rawTree: {},
            rootSource: createSourceReference('vehicleUnit', 'g2', rootPath),
            sections: emptyRecords,
            technicalRecords: emptyRecords,
            warnings: emptyRecords,
        };

        const document = createOpenedTachographDocument(documentSource(), content);

        expect(document).toMatchObject({
            capabilities: {
                applicable: [
                    'identity',
                    'drivers',
                    'positions',
                    'events',
                    'faults',
                    'calibrations',
                    'detailedSpeed',
                    'downloadHistory',
                    'technicalData',
                ],
                documentKind: 'vehicleUnit',
            },
            content,
            integrity: {
                reason: 'notRequested',
                status: 'notChecked',
            },
        });
        expect(document.raw).toBe(content.rawTree);
    });
});
