import type { IViewerPreferences, Result } from '#contracts';

export type ViewerPreferencesLoadResult = Result<IViewerPreferences, 'preferencesLoadFailed'>;
export type ViewerPreferencesSaveResult = Result<null, 'preferencesSaveFailed'>;

export interface IViewerPreferencesStore {
    load(): Promise<ViewerPreferencesLoadResult>;
    save(preferences: IViewerPreferences): Promise<ViewerPreferencesSaveResult>;
}

export interface IViewerPreferencesTarget {
    apply(preferences: IViewerPreferences): boolean;
    dispose(): void;
}
