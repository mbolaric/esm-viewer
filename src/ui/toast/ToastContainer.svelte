<script lang="ts">
    import Toast from './Toast.svelte';
    import type { IToastItem } from './toast-types.js';

    export interface IProps {
        readonly ariaLabel?: string | undefined;
        readonly ondismiss: (id: string) => void;
        readonly toasts: readonly IToastItem[];
    }

    let { ariaLabel = 'Notifications', ondismiss, toasts }: IProps = $props();
</script>

{#if toasts.length > 0}
    <aside class="toast-container" aria-label={ariaLabel} aria-live="polite" aria-relevant="additions text">
        {#each toasts as toast (toast.id)}
            <Toast {ondismiss} {toast} />
        {/each}
    </aside>
{/if}

<style>
    .toast-container {
        position: fixed;
        inset-block-end: var(--space-panel);
        inset-inline-end: var(--space-panel);
        z-index: var(--z-index-toast);
        display: flex;
        flex-direction: column-reverse;
        gap: var(--space-compact);
        pointer-events: none;
        max-block-size: var(--size-toast-container-max-block);
        overflow: visible;
    }
</style>
