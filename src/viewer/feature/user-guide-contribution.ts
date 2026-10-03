import type { IApplicationDialogContribution, IApplicationGuideContribution, IApplicationPreferencesContribution } from '#shell';

export type ViewerGuideTabId =
    'gettingStarted' | 'features' | 'generations' | 'timeBases' | 'integrity' | 'regulations' | 'shortcuts';
export type ViewerPreferencesTabId = 'general' | 'dateTime' | 'nightWork' | 'filesPrivacy' | 'appearance';

export type IViewerDialogContribution = IApplicationDialogContribution;
export type IUserGuideContribution = IApplicationGuideContribution<ViewerGuideTabId>;
export type IViewerPreferencesContribution = IApplicationPreferencesContribution<ViewerPreferencesTabId>;
