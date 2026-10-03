<script lang="ts">
    import type { Snippet } from 'svelte';

    interface IProps {
        // Edit fields laid out in the responsive grid.
        children: Snippet;
        heading: string;
        headingId: string;
        hint?: string | undefined;
    }

    let { children, heading, headingId, hint = undefined }: IProps = $props();
</script>

<section class="edit-panel" aria-labelledby={headingId}>
    <h3 id={headingId}>{heading}</h3>
    {#if hint !== undefined}
        <p class="edit-panel-hint">{hint}</p>
    {/if}
    <div class="edit-grid">
        {@render children()}
    </div>
</section>

<style>
    .edit-panel {
        display: flex;
        flex-direction: column;
        gap: var(--space-actions);
        padding: var(--space-actions) var(--space-panel);
        background: var(--color-surface-subtle);
        border: var(--border-region);
        border-radius: var(--radius-panel);
    }

    h3 {
        margin: var(--space-none);
        font-size: var(--font-size-section);
        font-weight: var(--font-weight-title);
    }

    .edit-panel-hint {
        margin: var(--space-none);
        font-size: var(--font-size-metadata);
        color: var(--color-text-muted);
    }

    .edit-grid {
        display: grid;
        grid-template-columns: var(--layout-edit-grid);
        gap: var(--space-actions);
    }
</style>
