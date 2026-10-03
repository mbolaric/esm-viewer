import { decodeFileMetadata } from '#contracts';
import {
    createDocumentSource,
    createOpenedTachographDocument,
    type IParsedVehicleUnitDocument,
    type OpenedTachographDocument,
} from '#viewer-application';
import {
    createSourceReference,
    isJsonPointer,
    type ICardUse,
    type IDetailedSpeedSample,
    type IOverspeedControlData,
    type IOverspeedRecord,
    type ITachographEvent,
    type IVehicleIdentity,
    type UtcTimestamp,
    type VehicleUnitTechnicalRecord,
} from '#viewer-domain';

interface IVehicleUnitDocumentFixtureOptions {
    readonly cardUses?: readonly ICardUse[];
    readonly detailedSpeedSamples?: readonly IDetailedSpeedSample[];
    readonly displayName?: string;
    readonly events?: readonly ITachographEvent[];
    readonly identity?: IVehicleIdentity | null;
    readonly openedAt: UtcTimestamp;
    readonly overspeedControl?: IOverspeedControlData | null;
    readonly overspeedRecords?: readonly IOverspeedRecord[];
    readonly sha256?: string;
    readonly technicalRecords?: readonly VehicleUnitTechnicalRecord[];
}

export function createVehicleUnitDocumentFixture(options: IVehicleUnitDocumentFixtureOptions): OpenedTachographDocument {
    const metadata = decodeFileMetadata({
        byteLength: 3,
        displayName: options.displayName ?? 'vehicle-unit.ddd',
        sha256: options.sha256 ?? 'b'.repeat(64),
    });
    const rootPath = '';
    if (!metadata.ok || !isJsonPointer(rootPath)) {
        throw new TypeError('The Vehicle Unit document fixture must be valid.');
    }

    const emptyRecords = [] as const;
    const content: IParsedVehicleUnitDocument = {
        cardUses: [...(options.cardUses ?? [])],
        detailedSpeedSamples: [...(options.detailedSpeedSamples ?? [])],
        documentKind: 'vehicleUnit',
        companyLocks: [],
        events: [...(options.events ?? [])],
        faults: emptyRecords,
        generation: 'g2',
        identity: options.identity ?? null,
        locations: emptyRecords,
        overspeedControl: options.overspeedControl ?? null,
        overspeedRecords: [...(options.overspeedRecords ?? [])],
        parserVariant: 'vuGen2',
        verification: null,
        rawTree: {},
        rootSource: createSourceReference('vehicleUnit', 'g2', rootPath),
        sections: emptyRecords,
        technicalRecords: [...(options.technicalRecords ?? [])],
        warnings: emptyRecords,
    };

    return createOpenedTachographDocument(createDocumentSource(metadata.value, options.openedAt), content);
}
