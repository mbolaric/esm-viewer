import type { IInlineNoticeAction } from '#ui';
import type { UtcTimestamp } from '#viewer-domain';

export interface IActivityDayLinkProps {
    readonly activityDayLabel: string | null;
    readonly activityDayMidnight: UtcTimestamp | null;
    readonly onclearactivityday: () => void;
    readonly onreturnactivityday?: (() => void) | undefined;
}

export function createActivityDayBackAction(
    day: UtcTimestamp | null,
    onreturn: (() => void) | undefined,
    label: string,
): IInlineNoticeAction | undefined {
    return day === null || onreturn === undefined ? undefined : { label, onclick: onreturn };
}
