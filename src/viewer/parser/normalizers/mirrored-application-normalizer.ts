import type { IDriverCardApplication } from '#viewer-application';
import {
    activityDayEvidenceKey,
    createTachographWarning,
    eventFaultEvidenceKey,
    eventFaultIdentityKey,
    type IActivityDay,
    type ISourceReference,
    type CardGeneration,
    type ITachographWarning,
    type TachographEventFault,
} from '#viewer-domain';

type DriverCardApplication = IDriverCardApplication;

// One application per generation reaches this point, so the rank only orders g1 < g2 < g2v2.
const generationRanks: Readonly<Record<CardGeneration, number>> = {
    combined: 0,
    g1: 1,
    g2: 2,
    g2v2: 3,
};

// A combined Gen1/Gen2 card records the same facts in both applications. Reporting a proven mirror once is right, but
// it may only happen for evidence that is actually the same: where the two applications disagree, either copy may hold
// the only account of a fact, so the reader gets a warning instead of a silent choice.
export function reconcileMirroredApplications(applications: readonly DriverCardApplication[]): readonly DriverCardApplication[] {
    if (applications.length < 2) {
        return applications;
    }

    const ordered = [...applications].sort((left, right) => generationRanks[left.generation] - generationRanks[right.generation]);
    const lower = ordered[0];
    const higher = ordered.at(-1);
    if (lower === undefined || higher === undefined || lower === higher) {
        return applications;
    }

    const warnings: ITachographWarning[] = [
        ...mirroredDayWarnings(lower.activityDays, higher.activityDays),
        ...mirroredEventFaultWarnings([...lower.events, ...lower.faults], [...higher.events, ...higher.faults]),
    ];
    if (warnings.length === 0) {
        return applications;
    }

    return applications.map((application) =>
        application === higher ? { ...application, warnings: [...application.warnings, ...warnings] } : application,
    );
}

function firstSource(day: IActivityDay): ISourceReference | null {
    for (const interval of day.intervals) {
        if (interval.source !== null) {
            return interval.source;
        }
    }
    return null;
}

function mirroredDayWarnings(
    lowerDays: readonly IActivityDay[],
    higherDays: readonly IActivityDay[],
): readonly ITachographWarning[] {
    const warnings: ITachographWarning[] = [];
    const higherByMidnight = new Map(higherDays.map((day) => [day.midnightUtc, day]));

    for (const lowerDay of lowerDays) {
        const higherDay = higherByMidnight.get(lowerDay.midnightUtc);
        if (higherDay === undefined) {
            // Evidence the newer application no longer holds is not a duplicate; it simply stays visible.
            continue;
        }
        if (activityDayEvidenceKey(lowerDay) === activityDayEvidenceKey(higherDay)) {
            const source = firstSource(lowerDay);
            if (source !== null) {
                warnings.push(createTachographWarning('duplicateEvidence', source));
            }
            continue;
        }
        const source = firstSource(higherDay) ?? firstSource(lowerDay);
        if (source !== null) {
            warnings.push(createTachographWarning('inconsistentData', source));
        }
    }

    return warnings;
}

function mirroredEventFaultWarnings(
    lowerRecords: readonly TachographEventFault[],
    higherRecords: readonly TachographEventFault[],
): readonly ITachographWarning[] {
    const warnings: ITachographWarning[] = [];
    const higherByIdentity = new Map(higherRecords.map((record) => [eventFaultIdentityKey(record), record]));

    for (const lowerRecord of lowerRecords) {
        const higherRecord = higherByIdentity.get(eventFaultIdentityKey(lowerRecord));
        if (higherRecord === undefined) {
            continue;
        }
        if (eventFaultEvidenceKey(lowerRecord) === eventFaultEvidenceKey(higherRecord)) {
            warnings.push(createTachographWarning('duplicateEvidence', lowerRecord.source));
            continue;
        }
        warnings.push(createTachographWarning('inconsistentData', higherRecord.source));
    }

    return warnings;
}
