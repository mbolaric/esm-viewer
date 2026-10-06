import { decodeFileMetadata } from '#contracts';
import { describe, expect, it } from 'vitest';

import {
    activityDayEvidenceKey,
    createRecordedActivityInterval,
    createSourceReference,
    eventFaultEvidenceKey,
    createTachographEvent,
    isJsonPointer,
    isUtcTimestamp,
    normalizeActivityDay,
    type IActivityDay,
    type ISourceReference,
    type ITachographEvent,
    type TachographGeneration,
    type UtcTimestamp,
} from '#viewer-domain';
import {
    createDocumentOverviewProjection,
    createDocumentSource,
    createOpenedTachographDocument,
    projectDocumentActivityDays,
    projectDocumentCanonicalActivityDays,
    projectDocumentCanonicalEventFaultRecords,
    projectDocumentEventFaultRecords,
    type IDriverCardApplication,
    type IParsedDriverCardDocument,
} from '../../application/index.js';

const dayMidnight = Date.UTC(2026, 0, 5);
const hour = 3_600_000;

function timestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The mirrored-evidence fixture timestamp must be valid.');
    }
    return value;
}

function source<TGeneration extends TachographGeneration>(
    generation: TGeneration,
    path: string,
): ISourceReference<TGeneration, 'driverCard'> {
    if (!isJsonPointer(path)) {
        throw new TypeError('The mirrored-evidence fixture pointer must be valid.');
    }
    return createSourceReference('driverCard', generation, path);
}

function day(generation: 'g1' | 'g2', drivingEndHour: number, path: string): IActivityDay {
    const crew = { crewPresence: 'single', slot: 'Driver' } as const;
    const intervals = [
        createRecordedActivityInterval(
            'driving',
            timestamp(dayMidnight),
            timestamp(dayMidnight + drivingEndHour * hour),
            source(generation, path),
            crew,
        ),
    ].filter((interval) => interval !== null);
    const normalized = normalizeActivityDay(intervals, timestamp(dayMidnight));
    if (normalized.status !== 'normalized') {
        throw new TypeError('The mirrored-evidence fixture day must normalize.');
    }
    return normalized.day;
}

function event(generation: 'g1' | 'g2', endHour: number | null, path: string): ITachographEvent {
    const created = createTachographEvent({
        code: 'cardConflict',
        end: endHour === null ? null : timestamp(dayMidnight + endHour * hour),
        recordKind: 'event',
        recordPurpose: null,
        registrationMemberState: null,
        registrationNumber: null,
        similarOccurrences: null,
        source: source(generation, path),
        start: timestamp(dayMidnight + hour),
    });
    if (created === null) {
        throw new TypeError('The mirrored-evidence fixture event must be valid.');
    }
    return created;
}

function application(
    generation: 'g1' | 'g2',
    activityDays: readonly IActivityDay[],
    events: readonly ITachographEvent[],
    warnings: IDriverCardApplication['warnings'] = [],
): IDriverCardApplication {
    return {
        activityDays,
        cardNotes: null,
        events,
        faults: [],
        generation,
        identity: null,
        locations: [],
        source: source(generation, `/cardDataResponses/${generation}`),
        technicalRecords: [],
        verification: { dataFiles: {}, dataFileSourcePaths: {}, generation },
        vehicleUses: [],
        vehicleUnitUses: [],
        warnings,
    };
}

function document(applications: readonly IDriverCardApplication[]): ReturnType<typeof createOpenedTachographDocument> {
    const metadata = decodeFileMetadata({ byteLength: 3, displayName: 'combined.ddd', sha256: 'e'.repeat(64) });
    if (!metadata.ok) {
        throw new TypeError('The mirrored-evidence fixture metadata must be valid.');
    }
    const content: IParsedDriverCardDocument = {
        applications,
        cardType: 'driverCard',
        documentKind: 'driverCard',
        generation: 'combined',
        parserVariant: 'cardGen2',
        rawTree: {},
        sections: [],
    };
    return createOpenedTachographDocument(createDocumentSource(metadata.value, timestamp(dayMidnight)), content);
}

function mirroredPair(): ReturnType<typeof document> {
    return document([application('g1', [day('g1', 4, '/g1/day')], []), application('g2', [day('g2', 4, '/g2/day')], [])]);
}

function conflictingPair(): ReturnType<typeof document> {
    return document([application('g1', [day('g1', 4, '/g1/day')], []), application('g2', [day('g2', 5, '/g2/day')], [])]);
}

function mirroredEventPair(): ReturnType<typeof document> {
    return document([application('g1', [], [event('g1', 3, '/g1/event')]), application('g2', [], [event('g2', 3, '/g2/event')])]);
}

function conflictingEventPair(): ReturnType<typeof document> {
    return document([application('g1', [], [event('g1', 3, '/g1/event')]), application('g2', [], [event('g2', 4, '/g2/event')])]);
}

describe('mirrored dual-generation evidence', () => {
    it('treats copies that record the same facts as mirrors and keeps copies that differ', () => {
        const mirrored = mirroredPair();
        const conflicting = conflictingPair();

        expect(projectDocumentActivityDays(mirrored)).toHaveLength(1);
        expect(projectDocumentActivityDays(mirrored)[0]?.generation).toBe('g2');
        // Differing evidence stays visible: either copy may hold the only account of that day.
        expect(projectDocumentActivityDays(conflicting)).toHaveLength(2);
        // Aggregates read one row per midnight either way.
        expect(projectDocumentCanonicalActivityDays(conflicting)).toHaveLength(1);
        expect(projectDocumentCanonicalActivityDays(conflicting)[0]?.generation).toBe('g2');
    });

    it('collapses mirrored events and keeps conflicting ones', () => {
        const mirrored = mirroredEventPair();
        const conflicting = conflictingEventPair();

        expect(projectDocumentEventFaultRecords(mirrored)).toHaveLength(1);
        expect(projectDocumentEventFaultRecords(mirrored)[0]?.source.generation).toBe('g2');
        expect(projectDocumentEventFaultRecords(conflicting)).toHaveLength(2);
        expect(projectDocumentCanonicalEventFaultRecords(conflicting)).toHaveLength(1);
    });

    it('counts and totals a mirrored generation once', () => {
        const mirrored = mirroredPair();
        const conflicting = conflictingPair();

        expect(createDocumentOverviewProjection(mirrored).counts).toMatchObject({
            activityDays: 1,
            recordedActivityIntervals: 1,
        });
        // One active day even when the two copies disagree, because the count describes the document.
        expect(createDocumentOverviewProjection(conflicting).counts).toMatchObject({
            activityDays: 1,
            recordedActivityIntervals: 1,
        });
    });

    it('keys days and events by their recorded facts rather than by their source', () => {
        expect(activityDayEvidenceKey(day('g1', 4, '/g1/day'))).toBe(activityDayEvidenceKey(day('g2', 4, '/g2/day')));
        expect(activityDayEvidenceKey(day('g1', 4, '/g1/day'))).not.toBe(activityDayEvidenceKey(day('g2', 5, '/g2/day')));
        expect(eventFaultEvidenceKey(event('g1', 3, '/g1/event'))).toBe(eventFaultEvidenceKey(event('g2', 3, '/g2/event')));
        expect(eventFaultEvidenceKey(event('g1', 3, '/g1/event'))).not.toBe(eventFaultEvidenceKey(event('g2', 4, '/g2/event')));
    });
});
