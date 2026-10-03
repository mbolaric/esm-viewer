import {
    createDocumentOverviewProjection,
    projectDocumentEventFaultRecords,
    projectDocumentTechnicalRecords,
    type IDocumentContentCounts,
    type IDocumentCoverage,
    type IDocumentIntegrityCounts,
    type OpenedTachographDocument,
} from '#viewer-application';
import {
    type IDriverIdentity,
    type IDrivingLicenceTechnicalData,
    type ISourceReference,
    type ITachographWarning,
    type IntegrityAssessment,
    type IVehicleIdentity,
    type TachographGeneration,
    type UtcTimestamp,
} from '#viewer-domain';

import { classifyEventFaultSecurity } from './event-fault-view-model.js';
import {
    formatDateTime,
    formatNumber,
    formatUtcDate,
    type IFormattedUtcRange,
    type IFormattedValue,
    type ViewerLocalisationService,
} from '../helpers/view-model-formatting.js';

export interface IDriverIdentityViewModel {
    readonly cardExpiryDate: IFormattedValue<UtcTimestamp> | null;
    readonly cardHolderBirthDate: IFormattedValue<UtcTimestamp> | null;
    readonly cardIssueDate: IFormattedValue<UtcTimestamp> | null;
    readonly cardValidityBegin: IFormattedValue<UtcTimestamp> | null;
    readonly cardIssuingAuthorityName: string | null;
    readonly identity: IDriverIdentity;
    readonly kind: 'driver';
    readonly licenceIssuingAuthority: string | null;
    readonly licenceIssuingMemberState: string | null;
    readonly licenceNumber: string | null;
}

export interface IVehicleIdentityViewModel {
    readonly identity: IVehicleIdentity;
    readonly kind: 'vehicle';
    readonly registrationMemberState: string | null;
    readonly registrationNumber: string | null;
    readonly vehicleIdentificationNumber: string | null;
}

export type IdentityViewModel = IDriverIdentityViewModel | IVehicleIdentityViewModel;

export interface IDocumentContentCountsViewModel {
    readonly activityDays: IFormattedValue<number>;
    readonly events: IFormattedValue<number>;
    readonly faults: IFormattedValue<number>;
    readonly inferredActivityGaps: IFormattedValue<number>;
    readonly recordedActivityIntervals: IFormattedValue<number>;
    readonly totalEventsAndFaults: IFormattedValue<number>;
    readonly warnings: IFormattedValue<number>;
}

export interface IDocumentIntegrityOverviewViewModel {
    readonly assessment: IntegrityAssessment;
    readonly checkedItems: IFormattedValue<number>;
    readonly invalidItems: IFormattedValue<number>;
    readonly status: IntegrityAssessment['status'];
    readonly validItems: IFormattedValue<number>;
}

export interface ICardNotesViewModel {
    readonly generation: TachographGeneration;
    readonly source: ISourceReference<TachographGeneration, 'driverCard'>;
    readonly text: string;
}

export function createDocumentContentCountsViewModel(
    counts: IDocumentContentCounts,
    localisation: ViewerLocalisationService,
): IDocumentContentCountsViewModel {
    return {
        activityDays: formatNumber(counts.activityDays, localisation),
        events: formatNumber(counts.events, localisation),
        faults: formatNumber(counts.faults, localisation),
        inferredActivityGaps: formatNumber(counts.inferredActivityGaps, localisation),
        recordedActivityIntervals: formatNumber(counts.recordedActivityIntervals, localisation),
        totalEventsAndFaults: formatNumber(counts.events + counts.faults, localisation),
        warnings: formatNumber(counts.warnings, localisation),
    };
}

function mapCoverage(coverage: IDocumentCoverage | null, localisation: ViewerLocalisationService): IFormattedUtcRange | null {
    return coverage === null
        ? null
        : {
              end: formatDateTime(coverage.end, localisation),
              start: formatDateTime(coverage.start, localisation),
          };
}

export function createDocumentIntegrityOverviewViewModel(
    assessment: IntegrityAssessment,
    counts: IDocumentIntegrityCounts,
    localisation: ViewerLocalisationService,
): IDocumentIntegrityOverviewViewModel {
    return {
        assessment,
        checkedItems: formatNumber(counts.checkedItems, localisation),
        invalidItems: formatNumber(counts.invalidItems, localisation),
        status: assessment.status,
        validItems: formatNumber(counts.validItems, localisation),
    };
}

function mapIdentity(
    identity: IDriverIdentity | IVehicleIdentity,
    drivingLicenceRecords: readonly IDrivingLicenceTechnicalData[],
    localisation: ViewerLocalisationService,
): IdentityViewModel {
    if (identity.kind === 'driver') {
        const licence = drivingLicenceRecords.find((record) => record.generation === identity.source.generation);

        return {
            cardExpiryDate: identity.cardExpiryDate === null ? null : formatUtcDate(identity.cardExpiryDate, localisation),
            cardHolderBirthDate:
                identity.cardHolderBirthDate === null ? null : formatUtcDate(identity.cardHolderBirthDate, localisation),
            cardIssueDate: identity.cardIssueDate === null ? null : formatUtcDate(identity.cardIssueDate, localisation),
            cardValidityBegin:
                identity.cardValidityBegin === null ? null : formatUtcDate(identity.cardValidityBegin, localisation),
            cardIssuingAuthorityName: identity.cardIssuingAuthorityName,
            identity,
            kind: 'driver',
            licenceIssuingAuthority: licence?.issuingAuthority ?? null,
            licenceIssuingMemberState: licence?.issuingMemberState ?? null,
            licenceNumber: licence?.licenceNumber ?? null,
        };
    }

    return {
        identity,
        kind: 'vehicle',
        registrationMemberState: identity.registrationMemberState,
        registrationNumber: identity.registrationNumber,
        vehicleIdentificationNumber: identity.vehicleIdentificationNumber,
    };
}

export function createDocumentOverviewViewModel(
    document: OpenedTachographDocument,
    localisation: ViewerLocalisationService,
): IDocumentOverviewViewModel {
    const projection = createDocumentOverviewProjection(document);
    const eventFaultRecords = projectDocumentEventFaultRecords(document);
    const securityCriticalCount = eventFaultRecords.filter(
        (record) => classifyEventFaultSecurity(record.code) === 'securityCritical',
    ).length;
    const drivingLicenceRecords = projectDocumentTechnicalRecords(document).filter(
        (record): record is IDrivingLicenceTechnicalData => record.kind === 'drivingLicenceTechnicalData',
    );

    return {
        applicationGenerations: projection.applicationGenerations,
        byteLength: formatNumber(document.source.byteLength, localisation),
        cardNotes: projection.cardNotes.map((note) => ({
            generation: note.source.generation,
            source: note.source,
            text: note.text,
        })),
        counts: createDocumentContentCountsViewModel(projection.counts, localisation),
        coverage: mapCoverage(projection.coverage, localisation),
        displayName: document.source.displayName,
        documentKind: document.content.documentKind,
        generation: document.content.generation,
        generationDisplay: document.content.generation.toUpperCase(),
        identities: projection.identities.map((identity) => mapIdentity(identity, drivingLicenceRecords, localisation)),
        integrity: createDocumentIntegrityOverviewViewModel(document.integrity, projection.integrityCounts, localisation),
        locale: localisation.locale,
        openedAt: formatDateTime(document.source.openedAt, localisation),
        securityCriticalCount: formatNumber(securityCriticalCount, localisation),
        sha256: document.source.sha256,
        timeZone: localisation.timeZone,
        warnings: projection.warnings,
    };
}
export interface IDocumentOverviewViewModel {
    readonly applicationGenerations: readonly TachographGeneration[];
    readonly byteLength: IFormattedValue<number>;
    readonly cardNotes: readonly ICardNotesViewModel[];
    readonly counts: IDocumentContentCountsViewModel;
    readonly coverage: IFormattedUtcRange | null;
    readonly displayName: OpenedTachographDocument['source']['displayName'];
    readonly documentKind: OpenedTachographDocument['content']['documentKind'];
    readonly generation: OpenedTachographDocument['content']['generation'];
    readonly generationDisplay: string;
    readonly identities: readonly IdentityViewModel[];
    readonly integrity: IDocumentIntegrityOverviewViewModel;
    readonly locale: string;
    readonly openedAt: IFormattedValue<UtcTimestamp>;
    readonly securityCriticalCount: IFormattedValue<number>;
    readonly sha256: OpenedTachographDocument['source']['sha256'];
    readonly timeZone: string;
    readonly warnings: readonly ITachographWarning[];
}
