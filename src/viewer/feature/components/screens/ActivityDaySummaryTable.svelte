<script lang="ts">
    import { createViewerDataTableLabels } from '../../helpers/data-table-labels.js';
    import { Button, createStandardSortValue, DataTable, Icon } from '#ui';
    import type { ICalendarMonthDayViewModel } from '#viewer-presentation';

    import { translateActivityKind, translateCrewBadge, translateGeneration } from '../../helpers/viewer-labels.js';
    import { TableToolingController } from '../../controllers/table-tooling-controller.svelte.js';
    import type { IDocumentScopedValue } from '../../controllers/document-scoped-value.svelte.js';
    import { useViewerContext } from '../../viewer-context.js';

    interface IProps {
        caption: string;
        filterText: IDocumentScopedValue<string>;
        onshowday: (index: number) => void;
        rows: readonly ICalendarMonthDayViewModel[];
        selectedDayIndex: number;
    }

    let { caption, filterText, onshowday, rows, selectedDayIndex }: IProps = $props();

    const viewerContext = useViewerContext();
    const translationService = viewerContext.translationService;

    const columns = $derived([
        {
            cell: dateCell,
            id: 'date',
            label: translationService.translate('activities.date'),
            sortable: true,
        },
        {
            cell: applicationCell,
            id: 'application',
            label: translationService.translate('activities.application'),
            priority: 'low' as const,
            sortable: true,
        },
        {
            cell: drivingCell,
            id: 'driving',
            label: translateActivityKind('driving', translationService),
            sortable: true,
        },
        {
            cell: workCell,
            id: 'work',
            label: translateActivityKind('work', translationService),
            priority: 'low' as const,
            sortable: true,
        },
        {
            cell: availabilityCell,
            id: 'availability',
            label: translateActivityKind('availability', translationService),
            priority: 'low' as const,
            sortable: true,
        },
        {
            cell: breakOrRestCell,
            id: 'breakOrRest',
            label: translateActivityKind('breakOrRest', translationService),
            sortable: true,
        },
        {
            cell: unknownCell,
            id: 'unknown',
            label: translateActivityKind('unknown', translationService),
            priority: 'low' as const,
            sortable: true,
        },
        {
            cell: crewCell,
            id: 'crew',
            label: translationService.translate('activities.crew.column'),
            priority: 'low' as const,
            sortable: true,
        },
        {
            cell: recordsCell,
            id: 'records',
            label: translationService.translate('activities.allDays.records'),
            priority: 'low' as const,
            sortable: true,
        },
        {
            cell: actionCell,
            id: 'action',
            label: translationService.translate('activities.allDays.showDay'),
            sortable: true,
        },
    ]);
    const tooling = new TableToolingController<ICalendarMonthDayViewModel>({
        columns: () => columns,
        filterText: () => filterText,
        filterValues: (row) => [
            row.day.date.display,
            translateGeneration(row.day.generation, translationService),
            row.day.totals.driving.display,
            row.day.totals.work.display,
            row.day.totals.availability.display,
            row.day.totals.breakOrRest.display,
            row.day.totals.unknown.display,
            translateCrewBadge(row.day.crewStatus, translationService) ?? '',
            String(row.day.records.length),
        ],
        sortValue: createStandardSortValue({
            action: (row) => row.index,
            application: (row) => row.day.generation,
            availability: (row) => row.day.totals.availability.value,
            breakOrRest: (row) => row.day.totals.breakOrRest.value,
            crew: (row) => row.day.crewStatus,
            date: (row) => row.day.date.value,
            driving: (row) => row.day.totals.driving.value,
            records: (row) => row.day.records.length,
            unknown: (row) => row.day.totals.unknown.value,
            work: (row) => row.day.totals.work.value,
        }),
    });

    function rowKey(row: ICalendarMonthDayViewModel): string {
        return `${row.day.generation}:${row.day.dateInputValue}:${String(row.index)}`;
    }
    function isCurrentDay(row: ICalendarMonthDayViewModel): boolean {
        return row.index === selectedDayIndex;
    }

    const tableLabels = $derived(createViewerDataTableLabels(translationService));
</script>

{#snippet dateCell(row: ICalendarMonthDayViewModel)}
    {row.day.date.display}
{/snippet}

{#snippet applicationCell(row: ICalendarMonthDayViewModel)}
    {translateGeneration(row.day.generation, translationService)}
{/snippet}

{#snippet drivingCell(row: ICalendarMonthDayViewModel)}
    {row.day.totals.driving.display}
{/snippet}

{#snippet workCell(row: ICalendarMonthDayViewModel)}
    {row.day.totals.work.display}
{/snippet}

{#snippet availabilityCell(row: ICalendarMonthDayViewModel)}
    {row.day.totals.availability.display}
{/snippet}

{#snippet breakOrRestCell(row: ICalendarMonthDayViewModel)}
    {row.day.totals.breakOrRest.display}
{/snippet}

{#snippet unknownCell(row: ICalendarMonthDayViewModel)}
    {row.day.totals.unknown.display}
{/snippet}

{#snippet crewCell(row: ICalendarMonthDayViewModel)}
    {@const crewBadge = translateCrewBadge(row.day.crewStatus, translationService)}
    {#if crewBadge !== null}
        <span class="crew-cell">
            <Icon name="users" />
            {crewBadge}
        </span>
    {/if}
{/snippet}

{#snippet recordsCell(row: ICalendarMonthDayViewModel)}
    {row.day.records.length}
{/snippet}

{#snippet actionCell(row: ICalendarMonthDayViewModel)}
    <Button
        ariaLabel={`${translationService.translate('activities.allDays.showDay')}: ${row.day.date.display}`}
        label={translationService.translate('activities.allDays.showDay')}
        onclick={() => {
            onshowday(row.index);
        }}
        size="compact"
        variant="ghost"
    />
{/snippet}

{#snippet toolingRows()}
    {@const snapshot = tooling.snapshot(rows)}
    <DataTable
        labels={tableLabels}
        {tooling}
        {caption}
        columnPreferencesStore={viewerContext.preferencesController}
        {columns}
        filterSummaryLabel={translationService.translate('table.filterResultCount', {
            shown: String(snapshot.rows.length),
            total: String(rows.length),
        })}
        preferenceKey="activities.daySummary"
        isRowSelected={isCurrentDay}
        {rowKey}
        rows={snapshot.rows}
    />
{/snippet}

<div class="day-summary-table">
    {@render toolingRows()}
</div>

<style>
    .day-summary-table {
        display: contents;
    }

    .crew-cell {
        display: inline-flex;
        align-items: center;
        gap: var(--space-compact);
    }
</style>
