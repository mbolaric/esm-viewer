<script lang="ts">
    import Button from './Button.svelte';
    import Icon from '../icon/Icon.svelte';
    import type { IconName } from '../icon/icon-registry.js';
    import type { IInlineNoticeAction } from './inline-notice.js';

    interface IProps {
        actions?: readonly IInlineNoticeAction[];
        label: string;
        leadingIcon?: IconName | undefined;
        role?: 'note' | 'status';
    }

    let { actions = [], label, leadingIcon = undefined, role = 'status' }: IProps = $props();
</script>

<div class="inline-notice" {role}>
    <div class="inline-notice-content">
        {#if leadingIcon !== undefined}
            <Icon name={leadingIcon} />
        {/if}
        <span class="inline-notice-label">{label}</span>
    </div>
    {#if actions.length > 0}
        <div class="inline-notice-actions">
            {#each actions as action (action.label)}
                <Button
                    {...action.ariaLabel === undefined ? {} : { ariaLabel: action.ariaLabel }}
                    {...action.icon === undefined ? {} : { icon: action.icon }}
                    {...action.iconOnly === undefined ? {} : { iconOnly: action.iconOnly }}
                    label={action.label}
                    onclick={action.onclick}
                    size="compact"
                    variant="ghost"
                />
            {/each}
        </div>
    {/if}
</div>

<style>
    .inline-notice {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-actions);
        padding-block: var(--space-control-block);
        padding-inline: var(--space-control-inline);
        background: var(--color-surface-subtle);
        border: var(--border-region);
        border-radius: var(--radius-control);
        color: var(--color-text-muted);
    }

    .inline-notice-content {
        display: flex;
        align-items: flex-start;
        gap: var(--space-actions);
        min-inline-size: var(--space-none);
    }

    .inline-notice-actions {
        display: flex;
        align-items: center;
        gap: var(--space-compact);
        flex: var(--layout-overview-action-flex);
    }
</style>
