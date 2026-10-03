import type {
    INormalizedDocumentSection,
    IParsedVehicleUnitDocument,
    NormalizedSectionKind,
    ParsedCardType,
    ParsedParserDocument,
} from '#viewer-application';
import { err, type IJsonRecord, isBoundaryRecord, isUnknownRecord, ok, type ParserOutputVariant, type Result } from '#contracts';
import {
    createSourceReference,
    type CardGeneration,
    type TachographGeneration,
    type VerificationGeneration,
} from '#viewer-domain';

import type {
    Gen1CardData,
    Gen2CardData,
    TachographHeader,
    VUTransferResponseParameterID,
    SerializedTachographData,
} from '../generated/esm_parser.js';
import { normalizeDriverCardApplication } from '../card/driver-card-normalizer.js';
import { createJsonPointer } from '../json-pointer.js';
import type {
    IParserEmbeddedCardSnapshot,
    ParserCardApplication,
    ParserDriverCardApplication,
    ParserVehicleUnitData,
    ParserVehicleUnitTransferParameter,
} from './parser-result-types.js';
import type { ParserNationAlphaCodes } from '../normalizers/parser-value-normalizer.js';
import { normalizeVehicleUnitActivitySections } from '../vehicle-unit/vehicle-unit-activity-normalizer.js';
import { normalizeVehicleUnitAssociations } from '../vehicle-unit/vehicle-unit-association-normalizer.js';
import { normalizeVehicleUnitEventFaultData } from '../vehicle-unit/vehicle-unit-event-fault-normalizer.js';
import { normalizeVehicleUnitLocations } from '../vehicle-unit/vehicle-unit-location-normalizer.js';
import { normalizeVehicleUnitIdentity } from '../vehicle-unit/vehicle-unit-normalizer.js';
import { normalizeVehicleUnitOverspeedData } from '../vehicle-unit/vehicle-unit-overspeed-normalizer.js';
import { normalizeVehicleUnitSpeedData } from '../vehicle-unit/vehicle-unit-speed-normalizer.js';
import { normalizeVehicleUnitCompanyLocks } from '../vehicle-unit/vehicle-unit-company-locks-normalizer.js';
import { normalizeVehicleUnitControlActivity } from '../vehicle-unit/vehicle-unit-control-activity-normalizer.js';
import { normalizeVehicleUnitDailyOdometerRecords } from '../vehicle-unit/vehicle-unit-daily-odometer-normalizer.js';
import { normalizeVehicleUnitSpecificConditions } from '../vehicle-unit/vehicle-unit-specific-condition-normalizer.js';
import { normalizeVehicleUnitTechnicalData } from '../vehicle-unit/vehicle-unit-technical-normalizer.js';
import { normalizeVehicleUnitTimeAdjustments } from '../vehicle-unit/vehicle-unit-time-adjustments-normalizer.js';
import { normalizeVehicleUnitVerification } from '../vehicle-unit/vehicle-unit-verification-normalizer.js';

export type ParserDocumentDecodeError =
    | 'inconsistentCardApplications'
    | 'invalidCardContent'
    | 'invalidHeader'
    | 'invalidVehicleUnitContent'
    | 'parserResultOutsideBounds';

interface ICardApplication {
    readonly cardType: ParsedCardType;
    readonly dataFiles: IJsonRecord;
    readonly generation: TachographGeneration;
    readonly pathTokens: readonly string[];
    readonly value: ParserCardApplication;
}

interface IDriverCardApplication extends ICardApplication {
    readonly cardType: 'driverCard';
    readonly value: ParserDriverCardApplication;
}

const vehicleUnitSections: Readonly<Partial<Record<VUTransferResponseParameterID, readonly NormalizedSectionKind[]>>> = {
    Activities: ['activities', 'places'],
    CardDownload: ['downloads'],
    EventsAndFaults: ['events', 'faults'],
    Gen2Activities: ['activities', 'places', 'positions'],
    Gen2CardDownload: ['downloads'],
    Gen2EventsAndFaults: ['events', 'faults'],
    Gen2Overview: ['identity', 'companyLocks', 'downloads'],
    Gen2Speed: ['speed'],
    Gen2TechnicalData: ['technicalData', 'calibration'],
    Gen2v2Activities: ['activities', 'places', 'positions'],
    Gen2v2EventsAndFaults: ['events', 'faults'],
    Gen2v2Overview: ['identity', 'companyLocks', 'downloads'],
    Gen2v2Speed: ['speed'],
    Gen2v2TechnicalData: ['technicalData', 'calibration'],
    Overview: ['identity', 'companyLocks', 'downloads'],
    Speed: ['speed'],
    TechnicalData: ['technicalData', 'calibration'],
};

const firstGenerationOnlyVuTypes: ReadonlySet<VUTransferResponseParameterID> = new Set([
    'Activities',
    'CardDownload',
    'EventsAndFaults',
    'Overview',
    'Speed',
    'TechnicalData',
]);

function headerMatchesVariant(header: TachographHeader, kind: SerializedTachographData['kind']): boolean {
    switch (kind) {
        case 'cardGen1':
            return header.dataType === 'Card' && header.generation === 'FirstGeneration';
        case 'cardGen2':
            return header.dataType === 'Card' && header.generation === 'SecondGeneration';
        case 'vuGen1':
            return header.dataType === 'VU' && header.generation === 'FirstGeneration';
        case 'vuGen2':
            return header.dataType === 'VU' && header.generation === 'SecondGeneration';
        default:
            return false;
    }
}

function readCardType(value: ParserCardApplication): ParsedCardType {
    const cardType = value.applicationIdentification.typeOfTachographCardId;
    if (cardType === 'CompanyCard') {
        return 'companyCard';
    }
    if (cardType === 'ControlCard') {
        return 'controlCard';
    }
    if (cardType === 'DriverCard') {
        return 'driverCard';
    }
    if (cardType === 'WorkshopCard') {
        return 'workshopCard';
    }
    return 'unsupportedCard';
}

function isDriverCardApplication(value: ParserCardApplication): value is ParserDriverCardApplication {
    return value.applicationIdentification.typeOfTachographCardId === 'DriverCard' && 'cardDownload' in value;
}

function applicationShapeCardType(value: ParserCardApplication): Exclude<ParsedCardType, 'unsupportedCard'> {
    if ('companyActivityData' in value) {
        return 'companyCard';
    }
    if ('controllerActivityData' in value || 'controlCardControlActivityData' in value) {
        return 'controlCard';
    }
    if ('cardDownload' in value) {
        return 'driverCard';
    }
    return 'workshopCard';
}

function readApplicationGeneration(value: ParserCardApplication, generation: VerificationGeneration): TachographGeneration {
    return generation === 'g1'
        ? 'g1'
        : 'applicationIdentificationV2' in value && value.applicationIdentificationV2 !== null
          ? 'g2v2'
          : 'g2';
}

function decodeCardApplication(
    value: ParserCardApplication,
    expectedGeneration: VerificationGeneration,
    pathTokens: readonly string[],
): ICardApplication | null {
    const cardType = readCardType(value);
    const isGen2Application = 'linkCertificate' in value;
    if (
        (expectedGeneration === 'g1') === isGen2Application ||
        ('cardGeneration' in value && value.cardGeneration !== (expectedGeneration === 'g1' ? 'Gen1' : 'Gen2')) ||
        (cardType !== 'unsupportedCard' && cardType !== applicationShapeCardType(value)) ||
        !isBoundaryRecord(value.dataFiles)
    ) {
        return null;
    }

    return {
        cardType,
        dataFiles: value.dataFiles,
        generation: readApplicationGeneration(value, expectedGeneration),
        pathTokens: [...pathTokens],
        value,
    };
}

function decodeGen1CardApplications(value: Gen1CardData): readonly ICardApplication[] | null {
    const response = value.cardDataResponses;
    if (response === 'Unsupported') {
        return [];
    }

    const application = decodeCardApplication(response, 'g1', ['cardDataResponses']);
    return application === null ? null : [application];
}

function decodeGen2CardApplications(value: Gen2CardData): readonly ICardApplication[] | null {
    const response = value.cardDataResponses;
    if (response === 'Unsupported' || response === null) {
        return [];
    }

    const applications: ICardApplication[] = [];
    if ('gen1' in response) {
        const application = decodeCardApplication(response.gen1, 'g1', ['cardDataResponses', 'gen1']);
        if (application === null) {
            return null;
        }
        applications.push(application);
    }
    if ('gen2' in response) {
        const application = decodeCardApplication(response.gen2, 'g2', ['cardDataResponses', 'gen2']);
        if (application === null) {
            return null;
        }
        applications.push(application);
    }

    return applications;
}

function decodeEmbeddedCardSnapshot(
    parameters: readonly ParserVehicleUnitTransferParameter[],
): IParserEmbeddedCardSnapshot | null {
    for (const [index, parameter] of parameters.entries()) {
        const typeId = parameter.typeId;
        if (typeId !== 'CardDownload' && typeId !== 'Gen2CardDownload') {
            continue;
        }
        const generation: 'g1' | 'g2' = typeId === 'CardDownload' ? 'g1' : 'g2';
        const basePath: readonly (string | number)[] = ['transferResParams', index, 'data'];
        if (generation === 'g1') {
            return {
                applications: [],
                generation,
                hasSignature: false,
                pathTokens: basePath,
                state: 'unsupported',
            };
        }
        const data = parameter.data;
        if (typeof data !== 'object' || !('CardDownload' in data)) {
            return {
                applications: null,
                generation,
                hasSignature: false,
                pathTokens: basePath,
                state: 'unsupported',
            };
        }
        const snapshot = data.CardDownload;
        const snapshotPath: readonly (string | number)[] = [...basePath, 'CardDownload', 'card'];
        const hasSignature = snapshot.signatureRecordArray !== null;
        const response = snapshot.card.cardDataResponses;
        if (response === 'Unsupported') {
            return {
                applications: [],
                generation,
                hasSignature,
                pathTokens: snapshotPath,
                state: 'unsupported',
            };
        }
        if (response === null) {
            return {
                applications: [],
                generation,
                hasSignature,
                pathTokens: snapshotPath,
                state: 'noCard',
            };
        }
        const applications = decodeGen2CardApplications(snapshot.card);
        if (applications === null) {
            return {
                applications: null,
                generation,
                hasSignature,
                pathTokens: snapshotPath,
                state: 'parsed',
            };
        }
        return {
            applications: applications.map((application) => ({
                cardType: application.cardType,
                generation: application.generation,
                pathTokens: [...snapshotPath, ...application.pathTokens],
                value: application.value,
            })),
            generation,
            hasSignature,
            pathTokens: snapshotPath,
            state: 'parsed',
        };
    }
    return null;
}

function deriveCardGeneration(applications: readonly ICardApplication[]): CardGeneration {
    if (applications.length > 1) {
        return 'combined';
    }

    const application = applications[0];
    if (application === undefined) {
        throw new Error('A decoded card must contain an application.');
    }
    return application.generation;
}

function collectCardSections(applications: readonly IDriverCardApplication[]): readonly INormalizedDocumentSection[] {
    const sections: INormalizedDocumentSection[] = [];

    for (const application of applications) {
        const { generation, pathTokens, value } = application;
        const candidates: readonly (readonly [NormalizedSectionKind, string, unknown])[] = [
            ['downloads', 'cardDownload', value.cardDownload],
            ['currentUsage', 'currentUsage', value.currentUsage],
            ['activities', 'driverActivityData', value.driverActivityData],
            ['events', 'eventsData', value.eventsData],
            ['faults', 'faultsData', value.faultsData],
            ['identity', 'identification', value.identification],
            ['places', 'places', value.places],
            ['conditions', 'specificConditions', value.specificConditions],
            ['vehicles', 'vehiclesUsed', value.vehiclesUsed],
        ];
        for (const [kind, key, candidate] of candidates) {
            if (candidate !== null) {
                sections.push({
                    kind,
                    source: createSourceReference('driverCard', generation, createJsonPointer([...pathTokens, key])),
                });
            }
        }

        if ('gnssPlaces' in value && value.gnssPlaces !== null) {
            sections.push({
                kind: 'positions',
                source: createSourceReference('driverCard', generation, createJsonPointer([...pathTokens, 'gnssPlaces'])),
            });
        }
        if ('borderCrossings' in value && value.borderCrossings !== null) {
            sections.push({
                kind: 'places',
                source: createSourceReference('driverCard', generation, createJsonPointer([...pathTokens, 'borderCrossings'])),
            });
        }
        if ('loadUnloadOperations' in value && value.loadUnloadOperations !== null) {
            sections.push({
                kind: 'places',
                source: createSourceReference(
                    'driverCard',
                    generation,
                    createJsonPointer([...pathTokens, 'loadUnloadOperations']),
                ),
            });
        }
        if ('loadTypeEntries' in value && value.loadTypeEntries !== null) {
            sections.push({
                kind: 'places',
                source: createSourceReference('driverCard', generation, createJsonPointer([...pathTokens, 'loadTypeEntries'])),
            });
        }
        if ('vehicleUnitsUsed' in value && value.vehicleUnitsUsed !== null) {
            sections.push({
                kind: 'vehicles',
                source: createSourceReference('driverCard', generation, createJsonPointer([...pathTokens, 'vehicleUnitsUsed'])),
            });
        }
        if (value.controlActivityData !== null) {
            sections.push({
                kind: 'controls',
                source: createSourceReference(
                    'driverCard',
                    generation,
                    createJsonPointer([...pathTokens, 'controlActivityData']),
                ),
            });
        }
    }

    return sections;
}

function decodeCardDocument(
    applications: readonly ICardApplication[] | null,
    parserVariant: Extract<ParserOutputVariant, 'cardGen1' | 'cardGen2'>,
    rawTree: IJsonRecord,
    nationAlphaCodes: ParserNationAlphaCodes,
): Result<ParsedParserDocument, ParserDocumentDecodeError> {
    if (applications === null) {
        return err('invalidCardContent');
    }
    if (applications.length === 0) {
        return ok({
            cardType: 'unsupportedCard',
            contentPath: createJsonPointer(['cardDataResponses']),
            documentKind: 'unsupportedCard',
            generation: parserVariant === 'cardGen1' ? 'g1' : 'g2',
            parserVariant,
            rawTree,
        });
    }

    const cardTypes = new Set(applications.map((application) => application.cardType));
    if (cardTypes.size !== 1) {
        return err('inconsistentCardApplications');
    }

    const firstApplication = applications[0];
    if (firstApplication === undefined) {
        return err('invalidCardContent');
    }

    const generation = deriveCardGeneration(applications);
    if (firstApplication.cardType !== 'driverCard') {
        return ok({
            cardType: firstApplication.cardType,
            contentPath: createJsonPointer(firstApplication.pathTokens),
            documentKind: 'unsupportedCard',
            generation,
            parserVariant,
            rawTree,
        });
    }

    const driverApplications: IDriverCardApplication[] = [];
    for (const application of applications) {
        if (application.cardType !== 'driverCard' || !isDriverCardApplication(application.value)) {
            return err('inconsistentCardApplications');
        }
        driverApplications.push({
            ...application,
            cardType: 'driverCard',
            value: application.value,
        });
    }

    const normalizedApplications = driverApplications.map((application) =>
        normalizeDriverCardApplication(
            application.value,
            application.dataFiles,
            application.generation,
            application.pathTokens,
            nationAlphaCodes,
        ),
    );

    return ok({
        applications: normalizedApplications,
        cardType: 'driverCard',
        documentKind: 'driverCard',
        generation,
        parserVariant,
        rawTree,
        sections: collectCardSections(driverApplications),
    });
}

function parameterGeneration(
    parserVariant: Extract<ParserOutputVariant, 'vuGen1' | 'vuGen2'>,
    typeId: VUTransferResponseParameterID,
): TachographGeneration {
    return parserVariant === 'vuGen1' ? 'g1' : typeId.startsWith('Gen2v2') ? 'g2v2' : 'g2';
}

function parameterTypeMatchesVariant(
    typeId: VUTransferResponseParameterID,
    parserVariant: Extract<ParserOutputVariant, 'vuGen1' | 'vuGen2'>,
): boolean {
    if (typeId === 'OddballCrashDump' || typeId === 'Unknown') {
        return true;
    }
    return parserVariant === 'vuGen1' ? firstGenerationOnlyVuTypes.has(typeId) : typeId.startsWith('Gen2');
}

function parameterDataMatchesType(
    parameter: ParserVehicleUnitTransferParameter,
    parserVariant: Extract<ParserOutputVariant, 'vuGen1' | 'vuGen2'>,
): boolean {
    const { data, typeId } = parameter;
    switch (typeId) {
        case 'Activities':
        case 'Gen2Activities':
        case 'Gen2v2Activities':
            return typeof data === 'object' && 'Activity' in data;
        case 'EventsAndFaults':
        case 'Gen2EventsAndFaults':
        case 'Gen2v2EventsAndFaults':
            return typeof data === 'object' && 'Events' in data;
        case 'Overview':
        case 'Gen2Overview':
        case 'Gen2v2Overview':
            return typeof data === 'object' && 'Control' in data;
        case 'Speed':
        case 'Gen2Speed':
        case 'Gen2v2Speed':
            return typeof data === 'object' && 'Speed' in data;
        case 'TechnicalData':
        case 'Gen2TechnicalData':
        case 'Gen2v2TechnicalData':
            return typeof data === 'object' && 'Calibration' in data;
        case 'CardDownload':
        case 'Gen2CardDownload':
            return parserVariant === 'vuGen1' ? data === 'CardDownload' : typeof data === 'object' && 'CardDownload' in data;
        case 'OddballCrashDump':
            return data === 'OddballCrashDump';
        case 'Unknown':
            return parserVariant === 'vuGen1' ? data === 'Unknown' : typeof data === 'object' && 'Unknown' in data;
    }
}

function decodeVehicleUnitDocument(
    value: ParserVehicleUnitData,
    parserVariant: Extract<ParserOutputVariant, 'vuGen1' | 'vuGen2'>,
    rawTree: IJsonRecord,
    nationAlphaCodes: ParserNationAlphaCodes,
): Result<IParsedVehicleUnitDocument, ParserDocumentDecodeError> {
    const sections: INormalizedDocumentSection[] = [];
    let hasGen2v2 = false;
    for (const [index, parameter] of value.transferResParams.entries()) {
        if (
            !Number.isInteger(parameter.position) ||
            parameter.position < 0 ||
            parameter.position > 0xff_ff_ff_ff ||
            !parameterTypeMatchesVariant(parameter.typeId, parserVariant) ||
            !parameterDataMatchesType(parameter, parserVariant)
        ) {
            return err('invalidVehicleUnitContent');
        }

        if (parameter.typeId.startsWith('Gen2v2')) {
            hasGen2v2 = true;
        }

        const kinds = vehicleUnitSections[parameter.typeId];
        if (kinds !== undefined) {
            const generation = parameterGeneration(parserVariant, parameter.typeId);
            for (const kind of kinds) {
                sections.push({
                    kind,
                    source: createSourceReference(
                        'vehicleUnit',
                        generation,
                        createJsonPointer(['transferResParams', index, 'data']),
                    ),
                });
            }
        }
    }

    const generation: TachographGeneration = parserVariant === 'vuGen1' ? 'g1' : hasGen2v2 ? 'g2v2' : 'g2';
    const identity = normalizeVehicleUnitIdentity(value.transferResParams, generation, nationAlphaCodes);
    const eventFaultData = normalizeVehicleUnitEventFaultData(value.transferResParams, parserVariant);
    const activitySections = normalizeVehicleUnitActivitySections(value.transferResParams, generation);
    const specificConditions = normalizeVehicleUnitSpecificConditions(value.transferResParams, generation);
    const associations = normalizeVehicleUnitAssociations(activitySections.sections, nationAlphaCodes);
    const locations = normalizeVehicleUnitLocations(activitySections.sections, nationAlphaCodes);
    const speed = normalizeVehicleUnitSpeedData(value.transferResParams);
    const overspeed = normalizeVehicleUnitOverspeedData(value.transferResParams, parserVariant, nationAlphaCodes);
    const technical = normalizeVehicleUnitTechnicalData(
        value.transferResParams,
        nationAlphaCodes,
        decodeEmbeddedCardSnapshot(value.transferResParams),
    );
    const companyLocks = normalizeVehicleUnitCompanyLocks(value.transferResParams);
    const timeAdjustments = normalizeVehicleUnitTimeAdjustments(value.transferResParams, parserVariant, nationAlphaCodes);
    const controlActivity = normalizeVehicleUnitControlActivity(value.transferResParams, nationAlphaCodes);
    const dailyOdometer = normalizeVehicleUnitDailyOdometerRecords(activitySections.sections);

    return ok({
        cardUses: associations.cardUses,
        companyLocks: companyLocks.records,
        detailedSpeedSamples: speed.samples,
        documentKind: 'vehicleUnit',
        events: eventFaultData.events,
        faults: eventFaultData.faults,
        overspeedControl: overspeed.control,
        overspeedRecords: overspeed.records,
        generation,
        identity: identity.identity,
        locations: locations.locations,
        parserVariant,
        rawTree,
        rootSource: createSourceReference('vehicleUnit', generation, createJsonPointer([])),
        sections: sections,
        technicalRecords: [
            ...technical.records,
            ...timeAdjustments.records,
            ...controlActivity.records,
            ...specificConditions.records,
            ...dailyOdometer.records,
        ],
        verification: normalizeVehicleUnitVerification(value.transferResParams, generation, value.dataFiles),
        warnings: [
            ...identity.warnings,
            ...eventFaultData.warnings,
            ...activitySections.warnings,
            ...associations.warnings,
            ...locations.warnings,
            ...speed.warnings,
            ...overspeed.warnings,
            ...technical.warnings,
            ...timeAdjustments.warnings,
            ...controlActivity.warnings,
            ...specificConditions.warnings,
            ...dailyOdometer.warnings,
        ],
    });
}

export function isSerializedTachographData(value: unknown): value is SerializedTachographData {
    if (!isUnknownRecord(value)) {
        return false;
    }
    const { data, kind } = value;
    return (kind === 'vuGen1' || kind === 'vuGen2' || kind === 'cardGen1' || kind === 'cardGen2') && isBoundaryRecord(data);
}

export function decodeParserDocument(
    value: SerializedTachographData,
    nationAlphaCodes: ParserNationAlphaCodes,
): Result<ParsedParserDocument, ParserDocumentDecodeError> {
    if (!isBoundaryRecord(value.data)) {
        return err('parserResultOutsideBounds');
    }
    if (!headerMatchesVariant(value.data.header, value.kind)) {
        return err('invalidHeader');
    }

    switch (value.kind) {
        case 'cardGen1':
            return decodeCardDocument(decodeGen1CardApplications(value.data), value.kind, value.data, nationAlphaCodes);
        case 'cardGen2':
            return decodeCardDocument(decodeGen2CardApplications(value.data), value.kind, value.data, nationAlphaCodes);
        case 'vuGen1':
        case 'vuGen2':
            return decodeVehicleUnitDocument(value.data, value.kind, value.data, nationAlphaCodes);
        default:
            return err('parserResultOutsideBounds');
    }
}
