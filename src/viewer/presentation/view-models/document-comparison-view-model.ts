import {
    utcIntervalsOverlap,
    type DurationMilliseconds,
    type DocumentKind,
    type OdometerKilometres,
    type TachographGeneration,
    type TachographIdentity,
    type UtcTimestamp,
} from '#viewer-domain';
import type {
    IComparisonAssociationSession,
    IOpenedDocumentComparisonRecord,
    IOpenedDocumentComparisonSnapshot,
} from '#viewer-application';

import { classifyEventFaultSecurity, type EventFaultSecurityCategory } from './event-fault-view-model.js';
import {
    createDocumentContentCountsViewModel,
    createDocumentIntegrityOverviewViewModel,
    formatDateTime,
    formatDuration,
    formattedValue,
    formatNumber,
    type IDocumentContentCountsViewModel,
    type IDocumentIntegrityOverviewViewModel,
    type IFormattedUtcRange,
    type IFormattedValue,
} from './document-view-model.js';
import type { ViewerLocalisationService } from '../helpers/view-model-formatting.js';

// Activity totals for comparison; null when document lacks activity-day evidence.
export interface IComparisonActivityTotalsViewModel {
    readonly availability: IFormattedValue<DurationMilliseconds>;
    readonly breakOrRest: IFormattedValue<DurationMilliseconds>;
    readonly driving: IFormattedValue<DurationMilliseconds>;
    readonly work: IFormattedValue<DurationMilliseconds>;
}

export interface IComparisonOdometerRangeViewModel {
    readonly max: IFormattedValue<OdometerKilometres>;
    readonly min: IFormattedValue<OdometerKilometres>;
}

// Counts events and faults by security category; factual evidence only.
export type IComparisonSecurityCountsViewModel = Readonly<Record<EventFaultSecurityCategory, number>>;

export interface IOpenedDocumentComparisonRowViewModel {
    readonly activityTotals: IComparisonActivityTotalsViewModel | null;
    readonly byteLength: IFormattedValue<number>;
    readonly coverage: IFormattedUtcRange | null;
    readonly displayName: string;
    readonly documentKind: DocumentKind;
    readonly generations: readonly TachographGeneration[];
    readonly identitySummary: string | null;
    readonly integrity: IDocumentIntegrityOverviewViewModel;
    readonly key: string;
    readonly odometerRange: IComparisonOdometerRangeViewModel | null;
    readonly openedAt: IFormattedValue<UtcTimestamp>;
    readonly overlappingSessionCount: number;
    readonly reopenable: boolean;
    readonly securityCounts: IComparisonSecurityCountsViewModel;
    readonly sha256: string;
    readonly totals: IDocumentContentCountsViewModel;
}

export type ComparisonDiffColumn =
    | 'activityTotals'
    | 'contentCounts'
    | 'coverage'
    | 'identity'
    | 'integrity'
    | 'kind'
    | 'odometerRange'
    | 'overlappingSessions'
    | 'securityCounts';

export interface IOpenedDocumentComparisonViewModel {
    readonly differingColumns: readonly ComparisonDiffColumn[];
    readonly locale: string;
    readonly records: readonly IOpenedDocumentComparisonRowViewModel[];
    readonly timeZone: string;
}

function mapCoverage(start: UtcTimestamp, end: UtcTimestamp, localisation: ViewerLocalisationService): IFormattedUtcRange {
    return {
        end: formatDateTime(end, localisation),
        start: formatDateTime(start, localisation),
    };
}

function formatOdometerValue(
    value: OdometerKilometres,
    localisation: ViewerLocalisationService,
): IFormattedValue<OdometerKilometres> {
    return formattedValue(value, localisation.formatNumber(value));
}

function summariseIdentities(identities: readonly TachographIdentity[]): string {
    return identities
        .map((identity) => {
            if (identity.kind === 'driver') {
                const name = [identity.surname, identity.firstNames].filter((part) => part !== null && part.length > 0).join(' ');
                return name.length > 0 ? name : identity.cardNumber;
            }

            return identity.registrationNumber ?? identity.vehicleIdentificationNumber ?? '';
        })
        .filter((value) => value.length > 0)
        .join('; ');
}

const diffColumnIds: readonly ComparisonDiffColumn[] = [
    'kind',
    'coverage',
    'integrity',
    'contentCounts',
    'identity',
    'activityTotals',
    'odometerRange',
    'securityCounts',
    'overlappingSessions',
];

const securityCategories: readonly EventFaultSecurityCategory[] = ['operationalNotice', 'securityCritical', 'sensorDiagnostic'];

function documentSecurityCounts(record: IOpenedDocumentComparisonRecord): IComparisonSecurityCountsViewModel {
    const counts: Record<EventFaultSecurityCategory, number> = {
        operationalNotice: 0,
        securityCritical: 0,
        sensorDiagnostic: 0,
    };

    for (const eventFault of record.eventFaults) {
        counts[classifyEventFaultSecurity(eventFault.code)] += 1;
    }

    return counts;
}

// Evaluates session overlap; sessions that only touch are not concurrent, and unclosed sessions are the instant of
// their start.
function sessionsOverlap(left: IComparisonAssociationSession, right: IComparisonAssociationSession): boolean {
    return utcIntervalsOverlap(
        { end: left.end ?? left.start, start: left.start },
        { end: right.end ?? right.start, start: right.start },
    );
}

function countOverlappingSessions(
    record: IOpenedDocumentComparisonRecord,
    allRecords: readonly IOpenedDocumentComparisonRecord[],
): number {
    const otherRecords = allRecords.filter((other) => other.key !== record.key);

    return record.associationSessions.filter((session) =>
        otherRecords.some((other) => other.associationSessions.some((otherSession) => sessionsOverlap(session, otherSession))),
    ).length;
}

function createDiffValues(record: IOpenedDocumentComparisonRecord, overlappingSessionCount: number): readonly string[] {
    const securityCounts = documentSecurityCounts(record);

    return [
        `${record.documentKind}:${record.generations.join(',')}`,
        record.coverage === null ? '' : `${String(record.coverage.start)}:${String(record.coverage.end)}`,
        record.integrity.status,
        [
            record.counts.activityDays,
            record.counts.events,
            record.counts.faults,
            record.counts.inferredActivityGaps,
            record.counts.recordedActivityIntervals,
            record.counts.warnings,
        ].join(','),
        summariseIdentities(record.identities),
        record.activityTotals === null
            ? ''
            : [
                  record.activityTotals.driving,
                  record.activityTotals.work,
                  record.activityTotals.breakOrRest,
                  record.activityTotals.availability,
              ].join(','),
        record.odometerRange === null ? '' : `${String(record.odometerRange.min)}:${String(record.odometerRange.max)}`,
        securityCategories.map((category) => securityCounts[category]).join(','),
        String(overlappingSessionCount),
    ];
}

function findDifferingColumns(
    records: readonly IOpenedDocumentComparisonRecord[],
    overlapCounts: ReadonlyMap<string, number>,
): readonly ComparisonDiffColumn[] {
    if (records.length < 2) {
        return [];
    }

    const firstRecord = records[0];
    if (firstRecord === undefined) {
        return [];
    }

    const valuesByRecord = records.map((record) => createDiffValues(record, overlapCounts.get(record.key) ?? 0));
    const firstValues = valuesByRecord[0];
    if (firstValues === undefined) {
        return [];
    }

    return diffColumnIds.filter((_, index) => valuesByRecord.some((values) => values[index] !== firstValues[index]));
}

export function createDocumentComparisonViewModel(
    snapshot: IOpenedDocumentComparisonSnapshot,
    localisation: ViewerLocalisationService,
): IOpenedDocumentComparisonViewModel {
    const overlapCounts = new Map(
        snapshot.records.map((record) => [record.key, countOverlappingSessions(record, snapshot.records)]),
    );

    const records = snapshot.records.map((record) => {
        const identitySummaryValue = summariseIdentities(record.identities);

        return {
            activityTotals:
                record.activityTotals === null
                    ? null
                    : {
                          availability: formatDuration(record.activityTotals.availability, localisation),
                          breakOrRest: formatDuration(record.activityTotals.breakOrRest, localisation),
                          driving: formatDuration(record.activityTotals.driving, localisation),
                          work: formatDuration(record.activityTotals.work, localisation),
                      },
            byteLength: formatNumber(record.byteLength, localisation),
            coverage: record.coverage === null ? null : mapCoverage(record.coverage.start, record.coverage.end, localisation),
            displayName: record.displayName,
            documentKind: record.documentKind,
            generations: record.generations,
            identitySummary: identitySummaryValue.length > 0 ? identitySummaryValue : null,
            integrity: createDocumentIntegrityOverviewViewModel(record.integrity, record.integrityCounts, localisation),
            key: record.key,
            odometerRange:
                record.odometerRange === null
                    ? null
                    : {
                          max: formatOdometerValue(record.odometerRange.max, localisation),
                          min: formatOdometerValue(record.odometerRange.min, localisation),
                      },
            openedAt: formatDateTime(record.openedAt, localisation),
            overlappingSessionCount: overlapCounts.get(record.key) ?? 0,
            reopenable: record.reopenToken !== null,
            securityCounts: documentSecurityCounts(record),
            sha256: record.sha256,
            totals: createDocumentContentCountsViewModel(record.counts, localisation),
        };
    });

    return {
        differingColumns: findDifferingColumns(snapshot.records, overlapCounts),
        locale: localisation.locale,
        records,
        timeZone: localisation.timeZone,
    };
}
