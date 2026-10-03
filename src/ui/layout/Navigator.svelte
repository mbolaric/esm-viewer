<script lang="ts">
    import Icon from '../icon/Icon.svelte';
    import type { INavigatorGroup } from './navigator-contract.js';

    interface IProps {
        ariaLabel: string;
        closeLabel: string;
        drawerId: string;
        groups: readonly INavigatorGroup[];
        padding?: boolean | undefined;
    }

    let { ariaLabel, closeLabel, drawerId, groups, padding = false }: IProps = $props();
    let drawer = $state<HTMLDialogElement | undefined>();
    let drawerOpen = $state(false);
    let trigger = $state<HTMLButtonElement | undefined>();

    function openDrawer(): void {
        drawerOpen = true;
        if (typeof drawer?.showModal === 'function') {
            drawer.showModal();
        } else {
            drawer?.setAttribute('open', '');
        }
    }

    function finishClose(): void {
        drawerOpen = false;
        trigger?.focus();
    }

    function closeDrawer(): void {
        if (typeof drawer?.close === 'function') {
            drawer.close();
        } else {
            drawer?.removeAttribute('open');
            finishClose();
        }
    }

    function handleCancel(event: Event): void {
        event.preventDefault();
        closeDrawer();
    }

    function handleBackdropClick(event: MouseEvent): void {
        if (event.target === drawer) {
            closeDrawer();
        }
    }

    function handleWindowResize(): void {
        if (drawerOpen && trigger !== undefined && globalThis.getComputedStyle(trigger).display === 'none') {
            closeDrawer();
        }
    }

    function selectItem(onselect: () => void, closeAfterSelect: boolean): void {
        if (closeAfterSelect) {
            closeDrawer();
        }
        onselect();
    }
</script>

<svelte:window onresize={handleWindowResize} />

{#snippet navigation(closeAfterSelect: boolean)}
    <nav class="navigator" aria-label={ariaLabel}>
        {#each groups as group (group.heading)}
            <section>
                <h2>{group.heading}</h2>
                <ul>
                    {#each group.items as item (item.label)}
                        <li>
                            <button
                                type="button"
                                aria-busy={item.loading ? 'true' : undefined}
                                aria-current={item.selected ? 'page' : undefined}
                                class:is-loading={item.loading}
                                disabled={item.disabled ?? false}
                                onclick={() => selectItem(item.onselect, closeAfterSelect)}
                            >
                                {#if item.loading}
                                    <Icon className="navigator-spin" name="loaderCircle" size="small" />
                                {:else}
                                    <Icon name={item.icon} size="small" />
                                {/if}
                                <span>{item.label}</span>
                                {#if item.badgeCount !== null && item.badgeCount > 0}
                                    <span class="badge-count badge-{item.badgeVariant ?? 'danger'}">{item.badgeCount}</span>
                                {/if}
                            </button>
                        </li>
                    {/each}
                </ul>
            </section>
        {/each}
    </nav>
{/snippet}

<div class:with-padding={padding} class="navigator-root">
    <button
        aria-controls={drawerId}
        aria-expanded={drawerOpen}
        aria-label={ariaLabel}
        bind:this={trigger}
        class="navigator-trigger"
        onclick={openDrawer}
        type="button"
    >
        <Icon name="menu" />
        <span>{ariaLabel}</span>
    </button>

    <div class="navigator-inline">
        {@render navigation(false)}
    </div>

    <dialog
        aria-label={ariaLabel}
        bind:this={drawer}
        class="navigator-drawer"
        id={drawerId}
        oncancel={handleCancel}
        onclick={handleBackdropClick}
        onclose={finishClose}
    >
        <header>
            <h2>{ariaLabel}</h2>
            <button aria-label={closeLabel} class="drawer-close" onclick={closeDrawer} type="button">
                <Icon name="x" />
            </button>
        </header>
        <div class="drawer-content">
            {@render navigation(true)}
        </div>
    </dialog>
</div>

<style>
    .navigator-root.with-padding {
        padding-block: var(--space-stack);
        padding-inline: var(--space-actions);
    }

    .navigator-inline {
        display: var(--display-navigator-inline);
    }

    .navigator-trigger {
        display: var(--display-navigator-trigger);
        align-items: center;
        gap: var(--space-actions);
        inline-size: max-content;
        max-inline-size: var(--size-full);
        min-block-size: var(--size-control);
        padding-block: var(--space-control-block);
        padding-inline: var(--space-control-inline);
        border: var(--border-control);
        border-radius: var(--radius-control);
        background: var(--color-surface);
        color: var(--color-text);
        font: inherit;
        font-weight: var(--font-weight-action);
        cursor: pointer;
    }

    .navigator {
        display: grid;
        align-content: start;
        gap: var(--space-section);
    }

    section {
        display: grid;
        gap: var(--space-compact);
    }

    h2 {
        margin: var(--space-none);
        padding-inline: var(--space-control-inline);
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
        letter-spacing: var(--letter-spacing-group);
        text-transform: var(--text-transform-group);
    }

    ul {
        display: grid;
        gap: var(--space-compact);
        margin: var(--space-none);
        padding: var(--space-none);
        list-style: none;
    }

    button {
        display: inline-flex;
        align-items: center;
        gap: var(--space-compact);
        inline-size: var(--size-full);
        min-block-size: var(--size-control);
        padding-block: var(--space-control-block);
        padding-inline: var(--space-control-inline);
        border: none;
        border-radius: var(--radius-panel);
        background: var(--color-transparent);
        color: var(--color-text);
        font: inherit;
        text-align: start;
        cursor: pointer;
        white-space: nowrap;
        transition:
            background-color var(--duration-fast) var(--easing-standard),
            color var(--duration-fast) var(--easing-standard);
    }

    button:hover:not(:disabled) {
        background: var(--color-surface-hover);
    }

    button:disabled {
        opacity: var(--opacity-disabled);
        cursor: default;
    }

    button[aria-current='page'] {
        background: var(--color-surface-selected);
        color: var(--color-accent);
        font-weight: var(--font-weight-action);
    }

    .badge-count {
        margin-inline-start: auto;
        padding: var(--space-none) var(--space-compact);
        border-radius: var(--radius-chip);
        font-size: var(--font-size-metadata);
        font-weight: var(--font-weight-title);
    }

    .badge-danger {
        background: var(--color-danger-soft);
        color: var(--color-danger);
    }

    .badge-warning {
        background: var(--color-warning-soft);
        color: var(--color-warning);
    }

    .navigator-drawer {
        inset-block: var(--space-none);
        inset-inline-start: var(--space-none);
        inline-size: min(var(--size-navigation-drawer), calc(var(--size-full) - var(--space-shell)));
        max-block-size: var(--size-full);
        block-size: var(--size-full);
        margin-block: var(--space-none);
        margin-inline-start: var(--space-none);
        margin-inline-end: auto;
        padding: var(--space-none);
        background: var(--color-surface);
        border: var(--border-dialog);
        border-radius: var(--space-none);
        box-shadow: var(--shadow-dialog);
        color: var(--color-text);
    }

    .navigator-drawer[open] {
        display: grid;
        grid-template-rows: var(--layout-navigation-drawer-rows);
    }

    .navigator-drawer::backdrop {
        background: var(--color-dialog-backdrop);
    }

    .navigator-drawer header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-actions);
        padding: var(--space-panel);
        border-block-end: var(--border-region);
        background: var(--color-surface-subtle);
    }

    .drawer-close {
        justify-content: center;
        inline-size: var(--size-control);
        min-inline-size: var(--size-control);
        padding-inline: var(--space-none);
        border: var(--border-control);
        background: var(--color-surface);
    }

    .drawer-content {
        min-block-size: var(--space-none);
        overflow: auto;
        padding: var(--space-stack) var(--space-actions);
    }

    :global(.navigator-spin) {
        animation: spin var(--duration-drop-pulse) linear infinite;
    }

    @keyframes spin {
        from {
            transform: var(--transform-rotate-none);
        }
        to {
            transform: var(--transform-rotate-full);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        :global(.navigator-spin) {
            animation: none;
        }
    }
</style>
