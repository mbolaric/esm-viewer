<script lang="ts">
    import { onMount, type Snippet } from 'svelte';

    interface IProps {
        actions?: Snippet;
        children?: Snippet;
        description?: string;
        focusOnMount?: boolean;
        glassmorphic?: boolean;
        leading?: Snippet;
        live?: 'off' | 'polite' | 'assertive';
        title: string;
    }

    let {
        actions,
        children,
        description,
        focusOnMount = false,
        glassmorphic = false,
        leading,
        live = 'off',
        title,
    }: IProps = $props();

    let heading = $state<HTMLHeadingElement | undefined>();

    onMount(() => {
        if (focusOnMount) {
            heading?.focus();
        }
    });
</script>

<section class="task-state" class:glassmorphic aria-live={live === 'off' ? undefined : live}>
    {#if leading !== undefined}
        <div class="leading">
            {@render leading()}
        </div>
    {/if}
    {#if focusOnMount}
        <h1 bind:this={heading} tabindex="-1">{title}</h1>
    {:else}
        <h1 bind:this={heading}>{title}</h1>
    {/if}
    {#if description !== undefined}
        <p class="description">{description}</p>
    {/if}
    {#if children !== undefined}
        <div class="content">
            {@render children()}
        </div>
    {/if}
    {#if actions !== undefined}
        <div class="actions">
            {@render actions()}
        </div>
    {/if}
</section>

<style>
    .task-state {
        display: grid;
        inline-size: min(var(--size-content-readable), var(--size-full));
        justify-items: center;
        gap: var(--space-stack);
        padding: var(--space-task);
        background: var(--color-surface);
        border: var(--border-panel);
        border-radius: var(--radius-panel);
        text-align: center;
    }

    .task-state.glassmorphic {
        background: var(--color-task-state-surface);
        backdrop-filter: var(--effect-blur-task-state);
        -webkit-backdrop-filter: var(--effect-blur-task-state);
        box-shadow: var(--shadow-popover);
    }

    h1 {
        font-size: var(--font-size-task-title);
    }

    .leading {
        display: grid;
        inline-size: var(--size-task-leading);
        block-size: var(--size-task-leading);
        color: var(--color-accent);
        background: var(--color-accent-soft);
        border-radius: var(--radius-panel);
        place-items: center;
    }

    .description {
        color: var(--color-text-muted);
    }

    .content {
        display: grid;
        gap: var(--space-stack);
    }

    .actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: var(--space-actions);
    }
</style>
