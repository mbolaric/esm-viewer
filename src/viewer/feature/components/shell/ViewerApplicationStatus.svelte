<script lang="ts">
    import type { IViewerContext } from '../../viewer-context.js';
    import type { IViewerDocumentStatus } from '../../viewer-application-mode.js';
    import DocumentStatus from './DocumentStatus.svelte';

    interface IProps {
        context: IViewerContext;
        documentStatus: IViewerDocumentStatus | null;
    }
    let { context, documentStatus }: IProps = $props();
</script>

<DocumentStatus
    ariaLabel={context.translationService.translate('shell.status')}
    timeZone={context.localisationService.timeZone}
    {...documentStatus !== null
        ? {
              warningCount: documentStatus.warningCount,
              warningsLabel: context.translationService.translate('status.warnings'),
          }
        : {}}
/>
