<script lang="ts">
    import Icon from '../icon/Icon.svelte';
    import type { IconName } from '../icon/icon-registry.js';
    import type { IToastItem } from './toast-types.js';

    export interface IProps {
        readonly ondismiss: (id: string) => void;
        readonly toast: IToastItem;
    }

    let { ondismiss, toast }: IProps = $props();

    function getIcon(variant: IToastItem['variant']): IconName {
        switch (variant) {
            case 'success':
                return 'circleCheck';
            case 'warning':
                return 'triangleAlert';
            case 'error':
                return 'circleAlert';
            case 'info':
                return 'circleHelp';
        }
    }

    const iconName = $derived(getIcon(toast.variant));
    const isAlert = $derived(toast.variant === 'error');
</script>

<div class="toast-item toast-{toast.variant}" data-variant={toast.variant} role={isAlert ? 'alert' : 'status'} aria-atomic="true">
    <div class="toast-icon-wrapper">
        <Icon name={iconName} size="small" />
    </div>

    <div class="toast-body">
        {#if toast.title}
            <h4 class="toast-title">{toast.title}</h4>
        {/if}
        <p class="toast-message">{toast.message}</p>
    </div>

    {#if toast.action}
        <div class="toast-action-wrapper">
            <button type="button" class="toast-action-button" onclick={toast.action.onclick}>
                {toast.action.label}
            </button>
        </div>
    {/if}

    {#if toast.dismissible}
        <button
            type="button"
            class="toast-dismiss-button"
            aria-label={toast.dismissLabel ?? 'Dismiss notification'}
            onclick={() => ondismiss(toast.id)}
        >
            <Icon name="x" size="small" />
        </button>
    {/if}
</div>

<style>
    .toast-item {
        display: grid;
        grid-template-columns: var(--layout-toast-columns);
        align-items: center;
        gap: var(--space-toast-gap);
        min-inline-size: var(--size-toast-min-inline);
        max-inline-size: var(--size-toast-max-inline);
        padding-block: var(--space-toast-block);
        padding-inline: var(--space-toast-inline);
        background: var(--color-toast-surface);
        border: var(--border-panel);
        border-radius: var(--radius-toast);
        box-shadow: var(--shadow-toast);
        color: var(--color-text);
        pointer-events: auto;
        user-select: none;
    }

    .toast-item.toast-success {
        background: var(--color-toast-success-surface);
        border-color: var(--color-toast-success-border);
        color: var(--color-toast-success-text);
    }

    .toast-item.toast-warning {
        background: var(--color-toast-warning-surface);
        border-color: var(--color-toast-warning-border);
        color: var(--color-toast-warning-text);
    }

    .toast-item.toast-error {
        background: var(--color-toast-danger-surface);
        border-color: var(--color-toast-danger-border);
        color: var(--color-toast-danger-text);
    }

    .toast-item.toast-info {
        background: var(--color-toast-info-surface);
        border-color: var(--color-toast-info-border);
        color: var(--color-toast-info-text);
    }

    .toast-icon-wrapper {
        display: grid;
        place-items: center;
        inline-size: var(--size-toast-icon);
        block-size: var(--size-toast-icon);
        border-radius: var(--radius-chip);
        border: var(--border-panel);
    }

    .toast-success .toast-icon-wrapper {
        color: var(--color-toast-success-icon);
        background: var(--color-toast-success-badge);
        border-color: var(--color-toast-success-border);
    }

    .toast-warning .toast-icon-wrapper {
        color: var(--color-toast-warning-icon);
        background: var(--color-toast-warning-badge);
        border-color: var(--color-toast-warning-border);
    }

    .toast-error .toast-icon-wrapper {
        color: var(--color-toast-danger-icon);
        background: var(--color-toast-danger-badge);
        border-color: var(--color-toast-danger-border);
    }

    .toast-info .toast-icon-wrapper {
        color: var(--color-toast-info-icon);
        background: var(--color-toast-info-badge);
        border-color: var(--color-toast-info-border);
    }

    .toast-body {
        display: flex;
        flex-direction: column;
        gap: var(--space-compact);
    }

    .toast-title {
        font-size: var(--font-size-badge);
        font-weight: var(--font-weight-title);
        line-height: var(--line-height-heading);
        margin: var(--space-none);
        color: inherit;
    }

    .toast-message {
        font-size: var(--font-size-metadata);
        line-height: var(--line-height-body);
        margin: var(--space-none);
        color: inherit;
        word-break: break-word;
    }

    .toast-action-button {
        background: var(--color-surface-hover);
        border: var(--border-control);
        border-radius: var(--radius-control);
        color: inherit;
        font-size: var(--font-size-metadata);
        font-weight: var(--font-weight-action);
        padding-block: var(--space-compact);
        padding-inline: var(--space-control-inline);
        cursor: pointer;
        transition:
            background-color var(--duration-fast) var(--easing-standard),
            border-color var(--duration-fast) var(--easing-standard),
            color var(--duration-fast) var(--easing-standard);
    }

    .toast-action-button:hover {
        background: var(--color-surface-selected);
    }

    .toast-dismiss-button {
        display: grid;
        place-items: center;
        background: var(--color-transparent);
        border: none;
        color: inherit;
        padding: var(--space-compact);
        border-radius: var(--radius-control);
        cursor: pointer;
        transition:
            color var(--duration-fast) var(--easing-standard),
            background-color var(--duration-fast) var(--easing-standard);
    }

    .toast-dismiss-button:hover {
        background: var(--color-surface-hover);
    }
</style>
