<script lang="ts">
    import type { Snippet } from 'svelte';
    import Icon from '../icon/Icon.svelte';
    import type { IconName } from '../icon/icon-registry.js';

    interface ITabItem {
        readonly icon?: IconName;
        readonly id: string;
        readonly label: string;
    }

    interface IProps {
        items: readonly ITabItem[];
        label: string;
        onselect: (id: string) => void;
        // 'vertical' renders a sidebar tab list and swaps roving arrow keys to Up/Down per WAI-ARIA APG.
        orientation?: 'horizontal' | 'vertical';
        panel: Snippet<[string]>;
        selectedId: string;
    }

    let { items, label, onselect, orientation = 'horizontal', panel, selectedId }: IProps = $props();

    const uid = $props.id();
    let tabElements: (HTMLButtonElement | undefined)[] = $state([]);

    const selectedIndex = $derived(
        Math.max(
            items.findIndex((item) => item.id === selectedId),
            0,
        ),
    );

    function tabId(item: ITabItem): string {
        return `${uid}-tab-${item.id}`;
    }

    function panelId(item: ITabItem): string {
        return `${uid}-panel-${item.id}`;
    }

    function selectIndex(index: number): void {
        const item = items[index];
        if (item === undefined) {
            return;
        }
        tabElements[index]?.focus();
        if (item.id !== selectedId) {
            onselect(item.id);
        }
    }

    function handleKeyboard(event: KeyboardEvent): void {
        const previousKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
        const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
        switch (event.key) {
            case previousKey:
                event.preventDefault();
                selectIndex(selectedIndex === 0 ? items.length - 1 : selectedIndex - 1);
                break;
            case nextKey:
                event.preventDefault();
                selectIndex(selectedIndex === items.length - 1 ? 0 : selectedIndex + 1);
                break;
            case 'End':
                event.preventDefault();
                selectIndex(items.length - 1);
                break;
            case 'Home':
                event.preventDefault();
                selectIndex(0);
                break;
        }
    }
</script>

<div class="tabs" class:vertical={orientation === 'vertical'}>
    <div aria-label={label} aria-orientation={orientation} class="tab-list" role="tablist">
        {#each items as item, index (item.id)}
            <button
                aria-controls={panelId(item)}
                aria-selected={index === selectedIndex}
                bind:this={tabElements[index]}
                class="tab"
                id={tabId(item)}
                onclick={() => {
                    selectIndex(index);
                }}
                onkeydown={handleKeyboard}
                role="tab"
                tabindex={index === selectedIndex ? 0 : -1}
                type="button"
            >
                {#if item.icon !== undefined}
                    <Icon name={item.icon} />
                {/if}
                <span>{item.label}</span>
            </button>
        {/each}
    </div>
    {#each items as item, index (item.id)}
        {#if index === selectedIndex}
            <div aria-labelledby={tabId(item)} class="tab-panel" id={panelId(item)} role="tabpanel" tabindex="0">
                {@render panel(item.id)}
            </div>
        {/if}
    {/each}
</div>

<style>
    .tabs {
        display: grid;
        gap: var(--space-section);
    }

    .tabs.vertical {
        grid-template-columns: var(--layout-guide-columns);
        gap: var(--space-dialog);
        block-size: var(--size-full);
        min-block-size: var(--space-none);
        max-block-size: var(--size-full);
        overflow: hidden;
    }

    .tab-list {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-actions);
        border-block-end: var(--border-region);
    }

    .vertical .tab-list {
        flex-direction: column;
        flex-wrap: nowrap;
        gap: var(--space-compact);
        padding-inline-end: var(--space-actions);
        border-block-end: none;
        border-inline-end: var(--border-region);
        overflow-y: auto;
        flex: none;
    }

    .tab {
        min-block-size: var(--size-control);
        margin-block-end: calc(var(--size-tab-indicator) * -1);
        padding-block: var(--space-control-block);
        padding-inline: var(--space-control-inline);
        background: var(--color-transparent);
        border: none;
        border-block-end: var(--size-tab-indicator) solid var(--color-transparent);
        color: var(--color-text-muted);
        font: inherit;
        cursor: pointer;
    }

    .vertical .tab {
        display: flex;
        align-items: center;
        gap: var(--space-actions);
        margin-block-end: var(--space-none);
        border-block-end: none;
        border-inline-start: var(--size-selection-marker) solid var(--color-transparent);
        border-radius: var(--radius-control);
        font-size: var(--font-size-metadata);
        text-align: start;
        transition:
            background-color var(--duration-fast) var(--easing-standard),
            color var(--duration-fast) var(--easing-standard);
    }

    .tab:hover {
        background: var(--color-surface-hover);
        color: var(--color-text);
    }

    .tab[aria-selected='true'] {
        border-block-end-color: var(--color-accent);
        color: var(--color-text);
        font-weight: var(--font-weight-action);
    }

    .vertical .tab[aria-selected='true'] {
        background: var(--color-surface-selected);
        border-block-end-color: var(--color-transparent);
        border-inline-start: var(--border-active-tab);
    }

    .tab:focus-visible {
        outline: var(--size-focus-ring) solid var(--color-focus);
        outline-offset: calc(var(--size-focus-ring) * -1);
    }

    .tab-panel {
        display: grid;
        gap: var(--space-section);
    }

    .vertical .tab-panel {
        overflow-y: auto;
        padding-inline-end: var(--space-actions);
        min-block-size: var(--space-none);
        max-block-size: var(--size-full);
    }
</style>
