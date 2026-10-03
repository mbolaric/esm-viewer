<script lang="ts" generics="TRow">
    import { untrack } from 'svelte';
    import { SvelteSet } from 'svelte/reactivity';

    import ColumnMenu from './ColumnMenu.svelte';
    import DataTablePagination from './DataTablePagination.svelte';
    import type { IColumnPreferencesStore } from './column-preferences-store.js';
    import type {
        DataTablePageSize,
        IDataTablePaginationLabels,
        IDataTablePaginationPreferencesStore,
    } from './data-table-pagination.js';
    import SearchInput from '../controls/SearchInput.svelte';

    import type { IDataTableColumn } from './data-table-column.js';
    import type { IDataTableLabels } from './data-table-labels.js';
    import type { ITableSortState, ITableToolingBinding } from './table-tooling.js';

    interface IProps {
        caption: string;
        columnPreferencesStore?: IColumnPreferencesStore | undefined;
        columns: readonly IDataTableColumn<TRow>[];
        fillHeight?: boolean;
        filterSummaryLabel?: string;
        filterText?: string;
        hiddenColumnIds?: ReadonlySet<string>;
        labels?: IDataTableLabels | undefined;
        layout?: 'comparison' | 'standard' | 'wide';
        noWrap?: boolean;
        onfilterchange?: (text: string) => void;
        onsort?: (columnId: string) => void;
        ontogglecolumn?: (columnId: string) => void;
        paginationLabels?: IDataTablePaginationLabels | undefined;
        paginationPreferenceKey?: string | undefined;
        paginationPreferencesStore?: IDataTablePaginationPreferencesStore | undefined;
        // Stable persistence key for columnPreferencesStore.
        preferenceKey?: string;
        // Marks rows as selectable and reports which one is selected.
        isRowSelected?: ((row: TRow) => boolean) | undefined;
        rowKey: (row: TRow) => string;
        rows: readonly TRow[];
        showTitleRow?: boolean;
        sortState?: ITableSortState | null;
        // Binds filterText, hiddenColumnIds, sortState, and their callbacks from a tooling controller.
        tooling?: ITableToolingBinding | undefined;
    }

    let {
        caption,
        columnPreferencesStore = undefined,
        columns,
        fillHeight = false,
        filterSummaryLabel = undefined,
        filterText = undefined,
        hiddenColumnIds = undefined,
        labels = undefined,
        layout = 'standard',
        noWrap = false,
        onfilterchange = undefined,
        onsort = undefined,
        ontogglecolumn = undefined,
        paginationLabels = undefined,
        paginationPreferenceKey = undefined,
        paginationPreferencesStore = undefined,
        preferenceKey = undefined,
        isRowSelected = undefined,
        rowKey,
        rows,
        showTitleRow = true,
        sortState = undefined,
        tooling = undefined,
    }: IProps = $props();

    let scrollElement = $state<HTMLDivElement | undefined>();
    let headerContainerElement = $state<HTMLDivElement | undefined>();
    let bodyScrollElement = $state<HTMLDivElement | undefined>();
    let measureRowElement = $state<HTMLTableRowElement | undefined>();
    let tableShellElement = $state<HTMLDivElement | undefined>();
    let columnWidths = $state<readonly number[]>([]);
    let scrollbarPadding = $state<number>(0);
    let containerWidth = $state<number>(Number.POSITIVE_INFINITY);
    let currentPage = $state(1);
    let pageSize = $state<DataTablePageSize>(
        untrack(() =>
            paginationPreferenceKey !== undefined && paginationPreferencesStore !== undefined
                ? paginationPreferencesStore.getPageSize(paginationPreferenceKey)
                : 50,
        ),
    );

    const pageCount = $derived(Math.max(1, Math.ceil(rows.length / pageSize)));
    const activePage = $derived(Math.min(currentPage, pageCount));
    const firstRowIndex = $derived((activePage - 1) * pageSize);
    const lastRowIndex = $derived(Math.min(firstRowIndex + pageSize, rows.length));
    const firstDisplayedRow = $derived(rows.length === 0 ? 0 : firstRowIndex + 1);
    const visibleRows = $derived(paginationLabels === undefined ? rows : rows.slice(firstRowIndex, lastRowIndex));

    function resetPagination(): void {
        currentPage = 1;
        if (bodyScrollElement !== undefined) {
            bodyScrollElement.scrollTop = 0;
        }
    }

    $effect(() => {
        void rows;
        resetPagination();
    });

    const effectiveHiddenColumnIds = $derived(hiddenColumnIds ?? tooling?.hiddenColumnIds);
    const effectiveSortState = $derived(sortState !== undefined ? sortState : (tooling?.sort ?? null));
    const effectiveFilterText = $derived(filterText ?? tooling?.filterText ?? '');
    const effectiveOnFilterChange = $derived(
        onfilterchange ?? (tooling !== undefined ? (text: string) => tooling.setFilterText(text) : undefined),
    );
    const effectiveOnSort = $derived(
        onsort ?? (tooling !== undefined ? (columnId: string) => tooling.toggleSort(columnId) : undefined),
    );
    const effectiveOnToggleColumn = $derived(
        ontogglecolumn ?? (tooling !== undefined ? (columnId: string) => tooling.toggleColumn(columnId) : undefined),
    );

    function handleFilterChange(text: string): void {
        resetPagination();
        effectiveOnFilterChange?.(text);
    }

    function handleSort(columnId: string): void {
        resetPagination();
        effectiveOnSort?.(columnId);
    }

    function handlePageSizeChange(selectedPageSize: DataTablePageSize): void {
        pageSize = selectedPageSize;
        if (paginationPreferenceKey !== undefined && paginationPreferencesStore !== undefined) {
            paginationPreferencesStore.setPageSize(paginationPreferenceKey, selectedPageSize);
        }
        resetPagination();
    }

    function showPreviousPage(): void {
        currentPage = Math.max(1, activePage - 1);
        if (bodyScrollElement !== undefined) {
            bodyScrollElement.scrollTop = 0;
        }
    }

    function showNextPage(): void {
        currentPage = Math.min(pageCount, activePage + 1);
        if (bodyScrollElement !== undefined) {
            bodyScrollElement.scrollTop = 0;
        }
    }

    $effect(() => {
        if (tableShellElement === undefined || typeof ResizeObserver === 'undefined') {
            return;
        }
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry !== undefined) {
                containerWidth = entry.contentRect.width;
            }
        });
        observer.observe(tableShellElement);
        return () => {
            observer.disconnect();
        };
    });

    function updateColumnMeasurements(): void {
        if (measureRowElement === undefined) {
            return;
        }
        const cells = Array.from(measureRowElement.children).filter(
            (child): child is HTMLElement => child instanceof HTMLElement,
        );
        columnWidths = cells.map((cell) => cell.getBoundingClientRect().width);
        if (bodyScrollElement !== undefined) {
            scrollbarPadding = Math.max(0, bodyScrollElement.offsetWidth - bodyScrollElement.clientWidth);
        }
    }

    $effect(() => {
        if (!fillHeight || measureRowElement === undefined) {
            return;
        }
        updateColumnMeasurements();
        if (typeof ResizeObserver === 'undefined') {
            return;
        }
        const observer = new ResizeObserver(() => {
            updateColumnMeasurements();
        });
        observer.observe(measureRowElement);
        if (bodyScrollElement !== undefined) {
            observer.observe(bodyScrollElement);
        }
        return () => {
            observer.disconnect();
        };
    });

    const totalTableWidth = $derived(columnWidths.length > 0 ? columnWidths.reduce((acc, width) => acc + width, 0) : 0);
    const tableTotalWidthStyle = $derived(totalTableWidth > 0 ? `${String(totalTableWidth)}px` : 'var(--size-full)');

    $effect(() => {
        if (scrollElement !== undefined) {
            scrollElement.scrollLeft = 0;
        }
        if (bodyScrollElement !== undefined) {
            bodyScrollElement.scrollLeft = 0;
        }
    });

    function handleBodyScroll(): void {
        if (bodyScrollElement !== undefined && headerContainerElement !== undefined) {
            headerContainerElement.scrollLeft = bodyScrollElement.scrollLeft;
        }
    }

    const lowPriorityColumnIdsAll = $derived(columns.filter((column) => column.priority === 'low').map((column) => column.id));

    // User-pinned low priority columns excluded from auto-hide; seeded from columnPreferencesStore.
    const pinnedLowPriorityIds = new SvelteSet<string>();

    $effect(() => {
        if (preferenceKey === undefined || columnPreferencesStore === undefined) {
            return;
        }
        for (const id of columnPreferencesStore.getPinnedColumnIds(preferenceKey)) {
            pinnedLowPriorityIds.add(id);
        }
    });

    function persistPinnedColumnIds(): void {
        if (preferenceKey !== undefined && columnPreferencesStore !== undefined) {
            columnPreferencesStore.setPinnedColumnIds(preferenceKey, new Set(pinnedLowPriorityIds));
        }
    }

    const lowPriorityColumnIds = $derived(lowPriorityColumnIdsAll.filter((id) => !pinnedLowPriorityIds.has(id)));

    // Number of auto-hidden low priority columns, counted from end of lowPriorityColumnIds based on measured overflow.
    let hiddenLowPriorityCount = $state(0);

    // Container width at which showing a hidden column previously overflowed; prevents retry oscillation.
    let lastShowAttemptOverflowedAtWidth = $state<number | undefined>(undefined);

    // Width margin required before re-attempting to show an auto-hidden column.
    const SHOW_BACK_MARGIN_PX = 24;

    // Incrementally hides or shows low priority columns across animation frames until table content fits container.
    $effect(() => {
        void containerWidth;
        void effectiveHiddenColumnIds;
        const target = fillHeight ? bodyScrollElement : scrollElement;
        const maxHiddenCount = lowPriorityColumnIds.length;
        if (target === undefined || typeof globalThis.requestAnimationFrame !== 'function') {
            return;
        }
        // Alias prevents TypeScript losing control-flow narrowing in nested function.
        const scrollTarget: HTMLDivElement = target;
        let cancelled = false;
        let frame = 0;
        let steps = 0;
        let hasAttemptedShow = false;

        function measureAndAdjust(): void {
            if (cancelled || steps > maxHiddenCount * 2 + 2) {
                return;
            }
            steps += 1;
            const isOverflowing = scrollTarget.scrollWidth > scrollTarget.clientWidth + 1;
            if (isOverflowing) {
                if (hasAttemptedShow) {
                    // Revert optimistic column show if it overflows at current width.
                    hiddenLowPriorityCount += 1;
                    lastShowAttemptOverflowedAtWidth = containerWidth;
                    return;
                }
                if (hiddenLowPriorityCount >= maxHiddenCount) {
                    return;
                }
                hiddenLowPriorityCount += 1;
            } else if (
                hiddenLowPriorityCount > 0 &&
                !hasAttemptedShow &&
                (lastShowAttemptOverflowedAtWidth === undefined ||
                    containerWidth > lastShowAttemptOverflowedAtWidth + SHOW_BACK_MARGIN_PX)
            ) {
                hasAttemptedShow = true;
                hiddenLowPriorityCount -= 1;
            } else {
                return;
            }
            frame = globalThis.requestAnimationFrame(measureAndAdjust);
        }

        frame = globalThis.requestAnimationFrame(measureAndAdjust);
        return () => {
            cancelled = true;
            globalThis.cancelAnimationFrame(frame);
        };
    });

    // Combines user-hidden and auto-hidden columns into visibleColumns.
    const autoHiddenLowPriorityIds = $derived(
        new Set(lowPriorityColumnIds.slice(lowPriorityColumnIds.length - hiddenLowPriorityCount)),
    );
    const visibleColumns = $derived(
        columns.filter(
            (column) =>
                (effectiveHiddenColumnIds === undefined || !effectiveHiddenColumnIds.has(column.id)) &&
                !autoHiddenLowPriorityIds.has(column.id),
        ),
    );
    const visibleColumnIds = $derived(visibleColumns.map((column) => column.id));
    const hasToolbar = $derived(effectiveOnFilterChange !== undefined);

    // Pin toggle enabled only for low-priority columns subject to auto-hiding.
    const pinnableColumnIds = $derived(new Set(lowPriorityColumnIdsAll));

    // Syncs menu checkbox with real visibility; checking width-hidden column pins it, unchecking unpins it.
    function handleToggleColumn(columnId: string): void {
        const willShow = !visibleColumnIds.includes(columnId);
        if (willShow) {
            if (lowPriorityColumnIdsAll.includes(columnId)) {
                pinnedLowPriorityIds.add(columnId);
                persistPinnedColumnIds();
            }
            if (effectiveHiddenColumnIds?.has(columnId) === true) {
                effectiveOnToggleColumn?.(columnId);
            }
        } else {
            if (pinnedLowPriorityIds.delete(columnId)) {
                persistPinnedColumnIds();
            }
            if (effectiveHiddenColumnIds === undefined || !effectiveHiddenColumnIds.has(columnId)) {
                effectiveOnToggleColumn?.(columnId);
            }
        }
    }

    // Independent pin toggle to pin currently visible low-priority columns or inspect pin state.
    function handleTogglePin(columnId: string): void {
        if (pinnedLowPriorityIds.has(columnId)) {
            pinnedLowPriorityIds.delete(columnId);
        } else {
            pinnedLowPriorityIds.add(columnId);
        }
        persistPinnedColumnIds();
    }

    function columnSortLabel(columnId: string): 'ascending' | 'descending' | 'none' {
        return effectiveSortState?.columnId === columnId
            ? effectiveSortState.direction === 'asc'
                ? 'ascending'
                : 'descending'
            : 'none';
    }
</script>

{#snippet bodyRow(currentRow: TRow)}
    {@const selected = isRowSelected?.(currentRow)}
    <tr aria-selected={selected} data-selectable={selected === undefined ? undefined : 'true'} data-selected={selected}>
        {#each columns as column (column.id)}
            <td
                class={['col-' + column.id, column.cellClass]}
                class:compact-cell={column.compact}
                class:numeric-cell={column.align === 'numeric'}
                hidden={!visibleColumnIds.includes(column.id)}
            >
                {@render column.cell(currentRow)}
            </td>
        {/each}
    </tr>
{/snippet}

{#snippet headerCells()}
    {#each visibleColumns as column (column.id)}
        {#if effectiveOnSort !== undefined && column.sortable === true}
            <th
                aria-sort={columnSortLabel(column.id)}
                class="sortable col-{column.id}"
                class:compact={column.compact}
                data-column-id={column.id}
                scope="col"
            >
                <button
                    class="sort-button has-tooltip"
                    data-tooltip={column.label}
                    type="button"
                    onclick={() => handleSort(column.id)}
                >
                    <span class="sort-label">{column.label}</span>
                    <span aria-hidden="true" class="sort-indicator">
                        {effectiveSortState?.columnId === column.id ? (effectiveSortState.direction === 'asc' ? '↑' : '↓') : ''}
                    </span>
                </button>
            </th>
        {:else}
            <th
                class="col-{column.id} has-tooltip"
                class:compact={column.compact}
                data-column-id={column.id}
                data-tooltip={column.label}
                scope="col"
            >
                <span class="header-label">{column.label}</span>
            </th>
        {/if}
    {/each}
{/snippet}

{#if hasToolbar}
    <div class="table-toolbar">
        {#if effectiveOnFilterChange !== undefined && labels?.filter !== undefined}
            <SearchInput
                clearLabel={labels.filter.clear}
                icon="filter"
                label={labels.filter.label}
                oninput={handleFilterChange}
                placeholder={labels.filter.placeholder}
                value={effectiveFilterText}
            />
        {/if}
        {#if filterSummaryLabel !== undefined}
            <p class="sr-only" role="status">{filterSummaryLabel}</p>
        {/if}
    </div>
{/if}

<div
    bind:this={tableShellElement}
    aria-label={caption}
    class="table-shell"
    class:fill-height={fillHeight}
    class:has-title-row={showTitleRow}
    role="region"
>
    {#if showTitleRow}
        <div class="table-title-row">
            <span class="table-title-text">{caption}</span>
            {#if effectiveOnToggleColumn !== undefined && labels !== undefined}
                <ColumnMenu
                    {columns}
                    hiddenColumnIds={effectiveHiddenColumnIds}
                    autoHiddenColumnIds={autoHiddenLowPriorityIds}
                    label={labels.columns}
                    ontogglecolumn={handleToggleColumn}
                    ontogglepin={handleTogglePin}
                    pinLabel={labels.pinColumn}
                    {pinnableColumnIds}
                    pinnedColumnIds={pinnedLowPriorityIds}
                />
            {/if}
        </div>
    {/if}
    {#if !fillHeight}
        <div bind:this={scrollElement} class="table-scroll">
            <table
                aria-label={caption}
                class:comparison={layout === 'comparison'}
                class:no-wrap={noWrap}
                class:wide={layout === 'wide'}
                class="data-table"
            >
                <caption class="sr-only">{caption}</caption>
                <thead>
                    <tr>
                        {@render headerCells()}
                    </tr>
                </thead>
                <tbody>
                    {#each visibleRows as currentRow (rowKey(currentRow))}
                        {@render bodyRow(currentRow)}
                    {/each}
                </tbody>
            </table>
        </div>
    {:else}
        <!--
            Two tables, on purpose: the visible, pinned header below is a
            decoration-only duplicate (`aria-hidden`) - it exists only so
            sighted users see a header that stays put while the body
            scrolls beneath it. The REAL, accessible header - real
            scope="col", aria-sort, working sort buttons - is the body
            table's own `<thead>` (`measureRowElement`); it is kept in the
            accessibility tree and reachable by keyboard, just visually
            zero-height (see `.table-measure-head` below), so it never
            appears twice for sighted users. Its rendered cell widths are
            also what `updateColumnMeasurements` reads to size the pinned
            duplicate's columns, keeping both pixel-aligned. This split is
            what lets the scrollbar's range cover only the data rows,
            starting at row 1, rather than the header too - something a
            single shared table with a `position: sticky` header cannot
            do, since sticky keeps the header inside the same scroll flow.
        -->
        <div
            bind:this={headerContainerElement}
            class="table-header-container"
            style:--table-scrollbar-offset="{String(scrollbarPadding)}px"
        >
            <table
                aria-hidden="true"
                class:comparison={layout === 'comparison'}
                class:no-wrap={noWrap}
                class:wide={layout === 'wide'}
                class="data-table header-table"
                style:--table-total-width={tableTotalWidthStyle}
            >
                <colgroup>
                    {#each columnWidths as width, index (index)}
                        <col style:--col-width="{String(width)}px" />
                    {/each}
                </colgroup>
                <thead>
                    <tr>
                        {@render headerCells()}
                    </tr>
                </thead>
            </table>
        </div>
        <div bind:this={bodyScrollElement} class="table-body-scroll" onscroll={handleBodyScroll}>
            <table
                aria-label={caption}
                class:comparison={layout === 'comparison'}
                class:no-wrap={noWrap}
                class:wide={layout === 'wide'}
                class="data-table body-table"
            >
                <caption class="sr-only">{caption}</caption>
                <thead class="table-measure-head">
                    <tr bind:this={measureRowElement}>
                        {@render headerCells()}
                    </tr>
                </thead>
                <tbody>
                    {#each visibleRows as currentRow (rowKey(currentRow))}
                        {@render bodyRow(currentRow)}
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
    {#if paginationLabels !== undefined}
        <DataTablePagination
            labels={paginationLabels}
            onnext={showNextPage}
            onpagesizechange={handlePageSizeChange}
            onprevious={showPreviousPage}
            {pageSize}
            status={{
                end: lastRowIndex,
                page: activePage,
                pageCount,
                start: firstDisplayedRow,
                total: rows.length,
            }}
        />
    {/if}
</div>

<style>
    .table-toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: end;
        gap: var(--space-actions);
        margin-block-end: var(--space-actions);
    }

    .table-shell {
        display: grid;
        grid-template-columns: var(--layout-panel-columns);
        inline-size: var(--size-full);
        max-inline-size: var(--size-full);
        min-inline-size: var(--size-zero);
        overflow: hidden;
        background: var(--color-surface);
        border: var(--border-panel);
        border-radius: var(--radius-panel);
    }

    /* Fills remaining vertical height and bounds scroll container. */
    .table-shell.fill-height {
        display: flex;
        flex-direction: column;
        flex: var(--layout-table-fill-flex);
        min-block-size: var(--size-table-fill-min-block);
        overflow: hidden;
    }

    .table-header-container {
        display: block;
        inline-size: var(--size-full);
        max-inline-size: var(--size-full);
        min-inline-size: var(--size-zero);
        overflow: hidden;
        flex: var(--layout-fixed-flex);
        border-block-end: var(--border-region);
        background: var(--color-surface-subtle);
        padding-inline-end: var(--table-scrollbar-offset, var(--space-none));
        box-sizing: border-box;
    }

    .table-body-scroll {
        display: block;
        inline-size: var(--size-full);
        max-inline-size: var(--size-full);
        min-inline-size: var(--size-zero);
        min-block-size: var(--size-zero);
        overflow-x: auto;
        overflow-y: auto;
        flex: var(--layout-fill-flex);
        scrollbar-width: thin;
        scrollbar-color: var(--color-border-strong) var(--color-surface-subtle);
        -webkit-overflow-scrolling: touch;
    }

    .table-shell.fill-height .table-body-scroll {
        min-block-size: var(--size-table-body-min-block);
    }

    .table-body-scroll::-webkit-scrollbar {
        height: var(--size-scrollbar);
        width: var(--size-scrollbar);
    }

    .table-body-scroll::-webkit-scrollbar-track {
        background: var(--color-surface-subtle);
        border-radius: var(--radius-chip);
    }

    .table-body-scroll::-webkit-scrollbar-thumb {
        background: var(--color-border-strong);
        border-radius: var(--radius-chip);
    }

    .table-body-scroll::-webkit-scrollbar-thumb:hover {
        background: var(--color-text-muted);
    }

    .header-table {
        table-layout: fixed;
        inline-size: var(--table-total-width, var(--size-full));
    }

    .header-table th {
        border-block-end: none;
    }

    /* Zero-size accessible header preserved for keyboard navigation and screen readers. */
    .table-measure-head th {
        padding-block: var(--space-none);
        padding-inline: var(--space-control-inline);
        box-sizing: border-box;
        border-block-end: none;
        height: var(--space-none);
        line-height: var(--space-none);
        overflow: hidden;
    }

    .table-measure-head .sort-button {
        min-block-size: var(--space-none);
        padding-block: var(--space-none);
        height: var(--space-none);
        overflow: hidden;
    }

    col {
        inline-size: var(--col-width);
        width: var(--col-width);
    }

    .table-scroll {
        display: block;
        inline-size: var(--size-full);
        max-inline-size: var(--size-full);
        min-inline-size: var(--size-zero);
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: thin;
        scrollbar-color: var(--color-border-strong) var(--color-surface-subtle);
        -webkit-overflow-scrolling: touch;
    }

    .table-scroll::-webkit-scrollbar {
        height: var(--size-scrollbar);
        width: var(--size-scrollbar);
    }

    .table-scroll::-webkit-scrollbar-track {
        background: var(--color-surface-subtle);
        border-radius: var(--radius-chip);
    }

    .table-scroll::-webkit-scrollbar-thumb {
        background: var(--color-border-strong);
        border-radius: var(--radius-chip);
    }

    .table-scroll::-webkit-scrollbar-thumb:hover {
        background: var(--color-text-muted);
    }

    .data-table {
        inline-size: var(--size-full);
        min-inline-size: var(--size-table-min-inline);
        border-collapse: separate;
        border-spacing: var(--space-none);
        text-align: start;
    }

    /* First row tooltips open downward to prevent clipping by scroll container. */
    :global(.data-table tbody tr:first-child .has-tooltip[data-tooltip]::after) {
        inset-block-start: calc(var(--size-full) + var(--space-compact));
        inset-block-end: auto;
    }

    /* Single-line cells with horizontal scroll for non-wrapping data tables. */
    .data-table.no-wrap th,
    :global(.data-table.no-wrap td) {
        white-space: nowrap;
    }

    .data-table.wide {
        min-inline-size: var(--size-table-wide-min-inline);
    }

    .data-table.comparison {
        min-inline-size: var(--size-table-comparison-min-inline);
    }

    .table-title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-actions);
        padding-block: var(--space-control-block);
        padding-inline: var(--space-control-inline);
        background: var(--color-surface-subtle);
        border-block-end: var(--border-region);
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
        text-align: start;
    }

    .table-title-text {
        font-weight: var(--font-weight-action);
    }

    th,
    :global(.data-table td) {
        padding-block: var(--space-row-block);
        padding-inline: var(--space-control-inline);
        border-block-end: var(--border-region);
        text-align: start;
        vertical-align: middle;
    }

    th {
        background: var(--color-surface-subtle);
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
        letter-spacing: var(--letter-spacing-group);
        text-transform: var(--text-transform-group);
    }

    th.compact,
    :global(.data-table td.compact-cell) {
        inline-size: var(--size-table-column-compact);
    }

    th.compact {
        white-space: nowrap;
    }

    th.sortable {
        padding: var(--space-none);
    }

    /* Allows header labels and sort buttons to shrink and ellipsize text overflow. */
    .header-label,
    .sort-button {
        min-inline-size: var(--size-zero);
    }

    .header-label {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .sort-button {
        min-block-size: var(--size-control-compact);
        display: inline-flex;
        align-items: center;
        gap: var(--space-compact);
        max-inline-size: var(--size-full);
        padding-block: var(--space-row-block);
        padding-inline: var(--space-control-inline);
        background: var(--color-surface-subtle);
        border: none;
        color: inherit;
        font: inherit;
        letter-spacing: inherit;
        text-align: inherit;
        text-transform: inherit;
        cursor: pointer;
    }

    .sort-label {
        min-inline-size: var(--size-zero);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .sort-indicator {
        flex: var(--layout-fixed-flex);
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
    }

    :global(.data-table tbody tr:last-child td) {
        border-block-end: none;
    }

    :global(.data-table tbody tr[data-selected='true']) {
        background: var(--color-surface-selected);
    }

    :global(.data-table tbody tr[data-selectable='true']:hover) {
        background: var(--color-surface-hover);
    }

    :global(.data-table tbody tr[data-selectable='true'][data-selected='true']:hover) {
        background: var(--color-surface-selected);
    }

    :global(.data-table td[hidden]) {
        display: none;
    }

    .numeric-cell {
        font-variant-numeric: tabular-nums;
        text-align: end;
        white-space: nowrap;
    }

    @media (forced-colors: active) {
        :global(.data-table tbody tr[data-selected='true']) {
            outline: var(--size-selection-marker) solid Highlight;
        }
    }
</style>
