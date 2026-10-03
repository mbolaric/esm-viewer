import { getCurrentWindow, type Theme } from '@tauri-apps/api/window';
import { ERROR_CODES, type IViewerPreferences } from '#contracts';
import type { IErrorService } from '#error-reporting';
import type { IViewerPreferencesTarget } from '#viewer-application';

type NativeTheme = Theme | null;

export interface ITauriPreferencesTargetOptions {
    readonly errorService: IErrorService;
    readonly onLocaleChange?: (locale: string) => void;
    readonly setNativeTheme?: (theme: NativeTheme) => Promise<void>;
}

function setCurrentWindowTheme(theme: NativeTheme): Promise<void> {
    return getCurrentWindow().setTheme(theme);
}

export class TauriPreferencesTarget implements IViewerPreferencesTarget {
    private _appliedLocale: string | null = null;
    private readonly _errorService: IErrorService;
    private _removeColorSchemeListener: (() => void) | null = null;
    private readonly _onLocaleChange: ((locale: string) => void) | undefined;
    private readonly _setNativeTheme: (theme: NativeTheme) => Promise<void>;

    public constructor(options: ITauriPreferencesTargetOptions) {
        this._errorService = options.errorService;
        this._onLocaleChange = options.onLocaleChange;
        this._setNativeTheme = options.setNativeTheme ?? setCurrentWindowTheme;
    }

    public apply(preferences: IViewerPreferences): boolean {
        this._removeColorSchemeListener?.();

        try {
            const root = document.documentElement;
            root.setAttribute('data-density', preferences.density);
            root.setAttribute('data-theme', this.resolveTheme(preferences.theme));
            root.setAttribute('lang', preferences.locale);
            root.setAttribute('data-preferences-ready', '');
            root.style.removeProperty('color-scheme');
            this.synchronizeNativeTheme(preferences.theme);

            if (preferences.theme === 'system') {
                const media = window.matchMedia('(prefers-color-scheme: dark)');
                const listener = (): void => {
                    root.setAttribute('data-theme', media.matches ? 'dark' : 'light');
                };
                media.addEventListener('change', listener);
                this._removeColorSchemeListener = () => {
                    media.removeEventListener('change', listener);
                };
            }

            // Composition installs the initial menu; preferences only update its labels for later language changes.
            if (this._appliedLocale !== null && this._appliedLocale !== preferences.locale) {
                this._onLocaleChange?.(preferences.locale);
            }
            this._appliedLocale = preferences.locale;
            return true;
        } catch {
            this._removeColorSchemeListener = null;
            return false;
        }
    }

    public dispose(): void {
        this._removeColorSchemeListener?.();
        this._removeColorSchemeListener = null;
    }

    private resolveTheme(theme: IViewerPreferences['theme']): 'dark' | 'light' {
        if (theme === 'dark' || theme === 'light') {
            return theme;
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    private synchronizeNativeTheme(theme: IViewerPreferences['theme']): void {
        const nativeTheme: NativeTheme = theme === 'system' ? null : theme;
        try {
            void this._setNativeTheme(nativeTheme).catch((error: unknown) => {
                void this._errorService.report(
                    { code: ERROR_CODES.nativeThemeSyncFailed, severity: 'warning', source: 'desktop' },
                    error,
                );
            });
        } catch (error) {
            void this._errorService.report(
                { code: ERROR_CODES.nativeThemeSyncFailed, severity: 'warning', source: 'desktop' },
                error,
            );
        }
    }
}
