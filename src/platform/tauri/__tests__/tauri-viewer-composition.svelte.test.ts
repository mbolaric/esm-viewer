import { MenuItem } from '@tauri-apps/api/menu';
import { clearMocks, mockIPC } from '@tauri-apps/api/mocks';
import { afterEach, describe, expect, it, vi, type Mock, type MockInstance } from 'vitest';

import {
    createMemoryKeyValueStore,
    DEFAULT_VIEWER_PREFERENCES,
    err,
    type IErrorEvent,
    type IViewerPreferences,
} from '#contracts';
import { createTauriViewerContext, TauriPlatformService, type createApplicationMenu } from '#tauri-platform';

vi.mock('@tauri-apps/api/window', () => ({
    getCurrentWindow: () => ({ setTheme: () => Promise.resolve() }),
}));

afterEach(() => {
    clearMocks();
    vi.restoreAllMocks();
});

interface INativeCommandStateFixture {
    readonly closeEnabled: MockInstance<MenuItem['setEnabled']>;
    readonly createContext: () => ReturnType<typeof createTauriViewerContext>;
    readonly openEnabled: MockInstance<MenuItem['setEnabled']>;
    readonly report: Mock<(event: IErrorEvent, detail?: unknown) => Promise<void>>;
}

async function nativeCommandStateFixture(): Promise<INativeCommandStateFixture> {
    let nextRid = 1;
    mockIPC((command) => {
        if (command !== 'plugin:menu|new') {
            throw new TypeError('Unexpected native menu command.');
        }
        const rid = nextRid++;
        return [rid, `menu-${String(rid)}`];
    });
    const openItem = await MenuItem.new({ text: 'Open' });
    const closeItem = await MenuItem.new({ text: 'Close' });
    const openEnabled = vi.spyOn(openItem, 'setEnabled').mockResolvedValue(undefined);
    const closeEnabled = vi.spyOn(closeItem, 'setEnabled').mockResolvedValue(undefined);
    const installMenu = vi.fn<typeof createApplicationMenu>().mockImplementation((_execute, items) => {
        items.set('file.open', openItem);
        items.set('file.close', closeItem);
        return Promise.resolve({ updateLocale: () => Promise.resolve() });
    });
    const report = vi.fn<(event: IErrorEvent, detail?: unknown) => Promise<void>>().mockResolvedValue(undefined);
    return {
        closeEnabled,
        createContext: () =>
            createTauriViewerContext(new TauriPlatformService(createMemoryKeyValueStore()), {
                errorService: { report },
                installMenu,
                preferencesTarget: { apply: () => true, dispose: () => undefined },
            }),
        openEnabled,
        report,
    };
}

describe('native menu command-state synchronization', () => {
    it('publishes command states, skips unchanged states, and updates modal availability without reporting errors', async () => {
        const { closeEnabled, createContext, openEnabled, report } = await nativeCommandStateFixture();
        const context = await createContext();
        try {
            expect(openEnabled).toHaveBeenCalledExactlyOnceWith(true);
            expect(closeEnabled).toHaveBeenCalledExactlyOnceWith(false);
            expect(context.commandController.synchronize()).toBe(true);
            expect(openEnabled).toHaveBeenCalledOnce();
            expect(closeEnabled).toHaveBeenCalledOnce();

            expect(context.preferencesController.open()).toBe(true);
            expect(context.commandController.synchronize()).toBe(true);
            expect(openEnabled.mock.calls).toEqual([[true], [false]]);
            expect(closeEnabled.mock.calls).toEqual([[false], [false]]);
            expect(report).not.toHaveBeenCalled();
        } finally {
            context.preferencesController.dispose();
            await context.documentController.dispose();
        }
    });

    it.each(['open', 'close'] as const)(
        'reports a delayed %s-menu rejection without exposing raw error details or blocking later updates',
        async (failedItem) => {
            const { closeEnabled, createContext, openEnabled, report } = await nativeCommandStateFixture();
            const pending = Promise.withResolvers<undefined>();
            (failedItem === 'open' ? openEnabled : closeEnabled).mockReturnValueOnce(pending.promise);
            const context = await createContext();
            try {
                expect(openEnabled).toHaveBeenCalledExactlyOnceWith(true);
                expect(closeEnabled).toHaveBeenCalledExactlyOnceWith(false);
                expect(report).not.toHaveBeenCalled();
                pending.reject(new Error('Synthetic native failure at /private/example.ddd'));
                await vi.waitFor(() => {
                    expect(report).toHaveBeenCalledExactlyOnceWith({
                        code: 'desktop.menu-state-sync-failed',
                        severity: 'error',
                        source: 'desktop',
                    });
                });

                expect(context.commandController.execute('application.preferences')).toBe(true);
                expect(context.commandController.synchronize()).toBe(true);
                expect(openEnabled.mock.calls).toEqual([[true], [false]]);
                expect(closeEnabled.mock.calls).toEqual([[false], [false]]);
                expect(context.preferencesController.cancel()).toBe(true);
                expect(context.commandController.synchronize()).toBe(true);
                expect(openEnabled.mock.calls).toEqual([[true], [false], [true]]);
                expect(report).toHaveBeenCalledOnce();
            } finally {
                context.preferencesController.dispose();
                await context.documentController.dispose();
            }
        },
    );

    it('reports each rejection when multiple menu items fail in the same update', async () => {
        const { closeEnabled, createContext, openEnabled, report } = await nativeCommandStateFixture();
        openEnabled.mockRejectedValueOnce(new Error('Synthetic open-menu failure'));
        closeEnabled.mockRejectedValueOnce(new Error('Synthetic close-menu failure'));
        const context = await createContext();
        try {
            await vi.waitFor(() => {
                expect(report.mock.calls).toEqual([
                    [{ code: 'desktop.menu-state-sync-failed', severity: 'error', source: 'desktop' }],
                    [{ code: 'desktop.menu-state-sync-failed', severity: 'error', source: 'desktop' }],
                ]);
            });
        } finally {
            context.preferencesController.dispose();
            await context.documentController.dispose();
        }
    });

    it('reports synchronous failures and preserves retry on the next synchronization', async () => {
        const { closeEnabled, createContext, openEnabled, report } = await nativeCommandStateFixture();
        const context = await createContext();
        try {
            openEnabled.mockImplementationOnce(() => {
                throw new Error('Synthetic synchronous failure at /private/example.ddd');
            });
            expect(context.preferencesController.open()).toBe(true);
            expect(context.commandController.synchronize()).toBe(false);
            expect(context.commandController.synchronize()).toBe(true);
            expect(openEnabled.mock.calls).toEqual([[true], [false], [false]]);
            expect(closeEnabled.mock.calls).toEqual([[false], [false]]);
            expect(report).toHaveBeenCalledExactlyOnceWith({
                code: 'desktop.menu-state-sync-failed',
                severity: 'error',
                source: 'desktop',
            });
        } finally {
            context.preferencesController.dispose();
            await context.documentController.dispose();
        }
    });
});

describe('native menu initialization', () => {
    it.each(['missing', 'corrupt', 'unavailable'] as const)(
        'starts with safe defaults and the correct load warning for %s preferences',
        async (storageState) => {
            const store = createMemoryKeyValueStore();
            if (storageState === 'corrupt') {
                store.setItem('esm_viewer_preferences', '{broken');
            } else if (storageState === 'unavailable') {
                store.readItem = () => err('ioFailure');
            }
            const installMenu = vi.fn<typeof createApplicationMenu>().mockResolvedValue({
                updateLocale: () => Promise.resolve(),
            });
            const report = vi.fn<(event: IErrorEvent) => Promise<void>>().mockResolvedValue(undefined);
            const context = await createTauriViewerContext(new TauriPlatformService(store), {
                errorService: { report },
                installMenu,
                preferencesTarget: { apply: () => true, dispose: () => undefined },
            });
            try {
                expect(context.preferencesController.snapshot).toMatchObject({
                    loadWarning: storageState !== 'missing',
                    preferences: DEFAULT_VIEWER_PREFERENCES,
                });
                expect(installMenu.mock.lastCall?.[2]).toBe('en');
                expect(context.preferencesController.open()).toBe(true);
            } finally {
                context.preferencesController.dispose();
                await context.documentController.dispose();
            }
        },
    );

    it('installs the saved language once and serializes label changes and failed-save rollbacks', async () => {
        const service = new TauriPlatformService();
        const initialPreferences: IViewerPreferences = {
            ...DEFAULT_VIEWER_PREFERENCES,
            locale: 'de',
            theme: 'dark',
        };
        vi.spyOn(service, 'loadPreferences').mockResolvedValue({ status: 'loaded', preferences: initialPreferences });
        const savePreferences = vi.spyOn(service, 'savePreferences').mockResolvedValue({ status: 'saved' });
        const updateLocale = vi.fn<(locale: string) => Promise<void>>().mockResolvedValue(undefined);
        const installMenu = vi.fn<typeof createApplicationMenu>().mockResolvedValue({ updateLocale });
        const report = vi.fn<(event: IErrorEvent, detail?: unknown) => Promise<void>>().mockResolvedValue(undefined);
        const context = await createTauriViewerContext(service, { errorService: { report }, installMenu });

        try {
            expect(installMenu).toHaveBeenCalledOnce();
            expect(updateLocale).not.toHaveBeenCalled();
            expect(installMenu.mock.lastCall?.[2]).toBe('de');
            expect(installMenu.mock.lastCall?.[3]?.errorService).toEqual({ report });

            const changedAppearance: IViewerPreferences = {
                ...initialPreferences,
                density: 'comfortable',
                theme: 'light',
            };
            context.preferencesController.open();
            await expect(context.preferencesController.apply(changedAppearance)).resolves.toBe(true);
            expect(installMenu).toHaveBeenCalledOnce();

            const changedLanguage: IViewerPreferences = { ...changedAppearance, locale: 'fr' };
            context.preferencesController.open();
            await expect(context.preferencesController.apply(changedLanguage)).resolves.toBe(true);
            await vi.waitFor(() => {
                expect(updateLocale).toHaveBeenCalledExactlyOnceWith('fr');
            });

            const pendingUpdate = Promise.withResolvers<undefined>();
            updateLocale.mockReturnValueOnce(pendingUpdate.promise);
            savePreferences.mockResolvedValueOnce({ status: 'failed', code: 'ioFailure' });
            context.preferencesController.open();
            await expect(context.preferencesController.apply({ ...changedLanguage, locale: 'en' })).resolves.toBe(false);
            await vi.waitFor(() => {
                expect(updateLocale.mock.calls.map((call) => call[0])).toEqual(['fr', 'en']);
            });
            pendingUpdate.resolve(undefined);
            await vi.waitFor(() => {
                expect(updateLocale.mock.calls.map((call) => call[0])).toEqual(['fr', 'en', 'fr']);
            });
            expect(installMenu).toHaveBeenCalledOnce();
            expect(report).not.toHaveBeenCalled();
        } finally {
            context.preferencesController.dispose();
            await context.documentController.dispose();
        }
    });
});
