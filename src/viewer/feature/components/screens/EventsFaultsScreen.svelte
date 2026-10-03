<script lang="ts">
    import { createViewerDataTableLabels } from '../../helpers/data-table-labels.js';
    import { translateEventFaultCode, translateEventFaultPurpose, translateGeneration } from '../../helpers/viewer-labels.js';
    import { Button, createStandardSortValue, DataTable, FilterChipGroup, Icon, ReferenceLink } from '#ui';
    import type { DocumentSectionRecord, EventFaultTypeFilter } from '#viewer-application';
    import RecordSectionLayout from '../records/RecordSectionLayout.svelte';
    import type { JsonPointer, TachographEventFault } from '#viewer-domain';
    import {
        filterEventsFaultsByActivityDay,
        type IEventFaultRecordViewModel,
        type IEventFaultSectionViewModel,
    } from '#viewer-presentation';
    import type { IActivityDayLinkProps } from '../../helpers/activity-day-link-props.js';
    import ActivityWindowRecordsPanel from './ActivityWindowRecordsPanel.svelte';
    import type { TranslationKey } from '#i18n-locales';
    import RecordFilterPanel from '../records/RecordFilterPanel.svelte';
    import { TableToolingController } from '../../controllers/table-tooling-controller.svelte.js';
    import type { IDocumentScopedValue } from '../../controllers/document-scoped-value.svelte.js';
    import { useViewerTranslationService } from '../../viewer-context.js';

    interface IProps extends IActivityDayLinkProps {
        filterText: IDocumentScopedValue<string>;
        onfilter: (filter: EventFaultTypeFilter) => void;
        onopensource: (path: JsonPointer) => void;
        onselectrecord: (record: TachographEventFault) => void;
        selectedRecord: DocumentSectionRecord | null;
        viewModel: IEventFaultSectionViewModel | null;
    }

    let {
        activityDayLabel,
        activityDayMidnight,
        filterText,
        onclearactivityday,
        onreturnactivityday,
        onfilter,
        onopensource,
        onselectrecord,
        selectedRecord,
        viewModel,
    }: IProps = $props();

    const translationService = useViewerTranslationService();
    const emptyTranslationKeys = {
        all: 'eventsFaults.empty.all',
        event: 'eventsFaults.empty.event',
        fault: 'eventsFaults.empty.fault',
    } satisfies Readonly<Record<EventFaultTypeFilter, TranslationKey>>;
    const filterTranslationKeys = {
        all: 'eventsFaults.filter.all',
        event: 'overview.contents.events',
        fault: 'overview.contents.faults',
    } satisfies Readonly<Record<EventFaultTypeFilter, TranslationKey>>;
    const kindTranslationKeys = {
        event: 'eventsFaults.kind.event',
        fault: 'eventsFaults.kind.fault',
    } satisfies Readonly<Record<IEventFaultRecordViewModel['recordKind'], TranslationKey>>;
    const columns = $derived([
        {
            cell: typeCell,
            id: 'type',
            label: translationService.translate('eventsFaults.type'),
            sortable: true,
        },
        {
            cell: startCell,
            cellClass: 'numeric-value',
            id: 'start',
            label: translationService.translate('eventsFaults.start'),
            sortable: true,
        },
        {
            cell: endDurationCell,
            id: 'endDuration',
            label: translationService.translate('eventsFaults.endDuration'),
            sortable: true,
        },
        {
            cell: codeCell,
            id: 'code',
            label: translationService.translate('eventsFaults.code'),
            sortable: true,
        },
        {
            cell: contextCell,
            id: 'context',
            label: translationService.translate('eventsFaults.context'),
            sortable: true,
        },
        {
            cell: sourceCell,
            compact: true,
            id: 'source',
            label: translationService.translate('eventsFaults.source'),
            sortable: true,
        },
    ]);
    const recordTooling = new TableToolingController<IEventFaultRecordViewModel>({
        columns: () => columns,
        filterText: () => filterText,
        filterValues: (record) => [
            kindLabel(record.recordKind),
            record.start.display,
            record.end?.display ?? '',
            record.duration?.display ?? '',
            translateEventFaultCode(record.code, translationService),
            record.code,
            record.recordPurpose === null ? '' : translateEventFaultPurpose(record.recordPurpose, translationService),
            record.similarOccurrences?.display ?? '',
            record.registrationMemberState ?? '',
            record.registrationNumber ?? '',
            record.source.path,
        ],
        sortValue: createStandardSortValue({
            type: (record) => record.recordKind,
            start: (record) => record.start.value,
            endDuration: (record) => record.end?.value ?? record.duration?.value ?? null,
            code: (record) => record.code,
            context: (record) => `${record.registrationMemberState ?? ''} ${record.registrationNumber ?? ''}`,
            source: (record) => record.source.path,
        }),
    });
    const windowedRecords = $derived(
        viewModel === null ? [] : filterEventsFaultsByActivityDay(viewModel.records, activityDayMidnight),
    );

    function emptyLabel(filter: EventFaultTypeFilter): string {
        return translationService.translate(emptyTranslationKeys[filter]);
    }

    function kindLabel(kind: IEventFaultRecordViewModel['recordKind']): string {
        return translationService.translate(kindTranslationKeys[kind]);
    }

    function recordSelectionLabel(record: IEventFaultRecordViewModel): string {
        return `${translationService.translate('eventsFaults.selectRecord')}: ${kindLabel(
            record.recordKind,
        )}, ${record.start.display}`;
    }

    function isRecordSelected(record: IEventFaultRecordViewModel): boolean {
        return record.record === selectedRecord;
    }

    function recordKey(record: IEventFaultRecordViewModel): string {
        return `${record.recordKind}:${record.source.path}`;
    }

    const tableLabels = $derived(createViewerDataTableLabels(translationService));
</script>

{#snippet typeFilters()}
    <FilterChipGroup
        ariaLabel={translationService.translate('eventsFaults.filterHeading')}
        onchange={onfilter}
        options={[
            {
                count: viewModel?.allCount.display ?? '',
                label: translationService.translate(filterTranslationKeys.all),
                value: 'all',
            },
            {
                count: viewModel?.eventCount.display ?? '',
                label: translationService.translate(filterTranslationKeys.event),
                value: 'event',
            },
            {
                count: viewModel?.faultCount.display ?? '',
                label: translationService.translate(filterTranslationKeys.fault),
                value: 'fault',
            },
        ]}
        value={viewModel?.filter}
    />
{/snippet}

{#snippet typeCell(record: IEventFaultRecordViewModel)}
    <Button
        ariaLabel={recordSelectionLabel(record)}
        icon="triangleAlert"
        label={kindLabel(record.recordKind)}
        onclick={() => onselectrecord(record.record)}
        pressed={isRecordSelected(record)}
        size="compact"
        variant="ghost"
    />
{/snippet}

{#snippet startCell(record: IEventFaultRecordViewModel)}
    {record.start.display}
{/snippet}

{#snippet endDurationCell(record: IEventFaultRecordViewModel)}
    {#if record.end === null}
        <span>{translationService.translate('overview.identity.missing')}</span>
    {:else}
        <div class="record-stack">
            <span class="numeric-value">{record.end.display}</span>
            <span class="metadata">
                <span>{translationService.translate('activities.duration')}</span>
                <span>
                    {record.duration?.display ?? translationService.translate('overview.identity.missing')}
                </span>
            </span>
        </div>
    {/if}
{/snippet}

{#snippet codeCell(record: IEventFaultRecordViewModel)}
    <div class="record-stack">
        <div class="code-title-row">
            <strong>{translateEventFaultCode(record.code, translationService)}</strong>
            {#if record.securityCategory === 'securityCritical'}
                <span class="security-badge" title={translationService.translate('eventsFaults.securityAlert')}>
                    <Icon name="circleAlert" size="small" />
                    {translationService.translate('eventsFaults.securityAlert')}
                </span>
            {/if}
        </div>
        <code>{record.code}</code>
        {#if record.recordPurpose !== null}
            <span class="metadata">
                <span>{translationService.translate('eventsFaults.purpose')}</span>
                <span>
                    {translateEventFaultPurpose(record.recordPurpose, translationService)}
                </span>
            </span>
        {/if}
        {#if record.similarOccurrences !== null}
            <span class="metadata">
                <span>
                    {translationService.translate('eventsFaults.similarOccurrences')}
                </span>
                <span>{record.similarOccurrences.display}</span>
            </span>
        {/if}
    </div>
{/snippet}

{#snippet contextCell(record: IEventFaultRecordViewModel)}
    {#if record.registrationMemberState === null && record.registrationNumber === null}
        <span>{translationService.translate('overview.identity.missing')}</span>
    {:else}
        <div class="record-stack">
            {#if record.registrationMemberState !== null}
                <span>{record.registrationMemberState}</span>
            {/if}
            {#if record.registrationNumber !== null}
                <strong>{record.registrationNumber}</strong>
            {/if}
        </div>
    {/if}
{/snippet}

{#snippet sourceCell(record: IEventFaultRecordViewModel)}
    <ReferenceLink
        generation={translateGeneration(record.generation, translationService)}
        onopen={() => onopensource(record.source.path)}
        openLabel={translationService.translate('overview.openSource')}
        path={record.source.path}
    />
{/snippet}

<RecordSectionLayout
    className="events-faults-screen record-workspace wide-workspace"
    errorDescription={translationService.translate('eventsFaults.error')}
    errorHeading={translationService.translate('eventsFaults.errorHeading')}
    errorHeadingId="events-faults-error-heading"
    fillHeight
    heading={translationService.translate('navigator.section.eventsAndFaults')}
    {viewModel}
>
    {#snippet content(viewModel: IEventFaultSectionViewModel)}
        <RecordFilterPanel
            filterHeading={translationService.translate('eventsFaults.filterHeading')}
            filters={typeFilters}
            headingId="events-faults-filter-heading"
            recordCount={viewModel.totalCount.display}
            recordsShown={translationService.translate('eventsFaults.recordsShown')}
            timeBasis={viewModel.timeZone}
            timeBasisLabel={translationService.translate('activities.timeZone')}
        />

        {#if viewModel.securityCriticalCount !== undefined && viewModel.securityCriticalCount.value > 0}
            <div class="security-summary-panel" role="alert">
                <div class="security-icon-col">
                    <Icon name="triangleAlert" size="default" />
                </div>
                <div class="security-text-col">
                    <h3 class="security-title">
                        {translationService.translate('eventsFaults.securityHeading')}
                    </h3>
                    <p class="security-desc">
                        <strong>
                            {translationService.translate('eventsFaults.securityCriticalCount', {
                                count: viewModel.securityCriticalCount.display,
                            })}
                        </strong>
                        {translationService.translate('eventsFaults.securitySummary')}
                    </p>
                </div>
            </div>
        {/if}

        <section class="events-faults-records-panel table-section" aria-labelledby="events-faults-records-heading">
            <h2 id="events-faults-records-heading">
                {translationService.translate('eventsFaults.recordsHeading')}
            </h2>
            <ActivityWindowRecordsPanel
                {activityDayLabel}
                {activityDayMidnight}
                emptyMessage={emptyLabel(viewModel.filter)}
                {onclearactivityday}
                {onreturnactivityday}
                recordsEmpty={windowedRecords.length === 0}
            >
                {@const eventFaultTableSnapshot = recordTooling.snapshot(windowedRecords)}
                <DataTable
                    labels={tableLabels}
                    caption={translationService.translate('eventsFaults.recordsCaption')}
                    {columns}
                    fillHeight
                    filterSummaryLabel={translationService.translate('table.filterResultCount', {
                        shown: String(eventFaultTableSnapshot.rows.length),
                        total: String(windowedRecords.length),
                    })}
                    isRowSelected={isRecordSelected}
                    layout="wide"
                    rowKey={recordKey}
                    rows={eventFaultTableSnapshot.rows}
                    tooling={recordTooling}
                />
            </ActivityWindowRecordsPanel>
        </section>
    {/snippet}
</RecordSectionLayout>

<style>
    .code-title-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-actions);
    }

    .security-badge {
        display: inline-flex;
        align-items: center;
        gap: var(--space-badge-gap);
        padding-block: var(--space-compact);
        padding-inline: var(--space-control-block);
        background: var(--color-danger-soft);
        color: var(--color-danger);
        border: var(--border-danger-badge);
        border-radius: var(--radius-chip);
        font-size: var(--font-size-badge);
        font-weight: var(--font-weight-action);
        line-height: var(--line-height-tight);
        white-space: nowrap;
    }

    .security-summary-panel {
        flex: var(--layout-fixed-flex);
        display: flex;
        align-items: flex-start;
        gap: var(--space-panel);
        padding: var(--space-panel);
        border-radius: var(--radius-panel);
        background: var(--color-danger-soft);
        border: var(--border-badge-critical);
        color: var(--color-text);
    }

    .security-icon-col {
        color: var(--color-danger);
    }

    .security-text-col {
        display: flex;
        flex-direction: column;
        gap: var(--space-compact);
    }

    .security-title {
        margin: var(--space-none);
        font-size: var(--font-size-section);
        font-weight: var(--font-weight-title);
        color: var(--color-danger);
    }

    .security-desc {
        margin: var(--space-none);
        font-size: var(--font-size-body);
        line-height: var(--line-height-body);
    }

    /* Avoids conflicting grid panel styling on flex table section. */
    .events-faults-records-panel h2 {
        margin-block: var(--space-none) var(--space-actions);
    }
</style>
