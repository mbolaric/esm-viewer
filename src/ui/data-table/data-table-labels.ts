export interface IDataTableFilterLabels {
    readonly clear: string;
    readonly label: string;
    readonly placeholder: string;
}

// Translated table chrome. The column menu appears when the table can toggle columns; the filter field appears
// only when filter labels are given and the table can filter.
export interface IDataTableLabels {
    readonly columns: string;
    readonly filter?: IDataTableFilterLabels;
    readonly pinColumn: string;
}
