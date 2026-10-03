export type TableColumnSortDirection = 'asc' | 'desc';

export interface ITableSortState {
    readonly columnId: string;
    readonly direction: TableColumnSortDirection;
}

export interface ITableColumnDescriptor {
    readonly id: string;
    readonly label: string;
    readonly sortable: boolean;
}

// Binds table filter, column visibility, and sort state to DataTable without manual wiring.
export interface ITableToolingBinding {
    readonly filterText: string;
    readonly hiddenColumnIds: ReadonlySet<string>;
    readonly sort: ITableSortState | null;
    setFilterText(value: string): void;
    toggleColumn(columnId: string): void;
    toggleSort(columnId: string): void;
}

export function cycleTableSortState(current: ITableSortState | null, columnId: string): ITableSortState | null {
    if (current?.columnId !== columnId) {
        return {
            columnId,
            direction: 'asc',
        };
    }

    return current.direction === 'asc'
        ? {
              columnId,
              direction: 'desc',
          }
        : null;
}

function compareTableValues(left: string | number | null, right: string | number | null): number {
    if (left === right) {
        return 0;
    }
    if (left === null) {
        return 1;
    }
    if (right === null) {
        return -1;
    }
    if (typeof left === 'number' && typeof right === 'number') {
        return left - right;
    }

    return String(left).localeCompare(String(right), undefined, {
        numeric: true,
        sensitivity: 'base',
    });
}

export function sortTableRows<TRow>(
    rows: readonly TRow[],
    sort: ITableSortState | null,
    sortValue: (row: TRow, columnId: string) => string | number | null,
): readonly TRow[] {
    if (sort === null) {
        return rows;
    }

    const directionMultiplier = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((left, right) => {
        const leftValue = sortValue(left, sort.columnId);
        const rightValue = sortValue(right, sort.columnId);
        if (leftValue === null && rightValue === null) {
            return 0;
        }
        if (leftValue === null) {
            return 1;
        }
        if (rightValue === null) {
            return -1;
        }
        return compareTableValues(leftValue, rightValue) * directionMultiplier;
    });
}

// Callers supply the application's search normalisation so every table matches text the same way.
export type TableTextNormalizer = (text: string) => string;

export function filterTableRows<TRow>(
    rows: readonly TRow[],
    filterText: string,
    filterValues: (row: TRow) => readonly string[],
    normalizeText: TableTextNormalizer,
): readonly TRow[] {
    const normalized = normalizeText(filterText.trim());
    if (normalized.length === 0) {
        return rows;
    }

    return rows.filter((row) => filterValues(row).some((value) => normalizeText(value).includes(normalized)));
}

export function selectVisibleTableColumns(
    columns: readonly ITableColumnDescriptor[],
    hiddenColumnIds: ReadonlySet<string>,
): readonly ITableColumnDescriptor[] {
    return columns.filter((column) => !hiddenColumnIds.has(column.id));
}

export function createStandardSortValue<TRow>(
    extractors: Readonly<Record<string, (row: TRow) => string | number | null>>,
): (row: TRow, columnId: string) => string | number | null {
    return (row, columnId) => {
        const extractor = extractors[columnId];
        return extractor === undefined ? null : extractor(row);
    };
}
