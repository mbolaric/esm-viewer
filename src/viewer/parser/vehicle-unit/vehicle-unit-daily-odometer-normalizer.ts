import {
    createVehicleUnitDailyOdometerTechnicalRecord,
    type ITachographWarning,
    type IVehicleUnitDailyOdometerTechnicalRecord,
    type TachographGeneration,
} from '#viewer-domain';

import type { OdometerShort, TimeReal } from '../generated/esm_parser.js';
import { createNormalizationSourceContext } from '../normalization-source.js';
import {
    isRecordedParserTimestamp,
    normalizeParserOdometerWithWarning,
    normalizeParserUtcTimestamp,
} from '../normalizers/parser-value-normalizer.js';
import { decodeVehicleUnitRecordArray } from './vehicle-unit-record-array.js';
import type { IVehicleUnitActivitySection } from './vehicle-unit-activity-normalizer.js';

export interface INormalizedVehicleUnitDailyOdometerRecords {
    readonly records: readonly IVehicleUnitDailyOdometerTechnicalRecord[];
    readonly warnings: readonly ITachographWarning[];
}

const { source, warning } = createNormalizationSourceContext('vehicleUnit');

// Normalizes VU midnight odometer readings (Annex 1B req. 084 / Annex 1C req. 105) for Gen1 and Gen2.
function normalizeSection(section: IVehicleUnitActivitySection): INormalizedVehicleUnitDailyOdometerRecords {
    const warnings: ITachographWarning[] = [];
    const generation: TachographGeneration = section.generation;

    let rawDay: TimeReal;
    let dayPathTokens: readonly (number | string)[];
    // Null means malformed wrapper, distinct from legitimately absent odometer value.
    let rawOdometer: OdometerShort;
    let odometerPathTokens: readonly (number | string)[];
    let odometerWrapperOk = true;

    if (section.generation === 'g1') {
        rawDay = section.activity.dateOfDayDownloaded;
        dayPathTokens = [...section.rootPath, 'dateOfDayDownloaded'];
        rawOdometer = section.activity.odometerValueMidnight;
        odometerPathTokens = [...section.rootPath, 'odometerValueMidnight'];
    } else {
        const dayArrayPathTokens = [...section.rootPath, 'dateOfDayDownloadedRecordArray'];
        const days = decodeVehicleUnitRecordArray(section.activity.dateOfDayDownloadedRecordArray, 1, 'DateOfDayDownloaded');
        if (days?.length !== 1) {
            return {
                records: [],
                warnings: [warning('inconsistentData', generation, dayArrayPathTokens)],
            };
        }
        rawDay = days[0] ?? null;
        dayPathTokens = [...dayArrayPathTokens, 'records', 0];

        const odometerArrayPathTokens = [...section.rootPath, 'odometerValueMidnightRecordArray'];
        const odometers = decodeVehicleUnitRecordArray(
            section.activity.odometerValueMidnightRecordArray,
            1,
            'OdometerValueMidnight',
        );
        if (odometers?.length !== 1) {
            warnings.push(warning('inconsistentData', generation, odometerArrayPathTokens));
            rawOdometer = null;
            odometerPathTokens = odometerArrayPathTokens;
            odometerWrapperOk = false;
        } else {
            rawOdometer = odometers[0] ?? null;
            odometerPathTokens = [...odometerArrayPathTokens, 'records', 0];
        }
    }

    const day = normalizeParserUtcTimestamp(rawDay);
    if (!isRecordedParserTimestamp(day)) {
        warnings.push(warning('invalidValue', generation, dayPathTokens));
        return { records: [], warnings };
    }

    const odometerKm = odometerWrapperOk
        ? normalizeParserOdometerWithWarning(rawOdometer, generation, odometerPathTokens, warnings, warning)
        : null;

    return {
        records: [
            createVehicleUnitDailyOdometerTechnicalRecord({
                day,
                odometerKm,
                source: source(generation, section.rootPath),
            }),
        ],
        warnings,
    };
}

export function normalizeVehicleUnitDailyOdometerRecords(
    activitySections: readonly IVehicleUnitActivitySection[],
): INormalizedVehicleUnitDailyOdometerRecords {
    const records: IVehicleUnitDailyOdometerTechnicalRecord[] = [];
    const warnings: ITachographWarning[] = [];
    for (const section of activitySections) {
        const normalized = normalizeSection(section);
        records.push(...normalized.records);
        warnings.push(...normalized.warnings);
    }

    return { records, warnings };
}
