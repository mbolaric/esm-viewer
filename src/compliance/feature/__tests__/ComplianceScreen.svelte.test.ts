import { decodeFileMetadata } from '#contracts';
import {
    createSourceReference,
    isDurationMilliseconds,
    isJsonPointer,
    isUtcTimestamp,
    type DurationMilliseconds,
    type JsonPointer,
    type UtcTimestamp,
} from '#tachograph-domain';
import { createDocumentSource, createOpenedTachographDocument } from '#viewer-application';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ComplianceScreen from '../ComplianceScreen.svelte';
import { createViewerTestRenderOptions, type IViewerTestRenderOptions } from '#testing';

afterEach(() => {
    cleanup();
});

function renderComplianceScreen(
    document: ReturnType<typeof createOpenedTachographDocument> | null,
    onopensource: (path: JsonPointer) => void,
    options: IViewerTestRenderOptions = createViewerTestRenderOptions(),
): ReturnType<typeof render> {
    const context = options.wrapperProps.context;
    return render(
        ComplianceScreen,
        {
            props: {
                activeSection: 'compliance',
                document,
                exportController: context.complianceExportController,
                localisationService: context.localisationService,
                nightWindow: { endHour: 4, startHour: 0, timeZone: 'UTC' },
                onopensource,
                profileController: context.complianceProfileController,
                settingsStore: context.keyValueStore,
                translationService: context.translationService,
            },
        },
        options,
    );
}

function timestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The test timestamp fixture must be valid.');
    }
    return value;
}

function duration(value: number): DurationMilliseconds {
    if (!isDurationMilliseconds(value)) {
        throw new TypeError('The test duration fixture must be valid.');
    }
    return value;
}

interface IActivityDocumentFixture {
    readonly activity: 'breakOrRest' | 'driving';
    readonly displayName: string;
    readonly durationMs: number;
    readonly sha256: string;
    readonly startMs: number;
}

function createActivityDocument(fixture: IActivityDocumentFixture): ReturnType<typeof createOpenedTachographDocument> {
    const start = timestamp(fixture.startMs);
    const end = timestamp(fixture.startMs + fixture.durationMs);
    const midnight = timestamp(
        Date.UTC(
            new Date(fixture.startMs).getUTCFullYear(),
            new Date(fixture.startMs).getUTCMonth(),
            new Date(fixture.startMs).getUTCDate(),
        ),
    );
    const activityPath = '/EF_DRIVER_ACTIVITY_DATA/0';
    const appPath = '/EF_APPLICATION_IDENTIFICATION';
    if (!isJsonPointer(activityPath) || !isJsonPointer(appPath)) {
        throw new TypeError('Test pointers must be valid.');
    }
    const metadata = decodeFileMetadata({
        byteLength: 1024,
        displayName: fixture.displayName,
        sha256: fixture.sha256,
    });
    if (!metadata.ok) {
        throw new TypeError('File metadata must decode successfully.');
    }
    const source = createDocumentSource(metadata.value, start);
    const activitySource = createSourceReference('driverCard', 'g1', activityPath);
    const appSource = createSourceReference('driverCard', 'g1', appPath);
    const activityDuration = duration(fixture.durationMs);

    return createOpenedTachographDocument(source, {
        applications: [
            {
                activityDays: [
                    {
                        intervals: [
                            {
                                activity: fixture.activity,
                                end,
                                crewPresence: 'single',
                                origin: 'recorded',
                                slot: 'Driver',
                                source: activitySource,
                                start,
                            },
                        ],
                        midnightUtc: midnight,
                        totals: {
                            availability: duration(0),
                            breakOrRest: fixture.activity === 'breakOrRest' ? activityDuration : duration(0),
                            driving: fixture.activity === 'driving' ? activityDuration : duration(0),
                            unknown: duration(0),
                            work: duration(0),
                        },
                    },
                ],
                cardNotes: null,
                events: [],
                faults: [],
                generation: 'g1',
                identity: null,
                locations: [],
                source: appSource,
                technicalRecords: [],
                vehicleUnitUses: [],
                vehicleUses: [],
                verification: {
                    dataFileSourcePaths: {},
                    dataFiles: {},
                    generation: 'g1',
                },
                warnings: [],
            },
        ],
        cardType: 'driverCard',
        documentKind: 'driverCard',
        generation: 'g1',
        parserVariant: 'cardGen1',
        rawTree: {},
        sections: [],
    });
}

function createMockInfringementDocument(): ReturnType<typeof createOpenedTachographDocument> {
    return createActivityDocument({
        activity: 'driving',
        displayName: 'test.ddd',
        durationMs: 5 * 60 * 60_000,
        sha256: 'a'.repeat(64),
        startMs: Date.UTC(2026, 7, 1, 8),
    });
}

function createMobilityAccommodationDocument(): ReturnType<typeof createOpenedTachographDocument> {
    return createActivityDocument({
        activity: 'breakOrRest',
        displayName: 'mobility-rest.ddd',
        sha256: 'b'.repeat(64),
        durationMs: 45 * 60 * 60_000,
        startMs: Date.UTC(2026, 7, 3, 8),
    });
}

describe('ComplianceScreen', () => {
    it('renders empty notice when document is null', () => {
        const onopensource = vi.fn();
        renderComplianceScreen(null, onopensource);

        expect(screen.getByText('No Infringements Detected')).toBeDefined();
        expect(screen.getByText(/Fleet & Driver Hours Infringement Analysis/i)).toBeDefined();
        expect(screen.getByText(/Viewer evaluation — not a final legal conclusion/)).toBeDefined();
        const heading = screen.getByRole('heading', { level: 1, name: 'Compliance' });
        expect(document.activeElement).toBe(heading);
    });

    it('renders translated category and severity labels when infringements exist', () => {
        const onopensource = vi.fn();
        const mockDocument = createMockInfringementDocument();

        renderComplianceScreen(mockDocument, onopensource);

        expect(screen.getAllByText('Break Requirements').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Very Serious').length).toBeGreaterThan(0);
        expect(screen.getByText(/Viewer evaluation — not a final legal conclusion/)).toBeDefined();
    });

    it('shows a distinct no-results state instead of a false "no infringements" state when filters hide all findings (REPORT-01)', async () => {
        const onopensource = vi.fn();
        const mockDocument = createMockInfringementDocument();

        renderComplianceScreen(mockDocument, onopensource);

        // The fixture document only produces a 'break' category infringement -
        // filtering to an unrelated category must hide it from the table
        // without implying the document has zero findings. `getByRole` (not
        // `getByLabelText`) because the table's own column-menu checkbox is
        // also labelled "Category" - a real double-label that's fine for
        // assistive tech (the checkbox sits inside the "Columns" group) but
        // ambiguous for `getByLabelText`, which ignores that grouping.
        const categorySelect = screen.getByRole('combobox', { name: 'Category' });
        await fireEvent.change(categorySelect, { target: { value: 'dailyDriving' } });

        expect(screen.getByText('No Matching Infringements')).toBeDefined();
        expect(screen.queryByText('No Infringements Detected')).toBeNull();
        expect(screen.getByText(/1 infringement\(s\) exist in this document/)).toBeDefined();
    });

    it('filters infringements by search text regardless of case and diacritics', async () => {
        renderComplianceScreen(createMockInfringementDocument(), vi.fn());

        const search = screen.getByRole('searchbox', { name: 'Search Infringements' });
        await fireEvent.input(search, { target: { value: 'BRÉAK_continuous' } });
        expect(screen.queryByText('No Matching Infringements')).toBeNull();
        expect(screen.getAllByText('Break Requirements').length).toBeGreaterThan(0);

        await fireEvent.input(search, { target: { value: 'no such rule' } });
        expect(screen.getByText('No Matching Infringements')).toBeDefined();
    });

    it('renders Directive 2002/15/EC and AETR options in profile selector', () => {
        const onopensource = vi.fn();
        renderComplianceScreen(null, onopensource);

        expect(screen.getByText('Directive 2002/15/EC (Road Transport Working Time) v2002.1')).toBeDefined();
        expect(screen.getByText('UNECE AETR Agreement (International Transport) v2020.1')).toBeDefined();
    });

    it('updates the shared, app-wide rule profile selection when changed, not just its own local view (VIEWER-09)', async () => {
        const onopensource = vi.fn();
        const options = createViewerTestRenderOptions();
        const { complianceProfileController } = options.wrapperProps.context;
        expect(complianceProfileController.selectedProfile.profileId).toBe('EU_561_2006_STANDARD');

        renderComplianceScreen(null, onopensource, options);

        const profileSelect = screen.getByLabelText('Regulatory Scope Profile:');
        await fireEvent.change(profileSelect, { target: { value: 'UK_GB_DOMESTIC' } });

        // The Compliance screen no longer owns this selection privately -
        // any other screen sharing the same controller instance (e.g. the
        // viewer's Activities screen's continuous-driving progress bar) must
        // see the same change, since both read from one controller instead
        // of each defaulting independently to the EU profile.
        expect(complianceProfileController.selectedProfile.profileId).toBe('UK_GB_DOMESTIC');
    });

    it('does not show generic Mobility review cards for a short file without relevant evidence', async () => {
        const onopensource = vi.fn();
        renderComplianceScreen(createMockInfringementDocument(), onopensource);

        await fireEvent.change(screen.getByLabelText('Regulatory Scope Profile:'), {
            target: { value: 'EU_MOBILITY_PACKAGE_2020' },
        });

        expect(screen.queryByRole('heading', { level: 2, name: 'External Evidence Reviews' })).toBeNull();
    });

    it('surfaces a relevant Mobility accommodation limitation as an external-evidence review', async () => {
        const onopensource = vi.fn();
        renderComplianceScreen(createMobilityAccommodationDocument(), onopensource);

        await fireEvent.change(screen.getByLabelText('Regulatory Scope Profile:'), {
            target: { value: 'EU_MOBILITY_PACKAGE_2020' },
        });

        expect(screen.getByRole('heading', { level: 2, name: 'External Evidence Reviews' })).toBeDefined();
        expect(screen.getByText('Weekly rest accommodation')).toBeDefined();
        expect(screen.queryByText('Driver return opportunity')).toBeNull();
    });

    it('opens infringement letter dialog and attestation dialog when clicked', async () => {
        const onopensource = vi.fn();
        const mockDocument = createMockInfringementDocument();

        renderComplianceScreen(mockDocument, onopensource);

        const letterButton = screen.getByRole('button', { name: 'Infringement Letter' });
        expect(letterButton).toBeDefined();
        await fireEvent.click(letterButton);

        expect(screen.getByText('Driver Infringement Acknowledgment Letter')).toBeDefined();
        expect(screen.getByRole('button', { name: 'Print Letter' })).toBeDefined();
        expect(screen.getByRole('button', { name: 'Save Letter PDF' })).toBeDefined();
        expect(screen.getByRole('button', { name: 'Save Letter HTML' })).toBeDefined();

        const closeButton = screen.getByRole('button', { name: 'Close letter dialog' });
        await fireEvent.click(closeButton);

        const attestationButton = screen.getByRole('button', { name: 'EU Attestation' });
        await fireEvent.click(attestationButton);

        expect(screen.getByText('EU Form of Attestation of Activities')).toBeDefined();
        expect(screen.getByRole('button', { name: 'Save Attestation PDF' })).toBeDefined();
    });
});
