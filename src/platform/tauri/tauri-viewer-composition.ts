import type { MenuItem } from '@tauri-apps/api/menu';
import { ERROR_CODES, type ApplicationCommand, type ApplicationCommandState, type IViewerPreferences } from '#contracts';
import { ComplianceProfileController } from '#compliance-feature';
import { ComplianceExportController } from '#compliance-export-controller';
import type { IErrorService } from '#error-reporting';
import { createLocalisationService, createTranslationService } from '#localization';
import { ToastController } from '#ui';
import {
    defaultViewerLocale,
    ViewerAboutController,
    ViewerCommandController,
    ViewerDocumentController,
    ViewerExportController,
    ViewerPreferencesController,
    viewerCatalogues,
    type IMessageParams,
    type IViewerContext,
    type TranslationKey,
    type ViewerLocale,
} from '#viewer';
import { nowAsUtcTimestamp, type DurationMilliseconds, type UtcTimestamp } from '#tachograph-domain';
import {
    DocumentComparisonController,
    DocumentLifecycleController,
    DocumentSelectionController,
    type ITachographParserPort,
    type ITextClipboardPort,
    type IViewerPreferencesTarget,
} from '#viewer-application';
import {
    TauriDroppedTachographFilePicker,
    TauriReopenTachographFilePicker,
    TauriTachographFilePicker,
} from './tauri-file-pickers.js';
import { createBrowserKeyValueStore } from './browser-key-value-store.js';
import { type TauriPlatformService } from './tauri-platform-service.js';
import { TauriTachographParser } from './tauri-tachograph-parser.js';
import { createApplicationMenu, type IApplicationMenu } from './viewer-menu.js';
import { TauriPreferencesTarget } from './tauri-preferences-target.js';
import { createTauriErrorService } from './tauri-error-service.js';

import {
    createExportPort,
    createFileDigest,
    createPdfPort,
    createPreferencesStore,
    createRuntimeVersionsPort,
    createTextClipboardPort,
} from './desktop-ports.js';

export interface ITauriViewerCompositionOptions {
    readonly catalogues?: Readonly<Record<ViewerLocale, Readonly<Record<TranslationKey, string>>>>;
    readonly errorService?: IErrorService;
    readonly installMenu?: typeof createApplicationMenu;
    readonly onPreferencesApplied?: (previous: IViewerPreferences, next: IViewerPreferences) => void;
    readonly preferencesTarget?: IViewerPreferencesTarget;
}

export async function createTauriViewerContext(
    service: TauriPlatformService,
    options?: ITauriViewerCompositionOptions,
): Promise<IViewerContext> {
    const preferencesStore = createPreferencesStore(service);
    const loadedPreferences = await preferencesStore.load();
    const commandMenuItems = new Map<ApplicationCommand, MenuItem>();
    let commandController: ViewerCommandController | null = null;

    const errorService: IErrorService = options?.errorService ?? createTauriErrorService();
    const installMenu = options?.installMenu ?? createApplicationMenu;
    let applicationMenu: IApplicationMenu | null = null;
    let menuUpdate: Promise<void> = Promise.resolve();
    const handleApplicationCommand = (command: ApplicationCommand): void => {
        commandController?.execute(command);
    };
    const updateMenu = (locale: string): Promise<void> => {
        menuUpdate = menuUpdate
            .then(async () => {
                if (applicationMenu === null) {
                    applicationMenu = await installMenu(handleApplicationCommand, commandMenuItems, locale, { errorService });
                } else {
                    await applicationMenu.updateLocale(locale);
                }
                commandController?.synchronize();
            })
            .catch((error: unknown) => {
                void errorService.report({ code: ERROR_CODES.menuBuildFailed, severity: 'error', source: 'desktop' }, error);
            });
        return menuUpdate;
    };
    const preferencesController = new ViewerPreferencesController({
        initialPreferences: loadedPreferences.ok ? loadedPreferences.value : null,
        loadWarning: !loadedPreferences.ok,
        ...(options?.onPreferencesApplied === undefined ? {} : { onapplied: options.onPreferencesApplied }),
        store: preferencesStore,
        target:
            options?.preferencesTarget ??
            new TauriPreferencesTarget({
                errorService,
                onLocaleChange: (locale) => {
                    void updateMenu(locale);
                },
            }),
    });
    const translationService = createTranslationService<ViewerLocale, TranslationKey, IMessageParams>(
        preferencesController,
        options?.catalogues ?? viewerCatalogues,
        defaultViewerLocale,
        errorService,
    );
    const localisationResult = createLocalisationService<UtcTimestamp, DurationMilliseconds>(
        preferencesController,
        preferencesController,
        preferencesController,
    );

    if (!localisationResult.ok) {
        throw new TypeError('The default viewer localization configuration is invalid.');
    }

    const parser: ITachographParserPort = new TauriTachographParser();
    const exportPort = createExportPort(service, errorService);
    const runtimeVersionsPort = createRuntimeVersionsPort(service);
    const clipboard: ITextClipboardPort = createTextClipboardPort(service);
    const keyValueStore = createBrowserKeyValueStore();
    const aboutController = new ViewerAboutController({
        clipboard,
        localisationService: localisationResult.value,
        runtimeVersionsPort,
    });
    const pdfPort = createPdfPort(service, errorService);
    const toastController = new ToastController();
    const complianceProfileController = new ComplianceProfileController();
    const complianceExportController = new ComplianceExportController({
        errorService,
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
    const documentController = new ViewerDocumentController({
        clock: nowAsUtcTimestamp,
        comparison: new DocumentComparisonController(),
        createDroppedFilePicker: (file) => new TauriDroppedTachographFilePicker(service, file),
        createReopenFilePicker: (reopenToken) => new TauriReopenTachographFilePicker(service, reopenToken),
        createSelectionController: (document) => new DocumentSelectionController(document),
        digest: createFileDigest(),
        disposeOwnedResources: () => undefined,
        errorService,
        filePicker: new TauriTachographFilePicker(service),
        lifecycle: new DocumentLifecycleController(),
        parser,
        preferencesController,
    });
    commandController = new ViewerCommandController({
        aboutController,
        documentController,
        exportController,
        exportLogs: () => {
            void service.exportErrorLogs();
        },
        preferencesController,
        stateTarget: {
            update(state: ApplicationCommandState): boolean {
                try {
                    for (const [command, item] of commandMenuItems) {
                        void item.setEnabled(state[command]);
                    }
                    return true;
                } catch {
                    return false;
                }
            },
        },
        translationService,
    });
    await updateMenu(preferencesController.locale);
    commandController.synchronize();

    return {
        aboutController,
        clipboard,
        commandController,
        complianceExportController,
        complianceProfileController,
        documentController,
        errorService,
        exportController,
        exportPort,
        keyValueStore,
        localeService: preferencesController,
        localisationService: localisationResult.value,
        pdfPort,
        preferencesController,
        runtimeVersionsPort,
        toastController,
        translationService,
    };
}
