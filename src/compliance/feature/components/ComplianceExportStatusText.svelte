<script lang="ts">
    import type { IComplianceTranslationService } from '#compliance';
    import type { ComplianceExportStatus } from './compliance-export-status.svelte.js';

    interface IProps {
        status: ComplianceExportStatus;
        translationService: IComplianceTranslationService;
    }

    let { status, translationService }: IProps = $props();
</script>

{#if status.busy}
    <span class="export-status-text">
        {status.busyAction === 'printing'
            ? translationService.translate('export.printing')
            : translationService.translate('export.exporting')}
    </span>
{/if}

<style>
    .export-status-text {
        color: var(--color-accent);
        font-size: var(--font-size-body);
        font-weight: var(--font-weight-action);
    }
</style>
