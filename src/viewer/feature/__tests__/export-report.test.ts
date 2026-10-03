import { describe, expect, it } from 'vitest';

import { createVehicleUnitUse } from '#viewer-domain';

import { exportFileName, serializeRawJson } from '../helpers/export-report.js';
import { serializeHtmlReport } from '../helpers/report-html.js';
import { createViewerDocumentHarness } from './viewer-document-harness.js';
import {
    openDocumentFixture,
    reportFixtureCardPlaceSource as cardPlaceSource,
    reportFixturePlaceRecord as placeRecord,
    reportFixtureTimestamp as timestamp,
    reportViewModelFor,
} from './report-view-model-fixture.js';

async function serializedReport(harness: ReturnType<typeof createViewerDocumentHarness>): Promise<string> {
    const { context, document } = await openDocumentFixture(harness);
    const viewModel = reportViewModelFor(document, context, { commit: null, version: null });
    return serializeHtmlReport(viewModel, context.translationService);
}

describe('export-report', () => {
    it('serializes a self-contained HTML report from the same view models', async () => {
        const harness = createViewerDocumentHarness();
        const { context, document } = await openDocumentFixture(harness, () => harness.successfulVehicleParserResult());

        const viewModel = reportViewModelFor(document, context, {
            commit: 'c'.repeat(40),
            version: '0.2.0',
        });
        const html = serializeHtmlReport(viewModel, context.translationService);

        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('Tachograph evidence report');
        expect(html).toContain('Vehicle identification number');
        expect(html).toContain('B-ESM-2026');
        expect(html).toContain('Driver and card-use records');
        expect(html).toContain('Signature verification');
        expect(html).toContain('Limitations');
        expect(html).not.toContain('src="http');
        expect(html).not.toContain('<script');
    });

    it('escapes user-derived evidence before embedding it in the report', async () => {
        const harness = createViewerDocumentHarness({
            displayNameCandidate: '<img src=x onerror=1>.ddd',
        });
        const { context, document } = await openDocumentFixture(harness);

        const viewModel = reportViewModelFor(document, context, { commit: null, version: null });
        const html = serializeHtmlReport(viewModel, context.translationService);

        expect(html).toContain('&lt;img src=x onerror=1&gt;.ddd');
        expect(html).not.toContain('<img src=x');
    });

    it('renders each activity day as a self-contained SVG band graph with a legend', async () => {
        const harness = createViewerDocumentHarness();
        const html = await serializedReport(harness);

        expect(html).toContain('class="activity-band"');
        expect(html).toContain('class="band-driving"');
        expect(html).toContain('class="band-work"');
        expect(html).toContain('24-hour timeline');
        expect(html).toContain('>Driving</span>');
        expect(html).toContain('>Other work</span>');
        expect(html).toContain('>Availability</span>');
        expect(html).toContain('>Break or rest</span>');
        expect(html).toContain('>Unknown</span>');
        expect(html).toContain('class="activity-totals"');
        expect(html).toContain('class="activity-icon"');
        expect(html).toContain('</svg>');
        expect(html).not.toContain('<script');
    });

    it('renders place records in a table with the same fields as the Places screen', async () => {
        const harness = createViewerDocumentHarness({ locations: [placeRecord()] });
        const html = await serializedReport(harness);

        expect(html).toContain('Chronological recorded place and GNSS position evidence');
        expect(html).toContain('Work-period end at card withdrawal');
        expect(html).toContain('HR');
        expect(html).toContain('477,499');
        expect(html).toContain('/cardDataResponses/places/placeRecords/0');
        expect(html).toContain('Card context');
        expect(html).toContain('Odometer and GNSS evidence');
        expect(html).not.toContain('<script');
    });

    it('includes the Most Serious Infringement count in the compliance summary breakdown', async () => {
        // Verifies printed breakdown includes mostSeriousCount and sums to total.
        const harness = createViewerDocumentHarness();
        const { context, document } = await openDocumentFixture(harness);
        const viewModel = reportViewModelFor(document, context, { commit: null, version: null });
        const viewModelWithMostSerious = {
            ...viewModel,
            compliance: {
                ...viewModel.compliance,
                summary: {
                    ...viewModel.compliance.summary,
                    mostSeriousCount: 3,
                    totalInfringements: viewModel.compliance.summary.totalInfringements + 3,
                },
            },
        };

        const html = serializeHtmlReport(viewModelWithMostSerious, context.translationService);

        expect(html).toContain('Most Serious: 3');
    });

    it('serializes the raw tree without presentation reshaping', () => {
        const raw = {
            identity: {
                cardNumber: '1234567890123456',
            },
        };

        expect(serializeRawJson(raw)).toBe('{\n  "identity": {\n    "cardNumber": "1234567890123456"\n  }\n}');
    });

    it('derives a bounded export file name from the display name', () => {
        expect(exportFileName('driver-card.ddd', '.html')).toBe('driver-card.ddd.html');
        expect(exportFileName('x'.repeat(260), '.json').length).toBe(256);
        expect(exportFileName('x'.repeat(260), '.json')).not.toContain('/');
    });

    it('renders Gen2 vehicle-unit-use evidence in the associations table', async () => {
        const harness = createViewerDocumentHarness({
            vehicleUnitUses: [
                createVehicleUnitUse({
                    deviceID: 123_456,
                    manufacturerCode: 2,
                    source: cardPlaceSource('/vehicleUnits/0'),
                    usedAt: timestamp(Date.UTC(2026, 6, 27, 10)),
                    vuSoftwareVersion: '0001',
                }),
            ],
        });
        const html = await serializedReport(harness);

        expect(html).toContain('Recorded');
        expect(html).toContain('VU device');
        expect(html).toContain('Manufacturer');
        expect(html).toContain('123456');
        expect(html).toContain('0001');
        expect(html).not.toContain('<script');
    });
});
