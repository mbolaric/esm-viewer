import { cycleTableSortState, sortTableRows, type ITableSortState } from './table-tooling.js';

export type TableSortValue<TRow> = (row: TRow, columnId: string) => string | number | null;

// Header sort state that cycles ascending, descending, then unsorted for each column.
export class TableSortController<TRow> {
    readonly #_sortValue: TableSortValue<TRow>;
    #_sort = $state<ITableSortState | null>(null);

    public constructor(sortValue: TableSortValue<TRow>) {
        this.#_sortValue = sortValue;
    }

    public get sort(): ITableSortState | null {
        return this.#_sort;
    }

    // Arrow property so screens can pass it straight to DataTable's `onsort`.
    public toggleSort = (columnId: string): void => {
        this.#_sort = cycleTableSortState(this.#_sort, columnId);
    };

    public apply(rows: readonly TRow[]): readonly TRow[] {
        return sortTableRows(rows, this.#_sort, this.#_sortValue);
    }
}
