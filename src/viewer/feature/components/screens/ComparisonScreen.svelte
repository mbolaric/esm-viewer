<script lang="ts">
    import { fileNameSegment, type ExportFailureCode } from '#contracts';
    import { createViewerDataTableLabels } from '../../helpers/data-table-labels.js';
    import {
        integrityStatusIcon,
        translateDocumentKind,
        translateGeneration,
        translateIntegrityStatus,
    } from '../../helpers/viewer-labels.js';
    import { serializeComparisonHtmlReport } from '../../helpers/report-html.js';
    import { Button, createStandardSortValue, DataTable, Icon, SectionMessage, type ToastController } from '#ui';
    import { nowAsUtcTimestamp } from '#viewer-domain';
    import { translateExportFailure, type ILocalisationService, type ITranslationService } from '#localization';
    import type { DurationMilliseconds, UtcTimestamp } from '#viewer-domain';
    import type { IViewerExportPort, IViewerPdfPort } from '#viewer-application';
    import type {
        ComparisonDiffColumn,
        IOpenedDocumentComparisonViewModel,
        IOpenedDocumentComparisonRowViewModel,
    } from '#viewer-presentation';
    import { createComparisonReportPdfRequest } from '#viewer-presentation';
    import RecordSectionLayout from '../records/RecordSectionLayout.svelte';
    import ExportDialog from '../dialogs/ExportDialog.svelte';
    import { TableToolingController } from '../../controllers/table-tooling-controller.svelte.js';
    import type { IDocumentScopedValue } from '../../controllers/document-scoped-value.svelte.js';
    import type { ExportFormat } from '../../controllers/viewer-export-controller.svelte.js';
    import type { IMessageParams, TranslationKey } from '#i18n-locales';

    interface IProps {
        exportPort: IViewerExportPort;
        filterText: IDocumentScopedValue<string>;
        localisationService: ILocalisationService<UtcTimestamp, DurationMilliseconds>;
        onclear: () => void;
        onremove: (key: string) => void;
        onreopen: (key: string) => void;
        pdfPort: IViewerPdfPort;
        toastController: ToastController;
        translationService: ITranslationService<TranslationKey, IMessageParams>;
        viewModel: IOpenedDocumentComparisonViewModel | null;
    }

    let {
        exportPort,
        filterText,
        localisationService,
        onclear,
        onremove,
        onreopen,
        pdfPort,
        toastController,
        translationService,
        viewModel,
    }: IProps = $props();
    let diffMode = $state(false);
    let isExporting = $state(false);
    let isExportDialogOpen = $state(false);
    let exportFormat = $state<'html' | 'pdf'>('pdf');
    const differingColumns = $derived(new Set(viewModel?.differingColumns ?? []));
    const columns = $derived([
        {
            cell: fileCell,
            id: 'file',
            label: translationService.translate('comparison.column.file'),
            sortable: true,
        },
        {
            cell: openedAtCell,
            cellClass: 'numeric-value',
            id: 'openedAt',
            label: translationService.translate('comparison.column.openedAt'),
            sortable: true,
        },
        {
            cell: kindCell,
            cellClass: 'kind-cell',
            id: 'kind',
            label: translationService.translate('comparison.column.kind'),
            sortable: true,
        },
        {
            cell: coverageCell,
            cellClass: 'numeric-value',
            id: 'coverage',
            label: translationService.translate('comparison.column.coverage'),
            sortable: true,
        },
        {
            cell: integrityCell,
            cellClass: 'integrity-cell',
            id: 'integrity',
            label: translationService.translate('comparison.column.integrity'),
            sortable: true,
        },
        {
            cell: contentCountsCell,
            cellClass: 'numeric-value content-counts-cell',
            id: 'contentCounts',
            label: translationService.translate('comparison.column.contentCounts'),
            sortable: true,
        },
        {
            cell: activityTotalsCell,
            cellClass: 'numeric-value content-counts-cell',
            id: 'activityTotals',
            label: translationService.translate('comparison.column.activityTotals'),
            sortable: true,
        },
        {
            cell: odometerRangeCell,
            cellClass: 'numeric-value',
            id: 'odometerRange',
            label: translationService.translate('comparison.column.odometerRange'),
            sortable: true,
        },
        {
            cell: securityCountsCell,
            cellClass: 'numeric-value content-counts-cell',
            id: 'securityCounts',
            label: translationService.translate('comparison.column.securityCounts'),
            sortable: true,
        },
        {
            cell: overlappingSessionsCell,
            cellClass: 'numeric-value',
            id: 'overlappingSessions',
            label: translationService.translate('comparison.column.overlappingSessions'),
            sortable: true,
        },
        {
            cell: identityCell,
            id: 'identity',
            label: translationService.translate('comparison.column.identity'),
            sortable: true,
        },
        {
            cell: actionCell,
            id: 'action',
            label: translationService.translate('common.actions'),
            sortable: true,
        },
    ]);
    const tooling = new TableToolingController<IOpenedDocumentComparisonRowViewModel>({
        columns: () => columns,
        filterText: () => filterText,
        filterValues: (record) => [
            record.displayName,
            translateDocumentKind(record.documentKind, translationService),
            ...record.generations.map((generation) => translateGeneration(generation, translationService)),
            record.coverage?.start.display ?? '',
            record.coverage?.end.display ?? '',
            translateIntegrityStatus(record.integrity.status, translationService),
            String(record.totals.activityDays.value),
            String(record.totals.events.value),
            String(record.totals.faults.value),
            String(record.totals.warnings.value),
            record.identitySummary ?? '',
            record.activityTotals?.driving.display ?? '',
            record.odometerRange?.min.display ?? '',
            record.odometerRange?.max.display ?? '',
            String(record.securityCounts.securityCritical),
            String(record.overlappingSessionCount),
        ],
        sortValue: createStandardSortValue({
            file: (record) => record.displayName,
            openedAt: (record) => record.openedAt.value,
            kind: (record) => `${record.documentKind}:${record.generations.join(',')}`,
            coverage: (record) => record.coverage?.start.value ?? null,
            integrity: (record) => record.integrity.status,
            contentCounts: (record) => record.totals.events.value,
            activityTotals: (record) => record.activityTotals?.driving.value ?? null,
            odometerRange: (record) => record.odometerRange?.min.value ?? null,
            securityCounts: (record) => record.securityCounts.securityCritical,
            overlappingSessions: (record) => record.overlappingSessionCount,
            identity: (record) => record.identitySummary ?? '',
            action: (record) => record.key,
        }),
    });

    function rowKey(record: IOpenedDocumentComparisonRowViewModel): string {
        return record.key;
    }

    function toggleDiffMode(): void {
        diffMode = !diffMode;
    }

    function comparisonExportFileName(format: 'html' | 'pdf'): string {
        const dateStr = new Date(nowAsUtcTimestamp()).toISOString().slice(0, 10);
        return `${fileNameSegment(translationService.translate('comparison.fileName'))}-${dateStr}.${format}`;
    }

    function openExportDialog(): void {
        isExportDialogOpen = true;
    }

    function closeExportDialog(): void {
        isExportDialogOpen = false;
    }

    function selectExportFormat(format: ExportFormat): void {
        if (format === 'html' || format === 'pdf') {
            exportFormat = format;
        }
    }

    function handleExport(): void {
        isExportDialogOpen = false;
        if (exportFormat === 'pdf') {
            void handleExportPdf();
        } else {
            void handleExportHtml();
        }
    }

    // The export dialog is already closed, so every outcome is reported by toast; a cancelled save needs none.
    async function saveExport(bytes: Uint8Array, suggestedName: string): Promise<void> {
        // A comparison export has no opened document behind it, so there is no source to protect.
        const saveResult = await exportPort.save({ bytes, source: null, suggestedName });
        if (saveResult.status === 'saved') {
            toastController.success(translationService.translate('export.toast.success', { fileName: suggestedName }));
        } else if (saveResult.status === 'failed') {
            reportExportFailure(saveResult.code);
        }
    }

    function reportExportFailure(code: ExportFailureCode): void {
        toastController.error(
            translationService.translate('export.toast.failed', { reason: translateExportFailure(code, translationService) }),
        );
    }

    async function handleExportPdf(): Promise<void> {
        if (viewModel === null || viewModel.records.length === 0 || isExporting) {
            return;
        }
        isExporting = true;
        try {
            const timestamp = nowAsUtcTimestamp();
            const request = createComparisonReportPdfRequest(viewModel, translationService, localisationService, timestamp);
            const generation = await pdfPort.generatePdf(request);
            if (generation.status === 'converted') {
                await saveExport(generation.bytes, comparisonExportFileName('pdf'));
            } else if (generation.status === 'printed') {
                toastController.info(translationService.translate('export.toast.printed'));
            } else {
                reportExportFailure(generation.code);
            }
        } catch {
            toastController.error(
                translationService.translate('export.toast.failed', {
                    reason: translationService.translate('export.error.generic'),
                }),
            );
        } finally {
            isExporting = false;
        }
    }

    async function handleExportHtml(): Promise<void> {
        if (viewModel === null || viewModel.records.length === 0 || isExporting) {
            return;
        }
        isExporting = true;
        try {
            const timestamp = nowAsUtcTimestamp();
            const html = serializeComparisonHtmlReport(viewModel, translationService, localisationService, timestamp);
            await saveExport(new TextEncoder().encode(html), comparisonExportFileName('html'));
        } catch {
            toastController.error(
                translationService.translate('export.toast.failed', {
                    reason: translationService.translate('export.error.generic'),
                }),
            );
        } finally {
            isExporting = false;
        }
    }

    const tableLabels = $derived(createViewerDataTableLabels(translationService));
</script>

{#snippet diffMarker(columnId: ComparisonDiffColumn)}
    {#if diffMode && differingColumns.has(columnId)}
        <span class="diff-marker" title={translationService.translate('comparison.differs')}>
            <Icon name="diff" size="small" />
        </span>
    {/if}
{/snippet}

{#snippet fileCell(record: IOpenedDocumentComparisonRowViewModel)}
    <div class="record-stack">
        <strong>{record.displayName}</strong>
    </div>
{/snippet}

{#snippet openedAtCell(record: IOpenedDocumentComparisonRowViewModel)}
    {record.openedAt.display}
{/snippet}

{#snippet kindCell(record: IOpenedDocumentComparisonRowViewModel)}
    <div class="diff-cell">
        {@render diffMarker('kind')}
        <div class="record-stack">
            <strong class="kind-name">{translateDocumentKind(record.documentKind, translationService)}</strong>
            <span class="metadata generation-row">
                {#each record.generations as generation (generation)}
                    <span>{translateGeneration(generation, translationService)}</span>
                {/each}
            </span>
        </div>
    </div>
{/snippet}

{#snippet coverageCell(record: IOpenedDocumentComparisonRowViewModel)}
    <div class="diff-cell">
        {@render diffMarker('coverage')}
        {#if record.coverage === null}
            <span>{translationService.translate('overview.identity.missing')}</span>
        {:else}
            {record.coverage.start.display}
            {translationService.translate('speed.range.separator')}
            {record.coverage.end.display}
        {/if}
    </div>
{/snippet}

{#snippet integrityCell(record: IOpenedDocumentComparisonRowViewModel)}
    <div class="diff-cell">
        {@render diffMarker('integrity')}
        <div class="record-stack">
            <span class="status-line" data-status={record.integrity.status}>
                <Icon name={integrityStatusIcon(record.integrity.status)} />
                <span>{translateIntegrityStatus(record.integrity.status, translationService)}</span>
            </span>
            <span class="metadata integrity-checked">
                <span>{translationService.translate('overview.integrity.checkedItems')}</span>
                <span>{record.integrity.checkedItems.display}</span>
            </span>
        </div>
    </div>
{/snippet}

{#snippet contentCountsCell(record: IOpenedDocumentComparisonRowViewModel)}
    <div class="diff-cell">
        {@render diffMarker('contentCounts')}
        <div class="count-grid">
            <div class="count-badge">
                <span class="count-label">
                    {translationService.translate('overview.contents.activityDays')}
                </span>
                <strong class="count-number">
                    {record.totals.activityDays.display}
                </strong>
            </div>
            <div class="count-badge">
                <span class="count-label">
                    {translationService.translate('overview.contents.events')}
                </span>
                <strong class="count-number">
                    {record.totals.events.display}
                </strong>
            </div>
            <div class="count-badge">
                <span class="count-label">
                    {translationService.translate('overview.contents.faults')}
                </span>
                <strong class="count-number">
                    {record.totals.faults.display}
                </strong>
            </div>
            <div class="count-badge">
                <span class="count-label">
                    {translationService.translate('overview.contents.warnings')}
                </span>
                <strong class="count-number">
                    {record.totals.warnings.display}
                </strong>
            </div>
        </div>
    </div>
{/snippet}

{#snippet activityTotalsCell(record: IOpenedDocumentComparisonRowViewModel)}
    <div class="diff-cell">
        {@render diffMarker('activityTotals')}
        {#if record.activityTotals === null}
            <span>{translationService.translate('overview.identity.missing')}</span>
        {:else}
            <div class="count-grid">
                <div class="count-badge">
                    <span class="count-label">
                        {translationService.translate('activities.activity.driving')}
                    </span>
                    <strong class="count-number">
                        {record.activityTotals.driving.display}
                    </strong>
                </div>
                <div class="count-badge">
                    <span class="count-label">
                        {translationService.translate('activities.activity.work')}
                    </span>
                    <strong class="count-number">
                        {record.activityTotals.work.display}
                    </strong>
                </div>
                <div class="count-badge">
                    <span class="count-label">
                        {translationService.translate('activities.activity.breakOrRest')}
                    </span>
                    <strong class="count-number">
                        {record.activityTotals.breakOrRest.display}
                    </strong>
                </div>
                <div class="count-badge">
                    <span class="count-label">
                        {translationService.translate('activities.activity.availability')}
                    </span>
                    <strong class="count-number">
                        {record.activityTotals.availability.display}
                    </strong>
                </div>
            </div>
        {/if}
    </div>
{/snippet}

{#snippet odometerRangeCell(record: IOpenedDocumentComparisonRowViewModel)}
    <div class="diff-cell">
        {@render diffMarker('odometerRange')}
        {#if record.odometerRange === null}
            <span>{translationService.translate('overview.identity.missing')}</span>
        {:else}
            {record.odometerRange.min.display}
            {translationService.translate('speed.range.separator')}
            {record.odometerRange.max.display}
            {translationService.translate('associations.kilometreUnit')}
        {/if}
    </div>
{/snippet}

{#snippet securityCountsCell(record: IOpenedDocumentComparisonRowViewModel)}
    <div class="diff-cell">
        {@render diffMarker('securityCounts')}
        <div class="count-grid">
            <div class="count-badge">
                <span class="count-label">
                    {translationService.translate('comparison.security.critical')}
                </span>
                <strong class="count-number">
                    {record.securityCounts.securityCritical}
                </strong>
            </div>
            <div class="count-badge">
                <span class="count-label">
                    {translationService.translate('comparison.security.diagnostic')}
                </span>
                <strong class="count-number">
                    {record.securityCounts.sensorDiagnostic}
                </strong>
            </div>
            <div class="count-badge">
                <span class="count-label">
                    {translationService.translate('comparison.security.operational')}
                </span>
                <strong class="count-number">
                    {record.securityCounts.operationalNotice}
                </strong>
            </div>
        </div>
    </div>
{/snippet}

{#snippet overlappingSessionsCell(record: IOpenedDocumentComparisonRowViewModel)}
    <div class="diff-cell">
        {@render diffMarker('overlappingSessions')}
        {record.overlappingSessionCount}
    </div>
{/snippet}

{#snippet identityCell(record: IOpenedDocumentComparisonRowViewModel)}
    <div class="diff-cell">
        {@render diffMarker('identity')}
        {record.identitySummary ?? translationService.translate('overview.identity.missing')}
    </div>
{/snippet}

{#snippet actionCell(record: IOpenedDocumentComparisonRowViewModel)}
    <div class="row-actions">
        {#if record.reopenable}
            <Button
                ariaLabel={translationService.translate('comparison.reopen')}
                icon="folderOpen"
                iconOnly
                label={translationService.translate('comparison.reopen')}
                onclick={() => onreopen(record.key)}
                size="compact"
                tooltip={translationService.translate('comparison.reopen')}
                tooltipAlign="end"
                variant="ghost"
            />
        {/if}
        <Button
            ariaLabel={`${translationService.translate('comparison.remove')}: ${record.displayName}`}
            icon="circleX"
            iconOnly
            label={translationService.translate('comparison.remove')}
            onclick={() => onremove(record.key)}
            size="compact"
            tooltip={translationService.translate('comparison.remove')}
            tooltipAlign="end"
            variant="danger"
        />
    </div>
{/snippet}

<RecordSectionLayout
    className="comparison-screen record-workspace wide-workspace"
    errorDescription={translationService.translate('comparison.description')}
    errorHeading={translationService.translate('comparison.heading')}
    errorHeadingId="comparison-error-heading"
    fillHeight
    heading={translationService.translate('comparison.heading')}
    {viewModel}
>
    {#snippet content(viewModel: IOpenedDocumentComparisonViewModel)}
        {#if viewModel.records.length === 0}
            <SectionMessage
                description={translationService.translate('comparison.empty')}
                heading={translationService.translate('comparison.heading')}
                headingId="comparison-empty-heading"
            />
        {:else}
            {@const comparisonTableSnapshot = tooling.snapshot(viewModel.records)}
            <section class="evidence-panel table-section" aria-labelledby="comparison-records-heading">
                <div class="comparison-heading">
                    <p id="comparison-records-heading">
                        {translationService.translate('comparison.description')}
                    </p>
                    <div class="comparison-actions">
                        <Button
                            disabled={viewModel.records.length < 2}
                            icon="diff"
                            label={translationService.translate('comparison.diff')}
                            onclick={toggleDiffMode}
                            pressed={diffMode}
                            variant="ghost"
                        />
                        <Button
                            disabled={isExporting || viewModel.records.length === 0}
                            icon="download"
                            label={translationService.translate('export.export')}
                            onclick={openExportDialog}
                            variant="secondary"
                        />
                        <Button label={translationService.translate('comparison.clearAll')} onclick={onclear} />
                    </div>
                </div>
                <DataTable
                    labels={tableLabels}
                    {tooling}
                    caption={translationService.translate('comparison.heading')}
                    {columns}
                    fillHeight
                    filterSummaryLabel={translationService.translate('table.filterResultCount', {
                        shown: String(comparisonTableSnapshot.rows.length),
                        total: String(viewModel.records.length),
                    })}
                    layout="comparison"
                    {rowKey}
                    rows={comparisonTableSnapshot.rows}
                />
                <p class="note">{translationService.translate('comparison.sessionOnly')}</p>
            </section>
        {/if}
    {/snippet}
</RecordSectionLayout>

{#if isExportDialogOpen}
    <ExportDialog
        error={null}
        fileName={comparisonExportFileName(exportFormat)}
        format={exportFormat}
        oncancel={closeExportDialog}
        onexport={handleExport}
        onformat={selectExportFormat}
        saving={isExporting}
        showRawJson={false}
    />
{/if}

<style>
    :global(.comparison-screen) {
        display: grid;
        grid-template-columns: var(--layout-panel-columns);
        inline-size: var(--size-full);
        max-inline-size: var(--size-content-wide);
        min-inline-size: var(--size-zero);
        margin-inline: auto;
        gap: var(--space-stack);
    }

    .evidence-panel {
        gap: var(--space-actions);
    }

    .row-actions {
        display: grid;
        grid-auto-flow: column;
        align-items: center;
        gap: var(--space-actions);
    }

    .record-stack {
        display: grid;
        gap: var(--space-row-block);
    }

    :global(.comparison-screen td.kind-cell),
    :global(.comparison-screen td.integrity-cell) {
        min-inline-size: max-content;
        white-space: nowrap;
    }

    .kind-name {
        white-space: nowrap;
    }

    .generation-row,
    .integrity-checked {
        display: inline-flex;
        flex-wrap: nowrap;
        align-items: center;
        gap: var(--space-compact);
        white-space: nowrap;
    }

    :global(.comparison-screen td.integrity-cell) .status-line {
        white-space: nowrap;
    }

    :global(.comparison-screen td.content-counts-cell) {
        min-inline-size: var(--size-comparison-counts-min-inline);
        padding-block: var(--space-control-block);
    }

    .count-grid {
        display: grid;
        grid-template-columns: var(--layout-comparison-count-grid);
        gap: var(--space-compact) var(--space-actions);
        align-items: center;
        inline-size: max-content;
        min-inline-size: var(--size-full);
    }

    .count-badge {
        display: inline-flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-actions);
        padding-block: var(--space-compact);
        padding-inline: var(--space-actions);
        background: var(--color-surface-subtle);
        border: var(--border-control);
        border-radius: var(--radius-control);
        font-size: var(--font-size-metadata);
        min-inline-size: max-content;
    }

    .count-label {
        color: var(--color-text-muted);
        white-space: nowrap;
    }

    .count-number {
        font-variant-numeric: tabular-nums;
        font-weight: var(--font-weight-action);
        color: var(--color-text);
    }

    .comparison-heading {
        flex: var(--layout-fixed-flex);
        display: grid;
        grid-template-columns: var(--layout-comparison-heading-columns);
        align-items: start;
        gap: var(--space-actions);
    }

    .comparison-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-actions);
        justify-content: end;
    }

    .diff-cell {
        display: flex;
        align-items: center;
        gap: var(--space-actions);
    }

    .diff-marker {
        display: inline-flex;
        align-items: center;
        color: var(--color-accent);
    }

    .note {
        flex: var(--layout-fixed-flex);
        margin: var(--space-none);
    }

    .comparison-heading p,
    .note,
    .metadata {
        color: var(--color-text-muted);
    }

    .metadata {
        font-size: var(--font-size-metadata);
    }
</style>
