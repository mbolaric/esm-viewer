import type { Rule } from 'eslint';

import { readChildNode, readChildNodes, readLiteralString, readNodeName } from './ast.ts';
import { readFirstRuleOption, readStringArrayOption } from './options.ts';

function matchesModule(configuredModules: readonly string[], source: string): boolean {
    return configuredModules.some((moduleName) => source === moduleName || source.startsWith(`${moduleName}/`));
}

function reportConcreteImport(
    context: Rule.RuleContext,
    declaration: Rule.Node,
    source: string,
    implementationExports: ReadonlySet<string>,
    implementationOnlyModules: readonly string[],
    implementationOwningModules: readonly string[],
): void {
    for (const specifier of readChildNodes(declaration, 'specifiers')) {
        if (specifier.type === 'ImportDefaultSpecifier' || specifier.type === 'ImportNamespaceSpecifier') {
            if (matchesModule(implementationOnlyModules, source) || matchesModule(implementationOwningModules, source)) {
                context.report({
                    messageId: 'concreteServiceImport',
                    node: specifier,
                });
            }
            continue;
        }

        const importedName = readNodeName(readChildNode(specifier, 'imported'));
        if (
            matchesModule(implementationOnlyModules, source) ||
            (importedName !== undefined && implementationExports.has(importedName))
        ) {
            context.report({
                data: {
                    name: importedName ?? source,
                },
                messageId: 'concreteServiceImport',
                node: specifier,
            });
        }
    }
}

export const noUiServiceImplementationImportsRule: Rule.RuleModule = {
    create(context) {
        const option = readFirstRuleOption(context);
        const implementationExports = new Set(readStringArrayOption(option, 'implementationExports'));
        const implementationOnlyModules = readStringArrayOption(option, 'implementationOnlyModules');
        const implementationOwningModules = readStringArrayOption(option, 'implementationOwningModules');

        return {
            ImportExpression(node): void {
                const source = readLiteralString(readChildNode(node, 'source'));
                if (
                    source !== undefined &&
                    (matchesModule(implementationOnlyModules, source) || matchesModule(implementationOwningModules, source))
                ) {
                    context.report({
                        data: {
                            name: source,
                        },
                        messageId: 'concreteServiceImport',
                        node,
                    });
                }
            },
            ImportDeclaration(node): void {
                const source = readLiteralString(readChildNode(node, 'source'));
                if (source !== undefined) {
                    reportConcreteImport(
                        context,
                        node,
                        source,
                        implementationExports,
                        implementationOnlyModules,
                        implementationOwningModules,
                    );
                }
            },
        };
    },
    meta: {
        docs: {
            description: 'Keep concrete service implementations out of generic and feature UI modules.',
        },
        messages: {
            concreteServiceImport:
                'UI must depend on an injected service/controller contract, not concrete implementation "{{name}}".',
        },
        schema: [
            {
                additionalProperties: false,
                properties: {
                    implementationExports: {
                        items: {
                            minLength: 1,
                            type: 'string',
                        },
                        type: 'array',
                        uniqueItems: true,
                    },
                    implementationOnlyModules: {
                        items: {
                            minLength: 1,
                            type: 'string',
                        },
                        type: 'array',
                        uniqueItems: true,
                    },
                    implementationOwningModules: {
                        items: {
                            minLength: 1,
                            type: 'string',
                        },
                        type: 'array',
                        uniqueItems: true,
                    },
                },
                required: ['implementationExports', 'implementationOnlyModules', 'implementationOwningModules'],
                type: 'object',
            },
        ],
        type: 'problem',
    },
};
