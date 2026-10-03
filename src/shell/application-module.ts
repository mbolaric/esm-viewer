import type { IconName } from '#ui';
import type { Snippet } from 'svelte';

export interface IApplicationFailureLabels {
    readonly heading: string;
    readonly description: string;
    readonly retry: string;
}

export interface IApplicationDialogContribution {
    readonly content: Snippet;
    readonly icon: IconName;
    readonly id: string;
    readonly label: string;
}

export interface IApplicationGuideContribution<TTabId extends string> extends IApplicationDialogContribution {
    readonly beforeTab?: TTabId;
}

export interface IApplicationPreferencesContribution<TTabId extends string> extends IApplicationDialogContribution {
    readonly targetTab?: TTabId;
    readonly canApply?: () => boolean;
    readonly onapply: () => boolean;
    readonly oncancel: () => void;
}

export interface ICommandPaletteDestination {
    readonly icon: IconName;
    readonly id: string;
    readonly label: string;
    readonly onselect: () => void;
}

export interface IApplicationCommand<TCommandId extends string = string> {
    readonly id: TCommandId;
    readonly label: string;
    readonly icon?: IconName;
    readonly accelerator?: string;
    readonly enabled: boolean;
    readonly onexecute: () => void;
}

export type ApplicationMenuItem<TCommandId extends string> = TCommandId | 'separator';

export interface IApplicationContributions<TGuideTabId extends string, TPreferencesTabId extends string> {
    readonly guide: readonly IApplicationGuideContribution<TGuideTabId>[];
    readonly preferences: readonly IApplicationPreferencesContribution<TPreferencesTabId>[];
    readonly destinations: readonly ICommandPaletteDestination[];
    readonly commands: readonly IApplicationCommand[];
}

export interface IWorkspaceItem<TWorkspaceId extends string> {
    readonly icon: IconName;
    readonly id: TWorkspaceId;
    readonly label: string;
}

export interface IApplicationModule<
    TWorkspaceId extends string,
    TGuideTabId extends string,
    TPreferencesTabId extends string,
> extends IWorkspaceItem<TWorkspaceId> {
    readonly workspace: Snippet<[boolean, TWorkspaceId]>;
    readonly status?: Snippet<[TWorkspaceId]>;
    readonly overlays?: Snippet;
    readonly guide?: readonly IApplicationGuideContribution<TGuideTabId>[];
    readonly preferences?: readonly IApplicationPreferencesContribution<TPreferencesTabId>[];
    readonly destinations?: readonly ICommandPaletteDestination[];
    readonly commands?: readonly IApplicationCommand[];
}

export function collectApplicationContributions<
    TWorkspaceId extends string,
    TGuideTabId extends string,
    TPreferencesTabId extends string,
>(
    modules: readonly IApplicationModule<TWorkspaceId, TGuideTabId, TPreferencesTabId>[],
): IApplicationContributions<TGuideTabId, TPreferencesTabId> {
    const contributions = {
        guide: modules.flatMap((module) => module.guide ?? []),
        preferences: modules.flatMap((module) => module.preferences ?? []),
        destinations: modules.flatMap((module) => module.destinations ?? []),
        commands: modules.flatMap((module) => module.commands ?? []),
    };
    requireUniqueIds(modules);
    requireUniqueIds(contributions.guide);
    requireUniqueIds(contributions.preferences);
    requireUniqueIds(contributions.destinations);
    requireUniqueIds(contributions.commands);
    return contributions;
}

function requireUniqueIds(items: readonly { readonly id: string }[]): void {
    const ids = new Set<string>();
    for (const item of items) {
        if (ids.has(item.id)) {
            throw new TypeError('Application contributions must have unique IDs within each surface.');
        }
        ids.add(item.id);
    }
}
