<script lang="ts">
    import { Button, Icon } from '#ui';
    import type { IApplicationFailureLabels } from './application-module.js';

    interface IProps {
        labels: IApplicationFailureLabels;
        onretry: () => void;
        state?: 'caught' | 'unknown';
    }
    let { labels, onretry, state = 'caught' }: IProps = $props();
</script>

<main class="root-boundary-screen" role="alert" data-boundary-state={state}>
    <div class="root-boundary-card">
        <span class="root-boundary-icon"><Icon name="triangleAlert" size="large" /></span>
        <h1 class="root-boundary-title">{labels.heading}</h1>
        <p class="root-boundary-description">{labels.description}</p>
        <div class="root-boundary-actions">
            <Button label={labels.retry} onclick={onretry} variant="primary" />
        </div>
    </div>
</main>

<style>
    .root-boundary-screen {
        display: grid;
        place-items: center;
        min-block-size: var(--size-viewport);
        padding: var(--space-shell);
        background: var(--color-surface);
    }

    .root-boundary-card {
        display: grid;
        justify-items: center;
        max-inline-size: var(--size-content-boundary);
        gap: var(--space-stack);
        padding: var(--space-panel);
        background: var(--color-surface);
        border: var(--border-panel);
        border-radius: var(--radius-panel);
        box-shadow: var(--shadow-popover);
        text-align: center;
    }

    .root-boundary-icon {
        color: var(--color-danger);
    }

    .root-boundary-title {
        font-size: var(--font-size-title);
        font-weight: var(--font-weight-title);
        color: var(--color-text);
        margin: var(--space-none);
    }

    .root-boundary-description {
        font-size: var(--font-size-body);
        color: var(--color-text-muted);
        margin: var(--space-none);
    }

    .root-boundary-actions {
        display: flex;
        justify-content: center;
        padding-block-start: var(--space-actions);
    }
</style>
