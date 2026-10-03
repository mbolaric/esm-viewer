<script lang="ts">
    import { ConfirmDialog } from '#ui';
    import type { OpenedTachographDocument } from '#viewer-application';

    import { exportFileName } from '../../helpers/export-report.js';
    import type { ExportFormat } from '../../controllers/viewer-export-controller.svelte.js';
    import { useViewerContext } from '../../viewer-context.js';
    import ExportDialog from '../dialogs/ExportDialog.svelte';

    interface IProps {
        currentDocument: OpenedTachographDocument | null;
        onhistoryremovalclose: () => void;
        pendingHistoryRemoval: string | null;
        pendingHistoryRemovalName: string | null;
    }

    let { currentDocument, onhistoryremovalclose, pendingHistoryRemoval, pendingHistoryRemovalName }: IProps = $props();
    const viewerContext = useViewerContext();
    const documentController = viewerContext.documentController;
    const exportController = viewerContext.exportController;

    async function exportDocument(): Promise<void> {
        const current = documentController.snapshot.current;
        if (current === null || exportController.snapshot.saving) {
            return;
        }
        const result = await exportController.exportCurrentDocument(current);
        if (result.status === 'saved') {
            viewerContext.toastController.success(
                viewerContext.translationService.translate('export.toast.success', { fileName: result.fileName }),
            );
        }
    }

    function confirmHistoryRemoval(): void {
        if (pendingHistoryRemoval !== null) {
            documentController.removeComparisonRecord(pendingHistoryRemoval);
        }
        onhistoryremovalclose();
    }
</script>

{#if exportController.snapshot.isOpen && currentDocument !== null}
    <ExportDialog
        error={exportController.snapshot.error}
        fileName={exportFileName(
            currentDocument.source.displayName,
            exportController.snapshot.format === 'html' ? '.html' : exportController.snapshot.format === 'pdf' ? '.pdf' : '.json',
        )}
        format={exportController.snapshot.format}
        isPdfSupported={exportController.snapshot.isPdfSupported}
        oncancel={() => exportController.cancel()}
        onexport={() => void exportDocument()}
        onformat={(format: ExportFormat) => exportController.setFormat(format)}
        saving={exportController.snapshot.saving}
    />
{/if}

{#if pendingHistoryRemoval !== null}
    <ConfirmDialog
        cancelLabel={viewerContext.translationService.translate('comparison.keepEntry')}
        confirmLabel={viewerContext.translationService.translate('comparison.removeEntry')}
        message={viewerContext.translationService.translate('comparison.removeConfirmMessage', {
            displayName: pendingHistoryRemovalName ?? '',
        })}
        oncancel={onhistoryremovalclose}
        onconfirm={confirmHistoryRemoval}
        title={viewerContext.translationService.translate('comparison.removeConfirmTitle')}
        titleId="comparison-remove-dialog-title"
    />
{/if}
