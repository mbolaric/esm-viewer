<script lang="ts">
    import { translateExportDialogLabels, translateExportFailure } from '#localization';
    import { ExportDialogShell, type IExportFormatOption } from '#ui';

    import type { ExportFormat } from '../../controllers/viewer-export-controller.svelte.js';
    import { useViewerTranslationService } from '../../viewer-context.js';
    import type { ViewerExportFailureCode } from '#viewer-application';

    interface IProps {
        error: ViewerExportFailureCode | null;
        fileName: string;
        format: ExportFormat;
        isPdfSupported?: boolean;
        oncancel: () => void;
        onexport: () => void;
        onformat: (format: ExportFormat) => void;
        saving: boolean;
        showRawJson?: boolean;
    }

    let {
        error,
        fileName,
        format,
        isPdfSupported = true,
        oncancel,
        onexport,
        onformat,
        saving,
        showRawJson = true,
    }: IProps = $props();

    const translationService = useViewerTranslationService();

    let formatOptions = $derived<readonly IExportFormatOption<ExportFormat>[]>(
        [
            {
                description: translationService.translate('export.format.html.description'),
                label: translationService.translate('export.format.html'),
                value: 'html',
            },
            isPdfSupported
                ? {
                      description: translationService.translate('export.format.pdf.description'),
                      label: translationService.translate('export.format.pdf'),
                      value: 'pdf',
                  }
                : null,
            showRawJson
                ? {
                      description: translationService.translate('export.format.rawJson.description'),
                      label: translationService.translate('export.format.rawJson'),
                      value: 'rawJson',
                  }
                : null,
        ].filter((option): option is IExportFormatOption<ExportFormat> => option !== null),
    );
</script>

<ExportDialogShell
    error={error !== null ? translateExportFailure(error, translationService) : null}
    {fileName}
    {formatOptions}
    labels={translateExportDialogLabels(translationService)}
    onclose={oncancel}
    {onexport}
    onselect={onformat}
    {saving}
    selectedFormat={format}
    titleId="export-dialog-title"
/>
