import type { UtcTimestamp } from '#viewer-domain';

export interface IActivityDayLinkProps {
    readonly activityDayLabel: string | null;
    readonly activityDayMidnight: UtcTimestamp | null;
    readonly onclearactivityday: () => void;
    readonly onreturnactivityday?: (() => void) | undefined;
}
