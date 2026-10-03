import {
    createSourceReference,
    createTachographEvent,
    createTachographFault,
    isDurationMilliseconds,
    isIssuingMemberState,
    isJsonPointer,
    isUtcTimestamp,
    isVehicleRegistrationNumber,
    type DurationMilliseconds,
    type ISourceReference,
    type TachographEventFault,
    type UtcTimestamp,
} from '#viewer-domain';
import type { IEventFaultRecordViewModel, IEventFaultSectionViewModel, IFormattedValue } from '#viewer-presentation';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import EventsFaultsScreen from '../components/screens/EventsFaultsScreen.svelte';
import { createDocumentScopedValue } from '../controllers/document-scoped-value.svelte.js';
import { createViewerTestRenderOptions } from './viewer-test-render.js';

afterEach(() => {
    cleanup();
});

function timestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The event and fault screen timestamp fixture must be valid.');
    }
    return value;
}

function duration(value: number): DurationMilliseconds {
    if (!isDurationMilliseconds(value)) {
        throw new TypeError('The event and fault screen duration fixture must be valid.');
    }
    return value;
}

function source(path: string): ISourceReference<'g1', 'driverCard'> {
    if (!isJsonPointer(path)) {
        throw new TypeError('The event and fault screen source fixture must be valid.');
    }
    return createSourceReference('driverCard', 'g1', path);
}

function formatted<TValue>(value: TValue, display: string): IFormattedValue<TValue> {
    return { display, value };
}

function records(): readonly [IEventFaultRecordViewModel, IEventFaultRecordViewModel] {
    const event = createTachographEvent({
        code: 'cardConflict',
        end: null,
        recordKind: 'event',
        recordPurpose: null,
        registrationMemberState: null,
        registrationNumber: null,
        similarOccurrences: null,
        source: source('/events/0'),
        start: timestamp(Date.UTC(2026, 6, 27, 8, 15)),
    });
    const memberState = 'D';
    const registrationNumber = 'TEST-123';
    if (!isIssuingMemberState(memberState) || !isVehicleRegistrationNumber(registrationNumber)) {
        throw new TypeError('The event and fault screen registration fixture must be valid.');
    }
    const fault = createTachographFault({
        code: 'recordingEquipmentPrinterFault',
        end: timestamp(Date.UTC(2026, 6, 27, 10, 24)),
        recordKind: 'fault',
        recordPurpose: 'active',
        registrationMemberState: memberState,
        registrationNumber,
        similarOccurrences: 2,
        source: source('/faults/0'),
        start: timestamp(Date.UTC(2026, 6, 27, 10, 20)),
    });
    if (event === null || fault === null) {
        throw new TypeError('The event and fault screen records must be valid.');
    }

    return [
        eventFaultRecord(event, '27 Jul 2026, 08:15', null, null),
        eventFaultRecord(fault, '27 Jul 2026, 10:20', '27 Jul 2026, 10:24', '4 min'),
    ];
}

function eventFaultRecord(
    record: TachographEventFault,
    startDisplay: string,
    endDisplay: string | null,
    durationDisplay: string | null,
): IEventFaultRecordViewModel {
    const recordDuration =
        record.end === null || durationDisplay === null ? null : formatted(duration(record.end - record.start), durationDisplay);
    return {
        code: record.code,
        duration: recordDuration,
        end: record.end === null || endDisplay === null ? null : formatted(record.end, endDisplay),
        generation: 'g1',
        record,
        recordKind: record.recordKind,
        recordPurpose: record.recordPurpose,
        registrationMemberState: record.registrationMemberState,
        registrationNumber: record.registrationNumber,
        searchValues: [startDisplay, record.source.path],
        securityCategory: 'operationalNotice',
        similarOccurrences:
            record.similarOccurrences === null ? null : formatted(record.similarOccurrences, String(record.similarOccurrences)),
        source: record.source,
        start: formatted(record.start, startDisplay),
    };
}

function viewModel(filter: IEventFaultSectionViewModel['filter'] = 'all'): IEventFaultSectionViewModel {
    const allRecords = records();
    const filteredRecords = allRecords.filter((record) => filter === 'all' || record.recordKind === filter);

    return {
        allCount: formatted(2, '2'),
        eventCount: formatted(1, '1'),
        faultCount: formatted(1, '1'),
        filter,
        locale: 'en',
        records: filteredRecords,
        securityCriticalCount: formatted(0, '0'),
        timeZone: 'Europe/Berlin',
        totalCount: formatted(filteredRecords.length, String(filteredRecords.length)),
    };
}

describe('EventsFaultsScreen', () => {
    it('renders factual records and emits immediate typed filter and source actions', async () => {
        const filter = vi.fn();
        const openSource = vi.fn();
        const selectRecord = vi.fn();
        const rendered = render(
            EventsFaultsScreen,
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
                    viewModel: viewModel(),
                },
            },
            createViewerTestRenderOptions(),
        );

        const heading = screen.getByRole('heading', { level: 1, name: 'Events & faults' });
        expect(document.activeElement).toBe(heading);
        expect(screen.getByRole('button', { name: 'All (2)', pressed: true })).toBeTruthy();
        expect(screen.getByText('Europe/Berlin')).toBeTruthy();

        const table = screen.getByRole('table', {
            name: 'Chronological event and fault records',
        });
        const tableRegion = screen.getByRole('region', {
            name: 'Chronological event and fault records',
        });
        expect(tableRegion.classList.contains('table-shell')).toBe(true);
        expect(table.classList.contains('wide')).toBe(true);
        expect(within(table).getAllByRole('row')).toHaveLength(3);
        expect(within(table).getByText('cardConflict')).toBeTruthy();
        expect(within(table).queryByRole('button', { name: 'Card conflict' })).toBeNull();
        expect(within(table).getByText('Record purpose')).toBeTruthy();
        expect(within(table).getByText('Active event or fault')).toBeTruthy();
        expect(within(table).getByText('TEST-123')).toBeTruthy();
        expect(table.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(4);

        await fireEvent.click(screen.getByRole('button', { name: 'Faults (1)' }));
        expect(filter).toHaveBeenCalledWith('fault');

        await fireEvent.click(
            within(table).getByRole('button', {
                name: /Select event or fault record: Event/u,
            }),
        );
        expect(selectRecord).toHaveBeenCalledWith(expect.objectContaining({ code: 'cardConflict', recordKind: 'event' }));

        await fireEvent.click(
            within(table).getByRole('button', {
                name: 'Open in Raw Data: /faults/0',
            }),
        );
        expect(openSource).toHaveBeenCalledWith(source('/faults/0').path);

        const faultViewModel = viewModel('fault');
        await rendered.rerender({
            onfilter: filter,
            onopensource: openSource,
            viewModel: faultViewModel,
        });
        expect(screen.getByRole('button', { name: 'Faults (1)', pressed: true })).toBeTruthy();
        expect(screen.getByText('Recording equipment printer fault')).toBeTruthy();
        expect(screen.queryByText('cardConflict')).toBeNull();
    });

    it('renders filter-specific empty and projection-error states', async () => {
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
        const emptyViewModel = {
            allCount: formatted(1, '1'),
            eventCount: formatted(1, '1'),
            faultCount: formatted(0, '0'),
            filter: 'fault' as const,
            locale: 'en',
            records: [],
            securityCriticalCount: formatted(0, '0'),
            timeZone: 'UTC',
            totalCount: formatted(0, '0'),
        };
        const rendered = render(
            EventsFaultsScreen,
            {
                props: {
                    ...commonProps,
                    viewModel: emptyViewModel,
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByText('No fault records were decoded from this file.')).toBeTruthy();

        await rendered.rerender({
            ...commonProps,
            viewModel: null,
        });
        expect(screen.getByRole('heading', { name: 'Events and faults unavailable' })).toBeTruthy();
        expect(
            screen.getByText('The decoded event and fault records could not be mapped to a safe presentation model.'),
        ).toBeTruthy();
    });

    it('filters records to the linked activity day and offers a clear action', async () => {
        const clearActivityDay = vi.fn();
        render(
            EventsFaultsScreen,
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
                    viewModel: viewModel(),
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByText('Showing records for July 27, 2026')).toBeTruthy();
        const table = screen.getByRole('table', {
            name: 'Chronological event and fault records',
        });
        expect(within(table).getAllByRole('row')).toHaveLength(3);
        expect(within(table).getByText('cardConflict')).toBeTruthy();
        expect(within(table).getByText('Recording equipment printer fault')).toBeTruthy();

        await fireEvent.click(screen.getByRole('button', { name: 'Show all records' }));
        expect(clearActivityDay).toHaveBeenCalledTimes(1);
    });

    it('shows the day-window empty message when no record overlaps the linked day', () => {
        render(
            EventsFaultsScreen,
            {
                props: {
                    activityDayLabel: 'July 26, 2026',
                    activityDayMidnight: timestamp(Date.UTC(2026, 6, 26)),
                    filterText: createDocumentScopedValue(''),
                    onclearactivityday: vi.fn(),
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
        expect(screen.queryByRole('table', { name: 'Chronological event and fault records' })).toBeNull();
    });

    it('presents security-critical records as neutral indicators requiring diagnosis, never as a tampering finding (VIEWER-07)', () => {
        const allRecords = records();
        const [event, fault] = allRecords;
        const securityCriticalViewModel: IEventFaultSectionViewModel = {
            allCount: formatted(2, '2'),
            eventCount: formatted(1, '1'),
            faultCount: formatted(1, '1'),
            filter: 'all',
            locale: 'en',
            records: [{ ...event, securityCategory: 'securityCritical' }, fault],
            securityCriticalCount: formatted(1, '1'),
            timeZone: 'Europe/Berlin',
            totalCount: formatted(2, '2'),
        };

        render(
            EventsFaultsScreen,
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
                    viewModel: securityCriticalViewModel,
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByText('Security-relevant indicators')).toBeTruthy();
        expect(screen.getByText('1 security-relevant indicators recorded')).toBeTruthy();
        expect(
            screen.getByText(
                'These are recorded event/fault codes that may warrant diagnosis - a power interruption, motion-data error, or similar code is not by itself proof of tampering or sabotage. Review each record below for what it actually reports.',
            ),
        ).toBeTruthy();
        expect(screen.getAllByText('Security-relevant')).not.toHaveLength(0);
        // Assertive tampering allegations must not appear in UI copy.
        expect(screen.queryByText('Security & tampering alerts')).toBeNull();
        expect(screen.queryByText(/critical security alerts? detected/iu)).toBeNull();
    });

    it('renders the screen container with fill-height layout for fixed viewport data grid', () => {
        const [event, fault] = records();
        const viewModel: IEventFaultSectionViewModel = {
            allCount: formatted(2, '2'),
            eventCount: formatted(1, '1'),
            faultCount: formatted(1, '1'),
            filter: 'all',
            locale: 'en',
            records: [event, fault],
            securityCriticalCount: formatted(0, '0'),
            timeZone: 'Europe/Berlin',
            totalCount: formatted(2, '2'),
        };

        const { container } = render(
            EventsFaultsScreen,
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
                    viewModel,
                },
            },
            createViewerTestRenderOptions(),
        );

        const article = container.querySelector('article.events-faults-screen');
        expect(article).not.toBeNull();
        expect(article?.classList.contains('fill-height')).toBe(true);
        const dataTable = container.querySelector('.table-shell');
        expect(dataTable?.classList.contains('fill-height')).toBe(true);
    });
});
