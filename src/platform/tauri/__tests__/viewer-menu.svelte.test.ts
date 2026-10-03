import { Channel, type InvokeArgs } from '@tauri-apps/api/core';
import { type MenuItem, Submenu } from '@tauri-apps/api/menu';
import { clearMocks, mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

import { resolveApplicationCatalogue } from '#application-i18n';
import { isUnknownRecord, type ApplicationCommand } from '#contracts';
import { createApplicationMenu } from '#tauri-platform';

interface IMenuResource {
    readonly kind: string;
    readonly id: string;
    readonly options: Readonly<Record<string, unknown>>;
    readonly handler: unknown;
    text: string;
    enabled: boolean;
}

interface IMenuFixture {
    readonly ipc: Mock<(command: string, payload?: InvokeArgs) => unknown>;
    readonly resources: ReadonlyMap<number, IMenuResource>;
}

function nativeMenuFixture(): IMenuFixture {
    const resources = new Map<number, IMenuResource>();
    let nextRid = 1;
    const ipc = vi.fn((command: string, payload?: InvokeArgs): unknown => {
        if (!isUnknownRecord(payload)) {
            throw new TypeError('Invalid menu payload.');
        }
        if (command === 'plugin:menu|new') {
            const options = payload['options'];
            const kind = payload['kind'];
            if (!isUnknownRecord(options) || typeof kind !== 'string') {
                throw new TypeError('Invalid menu creation payload.');
            }
            const rid = nextRid++;
            const id = typeof options['id'] === 'string' ? options['id'] : `menu-${String(rid)}`;
            resources.set(rid, {
                kind,
                id,
                options: { ...options },
                handler: payload['handler'],
                text: typeof options['text'] === 'string' ? options['text'] : '',
                enabled: options['enabled'] !== false,
            });
            return [rid, id];
        }
        if (command === 'plugin:menu|set_as_app_menu' || command === 'plugin:menu|set_as_window_menu') {
            return null;
        }
        if (command === 'plugin:resources|close') {
            const rid = payload['rid'];
            if (typeof rid === 'number') {
                resources.delete(rid);
            }
            return null;
        }
        const rid = payload['rid'];
        const resource = typeof rid === 'number' ? resources.get(rid) : undefined;
        if (resource === undefined) {
            throw new TypeError('Unknown menu resource.');
        }
        switch (command) {
            case 'plugin:menu|set_text': {
                const text = payload['text'];
                if (typeof text !== 'string') {
                    throw new TypeError('Invalid menu text.');
                }
                resource.text = text;
                return null;
            }
            case 'plugin:menu|text':
                return resource.text;
            case 'plugin:menu|set_enabled': {
                const enabled = payload['enabled'];
                if (typeof enabled !== 'boolean') {
                    throw new TypeError('Invalid menu state.');
                }
                resource.enabled = enabled;
                return null;
            }
            case 'plugin:menu|is_enabled':
                return resource.enabled;
            default:
                throw new TypeError(`Unexpected menu command: ${command}`);
        }
    });
    mockIPC(ipc);
    mockWindows('main');
    return {
        ipc,
        resources,
    };
}

afterEach(() => {
    clearMocks();
    vi.unstubAllGlobals();
});

describe('native menu language changes', () => {
    it.each(['Linux', 'Macintosh', 'Windows'])(
        'recreates menu with localized labels on %s and preserves shortcuts and actions',
        async (platform) => {
            vi.stubGlobal('navigator', { userAgent: platform });
            const { ipc, resources } = nativeMenuFixture();
            const hostMenu = await Submenu.new({ text: 'Host tools', items: [] });
            const commandItems = new Map<ApplicationCommand, MenuItem>();
            const execute = vi.fn<(command: ApplicationCommand) => void>();
            const menu = await createApplicationMenu(execute, commandItems, 'en', {
                additionalMenus: [hostMenu],
                applicationName: 'Private Host',
                commandLabels: { 'application.about': 'About Private Host' },
            });

            const initialOpen = commandItems.get('file.open');
            expect(initialOpen).toBeDefined();
            expect(await initialOpen?.text()).toBe('Open file…');

            const isMac = platform === 'Macintosh';
            const installCommand = isMac ? 'plugin:menu|set_as_app_menu' : 'plugin:menu|set_as_window_menu';

            expect(ipc.mock.calls.filter(([command]) => command === installCommand)).toHaveLength(1);

            for (const locale of ['de', 'fr', 'en']) {
                await menu.updateLocale(locale);
                const catalogue = resolveApplicationCatalogue(locale);

                const currentOpen = commandItems.get('file.open');
                expect(currentOpen).toBeDefined();
                expect(await currentOpen?.text()).toBe(catalogue['command.file.open']);

                const fileMenu = [...resources.values()].find(
                    (item) => item.kind === 'Submenu' && item.text === catalogue['menu.file'],
                );
                expect(fileMenu).toBeDefined();

                const editMenu = [...resources.values()].find(
                    (item) => item.kind === 'Submenu' && item.text === catalogue['menu.edit'],
                );
                expect(editMenu).toBeDefined();

                const undo = [...resources.values()].find(
                    (item) => item.options['item'] === 'Undo' && item.text === catalogue['command.edit.undo'],
                );
                expect(undo).toBeDefined();

                expect(await commandItems.get('application.about')?.text()).toBe('About Private Host');

                if (currentOpen !== undefined) {
                    const openResource = resources.get(currentOpen.rid);
                    const handler = openResource?.handler;
                    if (!(handler instanceof Channel)) {
                        throw new TypeError('Missing native menu action channel.');
                    }
                    handler.onmessage('file.open');
                }
            }

            expect(execute).toHaveBeenCalledTimes(3);
            expect(ipc.mock.calls.filter(([command]) => command === installCommand)).toHaveLength(4);
            expect(ipc.mock.calls.filter(([command]) => command === 'plugin:resources|close')).toHaveLength(3);
        },
    );
});
