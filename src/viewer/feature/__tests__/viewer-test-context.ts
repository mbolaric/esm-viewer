import { createMemoryKeyValueStore, type IViewerPreferences } from '#contracts';
import type { IErrorService } from '#error-reporting';
import { createLocalisationService, createTranslationService } from '#localization';
import type {
    IApplicationCommandStateTarget,
    IViewerExportPort,
    IViewerPdfPort,
    IViewerRuntimeVersionsPort,
} from '#viewer-application';
import type { DurationMilliseconds, UtcTimestamp } from '#viewer-domain';

import {
    defaultViewerLocale,
    viewerCatalogues,
    type IMessageParams,
    type TranslationKey,
    type ViewerLocale,
} from '#i18n-locales';
import type { IViewerContext } from '../viewer-context.js';
import { ToastController } from '#ui';
import { ComplianceProfileController } from '#compliance-feature';
import { ComplianceExportController } from '#compliance-export-controller';
import { ViewerAboutController } from '../controllers/viewer-about-controller.svelte.js';
import { ViewerCommandController } from '../controllers/viewer-command-controller.svelte.js';
import type { ViewerDocumentController } from '../controllers/viewer-document-controller.svelte.js';
import { ViewerExportController } from '../controllers/viewer-export-controller.svelte.js';
import { ViewerPreferencesController } from '../controllers/viewer-preferences-controller.svelte.js';

export interface IViewerTestContextOptions {
    readonly commandStateTarget?: IApplicationCommandStateTarget;
    readonly locale?: ViewerLocale;
}

// Test defaults for IViewerPreferences with optional per-field overrides.
export function buildTestViewerPreferences(overrides: Partial<IViewerPreferences> = {}): IViewerPreferences {
    return {
        density: 'compact',
        displayDateFormat: 'auto',
        displayTimeFormat: 'auto',
        displayTimeZone: 'UTC',
        locale: defaultViewerLocale,
        nightWorkEndHour: 4,
        nightWorkStartHour: 0,
        nightWorkTimeZone: 'UTC',
        pinnedTableColumnIds: {},
        recentFiles: [],
        recentFilesEnabled: false,
        recentFilePathsEnabled: false,
        tablePageSizes: {},
        theme: 'system',
        verificationAutoRun: false,
        version: 1,
        ...overrides,
    };
}

export function createViewerTestContext(
    documentController: ViewerDocumentController,
    options: IViewerTestContextOptions = {},
): IViewerContext {
    const locale = options.locale ?? defaultViewerLocale;
    const errorService = {
        report(): Promise<void> {
            return Promise.resolve();
        },
    } satisfies IErrorService;
    const preferencesController = new ViewerPreferencesController({
        initialPreferences: buildTestViewerPreferences({ locale }),
        loadWarning: false,
        store: {
            load: () =>
                Promise.resolve({
                    ok: true,
                    value: buildTestViewerPreferences({ locale }),
                }),
            save: () => Promise.resolve({ ok: true, value: null }),
        },
        target: {
            apply: () => true,
            dispose: () => undefined,
        },
    });
    const localisationResult = createLocalisationService<UtcTimestamp, DurationMilliseconds>(
        preferencesController,
        preferencesController,
        preferencesController,
    );

    if (!localisationResult.ok) {
        throw new TypeError('The test localization configuration is invalid.');
    }

    const translationService = createTranslationService<ViewerLocale, TranslationKey, IMessageParams>(
        preferencesController,
        viewerCatalogues,
        defaultViewerLocale,
        errorService,
    );
    const runtimeVersionsPort: IViewerRuntimeVersionsPort = {
        load: () =>
            Promise.resolve({
                ok: true,
                value: {
                    application: 'test',
                    architecture: 'x64',
                    parserCommit: 'a'.repeat(40),
                    parserVersion: '0.0.0-test',
                    platform: 'linux',
                    runtime: '36',
                },
            }),
    };
    const exportPort: IViewerExportPort = {
        save: () => Promise.resolve({ status: 'saved' }),
    };
    const pdfPort: IViewerPdfPort = {
        generatePdf: () => Promise.resolve({ bytes: new TextEncoder().encode('pdf'), status: 'converted' }),
        isSupported: () => true,
        print: () => Promise.resolve(),
    };
    const toastController = new ToastController();
    const complianceProfileController = new ComplianceProfileController();
    const complianceExportController = new ComplianceExportController({
        exportPort,
        pdfPort,
        toastController,
        translationService,
    });
    const exportController = new ViewerExportController({
        complianceProfileController,
        exportPort,
        localisationService: localisationResult.value,
        pdfPort,
        preferencesController,
        runtimeVersionsPort,
        translationService,
    });
    const aboutController = new ViewerAboutController({
        clipboard: {
            writeText: () => Promise.resolve(),
        },
        localisationService: localisationResult.value,
        runtimeVersionsPort,
    });
    const commandController = new ViewerCommandController({
        aboutController,
        documentController,
        exportController,
        preferencesController,
        stateTarget: options.commandStateTarget ?? {
            update: () => true,
        },
        translationService,
    });

    return {
        aboutController,
        clipboard: {
            writeText: () => Promise.resolve(),
        },
        commandController,
        complianceExportController,
        complianceProfileController,
        documentController,
        errorService,
        exportController,
        exportPort,
        keyValueStore: createMemoryKeyValueStore(),
        localeService: preferencesController,
        localisationService: localisationResult.value,
        pdfPort,
        preferencesController,
        runtimeVersionsPort,
        toastController,
        translationService,
    };
}
