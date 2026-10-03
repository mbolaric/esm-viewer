<script lang="ts" generics="TWorkspaceId extends string">
    import { Icon } from '#ui';
    import type { IWorkspaceItem } from './application-module.js';

    interface IProps {
        activeWorkspace: TWorkspaceId;
        ariaLabel: string;
        items: readonly IWorkspaceItem<TWorkspaceId>[];
        onchange: (workspace: TWorkspaceId) => void;
    }
    let { activeWorkspace, ariaLabel, items, onchange }: IProps = $props();
</script>

<div class="workspace-switcher" role="group" aria-label={ariaLabel}>
    {#each items as workspace (workspace.id)}
        <button
            aria-label={workspace.label}
            aria-pressed={activeWorkspace === workspace.id}
            class="workspace-tab"
            class:active={activeWorkspace === workspace.id}
            type="button"
            onclick={() => onchange(workspace.id)}
        >
            <Icon name={workspace.icon} size="small" />
            <span class="workspace-tab-label">{workspace.label}</span>
        </button>
    {/each}
</div>

<style>
    .workspace-switcher {
        display: inline-flex;
        align-items: center;
        gap: var(--space-compact);
        background: var(--color-surface-subtle);
        padding: var(--space-compact);
        border: var(--border-panel);
        border-radius: var(--radius-chip);
    }
    .workspace-tab {
        display: inline-flex;
        align-items: center;
        gap: var(--space-actions);
        padding: var(--space-compact) var(--space-panel);
        border: none;
        background: var(--color-transparent);
        color: var(--color-text-muted);
        font-family: var(--font-family-body);
        font-size: var(--font-size-metadata);
        font-weight: var(--font-weight-action);
        border-radius: var(--radius-chip);
        cursor: pointer;
        transition:
            background var(--duration-fast) var(--easing-standard),
            color var(--duration-fast) var(--easing-standard),
            box-shadow var(--duration-fast) var(--easing-standard);
    }
    .workspace-tab:hover:not(.active) {
        color: var(--color-text);
        background: var(--color-surface-hover);
    }
    .workspace-tab.active {
        background: var(--color-surface);
        color: var(--color-accent);
        font-weight: var(--font-weight-title);
        box-shadow: var(--shadow-card);
    }
    .workspace-tab:focus-visible {
        outline: var(--border-focus);
        outline-offset: var(--space-focus-offset);
    }
    .workspace-tab-label {
        display: var(--display-workspace-tab-label, inline);
    }
</style>
