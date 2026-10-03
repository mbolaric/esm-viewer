import {
    DEFAULT_VIEWER_PREFERENCES,
    isNightWorkWindow,
    MAXIMUM_COLUMN_PREFERENCE_TABLES,
    MAXIMUM_PAGE_SIZE_PREFERENCE_TABLES,
    MAXIMUM_PINNED_COLUMNS_PER_TABLE,
    MAXIMUM_RECENT_FILES,
    type FileDisplayName,
    type IRecentFileEntry,
    type IViewerPreferences,
    type ReopenToken,
    type TablePageSize,
} from '#contracts';
import { SvelteSet } from 'svelte/reactivity';
import {
    isDateFormatKey,
    isDisplayTimeZone,
    isTimeFormatKey,
    resolveDateFormatKey,
    resolveTimeFormatKey,
    type DateFormatKey,
    type IDateTimeFormatService,
    type IDisplayTimeZoneService,
    type ILocaleService,
    type TimeFormatKey,
} from '#localization';
import type { IViewerPreferencesStore, IViewerPreferencesTarget } from '#viewer-application';

import { isViewerLocale, type ViewerLocale } from '#i18n-locales';

export interface IViewerPreferencesSnapshot {
    readonly isOpen: boolean;
    readonly loadWarning: boolean;
    readonly preferences: IViewerPreferences;
    readonly saveError: boolean;
    readonly saving: boolean;
}

export interface IViewerPreferencesControllerDependencies {
    readonly initialPreferences: IViewerPreferences | null;
    readonly loadWarning: boolean;
    // Invoked after a successful save with the values in effect before and after the change.
    readonly onapplied?: (previous: IViewerPreferences, next: IViewerPreferences) => void;
    readonly store: IViewerPreferencesStore;
    readonly target: IViewerPreferencesTarget;
}

function supportedPreferences(preferences: IViewerPreferences): IViewerPreferences | null {
    if (
        !isViewerLocale(preferences.locale) ||
        !isDisplayTimeZone(preferences.displayTimeZone) ||
        !isDateFormatKey(preferences.displayDateFormat) ||
        !isTimeFormatKey(preferences.displayTimeFormat) ||
        !isDisplayTimeZone(preferences.nightWorkTimeZone) ||
        !isNightWorkWindow(preferences.nightWorkStartHour, preferences.nightWorkEndHour)
    ) {
        return null;
    }

    return { ...preferences };
}

export class ViewerPreferencesController
    implements IDateTimeFormatService, IDisplayTimeZoneService, ILocaleService<ViewerLocale>
{
    private _disposed = false;
    private readonly _onapplied: ((previous: IViewerPreferences, next: IViewerPreferences) => void) | undefined;
    private readonly _store: IViewerPreferencesStore;
    private readonly _target: IViewerPreferencesTarget;
    #_isOpen = $state(false);
    #_loadWarning = $state(false);
    #_preferences = $state<IViewerPreferences>(DEFAULT_VIEWER_PREFERENCES);
    #_saveError = $state(false);
    #_saving = $state(false);

    public constructor(dependencies: IViewerPreferencesControllerDependencies) {
        this._onapplied = dependencies.onapplied;
        this._store = dependencies.store;
        this._target = dependencies.target;

        const initialPreferences =
            dependencies.initialPreferences === null ? null : supportedPreferences(dependencies.initialPreferences);
        const preferences = initialPreferences ?? DEFAULT_VIEWER_PREFERENCES;
        const targetApplied = this.applyTarget(preferences);
        this.#_preferences = preferences;
        this.#_loadWarning = dependencies.loadWarning || initialPreferences === null || !targetApplied;
    }

    public get availableTimeZones(): readonly string[] {
        return this.availableNightWorkTimeZones;
    }

    public get availableNightWorkTimeZones(): readonly string[] {
        const timeZones = Intl.supportedValuesOf('timeZone');
        return timeZones.includes('UTC') ? timeZones : ['UTC', ...timeZones];
    }

    public get locale(): ViewerLocale {
        const locale = this.#_preferences.locale;
        return isViewerLocale(locale) ? locale : 'en';
    }

    public get dateFormat(): DateFormatKey {
        return resolveDateFormatKey(this.#_preferences.displayDateFormat);
    }

    public get timeFormat(): TimeFormatKey {
        return resolveTimeFormatKey(this.#_preferences.displayTimeFormat);
    }

    public get snapshot(): IViewerPreferencesSnapshot {
        return {
            isOpen: this.#_isOpen,
            loadWarning: this.#_loadWarning,
            preferences: this.#_preferences,
            saveError: this.#_saveError,
            saving: this.#_saving,
        };
    }

    public get timeZone(): string {
        return this.#_preferences.displayTimeZone;
    }

    public async apply(preferences: IViewerPreferences): Promise<boolean> {
        if (this._disposed || !this.#_isOpen || this.#_saving) {
            return false;
        }

        const supported = supportedPreferences(preferences);
        if (supported === null) {
            this.#_saveError = true;
            this.#_saving = false;
            return false;
        }

        const previous = this.#_preferences;
        this.#_saveError = false;
        this.#_saving = true;

        if (!this.applyTarget(supported)) {
            this.applyTarget(previous);
            this.#_saveError = true;
            this.#_saving = false;
            return false;
        }

        let saved: boolean;
        try {
            const result = await this._store.save(supported);
            saved = result.ok;
        } catch {
            saved = false;
        }

        if (!saved) {
            this.applyTarget(previous);
            this.#_saveError = true;
            this.#_saving = false;
            return false;
        }

        this.#_preferences = supported;
        this.#_isOpen = false;
        this.#_loadWarning = false;
        this.#_saveError = false;
        this.#_saving = false;
        this._onapplied?.(previous, supported);
        return true;
    }

    public cancel(): boolean {
        if (this._disposed || !this.#_isOpen || this.#_saving) {
            return false;
        }

        this.#_isOpen = false;
        this.#_saveError = false;
        this.#_saving = false;
        return true;
    }

    public dispose(): void {
        if (this._disposed) {
            return;
        }

        this._disposed = true;
        try {
            this._target.dispose();
        } catch {
            // Disposal is best effort because preference cleanup must not break application teardown.
        }
    }

    public open(): boolean {
        if (this._disposed || this.#_isOpen) {
            return false;
        }

        this.#_isOpen = true;
        this.#_saveError = false;
        this.#_saving = false;
        return true;
    }

    // Records an opened file in recent files if enabled and not disposed.
    public recordRecentFile(entry: {
        readonly displayName: FileDisplayName;
        readonly openedAtEpochMs: number;
        readonly reopenToken: ReopenToken;
    }): void {
        if (this._disposed || !this.#_preferences.recentFilesEnabled) {
            return;
        }

        const recorded: IRecentFileEntry = {
            displayName: entry.displayName,
            openedAtEpochMs: entry.openedAtEpochMs,
            reopenToken: entry.reopenToken,
        };
        const deduped = this.#_preferences.recentFiles.filter((existing) => existing.reopenToken !== recorded.reopenToken);
        const updated: IViewerPreferences = {
            ...this.#_preferences,
            recentFiles: [recorded, ...deduped].slice(0, MAXIMUM_RECENT_FILES),
        };
        this.#_preferences = updated;
        void this._store.save(updated);
    }

    public clearRecentFiles(): void {
        if (this._disposed || this.#_preferences.recentFiles.length === 0) {
            return;
        }

        const updated: IViewerPreferences = { ...this.#_preferences, recentFiles: [] };
        this.#_preferences = updated;
        void this._store.save(updated);
    }

    // Returns persisted pinned column IDs for a table preference key.
    public getPinnedColumnIds(preferenceKey: string): ReadonlySet<string> {
        return new SvelteSet(this.#_preferences.pinnedTableColumnIds[preferenceKey] ?? []);
    }

    public setPinnedColumnIds(preferenceKey: string, pinnedColumnIds: ReadonlySet<string>): void {
        if (this._disposed) {
            return;
        }

        const nextTablePreference = [...pinnedColumnIds].slice(0, MAXIMUM_PINNED_COLUMNS_PER_TABLE);
        const withoutThisTable = Object.fromEntries(
            Object.entries(this.#_preferences.pinnedTableColumnIds).filter(([key]) => key !== preferenceKey),
        );
        const nextEntries = [
            ...Object.entries(withoutThisTable).slice(0, MAXIMUM_COLUMN_PREFERENCE_TABLES - 1),
            [preferenceKey, nextTablePreference] as const,
        ];
        const updated: IViewerPreferences = {
            ...this.#_preferences,
            pinnedTableColumnIds: Object.fromEntries(nextEntries),
        };
        this.#_preferences = updated;
        void this._store.save(updated);
    }

    public getPageSize(preferenceKey: string): TablePageSize {
        return this.#_preferences.tablePageSizes[preferenceKey] ?? 50;
    }

    public setPageSize(preferenceKey: string, pageSize: TablePageSize): void {
        if (this._disposed) {
            return;
        }

        const withoutThisTable = Object.fromEntries(
            Object.entries(this.#_preferences.tablePageSizes).filter(([key]) => key !== preferenceKey),
        );
        const nextEntries = [
            ...Object.entries(withoutThisTable).slice(0, MAXIMUM_PAGE_SIZE_PREFERENCE_TABLES - 1),
            [preferenceKey, pageSize] as const,
        ];
        const updated: IViewerPreferences = {
            ...this.#_preferences,
            tablePageSizes: Object.fromEntries(nextEntries),
        };
        this.#_preferences = updated;
        void this._store.save(updated);
    }

    private applyTarget(preferences: IViewerPreferences): boolean {
        try {
            return this._target.apply(preferences);
        } catch {
            return false;
        }
    }
}
