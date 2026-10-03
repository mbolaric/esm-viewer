import { describe, expect, it } from 'vitest';

import {
    normalizeParserActivityKind,
    normalizeParserCalibrationPurpose,
    normalizeParserCardControlActivityType,
    normalizeParserDailyWorkPeriodEntryType,
    normalizeParserInsertedCardType,
    normalizeParserSpecificConditionType,
} from '../normalizers/parser-enum-normalizer.js';

describe('parser enum normalization', () => {
    it('uses parser-owned closed enum types for exact mappings', () => {
        expect(normalizeParserActivityKind('Driving')).toBe('driving');
        expect(normalizeParserCalibrationPurpose('PeriodicInspection')).toBe('periodicInspection');
        expect(normalizeParserCardControlActivityType('VUDownloaded')).toBe('vehicleUnitDownloaded');
        expect(normalizeParserDailyWorkPeriodEntryType('BeginGnssData')).toBe('beginGnss');
        expect(normalizeParserInsertedCardType('WorkshopCard')).toBe('workshopCard');
        expect(normalizeParserSpecificConditionType('OutOfScopeEnd')).toBe('outOfScopeEnd');
    });

    it('preserves typed parser variants that the viewer does not normalize', () => {
        expect(normalizeParserDailyWorkPeriodEntryType('RFU8')).toBeNull();
        expect(normalizeParserInsertedCardType('VehicleUnit')).toBeNull();
    });
});
