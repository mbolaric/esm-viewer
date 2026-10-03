import {
    createCardUse,
    createSourceReference,
    createVehicleUnitUse,
    createVehicleUse,
    isCardNumber,
    isDurationMilliseconds,
    isIdentityName,
    isIssuingMemberState,
    isJsonPointer,
    isOdometerKilometres,
    isUtcTimestamp,
    isVehicleIdentificationNumber,
    isVehicleRegistrationNumber,
    type DurationMilliseconds,
    type ISourceReference,
    type OdometerKilometres,
    type UtcTimestamp,
} from '#viewer-domain';
import type {
    IAssociationSectionViewModel,
    ICardUseViewModel,
    IFormattedValue,
    IVehicleUnitUseViewModel,
    IVehicleUseViewModel,
} from '#viewer-presentation';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AssociationsScreen from '../components/screens/AssociationsScreen.svelte';
import { createDocumentScopedValue } from '../controllers/document-scoped-value.svelte.js';
import { createViewerTestRenderOptions } from './viewer-test-render.js';

afterEach(() => {
    cleanup();
});

function timestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The association screen timestamp fixture must be valid.');
    }
    return value;
}

function odometer(value: number): OdometerKilometres {
    if (!isOdometerKilometres(value)) {
        throw new TypeError('The association screen odometer fixture must be valid.');
    }
    return value;
}

function duration(value: number): DurationMilliseconds {
    if (!isDurationMilliseconds(value)) {
        throw new TypeError('The association screen duration fixture must be valid.');
    }
    return value;
}

function driverCardSource(path: string): ISourceReference<'g2', 'driverCard'> {
    if (!isJsonPointer(path)) {
        throw new TypeError('The association screen driver-card source must be valid.');
    }
    return createSourceReference('driverCard', 'g2', path);
}

function vehicleUnitSource(path: string): ISourceReference<'g2', 'vehicleUnit'> {
    if (!isJsonPointer(path)) {
        throw new TypeError('The association screen VU source must be valid.');
    }
    return createSourceReference('vehicleUnit', 'g2', path);
}

function formatted<TValue>(value: TValue, display: string): IFormattedValue<TValue> {
    return { display, value };
}

function vehicleUseViewModel(): IVehicleUseViewModel {
    const registrationMemberState = 'D';
    const registrationNumber = 'TEST-123';
    const vin = 'WVWZZZ1JZXW000001';
    if (
        !isIssuingMemberState(registrationMemberState) ||
        !isVehicleRegistrationNumber(registrationNumber) ||
        !isVehicleIdentificationNumber(vin)
    ) {
        throw new TypeError('The association screen vehicle identity must be valid.');
    }
    const firstUse = timestamp(Date.UTC(2026, 6, 27, 8));
    const lastUse = timestamp(Date.UTC(2026, 6, 27, 16));
    const odometerBegin = odometer(12_340);
    const odometerEnd = odometer(12_620);
    const record = createVehicleUse({
        firstUse,
        lastUse,
        odometerBegin,
        odometerEnd,
        registrationMemberState,
        registrationNumber,
        source: driverCardSource('/vehicles/0'),
        vehicleIdentificationNumber: vin,
    });
    if (record === null) {
        throw new TypeError('The association screen vehicle use must be valid.');
    }

    return {
        distance: formatted(odometer(280), '280'),
        duration: formatted(duration(lastUse - firstUse), '8 hr'),
        endTimestamp: formatted(lastUse, '27 Jul 2026, 16:00'),
        firstUse: formatted(firstUse, '27 Jul 2026, 08:00'),
        generation: 'g2',
        kind: 'vehicleUse',
        lastUse: formatted(lastUse, '27 Jul 2026, 16:00'),
        odometerBegin: formatted(odometerBegin, '12,340'),
        odometerEnd: formatted(odometerEnd, '12,620'),
        record,
        registrationMemberState,
        registrationNumber,
        source: record.source,
        startTimestamp: formatted(firstUse, '27 Jul 2026, 08:00'),
        vehicleIdentificationNumber: vin,
    };
}

function vehicleUnitUseViewModel(): IVehicleUnitUseViewModel {
    const usedAt = timestamp(Date.UTC(2026, 6, 27, 10));
    const record = createVehicleUnitUse({
        deviceID: 123_456,
        manufacturerCode: 2,
        source: driverCardSource('/vehicleUnits/0'),
        usedAt,
        vuSoftwareVersion: '0001',
    });

    return {
        deviceID: record.deviceID,
        endTimestamp: formatted(usedAt, '27 Jul 2026, 10:00'),
        generation: 'g2',
        kind: 'vehicleUnitUse',
        manufacturerCode: formatted(2, '2'),
        record,
        source: record.source,
        startTimestamp: formatted(usedAt, '27 Jul 2026, 10:00'),
        usedAt: formatted(usedAt, '27 Jul 2026, 10:00'),
        vuSoftwareVersion: '0001',
    };
}

function cardUseViewModel(): ICardUseViewModel {
    const cardNumber = 'SYNTHETIC0000001';
    const firstNames = 'Alex';
    const surname = 'Example';
    const issuingMemberState = 'D';
    if (
        !isCardNumber(cardNumber) ||
        !isIdentityName(firstNames) ||
        !isIdentityName(surname) ||
        !isIssuingMemberState(issuingMemberState)
    ) {
        throw new TypeError('The association screen card identity must be valid.');
    }
    const insertion = timestamp(Date.UTC(2026, 6, 27, 8));
    const withdrawal = timestamp(Date.UTC(2026, 6, 27, 16));
    const cardExpiryDate = timestamp(Date.UTC(2030, 6, 27));
    const odometerAtInsertion = odometer(12_340);
    const odometerAtWithdrawal = odometer(12_620);
    const record = createCardUse({
        cardExpiryDate,
        cardNumber,
        cardType: 'driverCard',
        firstNames,
        insertion,
        issuingMemberState,
        odometerAtInsertion,
        odometerAtWithdrawal,
        slot: 'Driver',
        source: vehicleUnitSource('/cards/0'),
        surname,
        withdrawal,
    });
    if (record === null) {
        throw new TypeError('The association screen card use must be valid.');
    }

    return {
        cardExpiryDate: formatted(cardExpiryDate, '27 Jul 2030'),
        cardIdentityDisplay: 'Example Alex',
        cardNumber,
        cardType: 'driverCard',
        duration: formatted(duration(withdrawal - insertion), '8 hr'),
        endTimestamp: formatted(withdrawal, '27 Jul 2026, 16:00'),
        firstNames,
        generation: 'g2',
        insertion: formatted(insertion, '27 Jul 2026, 08:00'),
        issuingMemberState,
        kind: 'cardUse',
        odometerAtInsertion: formatted(odometerAtInsertion, '12,340'),
        odometerAtWithdrawal: formatted(odometerAtWithdrawal, '12,620'),
        record,
        slot: 'Driver',
        source: record.source,
        startTimestamp: formatted(insertion, '27 Jul 2026, 08:00'),
        surname,
        withdrawal: formatted(withdrawal, '27 Jul 2026, 16:00'),
    };
}

function viewModel(documentKind: IAssociationSectionViewModel['documentKind']): IAssociationSectionViewModel {
    const record = documentKind === 'driverCard' ? vehicleUseViewModel() : cardUseViewModel();
    return {
        allCount: formatted(1, '1'),
        availableGenerations: ['g2'] as const,
        documentKind,
        filter: 'all',
        generationCounts: {
            g1: formatted(0, '0'),
            g2: formatted(1, '1'),
            g2v2: formatted(0, '0'),
        },
        locale: 'en',
        records: [record],
        timeZone: 'Europe/Berlin',
        totalCount: formatted(1, '1'),
    };
}

describe('AssociationsScreen', () => {
    it('renders card vehicle-use evidence with immediate generation and source actions', async () => {
        const filter = vi.fn();
        const openSource = vi.fn();
        const selectRecord = vi.fn();
        render(
            AssociationsScreen,
            {
                props: {
                    activityDayLabel: null,
                    activityDayMidnight: null,
                    filterText: createDocumentScopedValue(''),
                    onclearactivityday: vi.fn(),
                    onfilter: filter,
                    onopensource: openSource,
                    onselectrecord: selectRecord,
                    selectedRecord: null,
                    viewModel: viewModel('driverCard'),
                },
            },
            createViewerTestRenderOptions(),
        );

        const heading = screen.getByRole('heading', { level: 1, name: 'Vehicles' });
        expect(document.activeElement).toBe(heading);
        expect(screen.getByRole('button', { name: 'All records (1)', pressed: true })).toBeTruthy();
        const table = screen.getByRole('table', {
            name: 'Vehicle-use periods grouped by vehicle identity and ordered by first use',
        });
        expect(
            screen
                .getByRole('region', {
                    name: 'Vehicle-use periods grouped by vehicle identity and ordered by first use',
                })
                .classList.contains('table-shell'),
        ).toBe(true);
        expect(table.classList.contains('wide')).toBe(true);
        expect(within(table).getByText('TEST-123')).toBeTruthy();
        expect(within(table).getByText('WVWZZZ1JZXW000001')).toBeTruthy();
        expect(within(table).getByText('280 km')).toBeTruthy();

        await fireEvent.click(screen.getByRole('button', { name: 'Generation 2 (1)' }));
        expect(filter).toHaveBeenCalledWith('g2');

        await fireEvent.click(
            within(table).getByRole('button', {
                name: /Select association record: TEST-123/u,
            }),
        );
        expect(selectRecord).toHaveBeenCalledWith(
            expect.objectContaining({ kind: 'vehicleUse', registrationNumber: 'TEST-123' }),
        );

        await fireEvent.click(
            within(table).getByRole('button', {
                name: 'Open in Raw Data: /vehicles/0',
            }),
        );
        expect(openSource).toHaveBeenCalledWith(driverCardSource('/vehicles/0').path);
    });

    it('renders VU holder, card, slot, period, and odometer evidence', () => {
        render(
            AssociationsScreen,
            {
                props: {
                    activityDayLabel: null,
                    activityDayMidnight: null,
                    filterText: createDocumentScopedValue(''),
                    onclearactivityday: vi.fn(),
                    onfilter: vi.fn(),
                    onopensource: vi.fn(),
                    onselectrecord: vi.fn(),
                    selectedRecord: null,
                    viewModel: viewModel('vehicleUnit'),
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByRole('heading', { level: 1, name: 'Drivers & cards' })).toBeTruthy();
        const table = screen.getByRole('table', {
            name: 'Card insertion and withdrawal periods ordered chronologically',
        });
        expect(within(table).getByText(/Example/)).toBeTruthy();
        expect(within(table).getByText('SYNTHETIC0000001')).toBeTruthy();
        expect(within(table).getByText('Driver')).toBeTruthy();
        expect(within(table).getAllByText('12,340 km')).toHaveLength(1);
        expect(within(table).getAllByText('12,620 km')).toHaveLength(1);
    });

    it('renders explicit empty and projection-error states', async () => {
        const empty = {
            ...viewModel('driverCard'),
            records: [],
            totalCount: formatted(0, '0'),
        };
        const commonProps = {
            activityDayLabel: null,
            activityDayMidnight: null,
            filterText: createDocumentScopedValue(''),
            onclearactivityday: vi.fn(),
            onfilter: vi.fn(),
            onopensource: vi.fn(),
            onselectrecord: vi.fn(),
            selectedRecord: null,
        };
        const rendered = render(
            AssociationsScreen,
            {
                props: {
                    ...commonProps,
                    viewModel: empty,
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByText('No association records match the selected generation.')).toBeTruthy();

        await rendered.rerender({
            ...commonProps,
            viewModel: null,
        });
        expect(
            screen.getByRole('heading', {
                level: 2,
                name: 'Association records unavailable',
            }),
        ).toBeTruthy();
    });

    it('filters records to the linked activity day and offers a clear action', async () => {
        const clearActivityDay = vi.fn();
        render(
            AssociationsScreen,
            {
                props: {
                    activityDayLabel: 'July 27, 2026',
                    activityDayMidnight: timestamp(Date.UTC(2026, 6, 27)),
                    filterText: createDocumentScopedValue(''),
                    onclearactivityday: clearActivityDay,
                    onfilter: vi.fn(),
                    onopensource: vi.fn(),
                    onselectrecord: vi.fn(),
                    selectedRecord: null,
                    viewModel: viewModel('driverCard'),
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByText('Showing records for July 27, 2026')).toBeTruthy();
        const table = screen.getByRole('table', {
            name: 'Vehicle-use periods grouped by vehicle identity and ordered by first use',
        });
        expect(within(table).getAllByRole('row')).toHaveLength(2);
        expect(within(table).getByText('TEST-123')).toBeTruthy();
        expect(within(table).getByText('WVWZZZ1JZXW000001')).toBeTruthy();

        await fireEvent.click(screen.getByRole('button', { name: 'Show all records' }));
        expect(clearActivityDay).toHaveBeenCalledTimes(1);
    });

    it('shows the day-window empty message when no record overlaps the linked day', () => {
        render(
            AssociationsScreen,
            {
                props: {
                    activityDayLabel: 'July 28, 2026',
                    activityDayMidnight: timestamp(Date.UTC(2026, 6, 28)),
                    filterText: createDocumentScopedValue(''),
                    onclearactivityday: vi.fn(),
                    onfilter: vi.fn(),
                    onopensource: vi.fn(),
                    onselectrecord: vi.fn(),
                    selectedRecord: null,
                    viewModel: viewModel('driverCard'),
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByText('No records are present for the selected day.')).toBeTruthy();
        expect(
            screen.queryByRole('table', {
                name: 'Vehicle-use periods grouped by vehicle identity and ordered by first use',
            }),
        ).toBeNull();
    });

    it('renders vehicle-unit-use records beside vehicle uses with device evidence', async () => {
        const selectRecord = vi.fn();
        render(
            AssociationsScreen,
            {
                props: {
                    activityDayLabel: null,
                    activityDayMidnight: null,
                    filterText: createDocumentScopedValue(''),
                    onclearactivityday: vi.fn(),
                    onfilter: vi.fn(),
                    onopensource: vi.fn(),
                    onselectrecord: selectRecord,
                    selectedRecord: null,
                    viewModel: {
                        allCount: formatted(2, '2'),
                        availableGenerations: ['g2'] as const,
                        documentKind: 'driverCard',
                        filter: 'all',
                        generationCounts: {
                            g1: formatted(0, '0'),
                            g2: formatted(2, '2'),
                            g2v2: formatted(0, '0'),
                        },
                        locale: 'en',
                        records: [vehicleUseViewModel(), vehicleUnitUseViewModel()],
                        timeZone: 'Europe/Berlin',
                        totalCount: formatted(2, '2'),
                    },
                },
            },
            createViewerTestRenderOptions(),
        );

        const table = screen.getByRole('table', {
            name: 'Vehicle-use periods grouped by vehicle identity and ordered by first use',
        });
        expect(within(table).getAllByRole('row')).toHaveLength(3);
        expect(within(table).getByText('27 Jul 2026, 10:00')).toBeTruthy();
        expect(within(table).getByText('123456')).toBeTruthy();
        expect(within(table).getAllByText('0001')).toHaveLength(2);

        const unitButton = within(table).getByRole('button', {
            name: 'Select association record: VU device 123456, 27 Jul 2026, 10:00',
        });
        await fireEvent.click(unitButton);
        expect(selectRecord).toHaveBeenCalledWith(expect.objectContaining({ kind: 'vehicleUnitUse', deviceID: 123_456 }));
    });

    it('renders the screen container with fill-height layout for fixed viewport data grid', () => {
        const { container } = render(
            AssociationsScreen,
            {
                props: {
                    activityDayLabel: null,
                    activityDayMidnight: null,
                    filterText: createDocumentScopedValue(''),
                    onclearactivityday: vi.fn(),
                    onfilter: vi.fn(),
                    onopensource: vi.fn(),
                    onselectrecord: vi.fn(),
                    selectedRecord: null,
                    viewModel: viewModel('vehicleUnit'),
                },
            },
            createViewerTestRenderOptions(),
        );

        const article = container.querySelector('article.associations-screen');
        expect(article).not.toBeNull();
        expect(article?.classList.contains('fill-height')).toBe(true);
        const dataTable = container.querySelector('.table-shell');
        expect(dataTable?.classList.contains('fill-height')).toBe(true);
    });
});
