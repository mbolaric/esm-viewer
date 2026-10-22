import { describe, expect, it } from 'vitest';

import {
    normalizeParserActivityKind,
    normalizeParserCalibrationPurpose,
    normalizeParserCardControlActivityType,
    normalizeParserDailyWorkPeriodEntryType,
    normalizeParserInsertedCardType,
    normalizeParserSpecificConditionType,
} from '../normalizers/parser-enum-normalizer.js';

import { normalizeParserEventFaultCode } from '../normalizers/event-fault-value-normalizer.js';

describe('parser enum normalization', () => {
    it('uses parser-owned closed enum types for exact mappings', () => {
        expect(normalizeParserActivityKind('Driving')).toBe('driving');
        expect(normalizeParserCalibrationPurpose('PeriodicInspection')).toBe('periodicInspection');
        expect(normalizeParserCardControlActivityType(0x40)).toEqual(['vehicleUnitDownloaded']);
        expect(normalizeParserDailyWorkPeriodEntryType('BeginGnssData')).toBe('beginGnss');
        expect(normalizeParserInsertedCardType('WorkshopCard')).toBe('workshopCard');
        expect(normalizeParserSpecificConditionType('OutOfScopeEnd')).toBe('outOfScopeEnd');
    });

    it('preserves typed parser variants that the viewer does not normalize', () => {
        expect(normalizeParserDailyWorkPeriodEntryType('RFU8')).toBeNull();
        expect(normalizeParserInsertedCardType('VehicleUnit')).toBeNull();
    });

    it('preserves combined control flags, empty controls, and reserved bits', () => {
        expect(normalizeParserCardControlActivityType(0xc0)).toEqual(['vehicleUnitDownloaded', 'cardDownloaded']);
        expect(normalizeParserCardControlActivityType(0x30)).toEqual(['displayUsed', 'printingDone']);
        expect(normalizeParserCardControlActivityType(0)).toEqual(['none']);
        expect(normalizeParserCardControlActivityType(0x81)).toEqual(['cardDownloaded', 'unknown']);
        expect(normalizeParserCardControlActivityType(0x07)).toEqual(['unknown']);
    });

    it.each([-1, 256, 1.5, Number.NaN])('rejects invalid control bytes: %s', (value) => {
        expect(normalizeParserCardControlActivityType(value)).toBeNull();
    });

    it('maps numeric unknown codes and new named events from the parser', () => {
        expect(normalizeParserCalibrationPurpose(255)).toBe('unknown');
        expect(normalizeParserEventFaultCode(255)).toBe('unknown');
        expect(normalizeParserEventFaultCode('GNSSAnomaly')).toBe('gnssAnomaly');
        expect(normalizeParserEventFaultCode('GNSSExternalGNSSFacilityAuthenticationFailure')).toBe(
            'gnssExternalFacilityAuthenticationFailure',
        );
        expect(normalizeParserEventFaultCode('VuMotionDataAndDriverActivityInconsistency')).toBe(
            'vuMotionDataAndDriverActivityInconsistency',
        );
        expect(normalizeParserEventFaultCode('REITSInterfaceFault')).toBe('recordingEquipmentItsInterfaceFault');
    });
});
