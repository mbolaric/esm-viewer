<script lang="ts">
    import Button from '../controls/Button.svelte';
    import type { DataTablePageSize, IDataTablePageStatus, IDataTablePaginationLabels } from './data-table-pagination.js';

    interface IProps {
        labels: IDataTablePaginationLabels;
        onnext: () => void;
        onpagesizechange: (pageSize: DataTablePageSize) => void;
        onprevious: () => void;
        pageSize: DataTablePageSize;
        status: IDataTablePageStatus;
    }

    let { labels, onnext, onpagesizechange, onprevious, pageSize, status }: IProps = $props();

    const pageSizeOptions = [25, 50, 100] as const satisfies readonly DataTablePageSize[];

    function handlePageSizeChange(event: Event): void {
        const target = event.currentTarget;
        if (!(target instanceof HTMLSelectElement)) {
            throw new TypeError('Expected the page-size control to be a select element.');
        }
        const selected = pageSizeOptions.find((option) => String(option) === target.value);
        if (selected === undefined) {
            throw new RangeError(`Unsupported table page size: ${target.value}`);
        }
        onpagesizechange(selected);
    }
</script>

<nav aria-label={labels.navigation} class="table-pagination">
    <p aria-atomic="true" class="pagination-status" role="status">
        {labels.status(status)}
    </p>
    <div class="pagination-controls">
        <label class="page-size-control">
            <span>{labels.rowsPerPage}</span>
            <select class="viewer-input" onchange={handlePageSizeChange} value={pageSize}>
                {#each pageSizeOptions as option (option)}
                    <option value={option}>{option}</option>
                {/each}
            </select>
        </label>
        <div class="pagination-buttons">
            <Button
                disabled={status.page === 1}
                icon="chevronLeft"
                label={labels.previousPage}
                onclick={onprevious}
                size="compact"
            />
            <Button
                disabled={status.page === status.pageCount}
                icon="chevronRight"
                label={labels.nextPage}
                onclick={onnext}
                size="compact"
            />
        </div>
    </div>
</nav>

<style>
    .table-pagination {
        display: flex;
        flex: var(--layout-fixed-flex);
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-actions) var(--space-panel);
        padding-block: var(--space-control-block);
        padding-inline: var(--space-control-inline);
        border-block-start: var(--border-region);
        background: var(--color-surface-subtle);
    }

    .pagination-status {
        flex: var(--layout-search-input-field-flex);
        margin: var(--space-none);
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
    }

    .pagination-controls,
    .page-size-control,
    .pagination-buttons {
        display: flex;
        align-items: center;
        gap: var(--space-actions);
    }

    .pagination-controls {
        flex: var(--layout-overview-action-flex);
        flex-wrap: wrap;
    }

    .pagination-buttons :global(.button.compact) {
        padding-inline: var(--space-actions);
    }

    .page-size-control {
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
        font-weight: var(--font-weight-action);
    }

    .page-size-control select {
        min-block-size: var(--size-control-compact);
        padding-block: var(--space-none);
    }
</style>
