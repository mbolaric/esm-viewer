<script lang="ts" generics="TWorkspaceId extends string = string">
    import { useAppBranding } from './app-branding.js';
    import type { Snippet } from 'svelte';
    import type { IWorkspaceItem } from './application-module.js';
    import WorkspaceSwitcher from './WorkspaceSwitcher.svelte';

    interface IProps {
        appName: string;
        ariaLabel: string;
        actions: Snippet;
        beforeActions?: Snippet | undefined;
        afterActions?: Snippet | undefined;
        modules?: readonly IWorkspaceItem<TWorkspaceId>[] | undefined;
        activeWorkspace?: TWorkspaceId | undefined;
        onchangeworkspace?: ((workspace: TWorkspaceId) => void) | undefined;
    }
    let {
        appName,
        ariaLabel,
        actions,
        beforeActions,
        afterActions,
        modules = undefined,
        activeWorkspace = undefined,
        onchangeworkspace = undefined,
    }: IProps = $props();
    const appBranding = useAppBranding();
</script>

<nav class="command-bar" aria-label={ariaLabel}>
    <p class="brand" aria-hidden="true">
        <span class="brand-mark">
            <img alt="" class="brand-icon" height="24" src={appBranding.icon} width="24" />
        </span>
        <span class="brand-name">{appName}</span>
    </p>

    {#if modules !== undefined && modules.length > 1 && activeWorkspace !== undefined && onchangeworkspace !== undefined}
        <span class="brand-divider" aria-hidden="true"></span>
        <WorkspaceSwitcher {activeWorkspace} {ariaLabel} items={modules} onchange={onchangeworkspace} />
    {/if}

    <span class="brand-divider" aria-hidden="true"></span>

    {#if beforeActions !== undefined}
        {@render beforeActions()}
    {/if}

    {@render actions()}
    {#if afterActions !== undefined}
        {@render afterActions()}
    {/if}
</nav>

<style>
    .command-bar {
        display: flex;
        align-items: center;
        gap: var(--space-actions);
        block-size: var(--size-full);
        padding-inline: var(--space-command-bar-start) var(--space-shell);
        overflow-x: var(--overflow-command-bar-inline);
        /* Maps the shell's narrow-width policy onto the shared button label. */
        --display-button-label: var(--display-command-bar-button-label);
    }

    .brand {
        display: flex;
        align-items: center;
        gap: var(--space-actions);
        margin: var(--space-none);
    }

    .brand-mark {
        display: grid;
        place-items: center;
        inline-size: var(--size-brand-mark);
        block-size: var(--size-brand-mark);
        border-radius: var(--radius-panel);
        background: var(--color-accent-soft);
        color: var(--color-accent);
    }

    .brand-name {
        display: var(--display-command-bar-brand-name);
        font-size: var(--font-size-section);
        font-weight: var(--font-weight-title);
        line-height: var(--line-height-heading);
        white-space: nowrap;
    }

    .brand-divider {
        display: var(--display-command-bar-divider);
        inline-size: var(--border-width-hairline);
        block-size: var(--size-brand-divider);
        margin-inline: var(--space-compact);
        background: var(--color-border);
    }
</style>
