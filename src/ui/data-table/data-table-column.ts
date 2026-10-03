import type { Snippet } from 'svelte';

export interface IDataTableColumn<TRow = never> {
    // Right-aligns tabular figures so digits line up down the column.
    readonly align?: 'numeric';
    // Renders this column's cell; DataTable then owns the row markup and column visibility.
    readonly cell: Snippet<[TRow]>;
    // Class added to every body cell of this column, for layout the consuming screen styles.
    readonly cellClass?: string;
    // Narrow fixed-width column; applies to both the header and the body cells.
    readonly compact?: boolean;
    readonly id: string;
    readonly label: string;
    // Low priority columns are auto-hidden first on narrow widths via the same hiddenColumnIds path.
    readonly priority?: 'low';
    readonly sortable?: boolean;
}
