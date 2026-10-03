import { classifyParseError, err, ok, type ParseError, type Result } from '#contracts';
import type {
    ActivityInterval,
    DocumentCapability,
    IDetailedSpeedSample,
    TachographTechnicalRecord,
    TachographEventFault,
    TachographAssociation,
    TachographIdentity,
    TachographLocationRecord,
} from '#viewer-domain';

import {
    projectDocumentActivityRecords,
    projectDocumentAssociations,
    projectDocumentDetailedSpeedSamples,
    projectDocumentEventFaultRecords,
    projectDocumentIdentities,
    projectDocumentLocationRecords,
    projectDocumentTechnicalRecords,
} from './document-projections.js';
import type { OpenedTachographDocument } from './opened-document.js';

export type DocumentWorkspaceSection =
    | 'activities'
    | 'associations'
    | 'compliance'
    | 'comparison'
    | 'eventsAndFaults'
    | 'integrity'
    | 'overview'
    | 'places'
    | 'rawData'
    | 'speed'
    | 'technical';

export type DocumentSectionRecord =
    | ActivityInterval
    | IDetailedSpeedSample
    | TachographAssociation
    | TachographEventFault
    | TachographIdentity
    | TachographLocationRecord
    | TachographTechnicalRecord;

export interface IDocumentSectionProjection {
    readonly records: readonly DocumentSectionRecord[];
    readonly section: DocumentWorkspaceSection;
}

export interface IDocumentSelectionSnapshot {
    readonly availableSections: readonly DocumentWorkspaceSection[];
    readonly projection: IDocumentSectionProjection;
    readonly selectedRecord: DocumentSectionRecord | null;
}

export type DocumentSelectionResult = Result<IDocumentSelectionSnapshot, ParseError>;

export interface IDocumentSelectionController {
    readonly snapshot: IDocumentSelectionSnapshot;
    clearRecord(): IDocumentSelectionSnapshot;
    selectRecord(record: DocumentSectionRecord): DocumentSelectionResult;
    selectSection(section: DocumentWorkspaceSection): DocumentSelectionResult;
}

const associationCapabilities = ['drivers', 'vehicles'] as const satisfies readonly DocumentCapability[];

const placeCapabilities = ['borderCrossings', 'places', 'positions'] as const satisfies readonly DocumentCapability[];

const technicalCapabilities = [
    'calibrations',
    'companyLocks',
    'controlActivities',
    'downloadHistory',
    'sensorData',
    'specificConditions',
    'technicalData',
    'timeAdjustments',
] as const satisfies readonly DocumentCapability[];

function hasAnyCapability(capabilities: ReadonlySet<DocumentCapability>, candidates: readonly DocumentCapability[]): boolean {
    return candidates.some((candidate) => capabilities.has(candidate));
}

export function getAvailableDocumentSections(document: OpenedTachographDocument): readonly DocumentWorkspaceSection[] {
    const capabilities = new Set<DocumentCapability>(document.capabilities.applicable);
    const sections: DocumentWorkspaceSection[] = ['overview'];

    if (capabilities.has('activities')) {
        sections.push('activities', 'compliance');
    }
    if (hasAnyCapability(capabilities, associationCapabilities)) {
        sections.push('associations');
    }
    if (hasAnyCapability(capabilities, placeCapabilities)) {
        sections.push('places');
    }
    if (capabilities.has('events') || capabilities.has('faults')) {
        sections.push('eventsAndFaults');
    }
    if (hasAnyCapability(capabilities, technicalCapabilities)) {
        sections.push('technical');
    }
    if (capabilities.has('detailedSpeed')) {
        sections.push('speed');
    }

    sections.push('comparison', 'integrity', 'rawData');
    return sections;
}

function projectOverview(document: OpenedTachographDocument): readonly TachographIdentity[] {
    return projectDocumentIdentities(document);
}

function projectActivities(document: OpenedTachographDocument): readonly ActivityInterval[] {
    return projectDocumentActivityRecords(document).map((record) => record.interval);
}

function projectEventsAndFaults(document: OpenedTachographDocument): readonly TachographEventFault[] {
    return projectDocumentEventFaultRecords(document);
}

function projectAssociations(document: OpenedTachographDocument): readonly TachographAssociation[] {
    return projectDocumentAssociations(document);
}

function projectPlaces(document: OpenedTachographDocument): readonly TachographLocationRecord[] {
    return projectDocumentLocationRecords(document);
}

function projectTechnical(document: OpenedTachographDocument): readonly TachographTechnicalRecord[] {
    return projectDocumentTechnicalRecords(document);
}

function projectSpeed(document: OpenedTachographDocument): readonly IDetailedSpeedSample[] {
    return projectDocumentDetailedSpeedSamples(document);
}

export function createDocumentSectionProjection(
    document: OpenedTachographDocument,
    section: DocumentWorkspaceSection,
): IDocumentSectionProjection {
    let records: readonly DocumentSectionRecord[];

    switch (section) {
        case 'overview':
            records = projectOverview(document);
            break;
        case 'activities':
            records = projectActivities(document);
            break;
        case 'eventsAndFaults':
            records = projectEventsAndFaults(document);
            break;
        case 'associations':
            records = projectAssociations(document);
            break;
        case 'comparison':
            records = [];
            break;
        case 'places':
            records = projectPlaces(document);
            break;
        case 'technical':
            records = projectTechnical(document);
            break;
        case 'speed':
            records = projectSpeed(document);
            break;
        case 'integrity':
        case 'compliance':
        case 'rawData':
            records = [];
            break;
    }

    return {
        records,
        section,
    };
}

function createSnapshot(
    availableSections: readonly DocumentWorkspaceSection[],
    projection: IDocumentSectionProjection,
    selectedRecord: DocumentSectionRecord | null,
): IDocumentSelectionSnapshot {
    return {
        availableSections,
        projection,
        selectedRecord,
    };
}

function successfulSelection(snapshot: IDocumentSelectionSnapshot): DocumentSelectionResult {
    return ok(snapshot);
}

function invalidSelection(): DocumentSelectionResult {
    return err(classifyParseError('invalidDocumentState'));
}

export class DocumentSelectionController implements IDocumentSelectionController {
    private readonly _availableSections: readonly DocumentWorkspaceSection[];
    private readonly _document: OpenedTachographDocument;
    private _snapshot: IDocumentSelectionSnapshot;

    public constructor(document: OpenedTachographDocument) {
        this._document = document;
        this._availableSections = getAvailableDocumentSections(document);
        this._snapshot = createSnapshot(this._availableSections, createDocumentSectionProjection(document, 'overview'), null);
    }

    public get snapshot(): IDocumentSelectionSnapshot {
        return this._snapshot;
    }

    public clearRecord(): IDocumentSelectionSnapshot {
        if (this._snapshot.selectedRecord !== null) {
            this._snapshot = createSnapshot(this._availableSections, this._snapshot.projection, null);
        }

        return this._snapshot;
    }

    public selectRecord(record: DocumentSectionRecord): DocumentSelectionResult {
        if (!this._snapshot.projection.records.includes(record)) {
            return invalidSelection();
        }

        this._snapshot = createSnapshot(this._availableSections, this._snapshot.projection, record);
        return successfulSelection(this._snapshot);
    }

    public selectSection(section: DocumentWorkspaceSection): DocumentSelectionResult {
        if (!this._availableSections.includes(section)) {
            return invalidSelection();
        }
        if (section === this._snapshot.projection.section) {
            return successfulSelection(this._snapshot);
        }

        this._snapshot = createSnapshot(this._availableSections, createDocumentSectionProjection(this._document, section), null);
        return successfulSelection(this._snapshot);
    }
}
