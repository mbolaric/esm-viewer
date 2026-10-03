<script lang="ts">
    import Icon from '../icon/Icon.svelte';
    import type { IconName } from '../icon/icon-registry.js';

    interface IProps {
        hint?: string | undefined;
        icon?: IconName | undefined;
        message: string;
    }

    let { hint = undefined, icon = 'circleAlert', message }: IProps = $props();
</script>

<div class="empty-state" role="status">
    <Icon name={icon} size="large" />
    <p>{message}</p>
    {#if hint !== undefined}
        <p class="hint">{hint}</p>
    {/if}
</div>

<style>
    .empty-state {
        flex: var(--layout-fill-flex);
        min-block-size: var(--space-none);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--space-shell);
        color: var(--color-text-muted);
        gap: var(--space-stack);
        text-align: center;
    }

    .hint {
        margin: var(--space-none);
        font-size: var(--font-size-metadata);
    }
</style>
