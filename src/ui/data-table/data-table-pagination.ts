export interface IDataTablePageStatus {
    readonly end: number;
    readonly page: number;
    readonly pageCount: number;
    readonly start: number;
    readonly total: number;
}

export interface IDataTablePaginationLabels {
    readonly navigation: string;
    readonly nextPage: string;
    readonly previousPage: string;
    readonly rowsPerPage: string;
    readonly status: (status: IDataTablePageStatus) => string;
}

export type DataTablePageSize = 25 | 50 | 100;

export interface IDataTablePaginationPreferencesStore {
    getPageSize(preferenceKey: string): DataTablePageSize;
    setPageSize(preferenceKey: string, pageSize: DataTablePageSize): void;
}
