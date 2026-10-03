import { describe, expect, it } from 'vitest';

import {
    translateExportDialogLabels,
    translateExportFailure,
    type ExportDialogTranslationKey,
    type ExportFailureTranslationKey,
} from '../export-messages.js';
import { createTranslationService } from '../translation-service.js';

const translationService = createTranslationService<'en', ExportFailureTranslationKey>(
    { locale: 'en' },
    {
        en: {
            'export.error.destinationExists': 'Destination exists',
            'export.error.generic': 'Generic failure',
            'export.error.io': 'I/O failure',
            'export.error.sourceConflict': 'Source conflict',
        },
    },
    'en',
    { report: () => Promise.resolve() },
);

describe('translateExportFailure', () => {
    it.each([
        ['destinationExists', 'Destination exists'],
        ['exportFailed', 'Generic failure'],
        ['ioFailure', 'I/O failure'],
        ['sourceConflict', 'Source conflict'],
    ] as const)('maps %s to its catalogue message', (code, message) => {
        expect(translateExportFailure(code, translationService)).toBe(message);
    });
});

describe('translateExportDialogLabels', () => {
    it('looks up the shared export dialog copy', () => {
        const dialogTranslationService = createTranslationService<'en', ExportDialogTranslationKey>(
            { locale: 'en' },
            {
                en: {
                    'export.export': 'Export',
                    'export.exporting': 'Exporting',
                    'export.fileName': 'File name',
                    'export.format': 'Format',
                    'export.heading': 'Export report',
                    'opening.cancel': 'Cancel',
                },
            },
            'en',
            { report: () => Promise.resolve() },
        );

        expect(translateExportDialogLabels(dialogTranslationService)).toEqual({
            cancel: 'Cancel',
            export: 'Export',
            exporting: 'Exporting',
            fileName: 'File name',
            formatLegend: 'Format',
            title: 'Export report',
        });
    });
});
