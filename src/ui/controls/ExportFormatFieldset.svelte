<script lang="ts" generics="TFormat extends string">
    import type { IExportFormatOption } from './export-format-types.js';

    interface IProps {
        readonly disabled: boolean;
        readonly legend: string;
        readonly onselect: (value: TFormat) => void;
        readonly options: readonly IExportFormatOption<TFormat>[];
        readonly selected: TFormat;
    }

    let { disabled, legend, onselect, options, selected }: IProps = $props();
</script>

<fieldset {disabled}>
    <legend>{legend}</legend>
    {#each options as option (option.value)}
        <label class="format-option">
            <input
                checked={selected === option.value}
                onchange={() => onselect(option.value)}
                type="radio"
                value={option.value}
            />
            <span>
                <strong>{option.label}</strong>
                <span class="description">{option.description}</span>
            </span>
        </label>
    {/each}
</fieldset>

<style>
    fieldset {
        display: grid;
        gap: var(--space-stack);
        margin: var(--space-none);
        padding: var(--space-none);
        border: none;
    }

    legend {
        font-weight: var(--font-weight-action);
        margin-block-end: var(--space-stack);
    }

    .format-option {
        display: flex;
        gap: var(--space-control-block);
        align-items: start;
        padding: var(--space-control-inline);
        background: var(--color-surface-subtle);
        border: var(--border-panel);
        border-radius: var(--radius-control);
    }

    .format-option span {
        display: grid;
        gap: var(--space-compact);
    }

    .description {
        color: var(--color-text-muted);
    }

    input {
        accent-color: var(--color-accent);
        margin-block-start: var(--space-compact);
    }
</style>
