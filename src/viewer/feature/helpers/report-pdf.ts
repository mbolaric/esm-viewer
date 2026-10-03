import { translateActivityKind, translateDocumentKind, translateGeneration, translateIntegrityStatus } from './viewer-labels.js';
import {
    activityRecordTable,
    activityTotalEntries,
    associationTable,
    complianceSummaryText,
    complianceTable,
    eventFaultTable,
    identityGroups,
    integrityItemTable,
    integrityScopeTable,
    integritySummary,
    placesTable,
    reportLimitations,
    technicalReportRecords,
    type IReportTable,
    type ReportCell,
    type ReportLine,
    type ViewerTranslationService,
} from './report-tables.js';
import type { IFactualReportPdfRequest } from '#contracts';
import { ACTIVITY_KINDS } from '#viewer-domain';
import type { IExportReportViewModel, ITechnicalRecordViewModel } from '#viewer-presentation';
import { MILLISECONDS_PER_DAY } from '#time';

// Factual-report PDF request: the same sections, tables, notes, and limitations as the HTML report, rendered natively.
interface IPdfSectionRow {
    readonly cells: readonly string[];
}

interface IPdfSectionTimeline {
    readonly segments: readonly {
        readonly activity: string;
        readonly timelineEndMs: number;
        readonly timelineStartMs: number;
    }[];
    readonly totalMs: number;
}

interface IPdfSection {
    readonly headers: readonly string[];
    readonly rows: readonly IPdfSectionRow[];
    readonly subtitle: string;
    readonly timeline?: IPdfSectionTimeline;
    readonly title: string;
}

const PDF_MISSING = '—';

function pdfLine(line: ReportLine): string | null {
    if (line === null || typeof line === 'string') {
        return line;
    }
    const value = line.value ?? PDF_MISSING;
    return line.label === null ? value : `${line.label} ${value}`;
}

// The PDF prints a missing value as an em dash and joins the lines of a multi-line cell.
function pdfCell(cell: ReportCell): string {
    if (cell === null) {
        return PDF_MISSING;
    }
    if (typeof cell === 'string') {
        return cell;
    }
    return (
        cell
            .map(pdfLine)
            .filter((line): line is string => line !== null && line.length > 0)
            .join(' · ') || PDF_MISSING
    );
}

function pdfTableSection(table: IReportTable, title: string, subtitle = ''): IPdfSection {
    return { headers: table.headers, rows: table.rows.map((row) => ({ cells: row.cells.map(pdfCell) })), subtitle, title };
}

// A text-only section: the native renderer prints the title and subtitle and skips the empty table.
function pdfNoteSection(title: string, subtitle: string): IPdfSection {
    return { headers: [], rows: [], subtitle, title };
}

function unavailableSection(title: string, translationService: ViewerTranslationService): IPdfSection[] {
    return [pdfNoteSection(title, translationService.translate('report.section.unavailableDescription'))];
}

function buildIdentitySection(viewModel: IExportReportViewModel, translationService: ViewerTranslationService): IPdfSection[] {
    const t = translationService.translate.bind(translationService);
    const groups = identityGroups(viewModel, translationService);
    if (groups.length === 0) {
        return [];
    }
    const rows = groups.flatMap((group): IPdfSectionRow[] => [
        ...group.entries.map((entry) => ({ cells: [entry.label, entry.value ?? PDF_MISSING] })),
        { cells: [t('overview.identity.sourceReference'), group.sourcePath] },
    ]);
    return [
        {
            headers: [t('overview.identity.heading'), t('rawData.value.value')],
            rows,
            subtitle: '',
            title: t('overview.identity.heading'),
        },
    ];
}

function buildActivitiesSections(viewModel: IExportReportViewModel, translationService: ViewerTranslationService): IPdfSection[] {
    const t = translationService.translate.bind(translationService);
    const title = t('navigator.section.activities');
    if (!viewModel.activities.ok || viewModel.activities.viewModel === null) {
        return unavailableSection(title, translationService);
    }
    const days = viewModel.activities.viewModel.days;
    if (days.length === 0) {
        return [];
    }
    const sections: IPdfSection[] = [
        {
            headers: [t('activities.date'), ...ACTIVITY_KINDS.map((kind) => translateActivityKind(kind, translationService))],
            rows: days.map((day) => ({
                cells: [day.date.display, ...activityTotalEntries(day, translationService).map((entry) => entry.display)],
            })),
            subtitle: t('activities.viewerCalculationNote'),
            title,
        },
    ];
    for (const day of days) {
        const dayTitle = `${t('activities.timeline.heading')} — ${day.date.display}`;
        const totals = activityTotalEntries(day, translationService)
            .map((entry) => `${entry.label}: ${entry.display}`)
            .join(' · ');
        if (day.records.length === 0) {
            sections.push(pdfNoteSection(dayTitle, totals));
            continue;
        }
        sections.push({
            ...pdfTableSection(activityRecordTable(day, translationService), dayTitle, totals),
            timeline: {
                segments: day.records.map((record) => ({
                    activity: record.activity,
                    timelineEndMs: record.timelineEnd,
                    timelineStartMs: record.timelineStart,
                })),
                totalMs: day.timelineEnd > 0 ? day.timelineEnd : MILLISECONDS_PER_DAY,
            },
        });
    }
    return sections;
}

function buildComplianceSection(viewModel: IExportReportViewModel, translationService: ViewerTranslationService): IPdfSection[] {
    const t = translationService.translate.bind(translationService);
    const compliance = viewModel.compliance;
    const summary = complianceSummaryText(compliance, translationService);
    const title = t('navigator.section.compliance');
    const subtitle = `${summary.profileLabel} ${summary.profileName} (v${summary.profileVersion}) · ${summary.totalLabel}: ${summary.total} (${summary.breakdown})`;
    if (compliance.infringements.length === 0) {
        return [pdfNoteSection(title, `${subtitle} · ${t('compliance.emptyTitle')}`)];
    }
    return [pdfTableSection(complianceTable(compliance, translationService), title, subtitle)];
}

function buildAssociationsSection(
    viewModel: IExportReportViewModel,
    translationService: ViewerTranslationService,
): IPdfSection[] {
    const title = translationService.translate('report.section.associations');
    const associations = viewModel.associations;
    if (!associations.ok || associations.viewModel === null) {
        return unavailableSection(title, translationService);
    }
    if (associations.viewModel.records.length === 0) {
        return [];
    }
    return [pdfTableSection(associationTable(associations.viewModel, translationService), title)];
}

function buildPlacesSection(viewModel: IExportReportViewModel, translationService: ViewerTranslationService): IPdfSection[] {
    const t = translationService.translate.bind(translationService);
    const title = t('report.section.places');
    const locations = viewModel.locations;
    if (!locations.ok || locations.viewModel === null) {
        return unavailableSection(title, translationService);
    }
    if (locations.viewModel.records.length === 0) {
        return [];
    }
    return [
        pdfTableSection(
            placesTable(locations.viewModel, translationService),
            title,
            locations.viewModel.hasGen2v2ParserLimitation ? t('places.limitation') : '',
        ),
    ];
}

function buildEventsFaultsSection(
    viewModel: IExportReportViewModel,
    translationService: ViewerTranslationService,
): IPdfSection[] {
    const title = translationService.translate('report.section.eventsFaults');
    const eventsAndFaults = viewModel.eventsAndFaults;
    if (!eventsAndFaults.ok || eventsAndFaults.viewModel === null) {
        return unavailableSection(title, translationService);
    }
    if (eventsAndFaults.viewModel.records.length === 0) {
        return [];
    }
    return [pdfTableSection(eventFaultTable(eventsAndFaults.viewModel.records, translationService), title)];
}

function technicalGroupSection(
    records: readonly ITechnicalRecordViewModel[],
    title: string,
    translationService: ViewerTranslationService,
): IPdfSection[] {
    const t = translationService.translate.bind(translationService);
    const rows = technicalReportRecords(records, translationService).flatMap((record) => {
        const heading = record.recordedAt === null ? record.kindLabel : `${record.kindLabel} — ${record.recordedAt}`;
        return record.fields.map((field): IPdfSectionRow => ({ cells: [heading, field.label, field.value, record.sourcePath] }));
    });
    if (rows.length === 0) {
        return [];
    }
    return [
        {
            headers: [t('eventsFaults.type'), t('rawData.value.key'), t('rawData.value.value'), t('eventsFaults.source')],
            rows,
            subtitle: '',
            title,
        },
    ];
}

function buildTechnicalSection(viewModel: IExportReportViewModel, translationService: ViewerTranslationService): IPdfSection[] {
    const t = translationService.translate.bind(translationService);
    const technical = viewModel.technical;
    if (!technical.ok || technical.viewModel === null) {
        return unavailableSection(t('report.section.technical'), translationService);
    }
    const isCard = technical.viewModel.documentKind === 'driverCard';
    return [
        ...technicalGroupSection(
            technical.viewModel.identificationRecords,
            `${t('report.section.technical')} — ${isCard ? t('technical.identificationHeading') : t('technical.vehicleUnit.identificationHeading')}`,
            translationService,
        ),
        ...technicalGroupSection(
            technical.viewModel.operationalRecords,
            `${t('report.section.technical')} — ${isCard ? t('technical.operationalHeading') : t('technical.vehicleUnit.operationalHeading')}`,
            translationService,
        ),
    ];
}

function buildIntegritySections(viewModel: IExportReportViewModel, translationService: ViewerTranslationService): IPdfSection[] {
    const t = translationService.translate.bind(translationService);
    const title = t('report.section.integrity');
    const integrity = viewModel.integrity;
    const summary = integritySummary(viewModel, translationService);
    const sections: IPdfSection[] = [
        {
            headers: [title, t('rawData.value.value')],
            rows: summary.counts.map(([label, value]) => ({ cells: [label, value] })),
            subtitle: `${summary.status} — ${summary.description} · ${t('integrity.parsedIndependently')}`,
            title,
        },
    ];
    if (integrity.scopes.length > 0) {
        sections.push(pdfTableSection(integrityScopeTable(integrity, translationService), t('integrity.scopeHeading')));
    }
    sections.push(
        integrity.items.length === 0
            ? pdfNoteSection(t('integrity.verificationItemsHeading'), t('integrity.verificationItemsEmpty'))
            : pdfTableSection(integrityItemTable(integrity, translationService), t('integrity.verificationItemsHeading')),
    );
    return sections;
}

function buildLimitationsSection(viewModel: IExportReportViewModel, translationService: ViewerTranslationService): IPdfSection[] {
    const heading = translationService.translate('report.limitations.heading');
    return [
        {
            headers: [heading],
            rows: reportLimitations(viewModel, translationService).map((item) => ({ cells: [item] })),
            subtitle: '',
            title: heading,
        },
    ];
}

export function createFactualReportPdfRequest(
    viewModel: IExportReportViewModel,
    translationService: ViewerTranslationService,
    locale: string,
): IFactualReportPdfRequest {
    const t = translationService.translate.bind(translationService);
    const overview = viewModel.overview;
    const isCard = overview.documentKind === 'driverCard';

    let driverOrVehicleName = '—';
    let cardOrVin = '—';
    for (const identity of overview.identities) {
        if (identity.kind === 'driver') {
            const driver = identity.identity;
            const names = [driver.firstNames, driver.surname].filter(Boolean).join(' ');
            if (names.length > 0) {
                driverOrVehicleName = names;
            }
            cardOrVin = driver.cardNumber;
            break;
        } else {
            const vehicle = identity.identity;
            if (vehicle.registrationNumber) {
                driverOrVehicleName = vehicle.registrationNumber;
            }
            if (vehicle.vehicleIdentificationNumber) {
                cardOrVin = vehicle.vehicleIdentificationNumber;
            }
            break;
        }
    }

    const parser = [viewModel.parserVersion, viewModel.parserCommit]
        .filter((value): value is string => value !== null)
        .join(' @ ');

    const summaryItems: { label: string; value: string }[] = [
        {
            label: t('report.documentKind'),
            value: translateDocumentKind(overview.documentKind, translationService),
        },
        {
            label: t('overview.generation'),
            value: translateGeneration(overview.generation, translationService),
        },
        { label: t('report.sha256'), value: overview.sha256 },
        { label: t('report.timeZone'), value: overview.timeZone },
        {
            label: t('report.parser'),
            value: parser.length > 0 ? parser : t('overview.identity.missing'),
        },
        {
            label: t('overview.integrity'),
            value: translateIntegrityStatus(overview.integrity.status, translationService),
        },
    ];

    const sections: IPdfSection[] = [
        ...buildIdentitySection(viewModel, translationService),
        ...buildActivitiesSections(viewModel, translationService),
        ...buildComplianceSection(viewModel, translationService),
        ...buildAssociationsSection(viewModel, translationService),
        ...buildPlacesSection(viewModel, translationService),
        ...buildEventsFaultsSection(viewModel, translationService),
        ...buildTechnicalSection(viewModel, translationService),
        ...buildIntegritySections(viewModel, translationService),
        ...buildLimitationsSection(viewModel, translationService),
    ];

    const normalizedSections: IFactualReportPdfRequest['sections'] = sections.map((section) => ({
        ...section,
        timeline: section.timeline ?? null,
    }));

    return {
        footerNotice: t('report.notALegalAssessment'),
        headerFields: [
            {
                label: isCard ? t('overview.identity.firstNames') : t('overview.identity.registrationNumber'),
                value: driverOrVehicleName,
            },
            {
                label: isCard ? t('overview.identity.cardNumber') : t('overview.identity.vehicleIdentificationNumber'),
                value: cardOrVin,
            },
            { label: t('report.file'), value: overview.displayName },
            { label: t('report.generatedAt'), value: overview.openedAt.display },
        ],
        kind: 'factualReport',
        locale,
        // Landscape leaves room for the widest evidence tables (up to 11 columns) without dropping any.
        orientation: 'landscape',
        sections: normalizedSections,
        subtitle: overview.displayName,
        summaryItems,
        summaryTitle: t('report.documentKind'),
        title: t('report.title'),
    };
}
