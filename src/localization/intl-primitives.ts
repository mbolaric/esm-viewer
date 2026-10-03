// Central factory functions constructing Intl formatters.

export function createDateTimeFormatter(locale: string, options: Intl.DateTimeFormatOptions = {}): Intl.DateTimeFormat {
    return new Intl.DateTimeFormat(locale, options);
}

export function createNumberFormatter(locale: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
    return new Intl.NumberFormat(locale, options);
}

export function createDurationFormatter(locale: string, options: Intl.DurationFormatOptions): Intl.DurationFormat {
    return new Intl.DurationFormat(locale, options);
}

export function supportedLocaleCount(locale: string): number {
    return Intl.DateTimeFormat.supportedLocalesOf([locale]).length;
}
