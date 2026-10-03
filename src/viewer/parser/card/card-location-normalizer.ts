import { type ITachographWarning, type TachographGeneration, type TachographLocationRecord } from '#viewer-domain';

import {
    appendNormalizedLocation,
    type INormalizedLocationValue,
    normalizeAccumulatedDrivingPositionRecord,
    normalizeBorderCrossingRecord,
    normalizeDailyWorkPeriodPlaceRecord,
    normalizeLoadTypeEntryRecord,
    normalizeLoadUnloadRecord,
} from '../normalizers/location-value-normalizer.js';
import { createNormalizationSourceContext } from '../normalization-source.js';
import type { ParserDriverCardApplication } from '../decoders/parser-result-types.js';
import type { ParserNationAlphaCodes } from '../normalizers/parser-value-normalizer.js';

export interface INormalizedCardLocations {
    readonly locations: readonly TachographLocationRecord[];
    readonly warnings: readonly ITachographWarning[];
}

const maximumLocationRecords = 4_096;
const { source, warning } = createNormalizationSourceContext('driverCard');

interface ICyclicSection<TRaw> {
    readonly newestRecordPointer: number;
    readonly records: readonly TRaw[];
}

// A cyclic card section. Absent or null means the card holds no such data. A Gen2-only section on a Gen1 card, a
// non-integer newest-record pointer or too many records make the whole section invalid; otherwise every record is
// normalized at its own path.
function normalizeCyclicSection<TRaw, TLocation extends TachographLocationRecord>(
    section: ICyclicSection<TRaw> | null,
    generation: TachographGeneration,
    rootPath: readonly (number | string)[],
    recordsKey: string,
    gen2Only: boolean,
    normalizeRecord: (record: TRaw, recordPath: readonly (number | string)[]) => INormalizedLocationValue<TLocation>,
): INormalizedCardLocations {
    if (section === null) {
        return { locations: [], warnings: [] };
    }
    if (
        (gen2Only && generation === 'g1') ||
        !Number.isInteger(section.newestRecordPointer) ||
        section.records.length > maximumLocationRecords
    ) {
        return { locations: [], warnings: [warning('invalidValue', generation, rootPath)] };
    }

    const locations: TLocation[] = [];
    const warnings: ITachographWarning[] = [];
    for (const [index, record] of section.records.entries()) {
        appendNormalizedLocation(normalizeRecord(record, [...rootPath, recordsKey, index]), locations, warnings);
    }
    return { locations, warnings };
}

export function normalizeCardLocations(
    application: ParserDriverCardApplication,
    generation: TachographGeneration,
    pathTokens: readonly string[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedCardLocations {
    // The fields every record normalizer takes; each section adds its own.
    const context = (recordPath: readonly (number | string)[]): Parameters<typeof normalizeLoadTypeEntryRecord>[1] => ({
        generation,
        pathTokens: recordPath,
        source: source(generation, recordPath),
        warning,
    });
    const places = application.places;
    const gnssPlaces = 'gnssPlaces' in application ? application.gnssPlaces : null;
    const borderCrossings = 'borderCrossings' in application ? application.borderCrossings : null;
    const loadUnloadOperations = 'loadUnloadOperations' in application ? application.loadUnloadOperations : null;
    const loadTypeEntries = 'loadTypeEntries' in application ? application.loadTypeEntries : null;

    const sections = [
        normalizeCyclicSection(
            places && { newestRecordPointer: places.placePointerNewestRecord, records: places.placeRecords },
            generation,
            [...pathTokens, 'places'],
            'placeRecords',
            false,
            (record, recordPath) =>
                normalizeDailyWorkPeriodPlaceRecord(record, {
                    ...context(recordPath),
                    card: null,
                    nationAlphaCodes,
                    positionShape: generation === 'g1' ? 'none' : 'optional',
                }),
        ),
        normalizeCyclicSection(
            gnssPlaces && {
                newestRecordPointer: gnssPlaces.gnssADPointerNewestRecord,
                records: gnssPlaces.gnssAccumulatedDrivingRecords,
            },
            generation,
            [...pathTokens, 'gnssPlaces'],
            'gnssAccumulatedDrivingRecords',
            true,
            (record, recordPath) =>
                normalizeAccumulatedDrivingPositionRecord(record, {
                    ...context(recordPath),
                    coDriverCard: null,
                    driverCard: null,
                }),
        ),
        normalizeCyclicSection(
            borderCrossings && {
                newestRecordPointer: borderCrossings.borderCrossingPointerNewestRecord,
                records: borderCrossings.cardBorderCrossingRecords,
            },
            generation,
            [...pathTokens, 'borderCrossings'],
            'cardBorderCrossingRecords',
            true,
            (record, recordPath) => normalizeBorderCrossingRecord(record, { ...context(recordPath), nationAlphaCodes }),
        ),
        normalizeCyclicSection(
            loadUnloadOperations && {
                newestRecordPointer: loadUnloadOperations.loadUnloadPointerNewestRecord,
                records: loadUnloadOperations.cardLoadUnloadRecords,
            },
            generation,
            [...pathTokens, 'loadUnloadOperations'],
            'cardLoadUnloadRecords',
            true,
            (record, recordPath) => normalizeLoadUnloadRecord(record, { ...context(recordPath), nationAlphaCodes }),
        ),
        normalizeCyclicSection(
            loadTypeEntries && {
                newestRecordPointer: loadTypeEntries.loadTypeEntryPointerNewestRecord,
                records: loadTypeEntries.cardLoadTypeEntryRecords,
            },
            generation,
            [...pathTokens, 'loadTypeEntries'],
            'cardLoadTypeEntryRecords',
            true,
            (record, recordPath) => normalizeLoadTypeEntryRecord(record, context(recordPath)),
        ),
    ];

    return {
        locations: sections.flatMap((section) => section.locations),
        warnings: sections.flatMap((section) => section.warnings),
    };
}
