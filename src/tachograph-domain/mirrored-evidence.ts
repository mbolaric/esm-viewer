import type { ActivityInterval, IActivityDay } from './activity.js';
import type { TachographEventFault } from './event-fault.js';

// A Smart tachograph card carries the same records in its Gen1 and its Gen2 application, so a combined download can
// hold mirrored evidence. These keys describe the recorded facts without the source pointer or the generation, which
// is what makes two copies comparable at all: equal keys mean one fact recorded twice, different keys mean the two
// applications disagree and neither copy may be discarded silently.

function activityIntervalEvidence(interval: ActivityInterval): string {
    return [interval.activity, interval.origin, interval.start, interval.end, interval.crewPresence, interval.slot].join('|');
}

export function activityDayEvidenceKey(day: IActivityDay): string {
    return day.intervals.map(activityIntervalEvidence).join(';');
}

export function eventFaultEvidenceKey(record: TachographEventFault): string {
    return [
        record.recordKind,
        record.code,
        record.start,
        record.end ?? '',
        record.recordPurpose ?? '',
        record.registrationMemberState ?? '',
        record.registrationNumber ?? '',
        record.similarOccurrences ?? '',
    ].join('|');
}

// Pairs a record with its counterpart in the other application even when the two copies disagree, so a conflict can
// be told apart from a record that has no counterpart at all.
export function eventFaultIdentityKey(record: TachographEventFault): string {
    return [record.recordKind, record.code, record.start].join('|');
}
