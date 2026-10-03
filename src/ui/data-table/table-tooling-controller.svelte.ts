import { SessionColumnVisibility } from './session-column-visibility.svelte.js';
import { TableSortController, type TableSortValue } from './table-sort-controller.svelte.js';
import {
    filterTableRows,
    selectVisibleTableColumns,
    type ITableColumnDescriptor,
    type ITableSortState,
    type ITableToolingBinding,
    type TableTextNormalizer,
} from './table-tooling.js';

// Filter text storage owned by the caller, e.g. so it survives a screen remount.
export interface ITableFilterTextStore {
    readonly value: string;
    set(value: string): void;
}

export interface ITableToolingOptions<TRow> {
    readonly columns: () => readonly ITableColumnDescriptor[];
    // Read lazily so a component can pass its filter-text prop without capturing the value at construction.
    readonly filterText: () => ITableFilterTextStore;
    readonly filterValues: (row: TRow) => readonly string[];
    readonly normalizeText: TableTextNormalizer;
    readonly sortValue: TableSortValue<TRow>;
}

export interface ITableToolingSnapshot<TRow> {
    readonly filterText: string;
    readonly hiddenColumnIds: ReadonlySet<string>;
    readonly rows: readonly TRow[];
    readonly sort: ITableSortState | null;
    readonly visibleColumns: readonly ITableColumnDescriptor[];
}

// Filter, sort, and column visibility for one table, applied together as a snapshot of the input rows.
export class TableToolingController<TRow> implements ITableToolingBinding {
    readonly #_columns: () => readonly ITableColumnDescriptor[];
    readonly #_filterText: () => ITableFilterTextStore;
    readonly #_filterValues: (row: TRow) => readonly string[];
    readonly #_normalizeText: TableTextNormalizer;
    readonly #_sorting: TableSortController<TRow>;
    readonly #_columnVisibility = new SessionColumnVisibility();

    public constructor(options: ITableToolingOptions<TRow>) {
        this.#_columns = options.columns;
        this.#_filterText = options.filterText;
        this.#_filterValues = options.filterValues;
        this.#_normalizeText = options.normalizeText;
        this.#_sorting = new TableSortController(options.sortValue);
    }

    public get filterText(): string {
        return this.#_filterText().value;
    }

    public get hiddenColumnIds(): ReadonlySet<string> {
        return this.#_columnVisibility.hiddenColumnIds;
    }

    public get sort(): ITableSortState | null {
        return this.#_sorting.sort;
    }

    // Arrow properties so screens can pass them straight to DataTable callbacks.
    public setFilterText = (value: string): void => {
        this.#_filterText().set(value);
    };

    public toggleColumn = (columnId: string): void => {
        this.#_columnVisibility.toggle(columnId);
    };

    public toggleSort = (columnId: string): void => {
        this.#_sorting.toggleSort(columnId);
    };

    public snapshot(rows: readonly TRow[]): ITableToolingSnapshot<TRow> {
        const filterText = this.#_filterText().value;
        const filtered = filterTableRows(rows, filterText, this.#_filterValues, this.#_normalizeText);
        return {
            filterText,
            hiddenColumnIds: this.hiddenColumnIds,
            rows: this.#_sorting.apply(filtered),
            sort: this.#_sorting.sort,
            visibleColumns: selectVisibleTableColumns(this.#_columns(), this.hiddenColumnIds),
        };
    }
}
