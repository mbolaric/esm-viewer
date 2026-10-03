import { DISABLED_APPLICATION_COMMAND_STATE, type ApplicationCommand, type ApplicationCommandState } from '#contracts';
import { resolveApplicationCommandDefinition, type ITranslationService } from '#localization';
import type { DocumentWorkspaceSection, IApplicationCommandStateTarget } from '#viewer-application';

import type { IMessageParams, TranslationKey } from '#i18n-locales';
import type { ViewerAboutController } from './viewer-about-controller.svelte.js';
import type { ViewerDocumentController } from './viewer-document-controller.svelte.js';
import type { ViewerExportController } from './viewer-export-controller.svelte.js';
import type { ViewerPreferencesController } from './viewer-preferences-controller.svelte.js';

export interface IViewerCommandControllerDependencies {
    readonly aboutController: ViewerAboutController;
    readonly documentController: ViewerDocumentController;
    readonly exportController: ViewerExportController;
    readonly exportLogs?: (() => Promise<void> | void) | undefined;
    readonly openCommandPalette?: (() => void) | undefined;
    readonly openUserGuide?: (() => void) | undefined;
    readonly preferencesController: ViewerPreferencesController;
    readonly stateTarget: IApplicationCommandStateTarget;
    readonly translationService: ITranslationService<TranslationKey, IMessageParams>;
}

function statesMatch(left: ApplicationCommandState, right: ApplicationCommandState): boolean {
    return (
        left['application.about'] === right['application.about'] &&
        left['application.exportLogs'] === right['application.exportLogs'] &&
        left['application.preferences'] === right['application.preferences'] &&
        left['application.userGuide'] === right['application.userGuide'] &&
        left['file.close'] === right['file.close'] &&
        left['file.export'] === right['file.export'] &&
        left['file.open'] === right['file.open'] &&
        left['view.commandPalette'] === right['view.commandPalette']
    );
}

export class ViewerCommandController {
    private readonly _aboutController: ViewerAboutController;
    private _commandPaletteHandler?: (() => void) | undefined;
    private _fileOpenHandler?: (() => void) | undefined;
    private readonly _documentController: ViewerDocumentController;
    private readonly _exportController: ViewerExportController;
    private readonly _exportLogs?: (() => Promise<void> | void) | undefined;
    private readonly _openCommandPalette?: (() => void) | undefined;
    private readonly _openUserGuide?: (() => void) | undefined;
    private _publishedState: ApplicationCommandState = DISABLED_APPLICATION_COMMAND_STATE;
    private readonly _preferencesController: ViewerPreferencesController;
    private readonly _stateTarget: IApplicationCommandStateTarget;
    private readonly _translationService: ITranslationService<TranslationKey, IMessageParams>;
    private _userGuideHandler?: (() => void) | undefined;
    private _sectionSelectionHandler?: ((section: DocumentWorkspaceSection) => void) | undefined;

    public constructor(dependencies: IViewerCommandControllerDependencies) {
        this._aboutController = dependencies.aboutController;
        this._documentController = dependencies.documentController;
        this._exportController = dependencies.exportController;
        this._exportLogs = dependencies.exportLogs;
        this._openCommandPalette = dependencies.openCommandPalette;
        this._openUserGuide = dependencies.openUserGuide;
        this._preferencesController = dependencies.preferencesController;
        this._stateTarget = dependencies.stateTarget;
        this._translationService = dependencies.translationService;
    }

    public registerCommandPaletteHandler(handler: () => void): () => void {
        this._commandPaletteHandler = handler;
        return () => {
            if (this._commandPaletteHandler === handler) {
                this._commandPaletteHandler = undefined;
            }
        };
    }

    public registerFileOpenHandler(handler: () => void): () => void {
        this._fileOpenHandler = handler;
        return () => {
            if (this._fileOpenHandler === handler) {
                this._fileOpenHandler = undefined;
            }
        };
    }

    public registerUserGuideHandler(handler: () => void): () => void {
        this._userGuideHandler = handler;
        return () => {
            if (this._userGuideHandler === handler) {
                this._userGuideHandler = undefined;
            }
        };
    }

    public get state(): ApplicationCommandState {
        const modalOpen = this._preferencesController.snapshot.isOpen;
        const aboutOpen = this._aboutController.snapshot.isOpen;
        const exportOpen = this._exportController.snapshot.isOpen;
        const blocked =
            this._documentController.busy || modalOpen || aboutOpen || exportOpen || this._preferencesController.snapshot.saving;

        return {
            'application.about': !blocked,
            'application.exportLogs': !blocked,
            'application.preferences': !blocked,
            'application.userGuide': !blocked,
            'file.close': !blocked && this._documentController.snapshot.current !== null,
            'file.export': !blocked && this._documentController.snapshot.current !== null,
            'file.open': !blocked,
            'view.commandPalette': !blocked,
        };
    }

    public registerSectionSelectionHandler(handler: (section: DocumentWorkspaceSection) => void): () => void {
        this._sectionSelectionHandler = handler;
        return () => {
            if (this._sectionSelectionHandler === handler) {
                this._sectionSelectionHandler = undefined;
            }
        };
    }

    public selectSection(section: DocumentWorkspaceSection): void {
        if (this._sectionSelectionHandler !== undefined) {
            this._sectionSelectionHandler(section);
        } else {
            this._documentController.selectSection(section);
        }
    }

    public execute(command: ApplicationCommand): boolean {
        if (!this.state[command]) {
            return false;
        }

        switch (command) {
            case 'application.about':
                void this._aboutController.open();
                return true;
            case 'application.exportLogs':
                void this._exportLogs?.();
                return true;
            case 'application.preferences':
                return this._preferencesController.open();
            case 'application.userGuide':
                this._openUserGuide?.();
                this._userGuideHandler?.();
                return true;
            case 'file.close':
                void this._documentController.close();
                return true;
            case 'file.export':
                return this._exportController.open();
            case 'file.open':
                this._fileOpenHandler?.();
                void this._documentController.open();
                return true;
            case 'view.commandPalette':
                this._openCommandPalette?.();
                this._commandPaletteHandler?.();
                return true;
        }
    }

    public label(command: ApplicationCommand): string {
        return resolveApplicationCommandDefinition(command, this._translationService).label;
    }

    public synchronize(): boolean {
        const state = this.state;
        if (statesMatch(state, this._publishedState)) {
            return true;
        }

        let updated: boolean;
        try {
            updated = this._stateTarget.update(state);
        } catch {
            return false;
        }

        if (updated) {
            this._publishedState = state;
        }
        return updated;
    }
}
