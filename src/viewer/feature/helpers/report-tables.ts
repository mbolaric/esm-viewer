import { ACTIVITY_KINDS, type ActivityKind } from '#viewer-domain';
import type { ITranslationService } from '#localization';
import type {
    IActivityDayViewModel,
    IAssociationSectionViewModel,
    IEventFaultRecordViewModel,
    IExportReportViewModel,
    IGnssPositionEvidenceViewModel,
    IIntegrityDetailViewModel,
    IIntegrityScopeViewModel,
    ILocationSectionViewModel,
    ITechnicalFieldViewModel,
    ITechnicalRecordViewModel,
    LocationRecordViewModel,
} from '#viewer-presentation';
import type { IRecordedCardReference } from '#viewer-domain';
import type { IMessageParams, TranslationKey } from '#i18n-locales';

import {
    translateActivityKind,
    translateCalibrationPurpose,
    translateDailyWorkPeriodEntryType,
    translateConsent,
    translateControlType,
    translateEventFaultCode,
    translateEventFaultPurpose,
    translateGeneration,
    translateCardSlot,
    translateCrewPresence,
    translateInsertedCardType,
    translateIntegrityDescription,
    translateIntegrityLimitation,
    translateIntegrityStatus,
    translateLoadType,
    translateOperationType,
    translateRuleProfileName,
    translateSnapshotState,
    translateSpecificConditionType,
    translateTechnicalField,
    translateTechnicalRecordKind,
} from './viewer-labels.js';

// Avoids circular dependency by defining translation service type locally.
export type ViewerTranslationService = ITranslationService<TranslationKey, IMessageParams>;

// One line of a multi-line cell printed as "label value"; `code` marks identifiers set in a monospace face.
export interface IReportLabelledLine {
    readonly code: boolean;
    readonly label: string | null;
    readonly value: string | null;
}

export type ReportLine = string | null | IReportLabelledLine;

// A report cell holds plain text. `null` is a value the document did not record; a list is a multi-line cell whose
// entries may each be unrecorded or labelled. Each serializer decides how to print missing values and line breaks.
export type ReportCell = string | null | readonly ReportLine[];

export interface IReportRow {
    readonly cells: readonly ReportCell[];
}

// The same table feeds the HTML report and the PDF, so both always carry the same columns and rows.
export interface IReportTable {
    readonly caption: string;
    readonly headers: readonly string[];
    readonly rows: readonly IReportRow[];
}

function displayOrNull(value: { readonly display: string } | null | undefined): string | null {
    return value?.display ?? null;
}

function textOrNull(value: string | null | undefined): string | null {
    return value === null || value === undefined || value.length === 0 ? null : value;
}

export interface IIdentityEntry {
    readonly label: string;
    readonly value: string | null;
}

export interface IIdentityGroup {
    readonly entries: readonly IIdentityEntry[];
    readonly sourcePath: string;
}

export function identityGroups(
    viewModel: IExportReportViewModel,
    translationService: ViewerTranslationService,
): IIdentityGroup[] {
    const t = translationService.translate.bind(translationService);
    return viewModel.overview.identities.map((identity): IIdentityGroup => {
        if (identity.kind === 'driver') {
            const driver = identity.identity;
            return {
                entries: [
                    { label: t('overview.identity.surname'), value: textOrNull(driver.surname) },
                    { label: t('overview.identity.firstNames'), value: textOrNull(driver.firstNames) },
                    { label: t('overview.identity.cardHolderBirthDate'), value: displayOrNull(identity.cardHolderBirthDate) },
                    { label: t('overview.identity.cardNumber'), value: textOrNull(driver.cardNumber) },
                    { label: t('overview.identity.issuingMemberState'), value: textOrNull(driver.issuingMemberState) },
                    { label: t('overview.identity.cardIssueDate'), value: displayOrNull(identity.cardIssueDate) },
                    { label: t('overview.identity.cardValidityBegin'), value: displayOrNull(identity.cardValidityBegin) },
                    { label: t('overview.identity.cardExpiryDate'), value: displayOrNull(identity.cardExpiryDate) },
                    {
                        label: t('overview.identity.cardIssuingAuthorityName'),
                        value: textOrNull(driver.cardIssuingAuthorityName),
                    },
                ],
                sourcePath: driver.source.path,
            };
        }
        const vehicle = identity.identity;
        return {
            entries: [
                {
                    label: t('overview.identity.vehicleIdentificationNumber'),
                    value: textOrNull(vehicle.vehicleIdentificationNumber),
                },
                { label: t('overview.identity.registrationNumber'), value: textOrNull(vehicle.registrationNumber) },
                { label: t('overview.identity.registrationMemberState'), value: textOrNull(vehicle.registrationMemberState) },
            ],
            sourcePath: vehicle.source.path,
        };
    });
}

export function activityRecordTable(day: IActivityDayViewModel, translationService: ViewerTranslationService): IReportTable {
    const t = translationService.translate.bind(translationService);
    const headers = [
        t('activities.start'),
        t('activities.end'),
        t('activities.duration'),
        t('activities.activityColumn'),
        t('associations.slot'),
        t('activities.crew.column'),
        t('activities.evidence'),
    ];
    return {
        caption: t('activities.recordsHeading'),
        headers,
        rows: day.records.map((record) => ({
            cells: [
                record.start.display,
                record.end.display,
                record.duration.display,
                translateActivityKind(record.activity, translationService),
                translateCardSlot(record.record.slot, translationService),
                translateCrewPresence(record.record.crewPresence, translationService),
                record.origin === 'recorded' ? t('activities.origin.recorded') : t('activities.origin.inferredGap'),
            ],
        })),
    };
}

export interface IActivityTotalEntry {
    readonly activity: ActivityKind;
    readonly display: string;
    readonly label: string;
}

export function activityTotalEntries(
    day: IActivityDayViewModel,
    translationService: ViewerTranslationService,
): readonly IActivityTotalEntry[] {
    return ACTIVITY_KINDS.map((activity) => ({
        activity,
        display: day.totals[activity].display,
        label: translateActivityKind(activity, translationService),
    }));
}

export function associationTable(
    section: IAssociationSectionViewModel,
    translationService: ViewerTranslationService,
): IReportTable {
    const t = translationService.translate.bind(translationService);
    if (section.documentKind === 'driverCard') {
        return {
            caption: t('associations.recordsHeading.driverCard'),
            headers: [
                t('associations.vehicle'),
                t('associations.vehicleIdentificationNumber'),
                t('associations.firstUse'),
                t('associations.lastUse'),
                t('activities.duration'),
                t('report.associations.odometerBegin'),
                t('report.associations.odometerEnd'),
                t('associations.distance'),
                t('associations.recorded'),
                t('associations.device'),
                t('associations.manufacturer'),
            ],
            rows: section.records.flatMap((record): IReportRow[] => {
                if (record.kind === 'vehicleUse') {
                    return [
                        {
                            cells: [
                                textOrNull([record.registrationNumber, record.registrationMemberState].filter(Boolean).join(' ')),
                                textOrNull(record.vehicleIdentificationNumber),
                                record.firstUse.display,
                                displayOrNull(record.lastUse),
                                displayOrNull(record.duration),
                                displayOrNull(record.odometerBegin),
                                displayOrNull(record.odometerEnd),
                                displayOrNull(record.distance),
                                '',
                                '',
                                '',
                            ],
                        },
                    ];
                }
                if (record.kind === 'vehicleUnitUse') {
                    return [
                        {
                            cells: [
                                String(record.deviceID),
                                '',
                                '',
                                '',
                                '',
                                '',
                                '',
                                '',
                                record.usedAt.display,
                                [String(record.deviceID), record.vuSoftwareVersion],
                                record.manufacturerCode.display,
                            ],
                        },
                    ];
                }
                return [];
            }),
        };
    }
    return {
        caption: t('associations.recordsHeading.vehicleUnit'),
        headers: [
            t('associations.identity'),
            t('associations.slot'),
            t('associations.inserted'),
            t('associations.withdrawn'),
            t('activities.duration'),
            t('report.associations.odometerInsertion'),
            t('report.associations.odometerWithdrawal'),
        ],
        rows: section.records.flatMap((record): IReportRow[] =>
            record.kind === 'cardUse'
                ? [
                      {
                          cells: [
                              [
                                  textOrNull(record.cardNumber),
                                  textOrNull(record.surname),
                                  textOrNull(record.firstNames),
                                  textOrNull(record.issuingMemberState),
                                  translateInsertedCardType(record.cardType, translationService),
                              ],
                              translateCardSlot(record.slot, translationService),
                              record.insertion.display,
                              displayOrNull(record.withdrawal),
                              displayOrNull(record.duration),
                              displayOrNull(record.odometerAtInsertion),
                              displayOrNull(record.odometerAtWithdrawal),
                          ],
                      },
                  ]
                : [],
        ),
    };
}

function eventFaultRow(record: IEventFaultRecordViewModel, translationService: ViewerTranslationService): IReportRow {
    const t = translationService.translate.bind(translationService);
    const contextLines = [
        record.recordPurpose === null ? null : translateEventFaultPurpose(record.recordPurpose, translationService),
        record.similarOccurrences?.display ?? null,
        [record.registrationMemberState, record.registrationNumber].filter(Boolean).join(' '),
    ].filter((value): value is string => value !== null && value.length > 0);

    return {
        cells: [
            record.recordKind === 'event' ? t('eventsFaults.kind.event') : t('eventsFaults.kind.fault'),
            record.start.display,
            [displayOrNull(record.end), displayOrNull(record.duration)],
            translateEventFaultCode(record.code, translationService),
            contextLines,
            record.source.path,
        ],
    };
}

export function eventFaultTable(
    records: readonly IEventFaultRecordViewModel[],
    translationService: ViewerTranslationService,
): IReportTable {
    const t = translationService.translate.bind(translationService);
    return {
        caption: t('eventsFaults.recordsHeading'),
        headers: [
            t('eventsFaults.type'),
            t('eventsFaults.start'),
            t('eventsFaults.endDuration'),
            t('eventsFaults.code'),
            t('eventsFaults.context'),
            t('eventsFaults.source'),
        ],
        rows: records.map((record) => eventFaultRow(record, translationService)),
    };
}

export function scopeStatusLabel(scope: IIntegrityScopeViewModel, translationService: ViewerTranslationService): string {
    const assessment = scope.assessment;
    if (assessment === null) {
        return translationService.translate('integrity.noCheckedItems');
    }
    return translateIntegrityStatus(assessment.status, translationService);
}

export function integrityScopeTable(
    integrity: IIntegrityDetailViewModel,
    translationService: ViewerTranslationService,
): IReportTable {
    const t = translationService.translate.bind(translationService);
    const headers = [t('integrity.generation'), t('integrity.scopeStatus'), t('integrity.scopeSource')];
    return {
        caption: t('integrity.scopeHeading'),
        headers,
        rows: integrity.scopes.map((scope) => ({
            cells: [
                translateGeneration(scope.applicationGeneration, translationService),
                scopeStatusLabel(scope, translationService),
                scope.source.path,
            ],
        })),
    };
}

export function complianceTable(
    compliance: IExportReportViewModel['compliance'],
    translationService: ViewerTranslationService,
): IReportTable {
    const t = translationService.translate.bind(translationService);
    return {
        caption: t('compliance.tableCaption'),
        headers: [
            t('compliance.colSeverity'),
            t('compliance.colTitle'),
            t('compliance.colCategory'),
            t('compliance.colLegal'),
            t('compliance.colAllowed'),
            t('compliance.colMeasured'),
            t('compliance.colExcess'),
            t('compliance.colSource'),
        ],
        rows: compliance.infringements.map((infringement) => ({
            cells: [
                infringement.severityDisplay,
                infringement.title,
                infringement.categoryDisplay,
                infringement.legalDisplay,
                infringement.allowedDisplay,
                infringement.measuredDisplay,
                infringement.excessDisplay,
                infringement.sourcePath,
            ],
        })),
    };
}

export interface IComplianceSummaryText {
    // Per-severity counts, for example "Most Serious: 3, Very Serious: 0".
    readonly breakdown: string;
    readonly profileLabel: string;
    readonly profileName: string;
    readonly profileVersion: string;
    readonly total: string;
    readonly totalLabel: string;
}

export function complianceSummaryText(
    compliance: IExportReportViewModel['compliance'],
    translationService: ViewerTranslationService,
): IComplianceSummaryText {
    const t = translationService.translate.bind(translationService);
    const profile = compliance.selectedProfile;
    const summary = compliance.summary;
    const counts: readonly (readonly [string, number])[] = [
        [t('compliance.severityMostSerious'), summary.mostSeriousCount],
        [t('compliance.severityVerySerious'), summary.verySeriousCount],
        [t('compliance.severitySerious'), summary.seriousCount],
        [t('compliance.severityMinor'), summary.minorCount],
        [t('compliance.anomalies'), summary.anomalyCount],
    ];
    return {
        breakdown: counts.map(([label, count]) => `${label}: ${String(count)}`).join(', '),
        profileLabel: t('compliance.regulatoryProfile'),
        profileName: translateRuleProfileName(profile.profileId, profile.name, translationService),
        profileVersion: profile.version,
        total: String(summary.totalInfringements),
        totalLabel: t('compliance.totalInfringements'),
    };
}

export interface ITechnicalReportField {
    readonly label: string;
    readonly value: string;
    // Identifiers and codes the HTML report sets in a monospace face.
    readonly isCode: boolean;
}

export interface ITechnicalReportRecord {
    readonly fields: readonly ITechnicalReportField[];
    readonly kindLabel: string;
    readonly recordedAt: string | null;
    readonly sourcePath: string;
}

function technicalFieldText(field: ITechnicalFieldViewModel, translationService: ViewerTranslationService): string {
    const value = field.value;
    if (value.kind === 'calibrationPurpose') {
        return translateCalibrationPurpose(value.value, translationService);
    }
    if (value.kind === 'cardType') {
        return translateInsertedCardType(value.value, translationService);
    }
    if (value.kind === 'controlType') {
        return translateControlType(value.value, translationService);
    }
    if (value.kind === 'specificConditionType') {
        return translateSpecificConditionType(value.value, translationService);
    }
    if (value.kind === 'snapshotState') {
        return translateSnapshotState(value.value, translationService);
    }
    if (value.kind === 'consent') {
        return translateConsent(value.value, translationService);
    }
    return value.display ?? translationService.translate('overview.identity.missing');
}

export function technicalReportRecords(
    records: readonly ITechnicalRecordViewModel[],
    translationService: ViewerTranslationService,
): ITechnicalReportRecord[] {
    return records.map((record) => ({
        fields: record.fields.map((field) => ({
            isCode: field.value.kind === 'display' && field.value.display !== null && field.value.code,
            label: translateTechnicalField(field.key, translationService),
            value: technicalFieldText(field, translationService),
        })),
        kindLabel: translateTechnicalRecordKind(record.kind, translationService),
        recordedAt: record.recordedAt,
        sourcePath: record.source.path,
    }));
}

function labelled(label: string | null, value: string | null, code = false): IReportLabelledLine {
    return { code, label, value };
}

function cardReferenceLines(card: IRecordedCardReference | null, translationService: ViewerTranslationService): ReportLine[] {
    const t = translationService.translate.bind(translationService);
    if (card === null) {
        return [null];
    }
    return [
        labelled(`${t('overview.identity.cardNumber')}:`, card.cardNumber),
        labelled(`${t('overview.identity.issuingMemberState')}:`, card.issuingMemberState),
        labelled(`${t('associations.identity')}:`, translateInsertedCardType(card.cardType, translationService)),
    ];
}

function positionEvidenceLines(
    position: IGnssPositionEvidenceViewModel,
    translationService: ViewerTranslationService,
): ReportLine[] {
    const t = translationService.translate.bind(translationService);
    return [
        labelled(t('places.determinedAt'), position.determinedAt.display),
        labelled(t('places.coordinates'), position.coordinateDisplayValue, true),
        labelled(t('places.accuracy'), position.accuracy.display),
        ...(position.authenticationStatus === null
            ? []
            : [labelled(t('places.authenticationStatus'), position.authenticationStatus.display)]),
    ];
}

function placePositionLines(
    country: string | null,
    region: string | null,
    position: IGnssPositionEvidenceViewModel | null,
    translationService: ViewerTranslationService,
): ReportLine[] {
    const t = translationService.translate.bind(translationService);
    return [
        labelled(t('places.country'), country),
        labelled(t('places.region'), region),
        ...(position === null ? [labelled(t('places.coordinates'), null)] : positionEvidenceLines(position, translationService)),
    ];
}

function odometerAccuracyLines(
    odometer: { readonly display: string } | null,
    position: IGnssPositionEvidenceViewModel | null,
    translationService: ViewerTranslationService,
): ReportLine[] {
    const t = translationService.translate.bind(translationService);
    return [
        labelled(t('associations.odometer'), odometer?.display ?? null),
        ...(position === null
            ? []
            : [
                  labelled(t('places.accuracy'), position.accuracy.display),
                  ...(position.authenticationStatus === null
                      ? []
                      : [labelled(t('places.authenticationStatus'), position.authenticationStatus.display)]),
              ]),
    ];
}

function placeRow(record: LocationRecordViewModel, translationService: ViewerTranslationService): IReportRow {
    const t = translationService.translate.bind(translationService);
    const source: ReportCell = [
        translateGeneration(record.generation, translationService),
        labelled(null, record.source.path, true),
    ];
    switch (record.kind) {
        case 'dailyWorkPeriodPlace':
            return {
                cells: [
                    translateDailyWorkPeriodEntryType(record.entryType, translationService),
                    record.entryAt.display,
                    placePositionLines(record.country, record.region, record.position, translationService),
                    cardReferenceLines(record.card, translationService),
                    odometerAccuracyLines(record.odometer, record.position, translationService),
                    source,
                ],
            };
        case 'accumulatedDrivingPosition':
            return {
                cells: [
                    t('places.positionType'),
                    record.recordedAt.display,
                    positionEvidenceLines(record.position, translationService),
                    [
                        ...cardReferenceLines(record.driverCard, translationService),
                        ...cardReferenceLines(record.coDriverCard, translationService),
                    ],
                    odometerAccuracyLines(record.odometer, record.position, translationService),
                    source,
                ],
            };
        case 'borderCrossing':
            return {
                cells: [
                    t('places.borderCrossings'),
                    record.crossedAt.display,
                    placePositionLines(
                        record.countryLeft !== null && record.countryEntered !== null
                            ? `${record.countryLeft} → ${record.countryEntered}`
                            : (record.countryEntered ?? record.countryLeft),
                        null,
                        record.position,
                        translationService,
                    ),
                    '-',
                    odometerAccuracyLines(record.odometer, record.position, translationService),
                    source,
                ],
            };
        case 'loadUnloadOperation':
            return {
                cells: [
                    translateOperationType(record.operationType, translationService),
                    record.operationAt.display,
                    placePositionLines(record.country, record.region, record.position, translationService),
                    '-',
                    odometerAccuracyLines(record.odometer, record.position, translationService),
                    source,
                ],
            };
        case 'loadTypeEntry':
            return {
                cells: [
                    translateLoadType(record.loadType, translationService),
                    record.enteredAt.display,
                    translateLoadType(record.loadType, translationService),
                    '-',
                    '-',
                    source,
                ],
            };
    }
}

export function placesTable(section: ILocationSectionViewModel, translationService: ViewerTranslationService): IReportTable {
    const t = translationService.translate.bind(translationService);
    return {
        caption: t('places.recordsCaption'),
        headers: [
            t('eventsFaults.type'),
            t('places.recordedTime'),
            t('places.placePosition'),
            t('places.cardContext'),
            t('places.odometerAccuracy'),
            t('eventsFaults.source'),
        ],
        rows: section.records.map((record) => placeRow(record, translationService)),
    };
}

export function integrityItemTable(
    integrity: IIntegrityDetailViewModel,
    translationService: ViewerTranslationService,
): IReportTable {
    const t = translationService.translate.bind(translationService);
    return {
        caption: t('integrity.verificationItemsHeading'),
        headers: [t('integrity.record'), t('integrity.evidence'), t('integrity.scopeStatus')],
        rows: integrity.items.map((item) => ({
            cells: [item.recordId, item.source.path, translateIntegrityStatus(item.status, translationService)],
        })),
    };
}

export interface IIntegritySummary {
    readonly counts: readonly (readonly [string, string])[];
    readonly description: string;
    readonly status: string;
}

export function integritySummary(
    viewModel: IExportReportViewModel,
    translationService: ViewerTranslationService,
): IIntegritySummary {
    const t = translationService.translate.bind(translationService);
    const overview = viewModel.overview.integrity;
    return {
        counts: [
            [t('overview.integrity.checkedItems'), overview.checkedItems.display],
            [t('overview.integrity.validItems'), overview.validItems.display],
            [t('overview.integrity.invalidItems'), overview.invalidItems.display],
        ],
        description: translateIntegrityDescription(overview.assessment, translationService),
        status: translateIntegrityStatus(overview.status, translationService),
    };
}

const limitationSectionKeys = {
    activities: 'navigator.section.activities',
    associations: 'report.section.associations',
    eventsFaults: 'report.section.eventsFaults',
    places: 'report.section.places',
    technical: 'report.section.technical',
} as const satisfies Readonly<Record<string, TranslationKey>>;

// Every statement the report makes about what it could not show or does not claim.
export function reportLimitations(viewModel: IExportReportViewModel, translationService: ViewerTranslationService): string[] {
    const t = translationService.translate.bind(translationService);
    const limitations: string[] = [];
    const unavailableSections = (
        [
            ['activities', viewModel.activities],
            ['associations', viewModel.associations],
            ['eventsFaults', viewModel.eventsAndFaults],
            ['places', viewModel.locations],
            ['technical', viewModel.technical],
        ] as const
    )
        .filter(([, sectionModel]) => !sectionModel.ok)
        .map(([id]) => t(limitationSectionKeys[id]));
    if (unavailableSections.length > 0) {
        limitations.push(`${t('report.limitations.sectionUnavailable')} ${unavailableSections.join(', ')}`);
    }
    const integrityLimitation = translateIntegrityLimitation(viewModel.overview.integrity.assessment, translationService);
    if (integrityLimitation !== null) {
        limitations.push(integrityLimitation);
    }
    limitations.push(t('report.limitations.activities'), t('report.limitations.parser'));
    return limitations;
}
