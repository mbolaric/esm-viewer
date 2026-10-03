// Letters that carry a stroke or are ligatures do not decompose under Unicode normalisation, so they are folded by
// hand to the plain letters a keyboard without them would type.
const NON_DECOMPOSING_LETTER_FOLDS: Readonly<Record<string, string>> = {
    æ: 'ae',
    ð: 'd',
    đ: 'd',
    ħ: 'h',
    ø: 'o',
    œ: 'oe',
    ł: 'l',
    ß: 'ss',
};

const PRINTABLE_ASCII = /^[ -~]*$/u;

// Case- and diacritic-insensitive form of free-text search input and searched values. It lower-cases without the
// host locale so the same text matches the same way on every machine.
export function normalizeSearchText(value: string): string {
    // Printable ASCII has nothing to decompose or fold; skipping the Unicode work keeps large-table filtering cheap.
    if (PRINTABLE_ASCII.test(value)) {
        return value.toLowerCase();
    }
    return value
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[æðđħøœłß]/gu, (letter) => NON_DECOMPOSING_LETTER_FOLDS[letter] ?? letter);
}

// Matches free-text search input against a record's fields, normalising the query once for a whole list. An empty
// query matches every record, and a null field (a missing identifier) never matches.
export function createSearchMatcher(query: string): (fields: readonly (string | null)[]) => boolean {
    const normalizedQuery = normalizeSearchText(query.trim());
    return (fields) =>
        normalizedQuery.length === 0 ||
        fields.some((field) => field !== null && normalizeSearchText(field).includes(normalizedQuery));
}
