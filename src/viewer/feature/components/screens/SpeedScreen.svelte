<script lang="ts">
    import { createViewerDataTableLabels } from '../../helpers/data-table-labels.js';
    import { untrack } from 'svelte';

    import { logBoundaryError } from '#error-reporting';
    import { translateEventFaultPurpose, translateGeneration } from '../../helpers/viewer-labels.js';
    import { Button, createStandardSortValue, DataTable, ReferenceLink, SectionMessage, type TimeSeriesRuntimeLoader } from '#ui';
    import { dateFormatPatternToken, resolveInputFormatKeys, timeFormatPatternToken } from '#localization';
    import type { IDetailedSpeedSample, JsonPointer, UtcTimestamp } from '#viewer-domain';
    import {
        calculatePresetSpeedRange,
        parseSpeedRangeInput,
        type IOverspeedRecordViewModel,
        type ISpeedSampleViewModel,
        type ISpeedSectionViewModel,
    } from '#viewer-presentation';
    import { MILLISECONDS_PER_MINUTE } from '#time';
    import ChartError from './ChartError.svelte';
    import RecordSectionLayout from '../records/RecordSectionLayout.svelte';
    import SpeedChart from './SpeedChart.svelte';
    import { TableToolingController } from '../../controllers/table-tooling-controller.svelte.js';
    import type { IDocumentScopedValue } from '../../controllers/document-scoped-value.svelte.js';
    import {
        useViewerDateTimeFormatService,
        useViewerLocalisationService,
        useViewerTranslationService,
    } from '../../viewer-context.js';

    interface IProps {
        onchartfailure: () => void;
        onclearrecord: () => void;
        onpage: (pageIndex: number) => void;
        onrange: (start: UtcTimestamp, end: UtcTimestamp) => void;
        onreset: () => void;
        onselectrecord: (record: IDetailedSpeedSample) => void;
        onopensource: (path: JsonPointer) => void;
        overspeedFilterText: IDocumentScopedValue<string>;
        sampleFilterText: IDocumentScopedValue<string>;
        selectedRecord: IDetailedSpeedSample | null;
        timeSeriesRuntimeLoader?: TimeSeriesRuntimeLoader | undefined;
        viewModel: ISpeedSectionViewModel | null;
    }

    const FIVE_MINUTE_PRESET_MS = 5 * MILLISECONDS_PER_MINUTE;
    const ONE_HOUR_PRESET_MS = 60 * MILLISECONDS_PER_MINUTE;
    const ONE_MINUTE_PRESET_MS = MILLISECONDS_PER_MINUTE;

    let {
        onchartfailure,
        onclearrecord,
        onpage,
        onrange,
        onreset,
        onselectrecord,
        onopensource,
        overspeedFilterText,
        sampleFilterText,
        selectedRecord,
        timeSeriesRuntimeLoader = undefined,
        viewModel,
    }: IProps = $props();

    const translationService = useViewerTranslationService();
    const localisationService = useViewerLocalisationService();
    const preferencesController = useViewerDateTimeFormatService();
    let endInput = $state('');
    let startInput = $state('');
    let endTimestamp = $state<UtcTimestamp | null>(null);
    let startTimestamp = $state<UtcTimestamp | null>(null);
    let rangeStatus = $state<'idle' | 'invalid'>('idle');
    let synchronizedRangeKey = $state('');
    const rangeInputFormats = $derived(
        resolveInputFormatKeys(preferencesController.dateFormat, preferencesController.timeFormat, localisationService.timeZone),
    );
    const rangeInputPlaceholder = $derived(
        `${dateFormatPatternToken(rangeInputFormats.dateFormat)} ${timeFormatPatternToken(rangeInputFormats.timeFormat)}`,
    );

    const columns = $derived([
        { cell: speedTimeCell, id: 'time', label: translationService.translate('speed.table.time'), sortable: true },
        {
            cell: speedSpeedCell,
            cellClass: 'numeric-value',
            id: 'speed',
            label: translationService.translate('speed.table.speed'),
            sortable: true,
        },
        {
            cell: speedSourceCell,
            compact: true,
            id: 'source',
            label: translationService.translate('speed.table.source'),
            sortable: true,
        },
    ]);
    const overspeedColumns = $derived([
        {
            cell: overspeedTimeCell,
            id: 'time',
            label: translationService.translate('speed.overspeed.time'),
            sortable: true,
        },
        {
            cell: overspeedMaxSpeedCell,
            cellClass: 'numeric-value',
            id: 'maxSpeed',
            label: translationService.translate('speed.overspeed.maxSpeed'),
            sortable: true,
        },
        {
            cell: overspeedPurposeCell,
            id: 'purpose',
            label: translationService.translate('speed.overspeed.purpose'),
            sortable: true,
        },
        {
            cell: overspeedSimilarCell,
            cellClass: 'numeric-value',
            id: 'similar',
            label: translationService.translate('speed.overspeed.similarEvents'),
            sortable: true,
        },
        {
            cell: overspeedCardCell,
            id: 'card',
            label: translationService.translate('speed.overspeed.cardNumber'),
            sortable: true,
        },
        {
            compact: true,
            cell: overspeedSourceCell,
            id: 'source',
            label: translationService.translate('speed.table.source'),
            sortable: true,
        },
    ]);
    const sampleTooling = new TableToolingController<ISpeedSampleViewModel>({
        columns: () => columns,
        filterText: () => sampleFilterText,
        filterValues: (record) => [record.recordedAt.display, record.speed.display, record.source.path],
        sortValue: createStandardSortValue({
            time: (record) => record.recordedAt.value,
            speed: (record) => record.speed.value,
            source: (record) => record.source.path,
        }),
    });
    const overspeedTooling = new TableToolingController<IOverspeedRecordViewModel>({
        columns: () => overspeedColumns,
        filterText: () => overspeedFilterText,
        filterValues: (record) => [
            overspeedTimeLabel(record),
            record.maxSpeed.display,
            record.purpose === null
                ? translationService.translate('eventsFaults.purpose.unknown')
                : translateEventFaultPurpose(record.purpose, translationService),
            record.similarEvents?.display ?? '',
            record.cardNumber ?? '',
            record.source.path,
        ],
        sortValue: createStandardSortValue({
            time: (record) => record.begin.value,
            maxSpeed: (record) => record.maxSpeed.value,
            purpose: (record) => record.purpose ?? '',
            similar: (record) => record.similarEvents?.value ?? null,
            card: (record) => record.cardNumber,
            source: (record) => record.source.path,
        }),
    });
    const currentRangeKey = $derived(
        viewModel?.range === null ? '' : `${viewModel?.range?.startInput ?? ''}:${viewModel?.range?.endInput ?? ''}`,
    );

    $effect.pre(() => {
        const range = viewModel?.range;
        if (range === null || range === undefined || currentRangeKey.length === 0 || currentRangeKey === synchronizedRangeKey) {
            return;
        }
        untrack(() => {
            startInput = range.startInput;
            endInput = range.endInput;
            startTimestamp = range.start.value;
            endTimestamp = range.end.value;
            synchronizedRangeKey = currentRangeKey;
            rangeStatus = 'idle';
        });
    });

    function overspeedKey(record: IOverspeedRecordViewModel): string {
        return record.id;
    }

    function overspeedTimeLabel(record: IOverspeedRecordViewModel): string {
        return record.end === null
            ? record.begin.display
            : `${record.begin.display} ${translationService.translate('speed.range.separator')} ${record.end.display}`;
    }

    function recordKey(record: ISpeedSampleViewModel): string {
        return record.id;
    }

    function recordSelectionLabel(record: ISpeedSampleViewModel): string {
        return `${translationService.translate('speed.table.selectRecord')}: ${record.recordedAt.display}, ${record.speed.display} ${translationService.translate('speed.unit')}`;
    }

    function parseRangeInput(text: string, reference: UtcTimestamp | null): UtcTimestamp | null {
        return parseSpeedRangeInput(
            text,
            rangeInputFormats.dateFormat,
            rangeInputFormats.timeFormat,
            localisationService.locale,
            reference,
        );
    }

    function applyRange(): void {
        const appliedRange = viewModel?.range;
        const start =
            startTimestamp !== null &&
            appliedRange !== null &&
            appliedRange !== undefined &&
            startInput === appliedRange.startInput
                ? startTimestamp
                : parseRangeInput(startInput, startTimestamp);
        const end =
            endTimestamp !== null && appliedRange !== null && appliedRange !== undefined && endInput === appliedRange.endInput
                ? endTimestamp
                : parseRangeInput(endInput, endTimestamp);
        if (start === null || end === null) {
            rangeStatus = 'invalid';
            return;
        }
        rangeStatus = 'idle';
        onrange(start, end);
    }

    function resetRange(): void {
        rangeStatus = 'idle';
        onreset();
    }

    function applyPresetZoom(durationMs: number): void {
        if (viewModel === null) {
            return;
        }

        const preset = calculatePresetSpeedRange(viewModel.coverage, viewModel.allRecords, durationMs);
        if (preset !== null) {
            rangeStatus = 'idle';
            onrange(preset.start, preset.end);
        }
    }

    function selectChartRecord(record: IDetailedSpeedSample): void {
        // The chart's own page index describes chronological source order, which no longer matches the table once a
        // filter or sort is applied. Page to the row the reader can actually see instead, and leave the table alone
        // when the active filter excludes the record: the inspector still shows it.
        const rowIndex = sampleRows.findIndex((row) => row.record === record);
        if (rowIndex >= 0 && viewModel !== null) {
            onpage(Math.floor(rowIndex / viewModel.pageSize));
        }
        onselectrecord(record);
    }

    function handleChartBoundaryError(error: unknown): void {
        logBoundaryError('speed-chart', error);
        onchartfailure();
    }
    function isSpeedSampleSelected(record: ISpeedSampleViewModel): boolean {
        return record.record === selectedRecord;
    }

    // P12: the table sees every sample of the range, so a filter or a sort applies to the whole set and only the
    // displayed page is a slice of the result.
    const sampleRows = $derived(sampleTooling.snapshot(viewModel?.allRecords ?? []).rows);
    const filteredPageCount = $derived(
        viewModel === null || viewModel.pageSize === 0 ? 0 : Math.ceil(sampleRows.length / viewModel.pageSize),
    );
    const filteredPageIndex = $derived(filteredPageCount === 0 ? 0 : Math.min(viewModel?.pageIndex ?? 0, filteredPageCount - 1));
    const visibleSampleRows = $derived(
        viewModel === null
            ? []
            : sampleRows.slice(filteredPageIndex * viewModel.pageSize, (filteredPageIndex + 1) * viewModel.pageSize),
    );

    const tableLabels = $derived(createViewerDataTableLabels(translationService));
</script>

{#snippet chartFailed(error: unknown, reset: () => void)}
    <ChartError
        {error}
        onretry={reset}
        description={translationService.translate('speed.chart.failureDescription')}
        heading={translationService.translate('speed.chart.failureHeading')}
        retryLabel={translationService.translate('speed.chart.retry')}
    />
{/snippet}

{#snippet speedTimeCell(record: ISpeedSampleViewModel)}
    {@const selected = isSpeedSampleSelected(record)}
    <Button
        ariaLabel={recordSelectionLabel(record)}
        label={record.recordedAt.display}
        onclick={() => onselectrecord(record.record)}
        pressed={selected}
        size="compact"
        variant="ghost"
    />
{/snippet}

{#snippet speedSpeedCell(record: ISpeedSampleViewModel)}
    {record.speed.display}
    {translationService.translate('speed.unit')}
{/snippet}

{#snippet speedSourceCell(record: ISpeedSampleViewModel)}
    <ReferenceLink
        generation={translateGeneration(record.generation, translationService)}
        onopen={() => onopensource(record.source.path)}
        openLabel={translationService.translate('overview.openSource')}
        path={record.source.path}
    />
{/snippet}

{#snippet overspeedTimeCell(record: IOverspeedRecordViewModel)}
    {overspeedTimeLabel(record)}
{/snippet}

{#snippet overspeedMaxSpeedCell(record: IOverspeedRecordViewModel)}
    {record.maxSpeed.display}
    {translationService.translate('speed.unit')}
{/snippet}

{#snippet overspeedPurposeCell(record: IOverspeedRecordViewModel)}
    {record.purpose === null
        ? translationService.translate('eventsFaults.purpose.unknown')
        : translateEventFaultPurpose(record.purpose, translationService)}
{/snippet}

{#snippet overspeedSimilarCell(record: IOverspeedRecordViewModel)}
    {record.similarEvents === null ? translationService.translate('overview.identity.missing') : record.similarEvents.display}
{/snippet}

{#snippet overspeedCardCell(record: IOverspeedRecordViewModel)}
    {record.cardNumber === null ? translationService.translate('overview.identity.missing') : record.cardNumber}
{/snippet}

{#snippet overspeedSourceCell(record: IOverspeedRecordViewModel)}
    <ReferenceLink
        generation={translateGeneration(record.generation, translationService)}
        onopen={() => onopensource(record.source.path)}
        openLabel={translationService.translate('overview.openSource')}
        path={record.source.path}
    />
{/snippet}

<RecordSectionLayout
    className="speed-screen record-workspace wide-workspace"
    errorDescription={translationService.translate('speed.error')}
    errorHeading={translationService.translate('speed.errorHeading')}
    errorHeadingId="speed-error-heading"
    heading={translationService.translate('navigator.section.speed')}
    {viewModel}
>
    {#snippet content(viewModel: ISpeedSectionViewModel)}
        {#if viewModel.coverage === null}
            <SectionMessage
                description={translationService.translate('speed.empty')}
                heading={translationService.translate('speed.range.heading')}
                headingId="speed-empty-heading"
            />
        {:else}
            <section class="evidence-panel" aria-labelledby="speed-range-heading">
                <h2 id="speed-range-heading">
                    {translationService.translate('speed.range.heading')}
                </h2>
                <dl class="range-context">
                    <div>
                        <dt>{translationService.translate('speed.range.coverage')}</dt>
                        <dd>
                            {viewModel.coverage.start.display}
                            {translationService.translate('speed.range.separator')}
                            {viewModel.coverage.end.display}
                        </dd>
                    </div>
                    <div>
                        <dt>{translationService.translate('activities.timeZone')}</dt>
                        <dd>{viewModel.timeZone}</dd>
                    </div>
                </dl>
                <div class="range-controls">
                    <div
                        class="preset-zoom-toolbar"
                        role="group"
                        aria-label={translationService.translate('speed.preset.heading')}
                    >
                        <span class="preset-label">{translationService.translate('speed.preset.heading')}</span>
                        <Button
                            label={translationService.translate('speed.preset.oneMinute')}
                            onclick={() => applyPresetZoom(ONE_MINUTE_PRESET_MS)}
                            size="compact"
                        />
                        <Button
                            label={translationService.translate('speed.preset.fiveMinutes')}
                            onclick={() => applyPresetZoom(FIVE_MINUTE_PRESET_MS)}
                            size="compact"
                        />
                        <Button
                            label={translationService.translate('speed.preset.oneHour')}
                            onclick={() => applyPresetZoom(ONE_HOUR_PRESET_MS)}
                            size="compact"
                        />
                        <Button
                            label={translationService.translate('speed.preset.fullTrip')}
                            onclick={resetRange}
                            size="compact"
                        />
                    </div>
                    <div class="form-field range-field">
                        <label for="speed-range-start">
                            {translationService.translate('speed.range.start')}
                        </label>
                        <input
                            autocomplete="off"
                            bind:value={startInput}
                            class="viewer-input"
                            id="speed-range-start"
                            placeholder={rangeInputPlaceholder}
                            spellcheck="false"
                            type="text"
                        />
                    </div>
                    <div class="form-field range-field">
                        <label for="speed-range-end">
                            {translationService.translate('speed.range.end')}
                        </label>
                        <input
                            autocomplete="off"
                            bind:value={endInput}
                            class="viewer-input"
                            id="speed-range-end"
                            placeholder={rangeInputPlaceholder}
                            spellcheck="false"
                            type="text"
                        />
                    </div>
                    <div class="range-actions">
                        <Button
                            label={translationService.translate('speed.range.apply')}
                            onclick={applyRange}
                            variant="primary"
                        />
                        <Button label={translationService.translate('speed.range.reset')} onclick={resetRange} />
                    </div>
                </div>
                {#if rangeStatus === 'invalid'}
                    <p class="range-status" role="alert">
                        {translationService.translate('speed.range.invalid')}
                    </p>
                {/if}
                {#if viewModel.rangeLimited}
                    <p class="range-status" role="status">
                        {translationService.translate('speed.range.limited')}
                    </p>
                {/if}
            </section>

            <section class="evidence-panel" aria-labelledby="speed-summary-heading">
                <h2 id="speed-summary-heading">
                    {translationService.translate('speed.summary.heading')}
                </h2>
                {#if viewModel.statistics === null}
                    <p>{translationService.translate('speed.table.empty')}</p>
                {:else}
                    <dl class="statistics">
                        <div>
                            <dt>{translationService.translate('speed.summary.minimum')}</dt>
                            <dd>
                                {viewModel.statistics.minimum.display}
                                {translationService.translate('speed.unit')}
                            </dd>
                        </div>
                        <div>
                            <dt>{translationService.translate('speed.summary.maximum')}</dt>
                            <dd>
                                {viewModel.statistics.maximum.display}
                                {translationService.translate('speed.unit')}
                            </dd>
                        </div>
                        <div>
                            <dt>{translationService.translate('speed.summary.average')}</dt>
                            <dd>
                                {viewModel.statistics.average.display}
                                {translationService.translate('speed.unit')}
                            </dd>
                        </div>
                        <div>
                            <dt>{translationService.translate('speed.summary.samples')}</dt>
                            <dd>{viewModel.totalSamples.display}</dd>
                        </div>
                    </dl>
                {/if}
                <p class="note">{translationService.translate('speed.summary.note')}</p>
                {#if viewModel.measurement !== null}
                    <dl class="statistics measurement">
                        <div>
                            <dt>{translationService.translate('speed.measurement.duration')}</dt>
                            <dd>{viewModel.measurement.duration.display}</dd>
                        </div>
                        <div>
                            <dt>{translationService.translate('speed.measurement.distance')}</dt>
                            <dd>
                                {viewModel.measurement.distanceKilometres.display}
                                {translationService.translate('speed.unitDistance')}
                            </dd>
                        </div>
                    </dl>
                    <p class="note">{translationService.translate('speed.measurement.note')}</p>
                {/if}
            </section>

            {#if viewModel.chartRecords.length > 0}
                <section class="evidence-panel" aria-labelledby="speed-chart-heading">
                    <h2 id="speed-chart-heading">
                        {translationService.translate('speed.chart.heading')}
                    </h2>
                    <p>{translationService.translate('speed.chart.summary')}</p>
                    {#if viewModel.chartReduced}
                        <p class="note">{translationService.translate('speed.chart.reduced')}</p>
                    {/if}
                    <p class="note">{translationService.translate('speed.chart.limitsNote')}</p>
                    <svelte:boundary failed={chartFailed} onerror={handleChartBoundaryError}>
                        <SpeedChart
                            {onclearrecord}
                            onfailure={onchartfailure}
                            onselectrecord={selectChartRecord}
                            runtimeLoader={timeSeriesRuntimeLoader}
                            {selectedRecord}
                            {viewModel}
                        />
                    </svelte:boundary>
                </section>
            {/if}

            {#if viewModel.overspeedRecords.length > 0 || viewModel.overspeedControl !== null}
                <section class="evidence-panel" aria-labelledby="speed-overspeed-heading">
                    <div class="table-heading">
                        <div>
                            <h2 id="speed-overspeed-heading">
                                {translationService.translate('speed.overspeed.heading')}
                            </h2>
                            <p>{translationService.translate('speed.overspeed.note')}</p>
                        </div>
                    </div>
                    {#if viewModel.overspeedRecords.length === 0}
                        <p>{translationService.translate('speed.overspeed.empty')}</p>
                    {:else}
                        {@const overspeedTableSnapshot = overspeedTooling.snapshot(viewModel.overspeedRecords)}
                        <DataTable
                            labels={tableLabels}
                            tooling={overspeedTooling}
                            caption={translationService.translate('speed.overspeed.table.caption')}
                            columns={overspeedColumns}
                            filterSummaryLabel={translationService.translate('table.filterResultCount', {
                                shown: String(overspeedTableSnapshot.rows.length),
                                total: String(viewModel.overspeedRecords.length),
                            })}
                            layout="wide"
                            rowKey={overspeedKey}
                            rows={overspeedTableSnapshot.rows}
                        />
                    {/if}
                    {#if viewModel.overspeedControl !== null}
                        <h3>{translationService.translate('speed.overspeed.control.heading')}</h3>
                        <dl class="statistics">
                            <div>
                                <dt>
                                    {translationService.translate('speed.overspeed.control.numberOfOverspeedSince')}
                                </dt>
                                <dd>
                                    {viewModel.overspeedControl.numberOfOverspeedSince === null
                                        ? translationService.translate('overview.identity.missing')
                                        : viewModel.overspeedControl.numberOfOverspeedSince.display}
                                </dd>
                            </div>
                            <div>
                                <dt>
                                    {translationService.translate('speed.overspeed.control.firstOverspeedSince')}
                                </dt>
                                <dd>
                                    {viewModel.overspeedControl.firstOverspeedSince === null
                                        ? translationService.translate('overview.identity.missing')
                                        : viewModel.overspeedControl.firstOverspeedSince.display}
                                </dd>
                            </div>
                            <div>
                                <dt>
                                    {translationService.translate('speed.overspeed.control.lastControl')}
                                </dt>
                                <dd>
                                    {viewModel.overspeedControl.lastControl === null
                                        ? translationService.translate('overview.identity.missing')
                                        : viewModel.overspeedControl.lastControl.display}
                                </dd>
                            </div>
                        </dl>
                    {/if}
                </section>
            {/if}

            <section class="evidence-panel" aria-labelledby="speed-records-heading">
                <div class="table-heading">
                    <div>
                        <h2 id="speed-records-heading">
                            {translationService.translate('speed.table.heading')}
                        </h2>
                        <p aria-live="polite">
                            {translationService.translate('speed.table.page', {
                                page: String(filteredPageIndex + 1),
                                pageCount: String(filteredPageCount),
                                samples: String(sampleRows.length),
                            })}
                        </p>
                    </div>
                    <div class="page-actions">
                        <Button
                            disabled={filteredPageIndex <= 0}
                            label={translationService.translate('speed.table.previous')}
                            onclick={() => onpage(filteredPageIndex - 1)}
                        />
                        <Button
                            disabled={filteredPageIndex >= filteredPageCount - 1}
                            label={translationService.translate('speed.table.next')}
                            onclick={() => onpage(filteredPageIndex + 1)}
                        />
                    </div>
                </div>
                {#if viewModel.allRecords.length === 0}
                    <p>{translationService.translate('speed.table.empty')}</p>
                {:else}
                    <DataTable
                        labels={tableLabels}
                        tooling={sampleTooling}
                        caption={translationService.translate('speed.table.caption')}
                        {columns}
                        filterSummaryLabel={translationService.translate('table.filterResultCount', {
                            shown: String(sampleRows.length),
                            total: String(viewModel.allRecords.length),
                        })}
                        layout="wide"
                        isRowSelected={isSpeedSampleSelected}
                        rowKey={recordKey}
                        rows={visibleSampleRows}
                    />
                {/if}
            </section>
        {/if}
    {/snippet}
</RecordSectionLayout>

<style>
    .range-context,
    .statistics {
        display: grid;
        grid-template-columns: var(--layout-speed-summary);
        gap: var(--space-section);
    }

    .range-context > div,
    .statistics > div {
        display: grid;
        gap: var(--space-compact);
    }

    .range-controls,
    .range-actions,
    .page-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: end;
        gap: var(--space-actions);
    }

    .range-controls {
        align-items: end;
    }

    .table-heading {
        justify-content: space-between;
        align-items: center;
    }

    .table-heading > div:first-child {
        display: grid;
        gap: var(--space-compact);
    }

    .range-field {
        flex: var(--layout-speed-range-field-flex);
    }

    dt {
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
        font-weight: var(--font-weight-action);
    }

    dd {
        margin: var(--space-none);
        font-variant-numeric: tabular-nums;
    }

    .range-status,
    .note,
    .table-heading p {
        color: var(--color-text-muted);
    }

    .preset-zoom-toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        inline-size: var(--size-full);
        gap: var(--space-compact);
        margin-block-end: var(--space-compact);
    }

    .preset-label {
        font-size: var(--font-size-metadata);
        font-weight: var(--font-weight-action);
        color: var(--color-text-muted);
        margin-inline-end: var(--space-compact);
    }
</style>
