export function normalizeSearchValue(value: string, locale: string): string {
    return value.normalize('NFC').toLocaleLowerCase(locale);
}

export function validateLocale(locale: string): string {
    normalizeSearchValue('', locale);
    return locale;
}
