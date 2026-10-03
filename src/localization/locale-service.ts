export interface ILocaleService<TLocale extends string = string> {
    readonly locale: TLocale;
}
