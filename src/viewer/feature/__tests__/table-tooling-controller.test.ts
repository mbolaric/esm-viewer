import { describe, expect, it } from 'vitest';

import { TableToolingController } from '../controllers/table-tooling-controller.svelte.js';
import { createDocumentScopedValue } from '../controllers/document-scoped-value.svelte.js';

interface ITestRow {
    readonly id: string;
    readonly name: string;
    readonly value: number | null;
}

const columns = [
    { id: 'id', label: 'ID', sortable: true },
    { id: 'name', label: 'Name', sortable: true },
    { id: 'value', label: 'Value', sortable: true },
];

const rows: readonly ITestRow[] = [
    { id: 'b', name: 'Beta', value: 2 },
    { id: 'a', name: 'Alpha', value: 1 },
    { id: 'c', name: 'Gamma', value: null },
];

function controller(): TableToolingController<ITestRow> {
    const filterText = createDocumentScopedValue('');
    return new TableToolingController<ITestRow>({
        columns: () => columns,
        filterText: () => filterText,
        filterValues: (row) => [row.id, row.name, String(row.value ?? '')],
        sortValue: (row, columnId) => {
            switch (columnId) {
                case 'id':
                    return row.id;
                case 'name':
                    return row.name;
                case 'value':
                    return row.value;
                default:
                    return null;
            }
        },
    });
}

describe('TableToolingController', () => {
    it('keeps rows and columns unchanged without filter or sort', () => {
        const tooling = controller();
        const snapshot = tooling.snapshot(rows);
        expect(snapshot.rows).toEqual(rows);
        expect(snapshot.visibleColumns).toEqual(columns);
        expect(snapshot.filterText).toBe('');
        expect(snapshot.sort).toBeNull();
    });

    it('filters rows across all configured filter values', () => {
        const tooling = controller();
        tooling.setFilterText('alpha');
        expect(tooling.snapshot(rows).rows.map((row) => row.id)).toEqual(['a']);
        tooling.setFilterText('2');
        expect(tooling.snapshot(rows).rows.map((row) => row.id)).toEqual(['b']);
        tooling.setFilterText('   ');
        expect(tooling.snapshot(rows).rows).toEqual(rows);
    });

    it('cycles a column sort through ascending, descending, and cleared', () => {
        const tooling = controller();
        tooling.toggleSort('name');
        expect(tooling.snapshot(rows).rows.map((row) => row.id)).toEqual(['a', 'b', 'c']);
        tooling.toggleSort('name');
        expect(tooling.snapshot(rows).rows.map((row) => row.id)).toEqual(['c', 'b', 'a']);
        tooling.toggleSort('name');
        expect(tooling.snapshot(rows).rows).toEqual(rows);
        expect(tooling.sort).toBeNull();
    });

    it('sorts numeric values with missing values last in ascending order', () => {
        const tooling = controller();
        tooling.toggleSort('value');
        expect(tooling.snapshot(rows).rows.map((row) => row.id)).toEqual(['a', 'b', 'c']);
        tooling.toggleSort('value');
        expect(tooling.snapshot(rows).rows.map((row) => row.id)).toEqual(['b', 'a', 'c']);
    });

    it('switching columns starts a fresh ascending sort', () => {
        const tooling = controller();
        tooling.toggleSort('name');
        tooling.toggleSort('name');
        tooling.toggleSort('id');
        expect(tooling.sort).toEqual({ columnId: 'id', direction: 'asc' });
        expect(tooling.snapshot(rows).rows.map((row) => row.id)).toEqual(['a', 'b', 'c']);
    });

    it('hides and restores columns', () => {
        const tooling = controller();
        tooling.toggleColumn('name');
        expect([...tooling.hiddenColumnIds]).toEqual(['name']);
        const snapshot = tooling.snapshot(rows);
        expect(snapshot.visibleColumns.map((column) => column.id)).toEqual(['id', 'value']);
        tooling.toggleColumn('name');
        expect(tooling.snapshot(rows).visibleColumns).toEqual(columns);
    });
});
