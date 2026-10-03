export type DesignValueLocation = Readonly<{
    index: number;
    value: string;
}>;

const numericDesignValuePattern = /(?:^|[^\p{L}\p{N}_-])(?:\d+(?:\.\d+)?|\.\d+)(?:[a-z]+|%)?(?=$|[^\p{L}\p{N}_-])/iu;
const colorFunctionPattern = /\b(?:color|hsla?|hwb|lab|lch|oklab|oklch|rgba?)\s*\(/iu;
const hexadecimalColorPattern = /#[\da-f]{3,8}\b/iu;
const colorPropertyPattern =
    /^(?:background(?:-color)?|border(?:-(?:block|inline)(?:-(?:end|start))?)?-color|box-shadow|caret-color|color|fill|outline-color|stroke|text-decoration-color|text-shadow)$/u;
const allowedColorValuePattern = /^(?:currentColor|inherit|initial|none|revert(?:-layer)?|transparent|unset|var\(.+\))$/u;

function containsDesignLiteral(property: string, value: string): boolean {
    const normalizedValue = value.trim();

    if (
        numericDesignValuePattern.test(normalizedValue) ||
        hexadecimalColorPattern.test(normalizedValue) ||
        colorFunctionPattern.test(normalizedValue)
    ) {
        return true;
    }

    return colorPropertyPattern.test(property) && !allowedColorValuePattern.test(normalizedValue);
}

function findDeclarationIssues(source: string, sourceOffset: number): readonly DesignValueLocation[] {
    const issues: DesignValueLocation[] = [];
    const declarationPattern = /(?<property>--?[\w-]+|[\w-]+)\s*:\s*(?<value>[^;{}]+)(?:;|$)/gu;

    for (const match of source.matchAll(declarationPattern)) {
        const property = match.groups?.['property'];
        const value = match.groups?.['value'];
        if (
            property === undefined ||
            value === undefined ||
            property.startsWith('--') ||
            !containsDesignLiteral(property, value)
        ) {
            continue;
        }

        issues.push({
            index: sourceOffset + match.index,
            value: `${property}: ${value.trim()}`,
        });
    }

    return issues;
}

function removeCssComments(source: string): string {
    return source.replaceAll(/\/\*[\s\S]*?\*\//gu, (comment) => ' '.repeat(comment.length));
}

function unwrapStringLiteral(value: string): string | undefined {
    return /^['"`](?<content>[\s\S]*)['"`]$/u.exec(value)?.groups?.['content'];
}

export function findCssDesignValues(source: string): readonly DesignValueLocation[] {
    return findDeclarationIssues(removeCssComments(source), 0);
}

export function findSvelteDesignValues(source: string): readonly DesignValueLocation[] {
    const issues: DesignValueLocation[] = [];
    const styleBlockPattern = /<style(?:\s[^>]*)?>(?<content>[\s\S]*?)<\/style>/giu;
    const inlineStylePattern = /\sstyle\s*=\s*(?<quote>['"])(?<content>.*?)\k<quote>/giu;
    const inlineStyleExpressionPattern = /\sstyle\s*=\s*\{(?<expression>(?:[^{}]|\{[^{}]*\})*)\}/gu;
    const styleDirectivePattern = /\bstyle:(?<property>[\w-]+)\s*=\s*\{(?<expression>(?:[^{}]|\{[^{}]*\})*)\}/gu;

    for (const match of source.matchAll(styleBlockPattern)) {
        const content = match.groups?.['content'];
        if (content === undefined) {
            continue;
        }

        const contentOffset = match.index + match[0].indexOf(content);
        issues.push(...findDeclarationIssues(removeCssComments(content), contentOffset));
    }

    for (const match of source.matchAll(inlineStylePattern)) {
        const content = match.groups?.['content'];
        if (content === undefined) {
            continue;
        }

        const contentOffset = match.index + match[0].indexOf(content);
        issues.push(...findDeclarationIssues(content, contentOffset));
    }

    for (const match of source.matchAll(inlineStyleExpressionPattern)) {
        const expression = match.groups?.['expression'];
        if (expression === undefined) {
            continue;
        }

        const literalContent = unwrapStringLiteral(expression);
        if (literalContent === undefined) {
            continue;
        }

        issues.push(...findDeclarationIssues(literalContent, match.index));
    }

    for (const match of source.matchAll(styleDirectivePattern)) {
        const expression = match.groups?.['expression'];
        const property = match.groups?.['property'];
        if (expression === undefined || property === undefined) {
            continue;
        }

        const literalValue = unwrapStringLiteral(expression) ?? expression;
        if (containsDesignLiteral(property, literalValue)) {
            issues.push({
                index: match.index,
                value: match[0],
            });
        }
    }

    return issues;
}
