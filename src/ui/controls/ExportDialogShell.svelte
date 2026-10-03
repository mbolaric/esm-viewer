<script lang="ts" generics="TFormat extends string">
    import Button from './Button.svelte';
    import Dialog from './Dialog.svelte';
    import ExportFormatFieldset from './ExportFormatFieldset.svelte';
    import InlineError from './InlineError.svelte';
    import type { IExportDialogLabels, IExportFormatOption } from './export-format-types.js';

    interface IProps {
        readonly error: string | null;
        readonly fileName: string;
        readonly labels: IExportDialogLabels;
        readonly formatOptions: readonly IExportFormatOption<TFormat>[];
        readonly onclose: () => void;
        readonly onexport: () => void;
        readonly onselect: (value: TFormat) => void;
        readonly saving: boolean;
        readonly selectedFormat: TFormat;
        readonly titleId: string;
    }

    let { error, fileName, formatOptions, labels, onclose, onexport, onselect, saving, selectedFormat, titleId }: IProps =
        $props();
</script>

{#snippet actions()}
    <Button disabled={saving} label={labels.cancel} onclick={onclose} />
    <Button disabled={saving} label={saving ? labels.exporting : labels.export} onclick={onexport} variant="primary" />
{/snippet}

<Dialog {actions} {onclose} title={labels.title} {titleId}>
    <div class="export-form">
        {#if error !== null}
            <InlineError message={error} />
        {/if}

        <ExportFormatFieldset
            disabled={saving}
            legend={labels.formatLegend}
            {onselect}
            options={formatOptions}
            selected={selectedFormat}
        />

        <div class="file-name">
            <span class="file-name-label">{labels.fileName}</span>
            <code>{fileName}</code>
        </div>
    </div>
</Dialog>

<style>
    .export-form {
        display: grid;
        gap: var(--space-stack);
    }

    .file-name {
        display: grid;
        gap: var(--space-compact);
    }

    .file-name-label {
        font-weight: var(--font-weight-action);
    }

    .file-name code {
        overflow-wrap: anywhere;
    }
</style>
