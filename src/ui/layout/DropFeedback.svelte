<script lang="ts">
    import type { Snippet } from 'svelte';

    interface IProps {
        children: Snippet;
    }

    let { children }: IProps = $props();
</script>

<div class="drop-feedback" role="status" aria-atomic="true" aria-live="polite">
    <div class="drop-feedback-content">
        {@render children()}
    </div>
</div>

<style>
    .drop-feedback {
        position: absolute;
        z-index: var(--z-drop-feedback);
        inset: var(--space-none);
        display: grid;
        padding: var(--space-shell);
        background: var(--color-drop-feedback-surface);
        backdrop-filter: var(--effect-blur-drop-feedback);
        -webkit-backdrop-filter: var(--effect-blur-drop-feedback);
        border: var(--border-drop-feedback);
        place-content: center;
        place-items: center;
        pointer-events: none;
        animation: drop-pulse var(--duration-drop-pulse) var(--easing-standard) infinite;
    }

    .drop-feedback-content {
        display: grid;
        justify-items: center;
        gap: var(--space-compact);
        padding: var(--space-shell);
        color: var(--color-accent);
        text-align: center;
    }

    .drop-feedback-content :global(strong) {
        font-size: var(--font-size-section);
        color: var(--color-text);
    }

    .drop-feedback-content :global(span) {
        color: var(--color-text-muted);
    }

    @keyframes drop-pulse {
        0%,
        100% {
            border-color: var(--color-accent);
            box-shadow: var(--shadow-drop-pulse-soft);
        }
        50% {
            border-color: var(--color-accent-hover);
            box-shadow: var(--shadow-drop-pulse-strong);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .drop-feedback {
            animation: none;
            box-shadow: var(--shadow-drop-pulse-soft);
        }
    }
</style>
