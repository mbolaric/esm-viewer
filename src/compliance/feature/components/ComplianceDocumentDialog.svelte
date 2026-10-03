<script lang="ts">
    import type { Snippet } from 'svelte';
    import { Dialog, InlineError } from '#ui';
    import type { IComplianceTranslationService } from '#compliance';
    import { ComplianceExportStatus } from './compliance-export-status.svelte.js';
    import ComplianceExportActions from './ComplianceExportActions.svelte';
    import ComplianceExportStatusText from './ComplianceExportStatusText.svelte';

    interface IComplianceDocumentDialogLabels {
        readonly close: string;
        readonly print: string;
        readonly saveHtml: string;
        readonly savePdf: string;
        readonly subtitle: string;
        readonly title: string;
    }

    interface IProps {
        // Edit panels and the on-screen document preview.
        children: Snippet;
        error?: string | null;
        // False while required fields are missing; printing and saving stay disabled.
        exportAllowed?: boolean;
        labels: IComplianceDocumentDialogLabels;
        onclose: () => void;
        onprint: () => Promise<void> | void;
        onsaveHtml?: (() => Promise<void> | void) | undefined;
        onsavePdf?: (() => Promise<void> | void) | undefined;
        titleId: string;
        translationService: IComplianceTranslationService;
    }

    let {
        children,
        error = null,
        exportAllowed = true,
        labels,
        onclose,
        onprint,
        onsaveHtml = undefined,
        onsavePdf = undefined,
        titleId,
        translationService,
    }: IProps = $props();

    // Shared by the action buttons and the header status text, so both reflect the same running export.
    const exportStatus = new ComplianceExportStatus();
</script>

{#snippet actions()}
    <ComplianceExportActions
        closeLabel={labels.close}
        {exportAllowed}
        {onclose}
        {onprint}
        printLabel={labels.print}
        saveHtml={onsaveHtml !== undefined ? { label: labels.saveHtml, onclick: onsaveHtml } : undefined}
        savePdf={onsavePdf !== undefined ? { label: labels.savePdf, onclick: onsavePdf } : undefined}
        status={exportStatus}
    />
{/snippet}

{#snippet headerEnd()}
    <ComplianceExportStatusText status={exportStatus} {translationService} />
{/snippet}

<Dialog {actions} {headerEnd} {onclose} size="large" title={labels.title} {titleId}>
    <div class="document-dialog-container">
        <p class="subtitle">{labels.subtitle}</p>

        {#if error !== null}
            <InlineError message={error} />
        {/if}

        {@render children()}
    </div>
</Dialog>

<style>
    .document-dialog-container {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
    }

    .subtitle {
        margin: var(--space-none);
        font-size: var(--font-size-body);
        color: var(--color-text-muted);
    }
</style>
