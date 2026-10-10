import { describe, expect, it, vi } from 'vitest';

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
