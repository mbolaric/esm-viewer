import type { ILocalisationService } from '#localization';
import { isUtcTimestamp, type DurationMilliseconds, type UtcTimestamp } from '#viewer-domain';
import { describe, expect, it } from 'vitest';

import { createComplianceViewModel, EU_561_2006_STANDARD } from '#compliance';

import { createLocalisationServiceFake } from '#testing';
import { createExportReportViewModel } from '../index.js';
import { createVehicleUnitDocumentFixture } from './vehicle-unit-document-fixture.js';

function timestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The export report view-model fixture timestamp must be valid.');
    }
    return value;
}

function localisation(): ILocalisationService<UtcTimestamp, DurationMilliseconds> {
    return createLocalisationServiceFake();
}

describe('createExportReportViewModel', () => {
    it('projects every supported section from the same normalized view models', () => {
        const document = createVehicleUnitDocumentFixture({
            openedAt: timestamp(Date.UTC(2026, 6, 28, 8, 30)),
        });
        const viewModel = createExportReportViewModel(
            document,
            localisation(),
            {
                commit: 'c'.repeat(40),
                version: '0.2.0',
            },
            createComplianceViewModel(document, undefined, EU_561_2006_STANDARD),
            { creditedAvailabilityBreaks: [], crewDutyPeriods: [], evaluationIntervals: [], infringements: [] },
        );

        expect(viewModel.overview.displayName).toBe('vehicle-unit.ddd');
        expect(viewModel.parserCommit).toBe('c'.repeat(40));
        expect(viewModel.parserVersion).toBe('0.2.0');
        expect(viewModel.activities.ok).toBe(true);
        expect(viewModel.activities.viewModel?.days).toEqual([]);
        expect(viewModel.associations.ok).toBe(true);
        expect(viewModel.eventsAndFaults.ok).toBe(true);
        expect(viewModel.eventsAndFaults.viewModel?.records).toEqual([]);
        expect(viewModel.locations.ok).toBe(true);
        expect(viewModel.technical.ok).toBe(true);
        expect(viewModel.integrity.assessment.status).toBe('notChecked');
    });
});
