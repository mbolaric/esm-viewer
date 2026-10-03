import type { Rule } from 'eslint';

export function readNodeProperty(node: Rule.Node, propertyName: string): unknown {
    const value: unknown = Reflect.get(node, propertyName);
    return value;
}

export function isNode(value: unknown): value is Rule.Node {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const type: unknown = Reflect.get(value, 'type');
    return typeof type === 'string';
}

export function readChildNode(node: Rule.Node, propertyName: string): Rule.Node | undefined {
    const value = readNodeProperty(node, propertyName);
    return isNode(value) ? value : undefined;
}

export function readChildNodes(node: Rule.Node, propertyName: string): readonly Rule.Node[] {
    const value = readNodeProperty(node, propertyName);
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter(isNode);
}

export function readStringProperty(node: Rule.Node, propertyName: string): string | undefined {
    const value = readNodeProperty(node, propertyName);
    return typeof value === 'string' ? value : undefined;
}

export function readNodeName(node: Rule.Node | undefined): string | undefined {
    if (node === undefined) {
        return undefined;
    }

    return readStringProperty(node, 'name');
}

export function readLiteralString(node: Rule.Node | undefined): string | undefined {
    if (node === undefined) {
        return undefined;
    }

    const value = readNodeProperty(node, 'value');
    return typeof value === 'string' ? value : undefined;
}

export function readPropertyName(node: Rule.Node | undefined): string | undefined {
    return readNodeName(node) ?? readLiteralString(node);
}

export function readStaticString(node: Rule.Node | undefined): string | undefined {
    const literal = readLiteralString(node);
    if (literal !== undefined || node?.type !== 'TemplateLiteral') {
        return literal;
    }

    if (readChildNodes(node, 'expressions').length !== 0) {
        return undefined;
    }

    const quasi = readChildNodes(node, 'quasis')[0];
    if (quasi === undefined) {
        return undefined;
    }

    const value = readNodeProperty(quasi, 'value');
    if (typeof value !== 'object' || value === null) {
        return undefined;
    }

    const cooked: unknown = Reflect.get(value, 'cooked');
    if (typeof cooked === 'string') {
        return cooked;
    }

    const raw: unknown = Reflect.get(value, 'raw');
    return typeof raw === 'string' ? raw : undefined;
}

export function unwrapExpression(node: Rule.Node | undefined): Rule.Node | undefined {
    let current = node;

    while (
        current !== undefined &&
        [
            'ChainExpression',
            'ParenthesizedExpression',
            'TSAsExpression',
            'TSNonNullExpression',
            'TSSatisfiesExpression',
            'TSTypeAssertion',
        ].includes(current.type)
    ) {
        current = readChildNode(current, 'expression');
    }

    return current;
}
