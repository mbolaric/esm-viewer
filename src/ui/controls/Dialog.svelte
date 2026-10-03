<script lang="ts">
    import { onMount, type Snippet } from 'svelte';
    import type { DialogSize } from './dialog-types.js';

    interface IProps {
        actions: Snippet;
        children: Snippet;
        // Rendered on header right side alongside title.
        headerEnd?: Snippet | undefined;
        onclose: () => void;
        size?: DialogSize;
        title: string;
        titleId: string;
    }

    let { actions, children, headerEnd = undefined, onclose, size = 'medium', title, titleId }: IProps = $props();

    let dialog = $state<HTMLDialogElement | undefined>();
    let heading = $state<HTMLHeadingElement | undefined>();

    onMount(() => {
        const active = typeof globalThis.document !== 'undefined' ? globalThis.document.activeElement : null;
        const previouslyFocused = active instanceof HTMLElement ? active : null;

        if (typeof dialog?.showModal === 'function') {
            dialog.showModal();
        } else {
            dialog?.setAttribute('open', '');
        }
        heading?.focus();

        return () => {
            if (typeof dialog?.close === 'function') {
                dialog.close();
            } else {
                dialog?.removeAttribute('open');
            }
            previouslyFocused?.focus();
        };
    });

    function handleCancel(event: Event): void {
        event.preventDefault();
        onclose();
    }
</script>

<dialog
    bind:this={dialog}
    class:size-large={size === 'large'}
    class:size-wide={size === 'wide'}
    aria-labelledby={titleId}
    oncancel={handleCancel}
>
    <header>
        <h1 id={titleId} bind:this={heading} tabindex="-1">{title}</h1>
        {#if headerEnd}
            <div class="header-end">{@render headerEnd()}</div>
        {/if}
    </header>
    <div class="dialog-content">
        {@render children()}
    </div>
    <footer>
        {@render actions()}
    </footer>
</dialog>

<style>
    dialog {
        inline-size: min(var(--size-dialog), calc(var(--size-full) - var(--space-shell)));
        max-block-size: calc(var(--size-viewport) - var(--space-shell));
        padding: var(--space-none);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: var(--color-surface);
        border: var(--border-dialog);
        border-radius: var(--radius-dialog);
        box-shadow: var(--shadow-dialog);
        color: var(--color-text);
    }

    dialog.size-wide {
        inline-size: min(var(--size-dialog-wide), calc(var(--size-full) - var(--space-shell)));
    }

    dialog.size-large {
        inline-size: min(var(--size-dialog-large), calc(var(--size-full) - var(--space-shell)));
        block-size: min(var(--size-dialog-block-large), calc(var(--size-viewport) - var(--space-shell)));
    }

    dialog::backdrop {
        background: var(--color-dialog-backdrop);
    }

    header,
    footer {
        flex: none;
        padding: var(--space-dialog);
    }

    .dialog-content {
        flex: var(--layout-dialog-content-flex);
        min-block-size: var(--space-none);
        overflow: auto;
        padding: var(--space-dialog);
    }

    header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-actions);
        background: var(--color-surface-subtle);
        border-block-end: var(--border-region);
    }

    header h1 {
        outline: none;
    }

    .header-end {
        margin-inline-start: auto;
    }

    footer {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        align-items: center;
        gap: var(--space-actions);
        background: var(--color-surface-subtle);
        border-block-start: var(--border-region);
    }
</style>
