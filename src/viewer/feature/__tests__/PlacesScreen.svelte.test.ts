import {
    createAccumulatedDrivingPosition,
    createDailyWorkPeriodPlace,
    createGnssPositionEvidence,
    createSourceReference,
    isCardNumber,
    isGnssAccuracyIndicator,
    isGnssAuthenticationStatus,
    isIssuingMemberState,
    isJsonPointer,
    isLatitude,
    isLongitude,
    isOdometerKilometres,
    isUtcTimestamp,
    type ISourceReference,
    type UtcTimestamp,
} from '#viewer-domain';
import type {
    IAccumulatedDrivingPositionViewModel,
    IDailyWorkPeriodPlaceViewModel,
    IFormattedValue,
    IJourneyLegViewModel,
    IJourneyShiftSummary,
    IJourneySummaryViewModel,
    ILocationSectionViewModel,
} from '#viewer-presentation';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import PlacesScreen from '../components/screens/PlacesScreen.svelte';
import { createDocumentScopedValue } from '../controllers/document-scoped-value.svelte.js';
import { createViewerTestRenderOptions, type IViewerTestRenderOptions } from './viewer-test-render.js';

afterEach(() => {
    cleanup();
});

function formatted<TValue>(value: TValue, display: string): IFormattedValue<TValue> {
    return { display, value };
}

function timestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The location screen timestamp fixture must be valid.');
    }
    return value;
}

function source(path: string): ISourceReference<'g2v2', 'vehicleUnit'> {
    if (!isJsonPointer(path)) {
        throw new TypeError('The location screen source must be valid.');
    }
    return createSourceReference('vehicleUnit', 'g2v2', path);
}

function journeyShiftViewModel(
    id: string,
    dayUtc: UtcTimestamp,
    dateLabel: string,
    span: string,
    distanceKm: number,
    hasOdometerDiscrepancy = false,
): IJourneyShiftSummary {
    const start: IJourneyLegViewModel = {
        coordinates: null,
        country: 'DE',
        icon: 'mapPin',
        id: `${id}-start`,
        odometer: null,
        position: null,
        sourcePath: '/card/0/places/0',
        timestamp: formatted(timestamp(dayUtc + 8 * 3_600_000), '08:00'),
        type: 'start',
    };
    const end: IJourneyLegViewModel = {
        coordinates: null,
        country: 'BE',
        icon: 'circleCheck',
        id: `${id}-end`,
        odometer: null,
        position: null,
        sourcePath: '/card/0/places/1',
        timestamp: formatted(timestamp(dayUtc + 17 * 3_600_000), '17:00'),
        type: 'end',
    };
    const summary: IJourneySummaryViewModel = {
        hasCoordinates: false,
        hasOdometerDiscrepancy,
        legs: [start, end],
        totalShiftKilometres: formatted(distanceKm, String(distanceKm)),
    };
    return {
        dateLabel,
        dayUtc,
        formattedSpan: span,
        id,
        stopCount: 2,
        summary,
        totalKilometres: summary.totalShiftKilometres,
    };
}

function viewModel(): ILocationSectionViewModel {
    const latitude = 40.4168;
    const longitude = -3.7038;
    const accuracy = 2;
    const authenticationStatus = 1;
    const determinedAt = Date.UTC(2026, 5, 18, 8, 38, 58);
    const entryAt = Date.UTC(2026, 5, 18, 8, 39);
    const recordedAt = Date.UTC(2026, 5, 18, 11, 39);
    const odometer = 12_338;
    const cardNumber = 'SYNTHETIC0000001';
    const memberState = 'D';
    if (
        !isLatitude(latitude) ||
        !isLongitude(longitude) ||
        !isGnssAccuracyIndicator(accuracy) ||
        !isGnssAuthenticationStatus(authenticationStatus) ||
        !isUtcTimestamp(determinedAt) ||
        !isUtcTimestamp(entryAt) ||
        !isUtcTimestamp(recordedAt) ||
        !isOdometerKilometres(odometer) ||
        !isCardNumber(cardNumber) ||
        !isIssuingMemberState(memberState)
    ) {
        throw new TypeError('The location screen evidence must be valid.');
    }

    const position = createGnssPositionEvidence({
        accuracy,
        authenticationStatus,
        coordinates: { latitude, longitude },
        determinedAt,
    });
    const card = {
        cardNumber,
        cardType: 'driverCard' as const,
        issuingMemberState: memberState,
    };
    const placeRecord = createDailyWorkPeriodPlace({
        card,
        country: memberState,
        entryAt,
        entryType: 'beginCardInsertion',
        odometer,
        position,
        region: 'CastillaLeon',
        source: source('/places/0'),
    });
    const positionRecord = createAccumulatedDrivingPosition({
        coDriverCard: null,
        driverCard: card,
        odometer,
        position,
        recordedAt,
        source: source('/positions/0'),
    });
    const positionViewModel = {
        accuracy: formatted(accuracy, '2'),
        authenticationStatus: formatted(authenticationStatus, '1'),
        coordinateCopyValue: '40.4168, -3.7038',
        coordinateDisplayValue: '40.416800, -3.703800',
        determinedAt: formatted(determinedAt, '18 Jun 2026, 08:38:58'),
        latitude: formatted(latitude, '40.416800'),
        longitude: formatted(longitude, '-3.703800'),
    };
    const place: IDailyWorkPeriodPlaceViewModel = {
        card,
        country: memberState,
        entryAt: formatted(entryAt, '18 Jun 2026, 08:39'),
        entryType: 'beginCardInsertion',
        generation: 'g2v2',
        kind: 'dailyWorkPeriodPlace',
        odometer: formatted(odometer, '12,338'),
        position: positionViewModel,
        record: placeRecord,
        region: 'CastillaLeon',
        source: placeRecord.source,
        timestamp: formatted(entryAt, '18 Jun 2026, 08:39'),
    };
    const accumulated: IAccumulatedDrivingPositionViewModel = {
        coDriverCard: null,
        driverCard: card,
        generation: 'g2v2',
        kind: 'accumulatedDrivingPosition',
        odometer: formatted(odometer, '12,338'),
        position: positionViewModel,
        record: positionRecord,
        recordedAt: formatted(recordedAt, '18 Jun 2026, 11:39'),
        source: positionRecord.source,
        timestamp: formatted(recordedAt, '18 Jun 2026, 11:39'),
    };

    return {
        allCount: formatted(2, '2'),
        borderCrossingCount: formatted(0, '0'),
        documentKind: 'vehicleUnit',
        filter: 'all',
        gen2v2OperationCount: formatted(0, '0'),
        hasGen2v2ParserLimitation: false,
        loadTypeEntryCount: formatted(0, '0'),
        loadUnloadOperationCount: formatted(0, '0'),
        locale: 'en',
        placeCount: formatted(1, '1'),
        positionCount: formatted(1, '1'),
        records: [place, accumulated],
        shifts: [],
        timeZone: 'Europe/Berlin',
        totalCount: formatted(2, '2'),
    };
}

function renderPlacesScreenWithShifts(
    shifts: readonly IJourneyShiftSummary[],
    options: IViewerTestRenderOptions = createViewerTestRenderOptions(),
): ReturnType<typeof render> {
    return render(
        PlacesScreen,
        {
            props: {
                activityDayLabel: null,
                activityDayMidnight: null,
                filterText: createDocumentScopedValue(''),
                onclearactivityday: vi.fn(),
                oncopycoordinates: vi.fn().mockResolvedValue(true),
                onfilter: vi.fn(),
                onopensource: vi.fn(),
                onselectrecord: vi.fn(),
                selectedRecord: null,
                viewModel: { ...viewModel(), shifts },
            },
        },
        options,
    );
}

describe('PlacesScreen', () => {
    it('renders all recorded place/position evidence and working actions', async () => {
        const copyCoordinates = vi.fn(() => Promise.resolve(true));
        const filter = vi.fn();
        const openSource = vi.fn();
        const selectRecord = vi.fn();
        render(
            PlacesScreen,
            {
                props: {
                    activityDayLabel: null,
                    activityDayMidnight: null,
                    filterText: createDocumentScopedValue(''),
                    onclearactivityday: vi.fn(),
                    oncopycoordinates: copyCoordinates,
                    onfilter: filter,
                    onopensource: openSource,
                    onselectrecord: selectRecord,
                    selectedRecord: null,
                    viewModel: viewModel(),
                },
            },
            createViewerTestRenderOptions(),
        );

        const heading = screen.getByRole('heading', { level: 1, name: 'Positions & places' });
        expect(document.activeElement).toBe(heading);
        expect(
            screen.getByText('These positions are records contained in the opened file. They are not live vehicle tracking.'),
        ).toBeTruthy();
        expect(screen.getByRole('button', { name: 'All records (2)', pressed: true })).toBeTruthy();
        const table = screen.getByRole('table', {
            name: 'Chronological recorded place and GNSS position evidence',
        });
        expect(table.classList.contains('wide')).toBe(false);
        expect(within(table).getByText('CastillaLeon')).toBeTruthy();
        expect(screen.queryByRole('heading', { level: 2, name: 'Parser limitation' })).toBeNull();

        await fireEvent.click(screen.getByRole('button', { name: 'GNSS positions (1)' }));
        expect(filter).toHaveBeenCalledWith('position');

        const copyButtons = within(table).getAllByRole('button', {
            name: 'Copy coordinates: 40.4168, -3.7038',
        });
        const firstCopyButton = copyButtons[0];
        if (firstCopyButton === undefined) {
            throw new TypeError('The first coordinate copy action must be rendered.');
        }
        expect(firstCopyButton.classList.contains('icon-only')).toBe(true);
        expect(firstCopyButton.getAttribute('data-tooltip')).toBe('Copy coordinates');
        expect(firstCopyButton.querySelector('svg')).toBeTruthy();
        await fireEvent.click(firstCopyButton);
        await waitFor(() => {
            expect(copyCoordinates).toHaveBeenCalledWith('40.4168, -3.7038');
        });
        expect(screen.getByText('Coordinates copied to the clipboard.')).toBeTruthy();

        await fireEvent.click(
            within(table).getByRole('button', {
                name: /Select location record:.*18 Jun 2026, 08:39/u,
            }),
        );
        expect(selectRecord).toHaveBeenCalledWith(expect.objectContaining({ kind: 'dailyWorkPeriodPlace' }));

        await fireEvent.click(
            within(table).getByRole('button', {
                name: 'Open in Raw Data: /places/0',
            }),
        );
        expect(openSource).toHaveBeenCalledWith(source('/places/0').path);
    });

    it('renders explicit empty and projection-error states', async () => {
        const empty = {
            ...viewModel(),
            records: [],
            totalCount: formatted(0, '0'),
        };
        const commonProps = {
            activityDayLabel: null,
            activityDayMidnight: null,
            filterText: createDocumentScopedValue(''),
            onclearactivityday: vi.fn(),
            oncopycoordinates: vi.fn(() => Promise.resolve(true)),
            onfilter: vi.fn(),
            onopensource: vi.fn(),
            onselectrecord: vi.fn(),
            selectedRecord: null,
        };
        const rendered = render(
            PlacesScreen,
            {
                props: {
                    ...commonProps,
                    viewModel: empty,
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByText('No location records match the selected record type.')).toBeTruthy();

        await rendered.rerender({
            ...commonProps,
            viewModel: null,
        });
        expect(screen.getByRole('heading', { level: 2, name: 'Location records unavailable' })).toBeTruthy();
    });

    it('filters records to the linked activity day and offers a clear action', async () => {
        const clearActivityDay = vi.fn();
        render(
            PlacesScreen,
            {
                props: {
                    activityDayLabel: 'June 18, 2026',
                    activityDayMidnight: timestamp(Date.UTC(2026, 5, 18)),
                    filterText: createDocumentScopedValue(''),
                    onclearactivityday: clearActivityDay,
                    oncopycoordinates: vi.fn(() => Promise.resolve(true)),
                    onfilter: vi.fn(),
                    onopensource: vi.fn(),
                    onselectrecord: vi.fn(),
                    selectedRecord: null,
                    viewModel: viewModel(),
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByText('Showing records for June 18, 2026')).toBeTruthy();
        const table = screen.getByRole('table', {
            name: 'Chronological recorded place and GNSS position evidence',
        });
        expect(within(table).getAllByRole('row')).toHaveLength(3);
        expect(within(table).getByText('CastillaLeon')).toBeTruthy();
        expect(within(table).getByText('18 Jun 2026, 11:39')).toBeTruthy();

        await fireEvent.click(screen.getByRole('button', { name: 'Show all records' }));
        expect(clearActivityDay).toHaveBeenCalledTimes(1);
    });

    it('shows the day-window empty message when no record overlaps the linked day', () => {
        render(
            PlacesScreen,
            {
                props: {
                    activityDayLabel: 'June 19, 2026',
                    activityDayMidnight: timestamp(Date.UTC(2026, 5, 19)),
                    filterText: createDocumentScopedValue(''),
                    onclearactivityday: vi.fn(),
                    oncopycoordinates: vi.fn(() => Promise.resolve(true)),
                    onfilter: vi.fn(),
                    onopensource: vi.fn(),
                    onselectrecord: vi.fn(),
                    selectedRecord: null,
                    viewModel: viewModel(),
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByText('No records are present for the selected day.')).toBeTruthy();
        expect(
            screen.queryByRole('table', {
                name: 'Chronological recorded place and GNSS position evidence',
            }),
        ).toBeNull();
    });

    it('links the journey card to the selected activity day and navigates shifts', async () => {
        const day1 = timestamp(Date.UTC(2026, 5, 18));
        const day2 = timestamp(Date.UTC(2026, 5, 19));
        const linkedViewModel = {
            ...viewModel(),
            shifts: [
                journeyShiftViewModel('shift-1', day1, 'June 18, 2026', '08:00 – 17:00', 480),
                journeyShiftViewModel('shift-2', day2, 'June 19, 2026', '07:30 – 16:30', 320),
            ],
        };
        const commonProps = {
            filterText: createDocumentScopedValue(''),
            onclearactivityday: vi.fn(),
            oncopycoordinates: vi.fn(() => Promise.resolve(true)),
            onfilter: vi.fn(),
            onopensource: vi.fn(),
            onselectrecord: vi.fn(),
            selectedRecord: null,
            viewModel: linkedViewModel,
        };
        const rendered = render(
            PlacesScreen,
            {
                props: {
                    ...commonProps,
                    activityDayLabel: 'June 18, 2026',
                    activityDayMidnight: day1,
                },
            },
            createViewerTestRenderOptions(),
        );

        // The selected day links to the shift whose begin falls on that day.
        expect(screen.getByText(/08:00 – 17:00/u)).toBeTruthy();
        expect(screen.queryByText(/07:30 – 16:30/u)).toBeNull();
        expect(screen.getByText('480 km')).toBeTruthy();

        const shiftSelect = screen.getByRole('combobox', {
            name: 'Shift progression navigator',
        });
        expect(within(shiftSelect).getAllByRole('option')).toHaveLength(2);

        const previousShift = screen.getByRole('button', { name: 'Previous route shift' });
        expect(previousShift.hasAttribute('disabled')).toBe(true);

        await fireEvent.click(screen.getByRole('button', { name: 'Next route shift' }));
        expect(screen.getByText(/07:30 – 16:30/u)).toBeTruthy();
        expect(screen.queryByText(/08:00 – 17:00/u)).toBeNull();
        expect(previousShift.hasAttribute('disabled')).toBe(false);

        await fireEvent.click(previousShift);
        expect(screen.getByText(/08:00 – 17:00/u)).toBeTruthy();

        // Changing the linked day re-applies the day-link rule over the stale selection.
        await rendered.rerender({
            ...commonProps,
            activityDayLabel: 'June 19, 2026',
            activityDayMidnight: day2,
        });
        expect(screen.getByText(/07:30 – 16:30/u)).toBeTruthy();
        expect(screen.queryByText(/08:00 – 17:00/u)).toBeNull();
    });

    it('supports switching journey view modes between step track, vector map, and split view', async () => {
        const day1 = timestamp(Date.UTC(2026, 5, 18));
        const shift = journeyShiftViewModel('shift-1', day1, 'June 18, 2026', '08:00 – 17:00', 480);
        const testViewModel = {
            ...viewModel(),
            shifts: [shift],
        };

        render(
            PlacesScreen,
            {
                props: {
                    activityDayLabel: null,
                    activityDayMidnight: null,
                    filterText: createDocumentScopedValue(''),
                    onclearactivityday: vi.fn(),
                    oncopycoordinates: vi.fn().mockResolvedValue(true),
                    onfilter: vi.fn(),
                    onopensource: vi.fn(),
                    onselectrecord: vi.fn(),
                    selectedRecord: null,
                    viewModel: testViewModel,
                },
            },
            createViewerTestRenderOptions(),
        );

        // Initial default is step track
        expect(screen.getByRole('region', { name: 'Chronological journey route progression' })).toBeTruthy();
        expect(screen.queryByRole('region', { name: 'Offline route and waypoint vector map' })).toBeNull();

        // Switch to Vector Map
        const vectorMapBtn = screen.getByRole('button', { name: 'Vector Map' });
        await fireEvent.click(vectorMapBtn);

        expect(screen.getByRole('region', { name: 'Offline route and waypoint vector map' })).toBeTruthy();
        expect(screen.queryByRole('region', { name: 'Chronological journey route progression' })).toBeNull();

        // Switch to Split View
        const splitViewBtn = screen.getByRole('button', { name: 'Split View' });
        await fireEvent.click(splitViewBtn);

        expect(screen.getByRole('region', { name: 'Chronological journey route progression' })).toBeTruthy();
        expect(screen.getByRole('region', { name: 'Offline route and waypoint vector map' })).toBeTruthy();
    });

    it('shows an odometer-discrepancy warning only when the shift summary flags one (VIEWER-05)', () => {
        const day1 = timestamp(Date.UTC(2026, 5, 18));
        const cleanShift = journeyShiftViewModel('shift-1', day1, 'June 18, 2026', '08:00 – 17:00', 480);

        const { unmount } = renderPlacesScreenWithShifts([cleanShift]);

        expect(
            screen.queryByText(
                'A backward odometer jump or an implausible single-leg distance was excluded from this total - it may be incomplete.',
            ),
        ).toBeNull();
        unmount();

        const discrepancyShift = journeyShiftViewModel('shift-2', day1, 'June 18, 2026', '08:00 – 17:00', 100, true);

        renderPlacesScreenWithShifts([discrepancyShift]);

        expect(
            screen.getByText(
                'A backward odometer jump or an implausible single-leg distance was excluded from this total - it may be incomplete.',
            ),
        ).toBeTruthy();
    });

    it('translates map waypoint labels for the active locale instead of showing raw English (VIEWER-08)', async () => {
        const day1 = timestamp(Date.UTC(2026, 5, 18));
        const shift = journeyShiftViewModel('shift-1', day1, '18. Juni 2026', '08:00 – 17:00', 480);

        renderPlacesScreenWithShifts([shift], createViewerTestRenderOptions({ locale: 'de' }));

        await fireEvent.click(screen.getByRole('button', { name: 'Vektorkarte' }));

        // Waypoint labels must be localized even for approximate markers without GNSS fix.
        expect(screen.getByRole('button', { name: 'Schichtbeginn' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Schichtende' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Shift start' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Shift end' })).toBeNull();
    });
});
