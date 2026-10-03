<script lang="ts">
    import type { ParseFailureCode } from '#contracts';
    import { Button, TaskState } from '#ui';
    import type { Snippet } from 'svelte';

    interface IProps {
        extraActions?: Snippet | undefined;
        chooseAnotherLabel: string;
        description: string;
        displayName: string | null;
        errorCode: ParseFailureCode;
        errorCodeLabel: string;
        hasCurrentDocument: boolean;
        heading: string;
        onchooseanother: () => void;
        onreturn: () => void;
        returnLabel: string;
        unchangedLabel: string;
    }

    let {
        extraActions,
        chooseAnotherLabel,
        description,
        displayName,
        errorCode,
        errorCodeLabel,
        hasCurrentDocument,
        heading,
        onchooseanother,
        onreturn,
        returnLabel,
        unchangedLabel,
    }: IProps = $props();
</script>

<TaskState title={heading} {description} focusOnMount>
    {#if displayName !== null}
        <p class="filename">{displayName}</p>
    {/if}
    <p class="error-code">
        <span>{errorCodeLabel}</span>
        <code>{errorCode}</code>
    </p>
    {#if hasCurrentDocument}
        <p class="evidence">{unchangedLabel}</p>
    {/if}
    {#snippet actions()}
        {#if hasCurrentDocument}
            <Button label={returnLabel} onclick={onreturn} variant="primary" />
            <Button label={chooseAnotherLabel} onclick={onchooseanother} />
        {:else}
            <Button label={chooseAnotherLabel} onclick={onchooseanother} variant="primary" />
            {#if extraActions !== undefined}
                {@render extraActions()}
            {/if}
        {/if}
    {/snippet}
</TaskState>

<style>
    p {
        margin: var(--space-none);
    }

    .filename {
        font-weight: var(--font-weight-action);
    }

    .error-code {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-actions);
        color: var(--color-danger);
    }

    .evidence {
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
    }
</style>
