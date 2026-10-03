import { APPLICATION_COMMANDS, type ApplicationCommand } from '#contracts';
import type { ApplicationTranslationKey } from '#localization';

export type ViewerMenuItem = ApplicationCommand | 'separator';
export type ViewerMenuName = 'file' | 'help' | 'view';

export interface IViewerMenuContribution {
    readonly items: readonly ViewerMenuItem[];
    readonly labelKey: ApplicationTranslationKey;
    readonly name: ViewerMenuName;
}

export interface IViewerDesktopContribution {
    readonly commands: readonly ApplicationCommand[];
    readonly menus: readonly IViewerMenuContribution[];
    readonly toolbarCommands: readonly ApplicationCommand[];
}

// A host owns its application shell, but it can compose these stable Viewer contributions
// with its own commands, menus, toolbar controls, and preference surfaces.
export const VIEWER_DESKTOP_CONTRIBUTION: IViewerDesktopContribution = {
    commands: APPLICATION_COMMANDS,
    menus: [
        {
            items: ['file.open', 'file.close', 'separator', 'file.export', 'separator', 'application.preferences'],
            labelKey: 'menu.file',
            name: 'file',
        },
        {
            items: ['view.commandPalette'],
            labelKey: 'menu.view',
            name: 'view',
        },
        {
            items: ['application.exportLogs', 'separator', 'application.about'],
            labelKey: 'menu.help',
            name: 'help',
        },
    ],
    toolbarCommands: ['file.open', 'file.export'],
};
