import { invoke } from '@tauri-apps/api/core';
import { Menu, MenuItem, PredefinedMenuItem, Submenu } from '@tauri-apps/api/menu';
import { getCurrentWindow } from '@tauri-apps/api/window';

import { resolveApplicationCatalogue, resolveApplicationCommandDefinition } from '#application-i18n';
import type { ApplicationCommand } from '#contracts';
import { VIEWER_DESKTOP_CONTRIBUTION, type ViewerMenuItem } from '#viewer';

import type { IApplicationCommand } from '#shell';
import { createNativeCommandMenuItem, createNativeMenuItems } from './application-menu-items.js';

type NativeMenuItem = MenuItem | PredefinedMenuItem;

export interface IApplicationMenuOptions {
    readonly applicationName?: string;
    readonly additionalMenus?: readonly Submenu[];
    readonly commandLabels?: Readonly<Partial<Record<ApplicationCommand, string>>>;
}

export function isMacOS(): boolean {
    return typeof navigator !== 'undefined' && navigator.userAgent.includes('Macintosh');
}

export function isLinux(): boolean {
    return typeof navigator !== 'undefined' && navigator.userAgent.includes('Linux');
}

export async function createCommandMenuItem(
    command: ApplicationCommand,
    execute: (command: ApplicationCommand) => void,
    commandItems: Map<ApplicationCommand, MenuItem>,
    locale: string,
    label?: string,
): Promise<MenuItem> {
    const catalogue = resolveApplicationCatalogue(locale);
    const definition = resolveApplicationCommandDefinition(command, {
        translate: (key) => catalogue[key],
    });

    return createNativeCommandMenuItem(
        {
            ...definition,
            id: command,
            label: label ?? definition.label,
            enabled: true,
            onexecute: () => {
                execute(command);
            },
        },
        commandItems,
    );
}

function menuItems(name: 'file' | 'help' | 'view'): readonly ViewerMenuItem[] {
    const contribution = VIEWER_DESKTOP_CONTRIBUTION.menus.find((menu) => menu.name === name);
    if (contribution === undefined) {
        throw new TypeError(`Viewer menu contribution is missing ${name}.`);
    }
    return contribution.items;
}

async function createViewerMenuItems(
    items: readonly ViewerMenuItem[],
    execute: (command: ApplicationCommand) => void,
    commandItems: Map<ApplicationCommand, MenuItem>,
    locale: string,
    labels?: Readonly<Partial<Record<ApplicationCommand, string>>>,
): Promise<NativeMenuItem[]> {
    const catalogue = resolveApplicationCatalogue(locale);
    const commands: IApplicationCommand<ApplicationCommand>[] = items
        .filter((item) => item !== 'separator')
        .map((command) => {
            const definition = resolveApplicationCommandDefinition(command, { translate: (key) => catalogue[key] });
            return {
                ...definition,
                id: command,
                label: labels?.[command] ?? definition.label,
                enabled: true,
                onexecute: () => {
                    execute(command);
                },
            };
        });
    return createNativeMenuItems(items, commands, commandItems);
}

export async function createApplicationMenu(
    execute: (command: ApplicationCommand) => void,
    commandItems: Map<ApplicationCommand, MenuItem>,
    locale: string,
    options: IApplicationMenuOptions = {},
): Promise<void> {
    const catalogue = resolveApplicationCatalogue(locale);
    const fileItems = await createViewerMenuItems(menuItems('file'), execute, commandItems, locale, options.commandLabels);
    if (!isMacOS()) {
        fileItems.push(await PredefinedMenuItem.new({ item: 'Separator' }), await PredefinedMenuItem.new({ item: 'Quit' }));
    }
    const fileMenu = await Submenu.new({
        items: fileItems,
        text: catalogue['menu.file'],
    });
    const editMenu = await Submenu.new({
        items: [
            await PredefinedMenuItem.new({ item: 'Undo', text: catalogue['command.edit.undo'] }),
            await PredefinedMenuItem.new({ item: 'Redo', text: catalogue['command.edit.redo'] }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await PredefinedMenuItem.new({ item: 'Cut', text: catalogue['command.edit.cut'] }),
            await PredefinedMenuItem.new({ item: 'Copy', text: catalogue['command.edit.copy'] }),
            await PredefinedMenuItem.new({ item: 'Paste', text: catalogue['command.edit.paste'] }),
            await PredefinedMenuItem.new({ item: 'SelectAll', text: catalogue['command.edit.selectAll'] }),
        ],
        text: catalogue['menu.edit'],
    });
    const viewItems = await createViewerMenuItems(menuItems('view'), execute, commandItems, locale, options.commandLabels);
    viewItems.push(await PredefinedMenuItem.new({ item: 'Separator' }), await PredefinedMenuItem.new({ item: 'Fullscreen' }));
    if (import.meta.env.DEV) {
        viewItems.push(
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await MenuItem.new({
                accelerator: isMacOS() ? 'Option+Cmd+I' : 'Control+Shift+I',
                action: () => {
                    void invoke('open_devtools');
                },
                id: 'view.devtools',
                text: 'Toggle Developer Tools',
            }),
        );
    }
    const viewMenu = await Submenu.new({
        items: viewItems,
        text: catalogue['menu.view'],
    });
    // Predefined window items are unsupported by GTK menu crate on Linux; omitted on Linux.
    const windowMenu = isLinux()
        ? undefined
        : await Submenu.new({
              items: [
                  await PredefinedMenuItem.new({ item: 'Minimize' }),
                  await PredefinedMenuItem.new({ item: 'Maximize' }),
                  await PredefinedMenuItem.new({ item: 'CloseWindow' }),
              ],
              text: catalogue['menu.window'],
          });
    const helpMenu = await Submenu.new({
        items: await createViewerMenuItems(menuItems('help'), execute, commandItems, locale, options.commandLabels),
        text: catalogue['menu.help'],
    });

    const commonMenus = [fileMenu, editMenu, viewMenu, ...(options.additionalMenus ?? []), windowMenu, helpMenu].filter(
        (menu) => menu !== undefined,
    );
    const menu = isMacOS()
        ? await Menu.new({
              items: [
                  await Submenu.new({
                      items: [
                          await createCommandMenuItem(
                              'application.about',
                              execute,
                              commandItems,
                              locale,
                              options.commandLabels?.['application.about'],
                          ),
                          await PredefinedMenuItem.new({ item: 'Separator' }),
                          await createCommandMenuItem('application.preferences', execute, commandItems, locale),
                          await PredefinedMenuItem.new({ item: 'Separator' }),
                          await PredefinedMenuItem.new({ item: 'Quit' }),
                      ],
                      text: options.applicationName ?? catalogue['application.name'],
                  }),
                  ...commonMenus,
              ],
          })
        : await Menu.new({
              items: commonMenus,
          });

    if (isMacOS()) {
        await menu.setAsAppMenu();
    } else {
        await menu.setAsWindowMenu(getCurrentWindow());
    }
}
