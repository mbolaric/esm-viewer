export interface IExportDialogLabels {
    readonly cancel: string;
    readonly export: string;
    readonly exporting: string;
    readonly fileName: string;
    readonly formatLegend: string;
    readonly title: string;
}

export interface IExportFormatOption<TFormat extends string = string> {
    readonly description: string;
    readonly label: string;
    readonly value: TFormat;
}
