import type { ExportFailureCode } from '#contracts';

import type { ITranslationService } from './translation-service.js';

export type ExportFailureTranslationKey =
    | 'export.error.archiveChanged'
    | 'export.error.destinationExists'
    | 'export.error.generic'
    | 'export.error.io'
    | 'export.error.sourceConflict';

// Every export surface reports the same failure codes, so they share one set of catalogue keys.
const TRANSLATE_EXPORT_FAILURE_KEYS = {
    archiveChanged: 'export.error.archiveChanged',
    destinationExists: 'export.error.destinationExists',
    exportFailed: 'export.error.generic',
    ioFailure: 'export.error.io',
    sourceConflict: 'export.error.sourceConflict',
} satisfies Readonly<Record<ExportFailureCode, ExportFailureTranslationKey>>;

export function translateExportFailure(
    code: ExportFailureCode,
    translationService: ITranslationService<ExportFailureTranslationKey>,
): string {
    return translationService.translate(TRANSLATE_EXPORT_FAILURE_KEYS[code]);
}

export type ExportDialogTranslationKey =
    'export.export' | 'export.exporting' | 'export.fileName' | 'export.format' | 'export.heading' | 'opening.cancel';

export interface IExportDialogLabelTexts {
    readonly cancel: string;
    readonly export: string;
    readonly exporting: string;
    readonly fileName: string;
    readonly formatLegend: string;
    readonly title: string;
}

// Every export dialog shares its chrome copy; only the format options differ per caller.
export function translateExportDialogLabels(
    translationService: ITranslationService<ExportDialogTranslationKey>,
): IExportDialogLabelTexts {
    return {
        cancel: translationService.translate('opening.cancel'),
        export: translationService.translate('export.export'),
        exporting: translationService.translate('export.exporting'),
        fileName: translationService.translate('export.fileName'),
        formatLegend: translationService.translate('export.format'),
        title: translationService.translate('export.heading'),
    };
}
