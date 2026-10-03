import type { Rule, Scope } from 'eslint';

import { isNode, readNodeName, readStaticString } from './ast.ts';

export function findVariableInScope(scope: Scope.Scope, name: string): Scope.Variable | undefined {
    let currentScope: Scope.Scope | null = scope;

    while (currentScope !== null) {
        const variable = currentScope.set.get(name);
        if (variable !== undefined) {
            return variable;
        }

        currentScope = currentScope.upper;
    }

    return undefined;
}

export function readLocalStaticString(context: Rule.RuleContext, node: Rule.Node | undefined): string | undefined {
    const directValue = readStaticString(node);
    if (directValue !== undefined || node?.type !== 'Identifier') {
        return directValue;
    }

    const name = readNodeName(node);
    if (name === undefined) {
        return undefined;
    }

    const variable = findVariableInScope(context.sourceCode.getScope(node), name);
    if (variable?.defs.length !== 1) {
        return undefined;
    }

    const definition = variable.defs[0];
    if (definition?.type !== 'Variable' || definition.parent.kind !== 'const') {
        return undefined;
    }

    const initializer: unknown = definition.node.init;
    return isNode(initializer) ? readStaticString(initializer) : undefined;
}
