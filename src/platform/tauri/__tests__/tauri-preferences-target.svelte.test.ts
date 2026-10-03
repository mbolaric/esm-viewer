import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_VIEWER_PREFERENCES, ERROR_CODES, type IErrorEvent, type IViewerPreferences } from '#contracts';
import type { IErrorService } from '#error-reporting';

import { TauriPreferencesTarget } from '../tauri-preferences-target.js';

function createMediaQueryList(matches: boolean): MediaQueryList {
    return {
        addEventListener: () => undefined,
        addListener: () => undefined,
        dispatchEvent: () => false,
        matches,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        removeEventListener: () => undefined,
        removeListener: () => undefined,
    };
}

describe('TauriPreferencesTarget', () => {
    it('synchronizes the native GTK theme while applying the web theme', async () => {
        const root = document.documentElement;
        const onLocaleChange = vi.fn();
        const report = vi.fn<(event: IErrorEvent, detail?: unknown) => Promise<void>>().mockResolvedValue(undefined);
        const errorService: IErrorService = { report };
        const setNativeTheme = vi.fn<(theme: 'dark' | 'light' | null) => Promise<void>>().mockResolvedValue(undefined);
        const target = new TauriPreferencesTarget({ errorService, onLocaleChange, setNativeTheme });

        // Precondition: simulate an inline color-scheme previously set on root
        root.style.colorScheme = 'light';

        const darkPreferences: IViewerPreferences = {
            ...DEFAULT_VIEWER_PREFERENCES,
            theme: 'dark',
        };

        const darkApplied = target.apply(darkPreferences);
        expect(darkApplied).toBe(true);
        expect(root.getAttribute('data-theme')).toBe('dark');
        expect(root.style.colorScheme).toBe('');
        await vi.waitFor(() => {
            expect(setNativeTheme).toHaveBeenLastCalledWith('dark');
        });

        const lightPreferences: IViewerPreferences = {
            ...DEFAULT_VIEWER_PREFERENCES,
            theme: 'light',
        };

        const lightApplied = target.apply(lightPreferences);
        expect(lightApplied).toBe(true);
        expect(root.getAttribute('data-theme')).toBe('light');
        expect(root.style.colorScheme).toBe('');
        await vi.waitFor(() => {
            expect(setNativeTheme).toHaveBeenLastCalledWith('light');
        });
        expect(report).not.toHaveBeenCalled();

        target.dispose();
    });

    it('restores the native system theme for the system preference', async () => {
        vi.stubGlobal('matchMedia', () => createMediaQueryList(false));
        const report = vi.fn<(event: IErrorEvent, detail?: unknown) => Promise<void>>().mockResolvedValue(undefined);
        const setNativeTheme = vi.fn<(theme: 'dark' | 'light' | null) => Promise<void>>().mockResolvedValue(undefined);
        const target = new TauriPreferencesTarget({ errorService: { report }, setNativeTheme });

        try {
            expect(target.apply(DEFAULT_VIEWER_PREFERENCES)).toBe(true);
            await vi.waitFor(() => {
                expect(setNativeTheme).toHaveBeenCalledWith(null);
            });
        } finally {
            target.dispose();
            vi.unstubAllGlobals();
        }
    });

    it('reports a native theme synchronization failure without preventing web preferences from applying', async () => {
        const report = vi.fn<(event: IErrorEvent, detail?: unknown) => Promise<void>>().mockResolvedValue(undefined);
        const nativeFailure = new Error('native theme unavailable');
        const setNativeTheme = vi.fn<(theme: 'dark' | 'light' | null) => Promise<void>>().mockRejectedValue(nativeFailure);
        const target = new TauriPreferencesTarget({ errorService: { report }, setNativeTheme });

        expect(target.apply({ ...DEFAULT_VIEWER_PREFERENCES, theme: 'dark' })).toBe(true);
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        await vi.waitFor(() => {
            expect(report).toHaveBeenCalledWith(
                { code: ERROR_CODES.nativeThemeSyncFailed, severity: 'warning', source: 'desktop' },
                nativeFailure,
            );
        });

        target.dispose();
    });
});
