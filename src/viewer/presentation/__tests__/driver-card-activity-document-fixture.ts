import { decodeFileMetadata } from '#contracts';
import {
    createDocumentSource,
    createOpenedTachographDocument,
    type IParsedDriverCardDocument,
    type OpenedTachographDocument,
} from '#viewer-application';
import {
    createSourceReference,
    isJsonPointer,
    isUtcTimestamp,
    normalizeActivityDay,
    type ActivityInterval,
    type IActivityDay,
    type UtcTimestamp,
} from '#viewer-domain';

interface IDriverCardActivityDayFixtureInput {
    readonly intervals: readonly ActivityInterval[];
    readonly midnight: number;
}

interface IDriverCardActivityDocumentFixtureOptions {
    readonly midnight: number;
    readonly intervals: readonly ActivityInterval[];
    readonly openedAt: UtcTimestamp;
    readonly displayName?: string;
    readonly sha256?: string;
}

interface IDriverCardActivityDocumentAcrossDaysFixtureOptions {
    readonly days: readonly IDriverCardActivityDayFixtureInput[];
    readonly openedAt: UtcTimestamp;
    readonly displayName?: string;
    readonly sha256?: string;
}

function normalizeFixtureDay(midnight: number, intervals: readonly ActivityInterval[]): IActivityDay {
    if (!isUtcTimestamp(midnight)) {
        throw new TypeError('The driver-card activity document fixture midnight must be valid.');
    }

    const normalized = normalizeActivityDay(intervals, midnight);
    if (normalized.status !== 'normalized') {
        throw new TypeError('The driver-card activity document fixture day must normalize.');
    }

    return normalized.day;
}

// Builds single-day Gen1 driver-card document fixture around normalized activity day.
export function createDriverCardActivityDocumentFixture(
    options: IDriverCardActivityDocumentFixtureOptions,
): OpenedTachographDocument {
    return createDriverCardActivityDocumentFixtureAcrossDays({
        days: [{ intervals: options.intervals, midnight: options.midnight }],
        openedAt: options.openedAt,
        ...(options.displayName !== undefined ? { displayName: options.displayName } : {}),
        ...(options.sha256 !== undefined ? { sha256: options.sha256 } : {}),
    });
}

// Builds multi-day Gen1 driver-card document fixture to test continuous-driving across midnight.
export function createDriverCardActivityDocumentFixtureAcrossDays(
    options: IDriverCardActivityDocumentAcrossDaysFixtureOptions,
): OpenedTachographDocument {
    const activityDays = options.days.map((day) => normalizeFixtureDay(day.midnight, day.intervals));

    const metadata = decodeFileMetadata({
        byteLength: 3,
        displayName: options.displayName ?? 'driver-card-activity.ddd',
        sha256: options.sha256 ?? 'a'.repeat(64),
    });
    if (!metadata.ok) {
        throw new TypeError('The driver-card activity document fixture metadata must be valid.');
    }

    const applicationSourcePath = '/cardDataResponses';
    if (!isJsonPointer(applicationSourcePath)) {
        throw new TypeError('The driver-card activity document fixture source path must be valid.');
    }

    const content: IParsedDriverCardDocument = {
        applications: [
            {
                activityDays,
                cardNotes: null,
                events: [],
                faults: [],
                generation: 'g1',
                identity: null,
                locations: [],
                source: createSourceReference('driverCard', 'g1', applicationSourcePath),
                technicalRecords: [],
                verification: {
                    dataFiles: {},
                    dataFileSourcePaths: {},
                    generation: 'g1',
                },
                vehicleUnitUses: [],
                vehicleUses: [],
                warnings: [],
            },
        ],
        cardType: 'driverCard',
        documentKind: 'driverCard',
        generation: 'g1',
        parserVariant: 'cardGen1',
        rawTree: {},
        sections: [],
    };

    return createOpenedTachographDocument(createDocumentSource(metadata.value, options.openedAt), content);
}
