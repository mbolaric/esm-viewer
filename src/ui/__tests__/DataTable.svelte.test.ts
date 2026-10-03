import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DataTable from '../data-table/DataTable.svelte';
import type { IDataTableColumn } from '../data-table/data-table-column.js';
import type { IDataTableLabels } from '../data-table/data-table-labels.js';
import type { IDataTablePaginationLabels, IDataTablePaginationPreferencesStore } from '../data-table/data-table-pagination.js';
import type { ITableToolingBinding } from '../data-table/table-tooling.js';

afterEach(() => {
    cleanup();
});

interface ITestRow {
    readonly id: string;
    readonly name: string;
    readonly value: number;
}

const rows: readonly ITestRow[] = [
    { id: '1', name: 'Alpha', value: 10 },
    { id: '2', name: 'Beta', value: 20 },
];

// Narrows erased row type to ITestRow since render() erases generic TRow to unknown.
function isTestRow(value: unknown): value is ITestRow {
    return typeof value === 'object' && value !== null && 'id' in value;
}

function textCell(field: keyof ITestRow): ReturnType<typeof createRawSnippet<[unknown]>> {
    return createRawSnippet<[unknown]>((itemGetter) => ({
        render: () => {
            const item = itemGetter();
            return `<span>${isTestRow(item) ? String(item[field]) : ''}</span>`;
        },
    }));
}

const columns: readonly IDataTableColumn<unknown>[] = [
    { cell: textCell('id'), id: 'id', label: 'ID', sortable: true },
    { cell: textCell('name'), id: 'name', label: 'Name', sortable: true },
    { cell: textCell('value'), id: 'value', label: 'Value', sortable: true },
];

const paginatedRows: readonly ITestRow[] = Array.from({ length: 105 }, (_, index) => ({
    id: String(index + 1),
    name: `Record ${String(index + 1)}`,
    value: index + 1,
}));

const paginationLabels: IDataTablePaginationLabels = {
    navigation: 'Table pagination',
    nextPage: 'Next page',
    previousPage: 'Previous page',
    rowsPerPage: 'Rows per page',
    status: ({ end, page, pageCount, start, total }) =>
        `Showing rows ${String(start)}–${String(end)} of ${String(total)}; page ${String(page)} of ${String(pageCount)}`,
};

function rowKey(item: unknown): string {
    if (!isTestRow(item)) {
        throw new TypeError('Expected a test row.');
    }
    return item.id;
}

const columnMenuLabels: IDataTableLabels = { columns: 'Columns', pinColumn: 'Keep column visible' };
const labels: IDataTableLabels = {
    ...columnMenuLabels,
    filter: { clear: 'Clear filter', label: 'Filter records', placeholder: 'Search current records' },
};

// Optional test render options applied over DataTable required defaults.
interface IRenderDataTableOptions {
    readonly columns?: readonly IDataTableColumn<unknown>[];
    readonly fillHeight?: boolean;
    readonly filterSummaryLabel?: string;
    readonly filterText?: string;
    readonly hiddenColumnIds?: ReadonlySet<string>;
    readonly labels?: IDataTableLabels;
    readonly onfilterchange?: (text: string) => void;
    readonly onsort?: (columnId: string) => void;
    readonly ontogglecolumn?: (columnId: string) => void;
    readonly paginationLabels?: IDataTablePaginationLabels;
    readonly paginationPreferenceKey?: string;
    readonly paginationPreferencesStore?: IDataTablePaginationPreferencesStore;
    readonly rows?: readonly ITestRow[];
    readonly tooling?: ITableToolingBinding;
}

function renderDataTable(options: IRenderDataTableOptions = {}): ReturnType<typeof render> {
    return render(DataTable, {
        props: {
            caption: 'Records',
            columns,
            rowKey,
            rows,
            ...options,
        },
    });
}

describe('DataTable', () => {
    it('renders caption, headers, and rows', () => {
        renderDataTable();

        expect(screen.getByRole('table', { name: 'Records' })).toBeTruthy();
        expect(screen.getByRole('columnheader', { name: 'ID' })).toBeTruthy();
        expect(screen.getByRole('columnheader', { name: 'Name' })).toBeTruthy();
        expect(screen.getByRole('columnheader', { name: 'Value' })).toBeTruthy();
        expect(screen.getByText('Alpha')).toBeTruthy();
        expect(screen.getByText('20')).toBeTruthy();
    });

    it('announces the current sort state and cycles through columns', async () => {
        const onsort = vi.fn();
        const rendered = renderDataTable({ onsort });

        const nameHeader = screen.getByRole('columnheader', { name: 'Name' });
        expect(nameHeader.getAttribute('aria-sort')).toBe('none');

        const sortButton = screen.getByRole('button', { name: /Name/ });
        await fireEvent.click(sortButton);
        expect(onsort).toHaveBeenCalledWith('name');

        await rendered.rerender({
            sortState: { columnId: 'name', direction: 'asc' },
        });
        expect(nameHeader.getAttribute('aria-sort')).toBe('ascending');

        await rendered.rerender({
            sortState: { columnId: 'name', direction: 'desc' },
        });
        expect(nameHeader.getAttribute('aria-sort')).toBe('descending');
    });

    it('filters through the search input and toolbar', async () => {
        const onfilterchange = vi.fn();
        const rendered = renderDataTable({
            filterSummaryLabel: '2 of 2 records shown',
            filterText: '',
            labels,
            onfilterchange,
        });

        const search = screen.getByRole('searchbox', { name: 'Filter records' });
        await fireEvent.input(search, { target: { value: 'alpha' } });
        expect(onfilterchange).toHaveBeenCalledWith('alpha');

        expect(screen.getByRole('status').textContent).toBe('2 of 2 records shown');

        await rendered.rerender({ filterText: 'alpha' });
        const clearButton = screen.getByRole('button', { name: 'Clear filter' });
        await fireEvent.click(clearButton);
        expect(onfilterchange).toHaveBeenCalledWith('');
    });

    it('shows only visible columns and toggles them from the caption menu', async () => {
        const ontogglecolumn = vi.fn();
        const rendered = renderDataTable({
            hiddenColumnIds: new Set(['value']),
            labels: columnMenuLabels,
            ontogglecolumn,
        });

        expect(screen.queryByRole('columnheader', { name: 'Value' })).toBeNull();
        expect(screen.getByRole('columnheader', { name: 'ID' })).toBeTruthy();

        await fireEvent.click(screen.getByTitle('Columns'));
        const valueToggle = screen.getByRole('checkbox', { name: 'Value' });
        if (!(valueToggle instanceof HTMLInputElement)) {
            throw new TypeError('The column toggle must be an input element.');
        }
        expect(valueToggle.checked).toBe(false);
        await fireEvent.click(valueToggle);
        expect(ontogglecolumn).toHaveBeenCalledWith('value');

        await rendered.rerender({ hiddenColumnIds: new Set() });
        expect(screen.getByRole('columnheader', { name: 'Value' })).toBeTruthy();
    });

    it('shows the column menu but no filter field when only column-menu labels are given', () => {
        renderDataTable({ labels: columnMenuLabels, onfilterchange: vi.fn(), ontogglecolumn: vi.fn() });

        expect(screen.getByTitle('Columns')).toBeTruthy();
        expect(screen.queryByRole('searchbox')).toBeNull();
    });

    it('keeps the caption as the table name while the menu is present', () => {
        renderDataTable({ labels: columnMenuLabels, ontogglecolumn: vi.fn() });

        expect(screen.getByRole('table', { name: 'Records' })).toBeTruthy();
    });

    it('applies compact and column-id classes when compact is enabled', () => {
        renderDataTable({
            columns: [
                { cell: textCell('id'), compact: true, id: 'action', label: 'Actions' },
                { cell: textCell('name'), id: 'name', label: 'Name' },
            ],
        });

        const actionHeader = screen.getByRole('columnheader', { name: 'Actions' });
        expect(actionHeader.classList.contains('compact')).toBe(true);
        expect(actionHeader.classList.contains('col-action')).toBe(true);
        expect(actionHeader.getAttribute('data-column-id')).toBe('action');

        const nameHeader = screen.getByRole('columnheader', { name: 'Name' });
        expect(nameHeader.classList.contains('compact')).toBe(false);
        expect(nameHeader.classList.contains('col-name')).toBe(true);
    });

    it('applies fill-height class when fillHeight prop is enabled', () => {
        renderDataTable({ fillHeight: true });

        const region = screen.getByRole('region', { name: 'Records' });
        expect(region.classList.contains('fill-height')).toBe(true);
    });

    it('paginates rows with an accessible status and bounded page controls', async () => {
        renderDataTable({ paginationLabels, rows: paginatedRows });

        expect(screen.getByRole('navigation', { name: 'Table pagination' })).toBeTruthy();
        expect(screen.getByRole('status').textContent).toBe('Showing rows 1–50 of 105; page 1 of 3');
        expect(screen.getByText('Record 50')).toBeTruthy();
        expect(screen.queryByText('Record 51')).toBeNull();

        const previousButton = screen.getByRole('button', { name: 'Previous page' });
        const nextButton = screen.getByRole('button', { name: 'Next page' });
        expect(previousButton.hasAttribute('disabled')).toBe(true);
        expect(nextButton.hasAttribute('disabled')).toBe(false);

        await fireEvent.click(nextButton);
        expect(screen.getByRole('status').textContent).toBe('Showing rows 51–100 of 105; page 2 of 3');
        expect(screen.queryByText('Record 50')).toBeNull();
        expect(screen.getByText('Record 51')).toBeTruthy();

        await fireEvent.click(nextButton);
        expect(screen.getByRole('status').textContent).toBe('Showing rows 101–105 of 105; page 3 of 3');
        expect(nextButton.hasAttribute('disabled')).toBe(true);
        expect(previousButton.hasAttribute('disabled')).toBe(false);
    });

    it('offers 25, 50, and 100 rows per page and returns to page one when changed', async () => {
        renderDataTable({ paginationLabels, rows: paginatedRows });

        await fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
        const pageSizeControl = screen.getByRole('combobox', { name: 'Rows per page' });
        expect(Array.from(pageSizeControl.querySelectorAll('option')).map((option) => option.value)).toEqual(['25', '50', '100']);

        await fireEvent.change(pageSizeControl, { target: { value: '25' } });
        expect(screen.getByRole('status').textContent).toBe('Showing rows 1–25 of 105; page 1 of 5');
        expect(screen.getByText('Record 25')).toBeTruthy();
        expect(screen.queryByText('Record 26')).toBeNull();
    });

    it('loads and saves the page size through a keyed preferences store', async () => {
        const setPageSize = vi.fn<IDataTablePaginationPreferencesStore['setPageSize']>();
        const preferencesStore: IDataTablePaginationPreferencesStore = {
            getPageSize: (preferenceKey) => (preferenceKey === 'viewer.documents' ? 25 : 50),
            setPageSize,
        };
        renderDataTable({
            paginationLabels,
            paginationPreferenceKey: 'viewer.documents',
            paginationPreferencesStore: preferencesStore,
            rows: paginatedRows,
        });

        expect(screen.getByRole('status').textContent).toBe('Showing rows 1–25 of 105; page 1 of 5');

        await fireEvent.change(screen.getByRole('combobox', { name: 'Rows per page' }), {
            target: { value: '100' },
        });

        expect(setPageSize).toHaveBeenCalledWith('viewer.documents', 100);
        expect(screen.getByRole('status').textContent).toBe('Showing rows 1–100 of 105; page 1 of 2');
    });

    it('returns to page one when filtering, sorting, or the supplied rows change', async () => {
        const onfilterchange = vi.fn();
        const onsort = vi.fn();
        const rendered = renderDataTable({
            labels,
            onfilterchange,
            onsort,
            paginationLabels,
            rows: paginatedRows,
        });

        const nextButton = screen.getByRole('button', { name: 'Next page' });
        await fireEvent.click(nextButton);
        await fireEvent.input(screen.getByRole('searchbox', { name: 'Filter records' }), {
            target: { value: 'record' },
        });
        expect(onfilterchange).toHaveBeenCalledWith('record');
        expect(screen.getByRole('status').textContent).toContain('page 1 of 3');

        await fireEvent.click(nextButton);
        await fireEvent.click(screen.getByRole('button', { name: /Name/ }));
        expect(onsort).toHaveBeenCalledWith('name');
        expect(screen.getByRole('status').textContent).toContain('page 1 of 3');

        await fireEvent.click(nextButton);
        await rendered.rerender({ rows: paginatedRows.slice(0, 40) });
        await waitFor(() => {
            expect(screen.getByRole('status').textContent).toBe('Showing rows 1–40 of 40; page 1 of 1');
        });
    });

    it('renders a pinned header outside the scrollable body, with the scrollbar covering only the rows, when fillHeight is enabled', async () => {
        const { container } = renderDataTable({ fillHeight: true });

        const headerContainer = container.querySelector<HTMLDivElement>('.table-header-container');
        const bodyScroll = container.querySelector<HTMLDivElement>('.table-body-scroll');
        expect(headerContainer).toBeTruthy();
        expect(bodyScroll).toBeTruthy();

        // Pinned header is decorative (aria-hidden); exactly one interactive header exposed to assistive tech.
        const pinnedTable = headerContainer?.querySelector('table');
        expect(pinnedTable?.getAttribute('aria-hidden')).toBe('true');
        expect(screen.getAllByRole('columnheader', { name: 'Name' }).length).toBe(1);

        if (bodyScroll !== null && headerContainer !== null) {
            Object.defineProperty(bodyScroll, 'scrollLeft', { value: 75, writable: true });
            await fireEvent.scroll(bodyScroll);
            expect(headerContainer.scrollLeft).toBe(75);
        }
    });

    it('paginates only the accessible body rows in fill-height mode', async () => {
        renderDataTable({ fillHeight: true, paginationLabels, rows: paginatedRows });

        expect(screen.getByText('Record 50')).toBeTruthy();
        expect(screen.queryByText('Record 51')).toBeNull();

        await fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
        expect(screen.queryByText('Record 50')).toBeNull();
        expect(screen.getByText('Record 51')).toBeTruthy();
        expect(screen.getAllByRole('columnheader', { name: 'Name' }).length).toBe(1);
    });

    it('binds sort, filter, and column visibility through tooling prop', async () => {
        const toggleSort = vi.fn();
        const setFilterText = vi.fn();
        const toggleColumn = vi.fn();
        const tooling: ITableToolingBinding = {
            filterText: 'initial-filter',
            hiddenColumnIds: new Set(['id']),
            setFilterText,
            sort: { columnId: 'value', direction: 'desc' },
            toggleColumn,
            toggleSort,
        };

        renderDataTable({
            labels,
            tooling,
        });

        const search = screen.getByRole('searchbox', { name: 'Filter records' });
        if (!(search instanceof HTMLInputElement)) {
            throw new TypeError('The table filter must be an input element.');
        }
        expect(search.value).toBe('initial-filter');

        await fireEvent.input(search, { target: { value: 'new-query' } });
        expect(setFilterText).toHaveBeenCalledWith('new-query');

        const valueHeader = screen.getByRole('columnheader', { name: 'Value' });
        expect(valueHeader.getAttribute('aria-sort')).toBe('descending');

        const nameButton = screen.getByRole('button', { name: /Name/ });
        await fireEvent.click(nameButton);
        expect(toggleSort).toHaveBeenCalledWith('name');

        expect(screen.queryByRole('columnheader', { name: 'ID' })).toBeNull();

        const columnMenuTrigger = screen.getByTitle('Columns');
        await fireEvent.click(columnMenuTrigger);
        const nameCheckbox = screen.getByRole('checkbox', { name: 'Name' });
        await fireEvent.click(nameCheckbox);
        expect(toggleColumn).toHaveBeenCalledWith('name');
    });
});

describe('DataTable column cells', () => {
    const cellColumns = [
        { cell: textCell('id'), id: 'id', label: 'ID' },
        { cell: textCell('name'), id: 'name', label: 'Name' },
        {
            align: 'numeric' as const,
            cell: textCell('value'),
            cellClass: 'value-cell',
            compact: true,
            id: 'value',
            label: 'Value',
        },
    ];

    it('renders each row from column cells without a row snippet', () => {
        render(DataTable, {
            props: { caption: 'Cells', columns: cellColumns, rowKey: (item: unknown) => (isTestRow(item) ? item.id : ''), rows },
        });

        const bodyRows = document.querySelectorAll('tbody tr');
        expect(bodyRows).toHaveLength(2);
        expect(screen.getByText('Alpha').closest('td')?.classList.contains('col-name')).toBe(true);
        const valueCell = bodyRows[0]?.querySelector('td.col-value');
        expect(valueCell?.textContent).toBe('10');
        expect(valueCell?.classList.contains('numeric-cell')).toBe(true);
        expect(valueCell?.classList.contains('value-cell')).toBe(true);
        expect(valueCell?.classList.contains('compact-cell')).toBe(true);
        expect(screen.getByText('Alpha').closest('td')?.classList.contains('compact-cell')).toBe(false);
    });

    it('hides the cells of hidden columns', () => {
        render(DataTable, {
            props: {
                caption: 'Cells',
                columns: cellColumns,
                hiddenColumnIds: new Set(['name']),
                rowKey: (item: unknown) => (isTestRow(item) ? item.id : ''),
                rows,
            },
        });

        expect(screen.getByText('Alpha').closest('td')?.hidden).toBe(true);
        expect(screen.getByText('1').closest('td')?.hidden).toBe(false);
    });

    it('marks rows as selectable and reports the selected one', () => {
        render(DataTable, {
            props: {
                caption: 'Cells',
                columns: cellColumns,
                isRowSelected: (item: unknown) => isTestRow(item) && item.id === '2',
                rowKey: (item: unknown) => (isTestRow(item) ? item.id : ''),
                rows,
            },
        });

        const bodyRows = document.querySelectorAll('tbody tr');
        expect(bodyRows[0]?.getAttribute('data-selectable')).toBe('true');
        expect(bodyRows[0]?.getAttribute('aria-selected')).toBe('false');
        expect(bodyRows[1]?.getAttribute('aria-selected')).toBe('true');
    });
});
