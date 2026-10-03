import type { DocumentWorkspaceSection } from '#viewer-application';
import { isUtcTimestamp, utcIntervalsOverlap, type UtcTimestamp } from '#viewer-domain';
import { MILLISECONDS_PER_DAY } from '#time';

import type { LocationRecordViewModel } from './location-view-model.js';
import type { AssociationRecordViewModel } from './association-view-model.js';
import type { IEventFaultRecordViewModel } from './event-fault-view-model.js';

export type ActivityLinkedSection = Extract<DocumentWorkspaceSection, 'associations' | 'eventsAndFaults' | 'places'>;

export function recordOverlapsActivityDay(start: UtcTimestamp, end: UtcTimestamp | null, dayStart: UtcTimestamp): boolean {
    const dayEndValue = dayStart + MILLISECONDS_PER_DAY;
    if (!isUtcTimestamp(dayEndValue)) {
        return false;
    }

    // A record without an end has no known end, so it stays linked to every later day rather than being hidden.
    return utcIntervalsOverlap({ end: end ?? Number.POSITIVE_INFINITY, start }, { end: dayEndValue, start: dayStart });
}

export function filterLocationsByActivityDay(
    records: readonly LocationRecordViewModel[],
    activityDayMidnight: UtcTimestamp | null,
): readonly LocationRecordViewModel[] {
    if (activityDayMidnight === null) {
        return records;
    }
    return records.filter((record) =>
        recordOverlapsActivityDay(record.timestamp.value, record.timestamp.value, activityDayMidnight),
    );
}

export function filterAssociationsByActivityDay(
    records: readonly AssociationRecordViewModel[],
    activityDayMidnight: UtcTimestamp | null,
): readonly AssociationRecordViewModel[] {
    if (activityDayMidnight === null) {
        return records;
    }
    return records.filter((record) =>
        recordOverlapsActivityDay(record.startTimestamp.value, record.endTimestamp?.value ?? null, activityDayMidnight),
    );
}

export function filterEventsFaultsByActivityDay(
    records: readonly IEventFaultRecordViewModel[],
    activityDayMidnight: UtcTimestamp | null,
): readonly IEventFaultRecordViewModel[] {
    if (activityDayMidnight === null) {
        return records;
    }
    return records.filter((record) =>
        recordOverlapsActivityDay(record.start.value, record.end?.value ?? null, activityDayMidnight),
    );
}
