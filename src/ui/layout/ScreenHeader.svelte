<script lang="ts">
    import Button from '../controls/Button.svelte';
    import type { IInlineNoticeAction } from '../controls/inline-notice.js';
    import { focusOnMount } from './focus-on-mount.js';
    import type { Snippet } from 'svelte';

    interface IProps {
        readonly actions?: Snippet;
        readonly backAction?: IInlineNoticeAction | undefined;
        readonly description?: string;
        readonly heading: string;
    }

    let { actions, backAction = undefined, description = undefined, heading }: IProps = $props();
</script>

<header class="screen-header" class:with-actions={actions !== undefined}>
    <div class="screen-header-titles">
        {#if backAction !== undefined}
            <Button icon="chevronLeft" label={backAction.label} onclick={backAction.onclick} size="compact" variant="ghost" />
        {/if}
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
        justify-items: start;
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
