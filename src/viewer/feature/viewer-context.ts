import type { IKeyValueStore } from '#contracts';
import type { IErrorService } from '#error-reporting';
import type { IDateTimeFormatService, ILocaleService, ILocalisationService, ITranslationService } from '#localization';
import type { DurationMilliseconds, UtcTimestamp } from '#viewer-domain';
import type { ITextClipboardPort, IViewerExportPort, IViewerPdfPort, IViewerRuntimeVersionsPort } from '#viewer-application';
import { getContext, hasContext, setContext } from 'svelte';

import type { ToastController } from '#ui';
import type { ComplianceExportController } from '#compliance-export-controller';
import type { ComplianceProfileController } from '#compliance-profile-controller';

import type { IMessageParams, TranslationKey, ViewerLocale } from '#i18n-locales';
import type { ViewerAboutController } from './controllers/viewer-about-controller.svelte.js';
import type { ViewerCommandController } from './controllers/viewer-command-controller.svelte.js';
import type { ViewerDocumentController } from './controllers/viewer-document-controller.svelte.js';
import type { ViewerExportController } from './controllers/viewer-export-controller.svelte.js';
import type { ViewerPreferencesController } from './controllers/viewer-preferences-controller.svelte.js';

export interface IViewerContext {
    readonly aboutController: ViewerAboutController;
    readonly clipboard: ITextClipboardPort;
    readonly commandController: ViewerCommandController;
    readonly complianceExportController: ComplianceExportController;
    readonly complianceProfileController: ComplianceProfileController;
    readonly documentController: ViewerDocumentController;
    readonly errorService: IErrorService;
    readonly exportPort: IViewerExportPort;
    readonly exportController: ViewerExportController;
    // Small per-user conveniences (inspector width, dismissed hints, remembered letter details).
    readonly keyValueStore: IKeyValueStore;
    readonly localeService: ILocaleService<ViewerLocale>;
    readonly localisationService: ILocalisationService<UtcTimestamp, DurationMilliseconds>;
    readonly pdfPort: IViewerPdfPort;
    readonly preferencesController: ViewerPreferencesController;
    readonly runtimeVersionsPort: IViewerRuntimeVersionsPort;
    readonly toastController: ToastController;
    readonly translationService: ITranslationService<TranslationKey, IMessageParams>;
}

export type ViewerTranslationService = IViewerContext['translationService'];
export type ViewerLocalisationService = IViewerContext['localisationService'];

const viewerContextKey = Symbol('viewer-context');
type ViewerContextProvider = () => IViewerContext;

export class ViewerCompositionError extends Error {
    public readonly code = 'viewer.missing-context';

    public constructor() {
        super('The viewer context was not provided by the application composition root.');
        this.name = 'ViewerCompositionError';
    }
}

export function provideViewerContext(provider: ViewerContextProvider): ViewerContextProvider {
    return setContext(viewerContextKey, provider);
}

export function useViewerContext(): IViewerContext {
    if (!hasContext(viewerContextKey)) {
        throw new ViewerCompositionError();
    }

    return getContext<ViewerContextProvider>(viewerContextKey)();
}

export function useViewerTranslationService(): ViewerTranslationService {
    return useViewerContext().translationService;
}

export function useViewerLocalisationService(): ViewerLocalisationService {
    return useViewerContext().localisationService;
}

// Narrowed to IDateTimeFormatService to restrict access to format keys only.
export function useViewerDateTimeFormatService(): IDateTimeFormatService {
    return useViewerContext().preferencesController;
}
