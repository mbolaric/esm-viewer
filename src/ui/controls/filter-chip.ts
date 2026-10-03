export interface IFilterChipOption<TValue extends string> {
    // Shown after the label as "Label (count)"; omitted when absent.
    readonly count?: number | string | undefined;
    readonly label: string;
    readonly value: TValue;
}
