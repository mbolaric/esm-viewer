import { describe, expect, it } from 'vitest';

import { createDocumentCapabilities, type DriverCardCapability, type VehicleUnitCapability } from '../index.js';

describe('createDocumentCapabilities', () => {
    it('preserves deduplicated driver-card applicability in source order', () => {
        const applicable = [
            'identity',
            'activities',
            'vehicles',
            'places',
            'controlActivities',
            'specificConditions',
            'activities',
        ] satisfies readonly DriverCardCapability[];

        const capabilities = createDocumentCapabilities('driverCard', applicable);

        expect(capabilities).toEqual({
            applicable: ['identity', 'activities', 'vehicles', 'places', 'controlActivities', 'specificConditions'],
            documentKind: 'driverCard',
        });
    });

    it('preserves vehicle-unit-specific applicability', () => {
        const applicable = [
            'identity',
            'activities',
            'drivers',
            'calibrations',
            'companyLocks',
            'downloadHistory',
            'technicalData',
            'sensorData',
            'timeAdjustments',
            'positions',
            'borderCrossings',
            'detailedSpeed',
        ] satisfies readonly VehicleUnitCapability[];

        expect(createDocumentCapabilities('vehicleUnit', applicable)).toEqual({
            applicable,
            documentKind: 'vehicleUnit',
        });
    });

    it('represents an applicable-but-empty distinction without record counts', () => {
        expect(createDocumentCapabilities('driverCard', ['events', 'faults'])).toEqual({
            applicable: ['events', 'faults'],
            documentKind: 'driverCard',
        });
    });
});
