<script lang="ts">
    import DisclosureMenu from '../controls/DisclosureMenu.svelte';
    import Icon from '../icon/Icon.svelte';

    interface IColumnOption {
        readonly id: string;
        readonly label: string;
    }

    interface IProps {
        autoHiddenColumnIds?: ReadonlySet<string> | undefined;
        columns: readonly IColumnOption[];
        hiddenColumnIds?: ReadonlySet<string> | undefined;
        label: string;
        ontogglecolumn: (columnId: string) => void;
        ontogglepin?: ((columnId: string) => void) | undefined;
        pinLabel?: string | undefined;
        pinnableColumnIds?: ReadonlySet<string> | undefined;
        pinnedColumnIds?: ReadonlySet<string> | undefined;
    }

    let {
        autoHiddenColumnIds = undefined,
        columns,
        hiddenColumnIds = undefined,
        label,
        ontogglecolumn,
        ontogglepin = undefined,
        pinLabel = undefined,
        pinnableColumnIds = undefined,
        pinnedColumnIds = undefined,
    }: IProps = $props();
</script>

<DisclosureMenu icon="columns" menuLabel={label} placement="viewport" triggerLabel={label}>
    {#each columns as column (column.id)}
        <div class="column-menu-item">
            <label class="column-menu-checkbox">
                <input
                    checked={!hiddenColumnIds?.has(column.id) && autoHiddenColumnIds?.has(column.id) !== true}
                    type="checkbox"
                    onchange={() => ontogglecolumn(column.id)}
                />
                <span>{column.label}</span>
            </label>
            {#if pinLabel !== undefined && ontogglepin !== undefined && pinnableColumnIds?.has(column.id) === true}
                <button
                    aria-label={pinLabel}
                    aria-pressed={pinnedColumnIds?.has(column.id) === true}
                    class="column-menu-pin has-tooltip tooltip-end"
                    class:pinned={pinnedColumnIds?.has(column.id) === true}
                    data-tooltip={pinLabel}
                    type="button"
                    onclick={() => ontogglepin(column.id)}
                >
                    <Icon name="pin" size="small" />
                </button>
            {/if}
        </div>
    {/each}
</DisclosureMenu>

<style>
    .column-menu-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-compact);
    }

    .column-menu-checkbox {
        display: grid;
        grid-template-columns: var(--layout-table-column-menu-item-columns);
        align-items: center;
        gap: var(--space-compact);
        color: var(--color-text);
        min-inline-size: var(--size-zero);
    }

    /* Lightweight borderless pin button sized to icon rather than heavy standard button control. */
    .column-menu-pin {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-compact);
        background: var(--color-transparent);
        border: none;
        border-radius: var(--radius-control);
        color: var(--color-text-muted);
        cursor: pointer;
        transition:
            background-color var(--duration-fast) var(--easing-standard),
            color var(--duration-fast) var(--easing-standard);
    }

    .column-menu-pin:hover {
        background: var(--color-surface-hover);
        color: var(--color-text);
    }

    /* Accent background visually distinguishes pinned state on small icon. */
    .column-menu-pin.pinned {
        background: var(--color-accent-soft);
        color: var(--color-accent);
    }

    .column-menu-pin.pinned:hover {
        background: var(--color-accent-soft);
    }

    /* Tooltip opens downward to avoid clipping by table-shell boundary. */
    .column-menu-pin[data-tooltip]::after {
        inset-block-start: calc(var(--size-full) + var(--space-compact));
        inset-block-end: auto;
    }
</style>
