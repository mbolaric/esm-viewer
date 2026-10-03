import type { Rule } from 'eslint';

import { readChildNode, readChildNodes, readLiteralString, readNodeName } from './ast.ts';
import { readFirstRuleOption, readStringArrayOption } from './options.ts';

function matchesModule(configuredModules: readonly string[], source: string): boolean {
    return configuredModules.some((moduleName) => source === moduleName || source.startsWith(`${moduleName}/`));
}

export const noDirectBrandIconImportsRule: Rule.RuleModule = {
    create(context) {
        const option = readFirstRuleOption(context);
        const allowedFiles = readStringArrayOption(option, 'allow');
        const assetPathFragments = readStringArrayOption(option, 'assetPathFragments');
        const brandExports = new Set(readStringArrayOption(option, 'brandExports'));
        const brandModules = readStringArrayOption(option, 'brandModules');
        const libraryPathFragments = readStringArrayOption(option, 'libraryPathFragments');
        const filename = context.filename.replaceAll('\\', '/');
        if (allowedFiles.some((allowedFile) => filename.endsWith(allowedFile))) {
            return {};
        }
        // Host compositions may import their own brand asset; only library files must resolve it through the model.
        const isLibraryFile = libraryPathFragments.some((fragment) => filename.includes(fragment));

        function report(node: Rule.Node, name: string): void {
            context.report({
                data: {
                    name,
                },
                messageId: 'directBrandIconImport',
                node,
            });
        }

        function checkSource(node: Rule.Node, source: string): void {
            if (isLibraryFile && assetPathFragments.some((fragment) => source.includes(fragment))) {
                report(node, source);
                return;
            }
            if (!matchesModule(brandModules, source)) {
                return;
            }
            for (const specifier of readChildNodes(node, 'specifiers')) {
                if (specifier.type !== 'ImportSpecifier') {
                    continue;
                }
                const importedName = readNodeName(readChildNode(specifier, 'imported'));
                if (importedName !== undefined && brandExports.has(importedName)) {
                    report(specifier, importedName);
                }
            }
        }

        return {
            ImportDeclaration(node): void {
                const source = readLiteralString(readChildNode(node, 'source'));
                if (source !== undefined) {
                    checkSource(node, source);
                }
            },
            ImportExpression(node): void {
                const source = readLiteralString(readChildNode(node, 'source'));
                if (source !== undefined) {
                    checkSource(node, source);
                }
            },
        };
    },
    meta: {
        docs: {
            description:
                'Require branding marks to resolve through the app branding model instead of importing the packaged icon.',
        },
        messages: {
            directBrandIconImport:
                'Do not import the packaged brand icon directly; read it through the app branding model (useAppBranding) so hosts can override the mark.',
        },
        schema: [
            {
                additionalProperties: false,
                properties: {
                    allow: {
                        items: {
                            minLength: 1,
                            type: 'string',
                        },
                        minItems: 1,
                        type: 'array',
                        uniqueItems: true,
                    },
                    assetPathFragments: {
                        items: {
                            minLength: 1,
                            type: 'string',
                        },
                        minItems: 1,
                        type: 'array',
                        uniqueItems: true,
                    },
                    brandExports: {
                        items: {
                            minLength: 1,
                            type: 'string',
                        },
                        minItems: 1,
                        type: 'array',
                        uniqueItems: true,
                    },
                    brandModules: {
                        items: {
                            minLength: 1,
                            type: 'string',
                        },
                        minItems: 1,
                        type: 'array',
                        uniqueItems: true,
                    },
                    libraryPathFragments: {
                        items: {
                            minLength: 1,
                            type: 'string',
                        },
                        minItems: 1,
                        type: 'array',
                        uniqueItems: true,
                    },
                },
                required: ['allow', 'assetPathFragments', 'brandExports', 'brandModules', 'libraryPathFragments'],
                type: 'object',
            },
        ],
        type: 'problem',
    },
};
