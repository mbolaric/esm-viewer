import { describe, expect, it } from 'vitest';

import {
    cycleTableSortState,
    filterTableRows,
    selectVisibleTableColumns,
    sortTableRows,
    type ITableColumnDescriptor,
    type ITableSortState,
} from '../data-table/table-tooling.js';

interface ITestRow {
    readonly name: string;
    readonly rank: number | null;
}

const rows: readonly ITestRow[] = [
    { name: 'bravo', rank: 2 },
    { name: 'alpha', rank: 1 },
    { name: 'charlie', rank: null },
];

const columns: readonly ITableColumnDescriptor[] = [
    { id: 'name', label: 'Name', sortable: true },
    { id: 'rank', label: 'Rank', sortable: true },
];

const sortValue = (row: ITestRow, columnId: string): string | number | null => {
    switch (columnId) {
        case 'name':
            return row.name;
        case 'rank':
            return row.rank;
        default:
            return null;
    }
};

describe('cycleTableSortState', () => {
    it('starts ascending, moves to descending, then clears', () => {
        const first: ITableSortState | null = cycleTableSortState(null, 'name');
        expect(first).toEqual({ columnId: 'name', direction: 'asc' });
        const second: ITableSortState | null = cycleTableSortState(first, 'name');
        expect(second).toEqual({ columnId: 'name', direction: 'desc' });
        expect(cycleTableSortState(second, 'name')).toBeNull();
    });

    it('resets to ascending when the column changes', () => {
        const current: ITableSortState = { columnId: 'name', direction: 'desc' };
        expect(cycleTableSortState(current, 'rank')).toEqual({
            columnId: 'rank',
            direction: 'asc',
        });
    });
});

describe('sortTableRows', () => {
    it('returns the original rows without a sort state', () => {
        expect(sortTableRows(rows, null, sortValue)).toEqual(rows);
    });

    it('sorts ascending and descending by string values', () => {
        const ascending: ITableSortState = { columnId: 'name', direction: 'asc' };
        expect(sortTableRows(rows, ascending, sortValue).map((row) => row.name)).toEqual(['alpha', 'bravo', 'charlie']);
        const descending: ITableSortState = { columnId: 'name', direction: 'desc' };
        expect(sortTableRows(rows, descending, sortValue).map((row) => row.name)).toEqual(['charlie', 'bravo', 'alpha']);
    });

    it('sorts numbers numerically', () => {
        const ascending: ITableSortState = { columnId: 'rank', direction: 'asc' };
        expect(sortTableRows(rows, ascending, sortValue).map((row) => row.name)).toEqual(['alpha', 'bravo', 'charlie']);
        const descending: ITableSortState = { columnId: 'rank', direction: 'desc' };
        expect(sortTableRows(rows, descending, sortValue).map((row) => row.name)).toEqual(['bravo', 'alpha', 'charlie']);
    });
});

// Stand-in for the application's diacritic-insensitive search normalisation, which callers inject.
function normalizeTestText(text: string): string {
    return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

describe('filterTableRows', () => {
    it('keeps rows whose values contain the normalized filter text', () => {
        expect(filterTableRows(rows, ' ALPHA ', (row) => [row.name], normalizeTestText)).toEqual([rows[1]]);
        expect(filterTableRows(rows, 'charlie', (row) => [row.name], normalizeTestText)).toEqual([rows[2]]);
    });

    it('applies the injected normalisation to both the filter and the values', () => {
        const names: readonly ITestRow[] = [
            { name: 'Bölar', rank: 1 },
            { name: 'Čačić', rank: 2 },
            { name: 'Other', rank: 3 },
        ];

        expect(filterTableRows(names, 'bolar', (row) => [row.name], normalizeTestText)).toEqual([names[0]]);
        expect(filterTableRows(names, 'CACIC', (row) => [row.name], normalizeTestText)).toEqual([names[1]]);
        expect(filterTableRows(names, 'Bölar', (row) => [row.name], normalizeTestText)).toEqual([names[0]]);
    });

    it('keeps all rows for an empty or whitespace-only filter', () => {
        expect(filterTableRows(rows, '', (row) => [row.name], normalizeTestText)).toEqual(rows);
        expect(filterTableRows(rows, '  ', (row) => [row.name], normalizeTestText)).toEqual(rows);
    });
});

describe('selectVisibleTableColumns', () => {
    it('drops hidden column ids and preserves order', () => {
        const visible = selectVisibleTableColumns(columns, new Set(['rank']));
        expect(visible.map((column) => column.id)).toEqual(['name']);
        expect(selectVisibleTableColumns(columns, new Set())).toEqual(columns);
    });
});
