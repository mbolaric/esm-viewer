<script lang="ts">
    import type { HTMLInputAttributes } from 'svelte/elements';

    interface IProps {
        autocomplete?: HTMLInputAttributes['autocomplete'] | undefined;
        label: string;
        // Renders a three-row text area instead of a single-line input.
        multiline?: boolean;
        onblur?: (() => void) | undefined;
        // Shown after the label for fields the document can be exported without.
        optionalLabel?: string | undefined;
        required?: boolean;
        type?: 'email' | 'tel' | 'text';
        value: string;
    }

    let {
        autocomplete = undefined,
        label,
        multiline = false,
        onblur = undefined,
        optionalLabel = undefined,
        required = false,
        type = 'text',
        value = $bindable(),
    }: IProps = $props();
</script>

<label class="edit-field" class:edit-field-full={multiline}>
    <span>
        {label}
        {#if optionalLabel !== undefined}
            <span class="optional-marker">{optionalLabel}</span>
        {/if}
    </span>
    {#if multiline}
        <textarea aria-required={required ? 'true' : undefined} bind:value {onblur} rows="3"></textarea>
    {:else}
        <input aria-required={required ? 'true' : undefined} {autocomplete} bind:value {onblur} {type} />
    {/if}
</label>

<style>
    .edit-field {
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        gap: var(--space-compact);
        font-size: var(--font-size-metadata);
        color: var(--color-text-muted);
    }

    .edit-field-full {
        grid-column: var(--grid-column-full);
    }

    input,
    textarea {
        font-size: var(--font-size-body);
        color: var(--color-text);
        background: var(--color-surface);
        border: var(--border-control);
        border-radius: var(--radius-control);
        padding-block: var(--space-compact);
        padding-inline: var(--space-actions);
    }

    textarea {
        resize: vertical;
    }

    input:focus-visible,
    textarea:focus-visible {
        outline: var(--border-focus);
        outline-offset: var(--space-focus-offset);
    }

    .optional-marker {
        font-style: italic;
    }
</style>
