import type { FileDisplayName, ReopenToken, Sha256Digest } from '#contracts';
import {
    sumActivityTotals,
    type DocumentKind,
    type IActivityTotals,
    type IntegrityAssessment,
    type OdometerKilometres,
    type TachographEventFault,
    type TachographGeneration,
    type TachographIdentity,
    type UtcTimestamp,
} from '#viewer-domain';

import {
    createDocumentOverviewProjection,
    projectDocumentAssociations,
    projectDocumentCanonicalActivityDays,
    projectDocumentEventFaultRecords,
    type IDocumentContentCounts,
    type IDocumentCoverage,
} from './document-projections.js';
import type { IDocumentIntegrityCounts } from './document-integrity.js';
import type { OpenedTachographDocument } from './opened-document.js';

// Observed min and max odometer readings in document association records.
export interface IComparisonOdometerRange {
    readonly max: OdometerKilometres;
    readonly min: OdometerKilometres;
}

// Normalized time window for comparing association sessions across documents.
export interface IComparisonAssociationSession {
    readonly end: UtcTimestamp | null;
    readonly start: UtcTimestamp;
}

export interface IOpenedDocumentComparisonRecord {
    readonly activityTotals: IActivityTotals | null;
    readonly associationSessions: readonly IComparisonAssociationSession[];
    readonly byteLength: number;
    readonly counts: IDocumentContentCounts;
    readonly coverage: IDocumentCoverage | null;
    readonly displayName: FileDisplayName;
    readonly documentKind: DocumentKind;
    readonly eventFaults: readonly TachographEventFault[];
    readonly generations: readonly TachographGeneration[];
    readonly identities: readonly TachographIdentity[];
    readonly integrity: IntegrityAssessment;
    readonly integrityCounts: IDocumentIntegrityCounts;
    readonly key: string;
    readonly odometerRange: IComparisonOdometerRange | null;
    readonly openedAt: UtcTimestamp;
    readonly reopenToken: ReopenToken | null;
    readonly sha256: Sha256Digest;
}

function documentActivityTotals(document: OpenedTachographDocument): IActivityTotals | null {
    const days = projectDocumentCanonicalActivityDays(document);
    if (days.length === 0) {
        return null;
    }

    const result = sumActivityTotals(days.map(({ day }) => day.totals));
    if (result.status === 'durationOverflow') {
        throw new TypeError(`The summed ${result.activity} duration exceeds the supported bounds.`);
    }

    return result.totals;
}

function documentOdometerRange(document: OpenedTachographDocument): IComparisonOdometerRange | null {
    const readings: OdometerKilometres[] = [];

    for (const association of projectDocumentAssociations(document)) {
        if (association.kind === 'vehicleUse') {
            if (association.odometerBegin !== null) {
                readings.push(association.odometerBegin);
            }
            if (association.odometerEnd !== null) {
                readings.push(association.odometerEnd);
            }
        } else if (association.kind === 'cardUse') {
            if (association.odometerAtInsertion !== null) {
                readings.push(association.odometerAtInsertion);
            }
            if (association.odometerAtWithdrawal !== null) {
                readings.push(association.odometerAtWithdrawal);
            }
        }
    }

    if (readings.length === 0) {
        return null;
    }

    return {
        max: readings.reduce((max, value) => (value > max ? value : max)),
        min: readings.reduce((min, value) => (value < min ? value : min)),
    };
}

function documentAssociationSessions(document: OpenedTachographDocument): readonly IComparisonAssociationSession[] {
    return projectDocumentAssociations(document).map((association) => {
        if (association.kind === 'vehicleUse') {
            return { end: association.lastUse, start: association.firstUse };
        }
        if (association.kind === 'cardUse') {
            return { end: association.withdrawal, start: association.insertion };
        }
        return { end: association.usedAt, start: association.usedAt };
    });
}

export interface IOpenedDocumentComparisonSnapshot {
    readonly records: readonly IOpenedDocumentComparisonRecord[];
}

export interface IDocumentComparisonController {
    readonly snapshot: IOpenedDocumentComparisonSnapshot;
    add(document: OpenedTachographDocument): boolean;
    clear(): boolean;
    remove(key: string): boolean;
}

export function documentComparisonKey(document: OpenedTachographDocument): string {
    return document.source.sha256;
}

export function createOpenedDocumentComparisonRecord(document: OpenedTachographDocument): IOpenedDocumentComparisonRecord {
    const overview = createDocumentOverviewProjection(document);
    return {
        activityTotals: documentActivityTotals(document),
        associationSessions: documentAssociationSessions(document),
        byteLength: document.source.byteLength,
        counts: overview.counts,
        coverage: overview.coverage,
        displayName: document.source.displayName,
        documentKind: document.content.documentKind,
        eventFaults: projectDocumentEventFaultRecords(document),
        generations: overview.applicationGenerations,
        identities: overview.identities,
        integrity: document.integrity,
        integrityCounts: overview.integrityCounts,
        key: documentComparisonKey(document),
        odometerRange: documentOdometerRange(document),
        openedAt: document.source.openedAt,
        reopenToken: document.source.reopenToken,
        sha256: document.source.sha256,
    };
}

export class DocumentComparisonController implements IDocumentComparisonController {
    private _records: readonly IOpenedDocumentComparisonRecord[] = [];

    public get snapshot(): IOpenedDocumentComparisonSnapshot {
        return {
            records: this._records,
        };
    }

    public add(document: OpenedTachographDocument): boolean {
        const record = createOpenedDocumentComparisonRecord(document);
        this._records = [record, ...this._records.filter((entry) => entry.key !== record.key)];
        return true;
    }

    public clear(): boolean {
        if (this._records.length === 0) {
            return false;
        }

        this._records = [];
        return true;
    }

    public remove(key: string): boolean {
        const next = this._records.filter((entry) => entry.key !== key);
        if (next.length === this._records.length) {
            return false;
        }

        this._records = next;
        return true;
    }
}
