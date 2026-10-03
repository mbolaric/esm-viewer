// Persists pinned table columns per table preference key without coupling UI to application preferences.
export interface IColumnPreferencesStore {
    getPinnedColumnIds(preferenceKey: string): ReadonlySet<string>;
    setPinnedColumnIds(preferenceKey: string, pinnedColumnIds: ReadonlySet<string>): void;
}
