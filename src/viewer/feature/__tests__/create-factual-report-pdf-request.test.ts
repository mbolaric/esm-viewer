import { describe, expect, it } from 'vitest';

import {
    createBorderCrossing,
    createGnssPositionEvidence,
    createLoadTypeEntry,
    createLoadUnloadOperation,
    isGnssAccuracyIndicator,
    isIssuingMemberState,
    isLatitude,
    isLongitude,
    type IGnssPositionEvidence,
    type RecordedIssuingMemberState,
    type TachographLocationRecord,
} from '#viewer-domain';

import { serializeHtmlReport } from '../helpers/report-html.js';
import { createFactualReportPdfRequest } from '../helpers/report-pdf.js';
import { createViewerDocumentHarness } from './viewer-document-harness.js';
import {
    openDocumentFixture,
    reportFixtureCardPlaceSource,
    reportFixturePlaceRecord,
    reportFixtureTimestamp,
    reportViewModelFor,
} from './report-view-model-fixture.js';

function decodeHtmlText(value: string): string {
    return value
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&#39;', "'")
        .replaceAll('&amp;', '&');
}

function htmlColumnHeaders(html: string): ReadonlySet<string> {
    return new Set(Array.from(html.matchAll(/<th scope="col">([^<]*)<\/th>/gu), (match) => decodeHtmlText(match[1] ?? '')));
}

function memberState(value: string): RecordedIssuingMemberState {
    if (!isIssuingMemberState(value)) {
        throw new TypeError('The report member-state fixture must be valid.');
    }
    return value;
}

function gnssPosition(): IGnssPositionEvidence {
    const accuracy = 3;
    const latitude = 45.815;
    const longitude = 15.9819;
    if (!isGnssAccuracyIndicator(accuracy) || !isLatitude(latitude) || !isLongitude(longitude)) {
        throw new TypeError('The report GNSS fixture must be valid.');
    }
    return createGnssPositionEvidence({
        accuracy,
        authenticationStatus: null,
        coordinates: { latitude, longitude },
        determinedAt: reportFixtureTimestamp(Date.UTC(2026, 6, 27, 9)),
    });
}

// One record of every location kind the Places section can show besides the work-period place.
function mixedLocationRecords(): TachographLocationRecord[] {
    return [
        reportFixturePlaceRecord(),
        createBorderCrossing({
            countryEntered: memberState('SI'),
            countryLeft: memberState('HR'),
            crossedAt: reportFixtureTimestamp(Date.UTC(2026, 6, 27, 10)),
            odometer: null,
            position: gnssPosition(),
            source: reportFixtureCardPlaceSource('/cardDataResponses/borderCrossings/0'),
        }),
        createLoadUnloadOperation({
            country: memberState('SI'),
            odometer: null,
            operationAt: reportFixtureTimestamp(Date.UTC(2026, 6, 27, 11)),
            operationType: 'load',
            position: gnssPosition(),
            region: null,
            source: reportFixtureCardPlaceSource('/cardDataResponses/loadUnloadOperations/0'),
        }),
        createLoadTypeEntry({
            enteredAt: reportFixtureTimestamp(Date.UTC(2026, 6, 27, 12)),
            loadType: 'goods',
            source: reportFixtureCardPlaceSource('/cardDataResponses/loadTypeEntries/0'),
        }),
    ];
}

// Characterization coverage pinning section ordering, headers, and top-level fields.
describe('createFactualReportPdfRequest', () => {
    function openDriverCardDocument(
        options?: Parameters<typeof createViewerDocumentHarness>[0],
    ): ReturnType<typeof openDocumentFixture> {
        return openDocumentFixture(createViewerDocumentHarness(options));
    }

    it('builds the top-level request fields for a driver-card document', async () => {
        const { context, document } = await openDriverCardDocument();
        const viewModel = reportViewModelFor(document, context, {
            commit: 'c'.repeat(40),
            version: '0.2.0',
        });

        const request = createFactualReportPdfRequest(viewModel, context.translationService, 'en');

        expect(request.kind).toBe('factualReport');
        expect(request.orientation).toBe('landscape');
        expect(request.locale).toBe('en');
        expect(request.headerFields[2]?.value).toBe('synthetic-card.ddd');
        expect(request.subtitle).toBe('synthetic-card.ddd');
        expect(request.headerFields[0]?.value).toBe('Ada Lovelace');
        expect(request.headerFields[1]?.value).toBe('1234567890123456');
        expect(request.headerFields[1]?.label).toBe(context.translationService.translate('overview.identity.cardNumber'));
        expect(request.headerFields[0]?.label).toBe(context.translationService.translate('overview.identity.firstNames'));
        expect(request.title).toBe(context.translationService.translate('report.title'));
        expect(request.summaryTitle).toBe(context.translationService.translate('report.documentKind'));
        expect(request.footerNotice).toBe(context.translationService.translate('report.notALegalAssessment'));
        expect(request.headerFields[3]?.label).toBe(context.translationService.translate('report.generatedAt'));
    });

    it('includes one summary item per fixed summary field, in order', async () => {
        const { context, document } = await openDriverCardDocument();
        const viewModel = reportViewModelFor(document, context, { commit: null, version: null });

        const request = createFactualReportPdfRequest(viewModel, context.translationService, 'en');

        expect(request.summaryItems.map((item) => item.label)).toEqual([
            context.translationService.translate('report.documentKind'),
            context.translationService.translate('overview.generation'),
            context.translationService.translate('report.sha256'),
            context.translationService.translate('report.timeZone'),
            context.translationService.translate('report.parser'),
            context.translationService.translate('overview.integrity'),
        ]);
        const sha256Item = request.summaryItems[2];
        expect(sha256Item?.value).toBe('a'.repeat(64));
        const parserItem = request.summaryItems[4];
        expect(parserItem?.value).toBe(context.translationService.translate('overview.identity.missing'));
    });

    it('renders the driver-card section set: identity, activities, associations, and events/faults', async () => {
        const { context, document } = await openDriverCardDocument();
        const viewModel = reportViewModelFor(document, context, { commit: null, version: null });

        const request = createFactualReportPdfRequest(viewModel, context.translationService, 'en');
        const titles = request.sections.map((section) => section.title);
        const t = context.translationService.translate.bind(context.translationService);

        expect(titles).toContain(t('overview.identity.heading'));
        expect(titles).toContain(t('navigator.section.activities'));
        expect(titles).toContain(t('navigator.section.compliance'));
        expect(titles).toContain(t('report.section.associations'));
        expect(titles).toContain(t('report.section.eventsFaults'));
        // Empty technical and places sections are omitted from report.
        expect(titles).not.toContain(t('report.section.technical'));
        expect(titles).not.toContain(t('report.section.places'));

        const complianceSection = request.sections.find((section) => section.title === t('navigator.section.compliance'));
        expect(complianceSection?.headers).toEqual([
            t('compliance.colSeverity'),
            t('compliance.colTitle'),
            t('compliance.colCategory'),
            t('compliance.colLegal'),
            t('compliance.colAllowed'),
            t('compliance.colMeasured'),
            t('compliance.colExcess'),
            t('compliance.colSource'),
        ]);

        const identitySection = request.sections.find((section) => section.title === t('overview.identity.heading'));
        expect(identitySection?.headers).toEqual([t('overview.identity.heading'), t('rawData.value.value')]);
        expect(identitySection?.rows.some((row) => row.cells.includes('Lovelace'))).toBe(true);
        expect(identitySection?.rows.some((row) => row.cells.includes('1234567890123456'))).toBe(true);

        const associationsSection = request.sections.find((section) => section.title === t('report.section.associations'));
        expect(associationsSection?.headers).toEqual([
            t('associations.vehicle'),
            t('associations.vehicleIdentificationNumber'),
            t('associations.firstUse'),
            t('associations.lastUse'),
            t('activities.duration'),
            t('report.associations.odometerBegin'),
            t('report.associations.odometerEnd'),
            t('associations.distance'),
            t('associations.recorded'),
            t('associations.device'),
            t('associations.manufacturer'),
        ]);
        expect(associationsSection?.rows.some((row) => row.cells.includes('B-ESM-2026 D'))).toBe(true);

        const eventsFaultsSection = request.sections.find((section) => section.title === t('report.section.eventsFaults'));
        expect(eventsFaultsSection?.headers).toEqual([
            t('eventsFaults.type'),
            t('eventsFaults.start'),
            t('eventsFaults.endDuration'),
            t('eventsFaults.code'),
            t('eventsFaults.context'),
            t('eventsFaults.source'),
        ]);
        expect(eventsFaultsSection?.rows.length).toBe(2);
    });

    it('labels each per-day activity record column after the data it holds', async () => {
        const { context, document } = await openDriverCardDocument();
        const viewModel = reportViewModelFor(document, context, { commit: null, version: null });

        const request = createFactualReportPdfRequest(viewModel, context.translationService, 'en');
        const t = context.translationService.translate.bind(context.translationService);
        const dayTables = request.sections.filter((section) => section.title.startsWith(t('activities.timeline.heading')));

        expect(dayTables.length).toBeGreaterThan(0);
        for (const dayTable of dayTables) {
            expect(dayTable.headers).toEqual([
                t('activities.start'),
                t('activities.end'),
                t('activities.duration'),
                t('activities.activityColumn'),
                t('associations.slot'),
                t('activities.crew.column'),
                t('activities.evidence'),
            ]);
            expect(dayTable.rows.every((row) => row.cells.length === dayTable.headers.length)).toBe(true);
        }
    });

    it('prints exactly the table columns of the HTML report', async () => {
        const documents = [
            createViewerDocumentHarness({ locations: [reportFixturePlaceRecord()] }),
            createViewerDocumentHarness(),
        ];
        const vehicleUnitDocument = createViewerDocumentHarness();

        for (const harness of [...documents, vehicleUnitDocument]) {
            const { context, document } = await openDocumentFixture(
                harness,
                harness === vehicleUnitDocument ? () => harness.successfulVehicleParserResult() : undefined,
            );
            const viewModel = reportViewModelFor(document, context, { commit: null, version: null });
            const htmlHeaders = htmlColumnHeaders(serializeHtmlReport(viewModel, context.translationService));
            const request = createFactualReportPdfRequest(viewModel, context.translationService, 'en');
            const t = context.translationService.translate.bind(context.translationService);

            // Key/value sections are definition lists in HTML and the per-date activity totals matrix is PDF-only, so
            // they are left out of the comparison; every other table must match the HTML columns in both directions.
            const reshaped = new Set([t('navigator.section.activities')]);
            const tables = request.sections.filter((section) => section.headers.length > 2 && !reshaped.has(section.title));
            const pdfHeaders = new Set(request.sections.flatMap((section) => section.headers));

            expect(tables.length).toBeGreaterThan(0);
            for (const table of tables) {
                for (const header of table.headers) {
                    expect(htmlHeaders, `${table.title}: "${header}"`).toContain(header);
                }
            }
            for (const header of htmlHeaders) {
                expect(pdfHeaders, `HTML column "${header}"`).toContain(header);
            }
        }
    });

    it('prints the compliance profile label without doubling its trailing colon', async () => {
        const { context, document } = await openDriverCardDocument();
        const viewModel = reportViewModelFor(document, context, { commit: null, version: null });
        const t = context.translationService.translate.bind(context.translationService);

        const request = createFactualReportPdfRequest(viewModel, context.translationService, 'en');
        const compliance = request.sections.find((section) => section.title === t('navigator.section.compliance'));

        expect(compliance?.subtitle).toContain(t('compliance.regulatoryProfile'));
        expect(compliance?.subtitle).not.toContain('::');
    });

    it('prints every activity kind in the per-date totals and the end and duration of each event', async () => {
        const { context, document } = await openDriverCardDocument();
        const viewModel = reportViewModelFor(document, context, { commit: null, version: null });
        const t = context.translationService.translate.bind(context.translationService);

        const request = createFactualReportPdfRequest(viewModel, context.translationService, 'en');
        const totals = request.sections.find((section) => section.title === t('navigator.section.activities'));
        const eventsFaults = request.sections.find((section) => section.title === t('report.section.eventsFaults'));
        const records = viewModel.eventsAndFaults.ok ? (viewModel.eventsAndFaults.viewModel?.records ?? []) : [];
        const timedIndex = records.findIndex((record) => record.end !== null && record.duration !== null);
        const timedEvent = records[timedIndex];

        expect(totals?.headers).toEqual([
            t('activities.date'),
            t('activities.activity.driving'),
            t('activities.activity.work'),
            t('activities.activity.availability'),
            t('activities.activity.breakOrRest'),
            t('activities.activity.unknown'),
        ]);
        expect(timedEvent).toBeDefined();
        expect(eventsFaults?.rows[timedIndex]?.cells[2]).toBe(
            [timedEvent?.end?.display, timedEvent?.duration?.display].join(' · '),
        );
    });

    it('adds a Places section only when location records are present', async () => {
        const withoutLocations = await openDriverCardDocument();
        const requestWithout = createFactualReportPdfRequest(
            reportViewModelFor(withoutLocations.document, withoutLocations.context, {
                commit: null,
                version: null,
            }),
            withoutLocations.context.translationService,
            'en',
        );
        const t = withoutLocations.context.translationService.translate.bind(withoutLocations.context.translationService);
        expect(requestWithout.sections.map((section) => section.title)).not.toContain(t('report.section.places'));

        const withLocations = await openDriverCardDocument({
            locations: [reportFixturePlaceRecord()],
        });
        const requestWith = createFactualReportPdfRequest(
            reportViewModelFor(withLocations.document, withLocations.context, {
                commit: null,
                version: null,
            }),
            withLocations.context.translationService,
            'en',
        );
        const placesSection = requestWith.sections.find((section) => section.title === t('report.section.places'));
        expect(placesSection).toBeDefined();
        expect(placesSection?.headers).toEqual([
            t('eventsFaults.type'),
            t('places.recordedTime'),
            t('places.placePosition'),
            t('places.cardContext'),
            t('places.odometerAccuracy'),
            t('eventsFaults.source'),
        ]);
        expect(placesSection?.rows.some((row) => row.cells.some((cell) => cell.includes('HR')))).toBe(true);
    });

    it('uses the vehicle-identity labels and the card-use associations header for a vehicle-unit document', async () => {
        const harness = createViewerDocumentHarness();
        const { context, document } = await openDocumentFixture(harness, () => harness.successfulVehicleParserResult());
        const viewModel = reportViewModelFor(document, context, { commit: null, version: null });

        const request = createFactualReportPdfRequest(viewModel, context.translationService, 'en');
        const t = context.translationService.translate.bind(context.translationService);

        expect(request.headerFields[1]?.label).toBe(t('overview.identity.vehicleIdentificationNumber'));
        expect(request.headerFields[0]?.label).toBe(t('overview.identity.registrationNumber'));
        expect(request.headerFields[0]?.value).toBe('B-ESM-2026');
        expect(request.headerFields[1]?.value).toBe('WVWZZZ1JZXW000001');

        const associationsSection = request.sections.find((section) => section.title === t('report.section.associations'));
        expect(associationsSection?.headers).toEqual([
            t('associations.identity'),
            t('associations.slot'),
            t('associations.inserted'),
            t('associations.withdrawn'),
            t('activities.duration'),
            t('report.associations.odometerInsertion'),
            t('report.associations.odometerWithdrawal'),
        ]);
        expect(request.orientation).toBe('landscape');
        expect(associationsSection?.rows.some((row) => row.cells.some((cell) => cell.includes('Lovelace')))).toBe(true);
    });

    it('ends with the integrity evidence and the limitations the HTML report states', async () => {
        const { context, document } = await openDriverCardDocument();
        const viewModel = reportViewModelFor(document, context, { commit: null, version: null });
        const t = context.translationService.translate.bind(context.translationService);

        const request = createFactualReportPdfRequest(viewModel, context.translationService, 'en');
        const titles = request.sections.map((section) => section.title);
        const integrity = request.sections.find((section) => section.title === t('report.section.integrity'));
        const limitations = request.sections.at(-1);

        expect(integrity?.subtitle).toContain(t('integrity.parsedIndependently'));
        expect(integrity?.rows.map((row) => row.cells[0])).toEqual([
            t('overview.integrity.checkedItems'),
            t('overview.integrity.validItems'),
            t('overview.integrity.invalidItems'),
        ]);
        expect(titles).toContain(t('integrity.verificationItemsHeading'));
        expect(limitations?.title).toBe(t('report.limitations.heading'));
        expect(limitations?.rows.map((row) => row.cells[0])).toEqual(
            expect.arrayContaining([t('report.limitations.activities'), t('report.limitations.parser')]),
        );
    });

    it('prints every place kind the HTML report shows, one row per record', async () => {
        const { context, document } = await openDriverCardDocument({ locations: mixedLocationRecords() });
        const viewModel = reportViewModelFor(document, context, { commit: null, version: null });
        const t = context.translationService.translate.bind(context.translationService);

        const request = createFactualReportPdfRequest(viewModel, context.translationService, 'en');
        const places = request.sections.find((section) => section.title === t('report.section.places'));
        const htmlPlaceRows = (serializeHtmlReport(viewModel, context.translationService).split('<section id="places">')[1] ?? '')
            .split('</section>')[0]
            ?.match(/<tbody>.*<\/tbody>/su)?.[0]
            .split('<tr>').length;
        const expectedRows = viewModel.locations.ok ? (viewModel.locations.viewModel?.records.length ?? 0) : 0;

        expect(expectedRows).toBeGreaterThanOrEqual(4);
        expect(places?.rows.length).toBe(expectedRows);
        expect(htmlPlaceRows).toBe(expectedRows + 1);
        expect(places?.rows.some((row) => row.cells[0] === t('places.borderCrossings'))).toBe(true);
        expect(places?.rows.some((row) => row.cells.some((cell) => cell.includes('HR → SI')))).toBe(true);
    });
});
