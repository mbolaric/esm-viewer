import type { Rule } from 'eslint';

import {
    isNode,
    readChildNode,
    readChildNodes,
    readNodeName,
    readPropertyName,
    readStringProperty,
    unwrapExpression,
} from './ast.ts';
import { readFirstRuleOption, readStringArrayOption } from './options.ts';
import { findVariableInScope } from './static-string.ts';

function readCalleeName(node: Rule.Node): string | undefined {
    const callee = readChildNode(node, 'callee');
    if (callee?.type === 'Identifier') {
        return readNodeName(callee);
    }

    if (callee?.type !== 'MemberExpression') {
        return undefined;
    }

    return readPropertyName(readChildNode(callee, 'property'));
}

function readTypeName(node: Rule.Node | undefined): string | undefined {
    if (node === undefined) {
        return undefined;
    }

    if (node.type === 'Identifier') {
        return readNodeName(node);
    }

    const nodeType = readStringProperty(node, 'type');

    if (nodeType === 'TSQualifiedName') {
        return readTypeName(readChildNode(node, 'right'));
    }

    if (nodeType === 'TSTypeAnnotation') {
        return readTypeName(readChildNode(node, 'typeAnnotation'));
    }

    if (nodeType === 'TSTypeReference') {
        return readTypeName(readChildNode(node, 'typeName'));
    }

    return undefined;
}

function readAssertedTypeName(node: Rule.Node | undefined): string | undefined {
    if (node === undefined) {
        return undefined;
    }

    const nodeType = readStringProperty(node, 'type');
    if (nodeType !== 'TSAsExpression' && nodeType !== 'TSSatisfiesExpression' && nodeType !== 'TSTypeAssertion') {
        return undefined;
    }

    return readTypeName(readChildNode(node, 'typeAnnotation'));
}

function hasConfiguredSuffix(name: string, suffixes: readonly string[]): boolean {
    return suffixes.some((suffix) => name.endsWith(suffix));
}

function isConfiguredFactory(name: string, factoryNames: ReadonlySet<string>): boolean {
    return factoryNames.has(name);
}

function isServiceInstanceInitializer(
    declarator: Rule.Node,
    initializer: Rule.Node,
    factoryNames: ReadonlySet<string>,
    instanceNameSuffixes: readonly string[],
): boolean {
    const expression = unwrapExpression(initializer);
    const identifier = readChildNode(declarator, 'id');
    const variableName = readNodeName(identifier);
    const declaredTypeName = readTypeName(readChildNode(identifier ?? declarator, 'typeAnnotation'));
    const assertedTypeName = readAssertedTypeName(initializer);
    const contractName = declaredTypeName ?? assertedTypeName;

    if (expression?.type === 'NewExpression') {
        const constructorName = readCalleeName(expression);
        return (
            (constructorName !== undefined && hasConfiguredSuffix(constructorName, instanceNameSuffixes)) ||
            (contractName !== undefined && hasConfiguredSuffix(contractName, instanceNameSuffixes)) ||
            (variableName !== undefined && hasConfiguredSuffix(variableName, instanceNameSuffixes))
        );
    }

    if (
        expression?.type === 'ObjectExpression' &&
        ((contractName !== undefined && hasConfiguredSuffix(contractName, instanceNameSuffixes)) ||
            (variableName !== undefined && hasConfiguredSuffix(variableName, instanceNameSuffixes)))
    ) {
        return true;
    }

    if (expression?.type !== 'CallExpression') {
        return false;
    }

    const calleeName = readCalleeName(expression);
    return (
        (calleeName !== undefined && isConfiguredFactory(calleeName, factoryNames)) ||
        (variableName !== undefined && hasConfiguredSuffix(variableName, instanceNameSuffixes))
    );
}

function inspectExportedDeclaration(
    context: Rule.RuleContext,
    declaration: Rule.Node | undefined,
    factoryNames: ReadonlySet<string>,
    instanceNameSuffixes: readonly string[],
): void {
    if (declaration?.type !== 'VariableDeclaration') {
        return;
    }

    for (const declarator of readChildNodes(declaration, 'declarations')) {
        const initializer = readChildNode(declarator, 'init');
        if (
            initializer !== undefined &&
            isServiceInstanceInitializer(declarator, initializer, factoryNames, instanceNameSuffixes)
        ) {
            context.report({
                messageId: 'moduleSingleton',
                node: declarator,
            });
        }
    }
}

function identifierOwnsServiceInstance(
    context: Rule.RuleContext,
    identifier: Rule.Node | undefined,
    factoryNames: ReadonlySet<string>,
    instanceNameSuffixes: readonly string[],
): boolean {
    const name = readNodeName(identifier);
    if (identifier?.type !== 'Identifier' || name === undefined) {
        return false;
    }

    const variable = findVariableInScope(context.sourceCode.getScope(identifier), name);
    if (variable?.defs.length !== 1) {
        return false;
    }

    const definition = variable.defs[0];
    if (definition?.type !== 'Variable') {
        return false;
    }

    const declarator: unknown = definition.node;
    const initializer: unknown = definition.node.init;
    return (
        isNode(declarator) &&
        isNode(initializer) &&
        isServiceInstanceInitializer(declarator, initializer, factoryNames, instanceNameSuffixes)
    );
}

export const noModuleServiceSingletonsRule: Rule.RuleModule = {
    create(context) {
        const option = readFirstRuleOption(context);
        const factoryNames = new Set(readStringArrayOption(option, 'factoryNames'));
        const instanceNameSuffixes = readStringArrayOption(option, 'instanceNameSuffixes');

        return {
            ExportDefaultDeclaration(node): void {
                const declaration = readChildNode(node, 'declaration');
                const expression = unwrapExpression(declaration);
                if (
                    identifierOwnsServiceInstance(context, declaration, factoryNames, instanceNameSuffixes) ||
                    (expression?.type === 'NewExpression' &&
                        hasConfiguredSuffix(readCalleeName(expression) ?? '', instanceNameSuffixes)) ||
                    (expression?.type === 'CallExpression' && isConfiguredFactory(readCalleeName(expression) ?? '', factoryNames))
                ) {
                    context.report({
                        messageId: 'moduleSingleton',
                        node,
                    });
                }
            },
            ExportNamedDeclaration(node): void {
                inspectExportedDeclaration(context, readChildNode(node, 'declaration'), factoryNames, instanceNameSuffixes);

                if (readChildNode(node, 'source') !== undefined) {
                    return;
                }

                for (const specifier of readChildNodes(node, 'specifiers')) {
                    if (
                        identifierOwnsServiceInstance(
                            context,
                            readChildNode(specifier, 'local'),
                            factoryNames,
                            instanceNameSuffixes,
                        )
                    ) {
                        context.report({
                            messageId: 'moduleSingleton',
                            node: specifier,
                        });
                    }
                }
            },
        };
    },
    meta: {
        docs: {
            description: 'Forbid exported service and controller instances outside composition roots.',
        },
        messages: {
            moduleSingleton: 'Export a service/controller constructor or factory, not a module-level instance.',
        },
        schema: [
            {
                additionalProperties: false,
                properties: {
                    factoryNames: {
                        items: {
                            minLength: 1,
                            type: 'string',
                        },
                        type: 'array',
                        uniqueItems: true,
                    },
                    instanceNameSuffixes: {
                        items: {
                            minLength: 1,
                            type: 'string',
                        },
                        minItems: 1,
                        type: 'array',
                        uniqueItems: true,
                    },
                },
                required: ['factoryNames', 'instanceNameSuffixes'],
                type: 'object',
            },
        ],
        type: 'problem',
    },
};
