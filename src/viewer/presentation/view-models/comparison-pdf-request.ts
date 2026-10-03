import type { IFactualReportPdfRequest, IReportSummaryItemDto, IReportTableSectionDto } from '#contracts';
import type { ILocalisationService, ITranslationService } from '#localization';
import type { DocumentKind, DurationMilliseconds, IntegrityAssessment, TachographGeneration, UtcTimestamp } from '#viewer-domain';

import type { IOpenedDocumentComparisonViewModel } from './document-comparison-view-model.js';

export type ComparisonPdfTranslationKey =
    | 'activities.activity.availability'
    | 'activities.activity.breakOrRest'
    | 'activities.activity.driving'
    | 'activities.activity.work'
    | 'associations.kilometreUnit'
    | 'common.actions'
    | 'comparison.column.activityTotals'
    | 'comparison.column.contentCounts'
    | 'comparison.column.coverage'
    | 'comparison.column.file'
    | 'comparison.column.identity'
    | 'comparison.column.integrity'
    | 'comparison.column.kind'
    | 'comparison.column.odometerRange'
    | 'comparison.column.openedAt'
    | 'comparison.column.overlappingSessions'
    | 'comparison.column.securityCounts'
    | 'comparison.pdf.colKindGen'
    | 'comparison.pdf.colOdometerMax'
    | 'comparison.pdf.colOdometerMin'
    | 'comparison.pdf.differingColumnsLabel'
    | 'comparison.pdf.differingFieldsLabel'
    | 'comparison.pdf.documentsLabel'
    | 'comparison.pdf.footerNotice'
    | 'comparison.pdf.generatedAtLabel'
    | 'comparison.pdf.scopeLabel'
    | 'comparison.pdf.scopeValue'
    | 'comparison.pdf.subtitle'
    | 'comparison.pdf.summaryTitle'
    | 'comparison.pdf.tableActivitySubtitle'
    | 'comparison.pdf.tableActivityTitle'
    | 'comparison.pdf.tableCountsSubtitle'
    | 'comparison.pdf.tableCountsTitle'
    | 'comparison.pdf.tableOverviewSubtitle'
    | 'comparison.pdf.tableOverviewTitle'
    | 'comparison.pdf.tableSecuritySubtitle'
    | 'comparison.pdf.tableSecurityTitle'
    | 'comparison.pdf.title'
    | 'comparison.pdf.totalFilesLabel'
    | 'comparison.security.critical'
    | 'comparison.security.diagnostic'
    | 'comparison.security.operational'
    | 'document.generation.combined'
    | 'document.generation.g1'
    | 'document.generation.g2'
    | 'document.generation.g2v2'
    | 'document.integrity.chainVerified'
    | 'document.integrity.failed'
    | 'document.integrity.invalid'
    | 'document.integrity.notChecked'
    | 'document.integrity.partiallyValid'
    | 'document.integrity.unsupported'
    | 'document.integrity.valid'
    | 'document.kind.driverCard'
    | 'document.kind.vehicleUnit'
    | 'overview.contents.activityDays'
    | 'overview.contents.events'
    | 'overview.contents.faults'
    | 'overview.contents.inferredActivityGaps'
    | 'overview.contents.recordedActivityIntervals'
    | 'overview.contents.warnings'
    | 'overview.identity.missing';

function formatDocumentKind(kind: DocumentKind, translationService: ITranslationService<ComparisonPdfTranslationKey>): string {
    return kind === 'driverCard'
        ? translationService.translate('document.kind.driverCard')
        : translationService.translate('document.kind.vehicleUnit');
}

const FORMAT_GENERATION_KEYS = {
    g1: 'document.generation.g1',
    g2: 'document.generation.g2',
    g2v2: 'document.generation.g2v2',
} satisfies Readonly<Record<TachographGeneration, ComparisonPdfTranslationKey>>;

function formatGeneration(
    generation: TachographGeneration,
    translationService: ITranslationService<ComparisonPdfTranslationKey>,
): string {
    return translationService.translate(FORMAT_GENERATION_KEYS[generation]);
}

const FORMAT_INTEGRITY_STATUS_KEYS = {
    chainVerified: 'document.integrity.chainVerified',
    failed: 'document.integrity.failed',
    invalid: 'document.integrity.invalid',
    notChecked: 'document.integrity.notChecked',
    partiallyValid: 'document.integrity.partiallyValid',
    unsupported: 'document.integrity.unsupported',
    valid: 'document.integrity.valid',
} satisfies Readonly<Record<IntegrityAssessment['status'], ComparisonPdfTranslationKey>>;

function formatIntegrityStatus(
    status: IntegrityAssessment['status'],
    translationService: ITranslationService<ComparisonPdfTranslationKey>,
): string {
    return translationService.translate(FORMAT_INTEGRITY_STATUS_KEYS[status]);
}

// Builds shared tabular sections for PDF and HTML comparison exports.
export function createComparisonReportSections(
    viewModel: IOpenedDocumentComparisonViewModel,
    translationService: ITranslationService<ComparisonPdfTranslationKey>,
): readonly IReportTableSectionDto[] {
    const overviewHeaders = [
        translationService.translate('comparison.column.file'),
        translationService.translate('comparison.pdf.colKindGen'),
        translationService.translate('comparison.column.identity'),
        translationService.translate('comparison.column.coverage'),
        translationService.translate('comparison.column.integrity'),
    ];

    const overviewRows = viewModel.records.map((record) => {
        const kindLabel = formatDocumentKind(record.documentKind, translationService);
        const genLabels = record.generations.map((g) => formatGeneration(g, translationService)).join(', ');
        const kindGen = genLabels.length > 0 ? `${kindLabel} (${genLabels})` : kindLabel;

        const integrityLabel = formatIntegrityStatus(record.integrity.status, translationService);

        const coverageText = record.coverage !== null ? `${record.coverage.start.display} – ${record.coverage.end.display}` : '—';

        return {
            cells: [record.displayName, kindGen, record.identitySummary ?? '—', coverageText, integrityLabel],
        };
    });

    const countsHeaders = [
        translationService.translate('comparison.column.file'),
        translationService.translate('overview.contents.activityDays'),
        translationService.translate('overview.contents.recordedActivityIntervals'),
        translationService.translate('overview.contents.inferredActivityGaps'),
        translationService.translate('overview.contents.events'),
        translationService.translate('overview.contents.faults'),
        translationService.translate('overview.contents.warnings'),
    ];

    const countsRows = viewModel.records.map((record) => {
        return {
            cells: [
                record.displayName,
                String(record.totals.activityDays.value),
                String(record.totals.recordedActivityIntervals.value),
                String(record.totals.inferredActivityGaps.value),
                String(record.totals.events.value),
                String(record.totals.faults.value),
                String(record.totals.warnings.value),
            ],
        };
    });

    const missingLabel = translationService.translate('overview.identity.missing');

    const activityHeaders = [
        translationService.translate('comparison.column.file'),
        translationService.translate('activities.activity.driving'),
        translationService.translate('activities.activity.work'),
        translationService.translate('activities.activity.breakOrRest'),
        translationService.translate('activities.activity.availability'),
        translationService.translate('comparison.pdf.colOdometerMin'),
        translationService.translate('comparison.pdf.colOdometerMax'),
    ];

    const activityRows = viewModel.records.map((record) => {
        const totals = record.activityTotals;
        const odometerRange = record.odometerRange;
        return {
            cells: [
                record.displayName,
                totals === null ? missingLabel : totals.driving.display,
                totals === null ? missingLabel : totals.work.display,
                totals === null ? missingLabel : totals.breakOrRest.display,
                totals === null ? missingLabel : totals.availability.display,
                odometerRange === null ? missingLabel : odometerRange.min.display,
                odometerRange === null ? missingLabel : odometerRange.max.display,
            ],
        };
    });

    const securityHeaders = [
        translationService.translate('comparison.column.file'),
        translationService.translate('comparison.security.critical'),
        translationService.translate('comparison.security.diagnostic'),
        translationService.translate('comparison.security.operational'),
        translationService.translate('comparison.column.overlappingSessions'),
    ];

    const securityRows = viewModel.records.map((record) => ({
        cells: [
            record.displayName,
            String(record.securityCounts.securityCritical),
            String(record.securityCounts.sensorDiagnostic),
            String(record.securityCounts.operationalNotice),
            String(record.overlappingSessionCount),
        ],
    }));

    return [
        {
            headers: overviewHeaders,
            rows: overviewRows,
            subtitle: translationService.translate('comparison.pdf.tableOverviewSubtitle'),
            timeline: null,
            title: translationService.translate('comparison.pdf.tableOverviewTitle'),
        },
        {
            headers: countsHeaders,
            rows: countsRows,
            subtitle: translationService.translate('comparison.pdf.tableCountsSubtitle'),
            timeline: null,
            title: translationService.translate('comparison.pdf.tableCountsTitle'),
        },
        {
            headers: activityHeaders,
            rows: activityRows,
            subtitle: translationService.translate('comparison.pdf.tableActivitySubtitle'),
            timeline: null,
            title: translationService.translate('comparison.pdf.tableActivityTitle'),
        },
        {
            headers: securityHeaders,
            rows: securityRows,
            subtitle: translationService.translate('comparison.pdf.tableSecuritySubtitle'),
            timeline: null,
            title: translationService.translate('comparison.pdf.tableSecurityTitle'),
        },
    ];
}

export function createComparisonReportPdfRequest(
    viewModel: IOpenedDocumentComparisonViewModel,
    translationService: ITranslationService<ComparisonPdfTranslationKey>,
    localisationService: ILocalisationService<UtcTimestamp, DurationMilliseconds>,
    generatedAtTimestamp: UtcTimestamp,
): IFactualReportPdfRequest {
    const totalFiles = viewModel.records.length;
    const differingCount = viewModel.differingColumns.length;

    const summaryItems: readonly IReportSummaryItemDto[] = [
        {
            label: translationService.translate('comparison.pdf.totalFilesLabel'),
            value: String(totalFiles),
        },
        {
            label: translationService.translate('comparison.pdf.differingFieldsLabel'),
            value: String(differingCount),
        },
    ];

    return {
        footerNotice: translationService.translate('comparison.pdf.footerNotice'),
        headerFields: [
            { label: translationService.translate('comparison.pdf.documentsLabel'), value: String(totalFiles) },
            { label: translationService.translate('comparison.pdf.differingColumnsLabel'), value: String(differingCount) },
            {
                label: translationService.translate('comparison.pdf.scopeLabel'),
                value: translationService.translate('comparison.pdf.scopeValue'),
            },
            {
                label: translationService.translate('comparison.pdf.generatedAtLabel'),
                value: localisationService.formatDateTime(generatedAtTimestamp),
            },
        ],
        kind: 'factualReport',
        locale: localisationService.locale,
        orientation: 'landscape',
        sections: createComparisonReportSections(viewModel, translationService),
        subtitle: translationService.translate('comparison.pdf.subtitle'),
        summaryItems,
        summaryTitle: translationService.translate('comparison.pdf.summaryTitle'),
        title: translationService.translate('comparison.pdf.title'),
    };
}
