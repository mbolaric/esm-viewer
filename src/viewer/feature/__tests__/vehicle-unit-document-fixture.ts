import { decodeFileMetadata } from '#contracts';
import {
    createDocumentSource,
    createOpenedTachographDocument,
    type IDocumentSource,
    type IParsedVehicleUnitDocument,
    type OpenedTachographDocument,
} from '#viewer-application';
import { createSourceReference, isJsonPointer, type UtcTimestamp } from '#viewer-domain';

// Minimal vehicle-unit document fixture for export and report testing.
export function vehicleUnitDocumentFixture(
    displayName: string,
    sha256: string,
    openedAt: UtcTimestamp,
): OpenedTachographDocument {
    const metadata = decodeFileMetadata({ byteLength: 1024, displayName, sha256 });
    const rootPath = '';
    if (!metadata.ok || !isJsonPointer(rootPath)) {
        throw new TypeError('The vehicle-unit document fixture metadata must be valid.');
    }

    const source: IDocumentSource = createDocumentSource(metadata.value, openedAt);
    const emptyRecords = [] as const;
    const content: IParsedVehicleUnitDocument = {
        cardUses: emptyRecords,
        detailedSpeedSamples: emptyRecords,
        documentKind: 'vehicleUnit',
        companyLocks: emptyRecords,
        events: emptyRecords,
        faults: emptyRecords,
        generation: 'g2',
        identity: null,
        locations: emptyRecords,
        overspeedControl: null,
        overspeedRecords: emptyRecords,
        parserVariant: 'vuGen2',
        verification: null,
        rawTree: {},
        rootSource: createSourceReference('vehicleUnit', 'g2', rootPath),
        sections: emptyRecords,
        technicalRecords: emptyRecords,
        warnings: emptyRecords,
    };

    return createOpenedTachographDocument(source, content);
}
