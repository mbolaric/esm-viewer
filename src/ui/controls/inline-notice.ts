import type { IconName } from '../icon/icon-registry.js';

export interface IInlineNoticeAction {
    readonly ariaLabel?: string;
    readonly icon?: IconName;
    readonly iconOnly?: boolean;
    readonly label: string;
    readonly onclick: () => void;
}
