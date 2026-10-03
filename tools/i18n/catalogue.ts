export const TRANSLATION_CATALOGUE_VIOLATIONS = {
    duplicateMessage: 'duplicate-message',
    emptyCatalogue: 'empty-catalogue',
    emptyKeyOrMessage: 'empty-key-or-message',
    missingKey: 'missing-key',
    placeholderMismatch: 'placeholder-mismatch',
    terminologyTokenMismatch: 'terminology-token-mismatch',
    unexpectedKey: 'unexpected-key',
} as const;

export type TranslationCatalogueViolation =
    (typeof TRANSLATION_CATALOGUE_VIOLATIONS)[keyof typeof TRANSLATION_CATALOGUE_VIOLATIONS];

interface IMessageTokens {
    readonly placeholders: readonly string[];
    readonly terminologyTokens: readonly string[];
}

function sortedUnique(values: readonly string[]): readonly string[] {
    return [...new Set(values)].sort();
}

function messageTokens(message: string): IMessageTokens {
    const placeholders: string[] = [];
    const terminologyTokens: string[] = [];
    const tokenPattern = /\{\{([A-Za-z][A-Za-z0-9.]*)\}\}|\{([A-Za-z][A-Za-z0-9]*)\}/gu;

    for (const match of message.matchAll(tokenPattern)) {
        const terminologyToken = match[1];
        const placeholder = match[2];
        if (terminologyToken !== undefined) {
            terminologyTokens.push(terminologyToken);
        } else if (placeholder !== undefined) {
            placeholders.push(placeholder);
        }
    }

    return {
        placeholders: sortedUnique(placeholders),
        terminologyTokens: sortedUnique(terminologyTokens),
    };
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}

function addViolation(violations: TranslationCatalogueViolation[], violation: TranslationCatalogueViolation): void {
    if (!violations.includes(violation)) {
        violations.push(violation);
    }
}

export function findTranslationCatalogueViolations(
    catalogue: Readonly<Record<string, string>>,
): readonly TranslationCatalogueViolation[] {
    const entries = Object.entries(catalogue);
    const violations: TranslationCatalogueViolation[] = [];

    if (entries.length === 0) {
        violations.push(TRANSLATION_CATALOGUE_VIOLATIONS.emptyCatalogue);
    }

    if (entries.some(([key, message]) => key.trim() === '' || message.trim() === '')) {
        violations.push(TRANSLATION_CATALOGUE_VIOLATIONS.emptyKeyOrMessage);
    }

    const uniqueMessages = new Set(entries.map(([, message]) => message));
    if (uniqueMessages.size !== entries.length) {
        violations.push(TRANSLATION_CATALOGUE_VIOLATIONS.duplicateMessage);
    }

    return violations;
}

export function findTranslationCatalogueParityViolations(
    source: Readonly<Record<string, string>>,
    candidate: Readonly<Record<string, string>>,
): readonly TranslationCatalogueViolation[] {
    const violations: TranslationCatalogueViolation[] = [];
    const sourceKeys = Object.keys(source);
    const candidateKeys = Object.keys(candidate);

    if (sourceKeys.some((key) => candidate[key] === undefined)) {
        addViolation(violations, TRANSLATION_CATALOGUE_VIOLATIONS.missingKey);
    }
    if (candidateKeys.some((key) => source[key] === undefined)) {
        addViolation(violations, TRANSLATION_CATALOGUE_VIOLATIONS.unexpectedKey);
    }

    for (const key of sourceKeys) {
        const sourceMessage = source[key];
        const candidateMessage = candidate[key];
        if (sourceMessage === undefined || candidateMessage === undefined) {
            continue;
        }

        const sourceTokens = messageTokens(sourceMessage);
        const candidateTokens = messageTokens(candidateMessage);
        if (!sameValues(sourceTokens.placeholders, candidateTokens.placeholders)) {
            addViolation(violations, TRANSLATION_CATALOGUE_VIOLATIONS.placeholderMismatch);
        }
        if (!sameValues(sourceTokens.terminologyTokens, candidateTokens.terminologyTokens)) {
            addViolation(violations, TRANSLATION_CATALOGUE_VIOLATIONS.terminologyTokenMismatch);
        }
    }

    return violations;
}
