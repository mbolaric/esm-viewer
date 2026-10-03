<script lang="ts">
    import { Button, TaskState } from '#ui';

    interface IProps {
        cancelLabel: string;
        displayName: string | null;
        heading: string;
        oncancel: () => void;
        phaseLabel: string;
        readOnlyLabel: string;
    }

    let { cancelLabel, displayName, heading, oncancel, phaseLabel, readOnlyLabel }: IProps = $props();
</script>

<TaskState title={heading} description={phaseLabel} focusOnMount live="polite">
    {#if displayName !== null}
        <p class="filename">{displayName}</p>
    {/if}
    <progress aria-label={phaseLabel}></progress>
    <p class="evidence">{readOnlyLabel}</p>
    {#snippet actions()}
        <Button label={cancelLabel} onclick={oncancel} />
    {/snippet}
</TaskState>

<style>
    p {
        margin: var(--space-none);
    }

    .filename {
        font-weight: var(--font-weight-action);
    }

    .evidence {
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
    }

    progress {
        inline-size: var(--size-full);
        block-size: var(--size-progress);
        accent-color: var(--color-accent);
    }
</style>
