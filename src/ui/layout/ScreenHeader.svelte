<script lang="ts">
    import { focusOnMount } from './focus-on-mount.js';
    import type { Snippet } from 'svelte';

    interface IProps {
        readonly actions?: Snippet;
        readonly description?: string;
        readonly heading: string;
    }

    let { actions, description = undefined, heading }: IProps = $props();
</script>

<header class="screen-header" class:with-actions={actions !== undefined}>
    <div class="screen-header-titles">
        <h1 tabindex="-1" use:focusOnMount>{heading}</h1>
        {#if description !== undefined}
            <p>{description}</p>
        {/if}
    </div>
    {#if actions}
        <div class="screen-header-actions">
            {@render actions()}
        </div>
    {/if}
</header>

<style>
    .screen-header.with-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-actions);
        inline-size: var(--size-full);
    }

    .screen-header-titles {
        display: grid;
        gap: var(--space-compact);
    }

    .screen-header-titles p {
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
    }

    .screen-header-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-actions);
    }
</style>
