import type { IJsonRecord, ParserOutputVariant } from '#contracts';
import {
    createDocumentCapabilities,
    type CardGeneration,
    type DriverCardTechnicalRecord,
    type DriverCardCapability,
    type IActivityDay,
    type ICardNotes,
    type ICardUse,
    type IDocumentCapabilities,
    type IDriverIdentity,
    type IDetailedSpeedSample,
    type ISourceReference,
    type ITachographEvent,
    type ITachographFault,
    type TachographLocationRecord,
    type ITachographWarning,
    type IVehicleUnitUse,
    type IVehicleUse,
    type IVehicleIdentity,
    type IOverspeedControlData,
    type IOverspeedRecord,
    type IntegrityAssessment,
    type JsonPointer,
    type TachographGeneration,
    type VehicleUnitTechnicalRecord,
    type VehicleUnitCapability,
    type VerificationGeneration,
} from '#viewer-domain';

import type { IDocumentSource } from './document-source.js';

export type ParsedCardType = 'companyCard' | 'controlCard' | 'driverCard' | 'unsupportedCard' | 'workshopCard';

export type NormalizedSectionKind =
    | 'activities'
    | 'calibration'
    | 'companyLocks'
    | 'conditions'
    | 'controls'
    | 'currentUsage'
    | 'downloads'
    | 'events'
    | 'faults'
    | 'identity'
    | 'places'
    | 'positions'
    | 'speed'
    | 'technicalData'
    | 'vehicles';

export interface INormalizedDocumentSection {
    readonly kind: NormalizedSectionKind;
    readonly source: ISourceReference;
}

export interface ICardVerificationApplication {
    readonly dataFiles: IJsonRecord;
    readonly dataFileSourcePaths: Readonly<Record<string, JsonPointer>>;
    readonly generation: VerificationGeneration;
}

// Raw certificate byte arrays, data files, and source pointers for VU verification.
export interface IVuVerificationApplication {
    readonly dataFiles: readonly unknown[];
    readonly dataFileSourcePaths: Readonly<Record<string, JsonPointer>>;
    readonly generation: VerificationGeneration;
    readonly memberStateCertificateRaw: readonly number[];
    readonly memberStateCertificateSourcePath: JsonPointer;
    readonly vuCertificateRaw: readonly number[];
    readonly vuCertificateSourcePath: JsonPointer;
}

export interface IDriverCardApplication {
    readonly activityDays: readonly IActivityDay[];
    readonly cardNotes: ICardNotes | null;
    readonly events: readonly ITachographEvent[];
    readonly faults: readonly ITachographFault[];
    readonly generation: TachographGeneration;
    readonly identity: IDriverIdentity | null;
    readonly locations: readonly TachographLocationRecord[];
    readonly source: ISourceReference<TachographGeneration, 'driverCard'>;
    readonly technicalRecords: readonly DriverCardTechnicalRecord[];
    readonly verification: ICardVerificationApplication;
    readonly vehicleUses: readonly IVehicleUse[];
    readonly vehicleUnitUses: readonly IVehicleUnitUse[];
    readonly warnings: readonly ITachographWarning[];
}

interface IParsedDocumentBase {
    readonly generation: CardGeneration;
    readonly parserVariant: ParserOutputVariant;
    readonly rawTree: IJsonRecord;
}

export interface IParsedDriverCardDocument extends IParsedDocumentBase {
    readonly applications: readonly IDriverCardApplication[];
    readonly cardType: 'driverCard';
    readonly documentKind: 'driverCard';
    readonly sections: readonly INormalizedDocumentSection[];
}

export interface IParsedUnsupportedCardDocument extends IParsedDocumentBase {
    readonly cardType: Exclude<ParsedCardType, 'driverCard'>;
    readonly contentPath: JsonPointer;
    readonly documentKind: 'unsupportedCard';
}

export interface IParsedVehicleUnitDocument extends IParsedDocumentBase {
    readonly cardUses: readonly ICardUse[];
    readonly companyLocks: readonly VehicleUnitTechnicalRecord[];
    readonly detailedSpeedSamples: readonly IDetailedSpeedSample[];
    readonly documentKind: 'vehicleUnit';
    readonly events: readonly ITachographEvent[];
    readonly faults: readonly ITachographFault[];
    readonly generation: TachographGeneration;
    readonly identity: IVehicleIdentity | null;
    readonly locations: readonly TachographLocationRecord[];
    readonly overspeedControl: IOverspeedControlData | null;
    readonly overspeedRecords: readonly IOverspeedRecord[];
    readonly parserVariant: Extract<ParserOutputVariant, 'vuGen1' | 'vuGen2'>;
    readonly rootSource: ISourceReference<TachographGeneration, 'vehicleUnit'>;
    readonly sections: readonly INormalizedDocumentSection[];
    readonly technicalRecords: readonly VehicleUnitTechnicalRecord[];
    readonly verification: IVuVerificationApplication | null;
    readonly warnings: readonly ITachographWarning[];
}

export type ParsedParserDocument = IParsedDriverCardDocument | IParsedUnsupportedCardDocument | IParsedVehicleUnitDocument;

export type SupportedParsedParserDocument = IParsedDriverCardDocument | IParsedVehicleUnitDocument;

export interface IOpenedDriverCardDocument {
    readonly capabilities: IDocumentCapabilities<'driverCard'>;
    readonly content: IParsedDriverCardDocument;
    readonly integrity: IntegrityAssessment;
    readonly raw: IJsonRecord;
    readonly source: IDocumentSource;
}

export interface IOpenedVehicleUnitDocument {
    readonly capabilities: IDocumentCapabilities<'vehicleUnit'>;
    readonly content: IParsedVehicleUnitDocument;
    readonly integrity: IntegrityAssessment;
    readonly raw: IJsonRecord;
    readonly source: IDocumentSource;
}

export type OpenedTachographDocument = IOpenedDriverCardDocument | IOpenedVehicleUnitDocument;

const driverCardCapabilities = [
    'identity',
    'activities',
    'vehicles',
    'places',
    'events',
    'faults',
    'controlActivities',
    'specificConditions',
    'technicalData',
] as const satisfies readonly DriverCardCapability[];

const vehicleUnitCapabilities = [
    'identity',
    'drivers',
    'positions',
    'events',
    'faults',
    'calibrations',
    'detailedSpeed',
    'downloadHistory',
    'technicalData',
] as const satisfies readonly VehicleUnitCapability[];

const notRequestedIntegrity: IntegrityAssessment = {
    reason: 'notRequested',
    status: 'notChecked',
};

export function createOpenedTachographDocument(
    source: IDocumentSource,
    content: SupportedParsedParserDocument,
): OpenedTachographDocument {
    if (content.documentKind === 'driverCard') {
        return {
            capabilities: createDocumentCapabilities('driverCard', driverCardCapabilities),
            content,
            integrity: notRequestedIntegrity,
            raw: content.rawTree,
            source,
        };
    }

    return {
        capabilities: createDocumentCapabilities('vehicleUnit', vehicleUnitCapabilities),
        content,
        integrity: notRequestedIntegrity,
        raw: content.rawTree,
        source,
    };
}
