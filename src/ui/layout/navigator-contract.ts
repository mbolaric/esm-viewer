import type { IconName } from '../icon/icon-registry.js';

export interface INavigatorItem {
    readonly badgeCount: number | null;
    readonly badgeVariant: 'danger' | 'warning' | null;
    readonly disabled?: boolean | undefined;
    readonly icon: IconName;
    readonly label: string;
    readonly loading?: boolean | undefined;
    readonly onselect: () => void;
    readonly selected: boolean;
}

export interface INavigatorGroup {
    readonly heading: string;
    readonly items: readonly INavigatorItem[];
}
