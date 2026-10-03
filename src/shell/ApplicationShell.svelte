<script lang="ts" generics="TWorkspaceId extends string, TGuideTabId extends string, TPreferencesTabId extends string">
    import { ToastContainer, type IToastItem } from '#ui';
    import { onMount, type Snippet } from 'svelte';

    import {
        collectApplicationContributions,
        type IApplicationContributions,
        type IApplicationModule,
    } from './application-module.js';

    import ApplicationFailure from './ApplicationFailure.svelte';
    import type { IApplicationFailureLabels } from './application-module.js';

    interface IProps {
        activeWorkspace: TWorkspaceId;
        dialogs: Snippet<[IApplicationContributions<TGuideTabId, TPreferencesTabId>]>;
        failureLabels: IApplicationFailureLabels;
        modules: readonly IApplicationModule<TWorkspaceId, TGuideTabId, TPreferencesTabId>[];
        onerror: (error: unknown) => void;
        ondispose?: (() => void) | undefined;
        ondismisstoast: (id: string) => void;
        status?: Snippet | undefined;
        statusLabel: string;
        toastLabel: string;
        toasts: readonly IToastItem[];
    }

    let {
        activeWorkspace,
        dialogs,
        failureLabels,
        modules,
        onerror,
        ondispose,
        ondismisstoast,
        status,
        statusLabel,
        toastLabel,
        toasts,
    }: IProps = $props();
    const contributions = $derived.by(() => {
        if (!modules.some((module) => module.id === activeWorkspace)) {
            throw new TypeError('The active application workspace must belong to the composed modules.');
        }
        return collectApplicationContributions(modules);
    });
    onMount(() => () => {
        ondispose?.();
    });
</script>

<svelte:boundary {onerror}>
    <div class="application-root">
        <div class="application-workspaces">
            {#each modules as module (module.id)}
                {@render module.workspace(module.id === activeWorkspace, module.id)}
            {/each}
        </div>
        <footer class="shell-status" aria-label={statusLabel}>
            {#if status !== undefined}
                {@render status()}
            {/if}
            {#each modules as module (module.id)}
                {#if module.status !== undefined}
                    {@render module.status(module.id)}
                {/if}
            {/each}
        </footer>
    </div>
    {@render dialogs(contributions)}
    {#each modules as module (module.id)}
        {#if module.overlays !== undefined}
            {@render module.overlays()}
        {/if}
    {/each}
    <ToastContainer ariaLabel={toastLabel} ondismiss={ondismisstoast} {toasts} />

    {#snippet failed(_error: unknown, reset: () => void)}
        <ApplicationFailure labels={failureLabels} onretry={reset} state={_error === undefined ? 'unknown' : 'caught'} />
    {/snippet}
</svelte:boundary>

<style>
    .application-root {
        display: grid;
        grid-template-rows: var(--layout-app-root-rows);
        block-size: var(--size-viewport);
        max-block-size: var(--size-viewport);
        min-block-size: var(--size-viewport);
        overflow: hidden;
    }

    .application-workspaces {
        position: relative;
        min-block-size: var(--space-none);
        block-size: var(--size-full);
        overflow: hidden;
    }

    .shell-status {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-actions);
        min-block-size: var(--size-status-bar);
        padding-inline-end: var(--space-shell);
        background: var(--color-surface-subtle);
        border-block-start: var(--border-region);
    }
</style>
