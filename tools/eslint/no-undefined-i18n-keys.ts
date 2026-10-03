import type { Rule } from 'eslint';

import {
    isNode,
    readChildNode,
    readChildNodes,
    readNodeName,
    readPropertyName,
    readStaticString,
    unwrapExpression,
} from './ast.ts';
import { readFirstRuleOption, readStringArrayOption } from './options.ts';
import { findVariableInScope } from './static-string.ts';

const castExpressionTypes = new Set(['TSAsExpression', 'TSSatisfiesExpression', 'TSTypeAssertion']);

function readStaticObjectValues(node: Rule.Node | undefined): readonly string[] | undefined {
    const objectExpression = unwrapExpression(node);
    if (objectExpression?.type !== 'ObjectExpression') {
        return undefined;
    }

    const values: string[] = [];
    for (const property of readChildNodes(objectExpression, 'properties')) {
        if (property.type !== 'Property') {
            return undefined;
        }

        const value = unwrapExpression(readChildNode(property, 'value'));
        const staticValue = readStaticString(value);
        if (staticValue !== undefined) {
            values.push(staticValue);
            continue;
        }

        const nestedValues = readStaticObjectValues(value);
        if (nestedValues === undefined) {
            return undefined;
        }
        values.push(...nestedValues);
    }

    return values.length === 0 ? undefined : values;
}

function readMemberRoot(node: Rule.Node): Rule.Node | undefined {
    let current = unwrapExpression(node);
    if (current?.type !== 'MemberExpression') {
        return undefined;
    }

    while (current.type === 'MemberExpression') {
        current = unwrapExpression(readChildNode(current, 'object'));
        if (current === undefined) {
            return undefined;
        }
    }

    return current.type === 'Identifier' ? current : undefined;
}

function readConstMapValues(context: Rule.RuleContext, node: Rule.Node): readonly string[] | undefined {
    const root = readMemberRoot(node);
    const name = readNodeName(root);
    if (root === undefined || name === undefined) {
        return undefined;
    }

    const variable = findVariableInScope(context.sourceCode.getScope(root), name);
    if (variable?.defs.length !== 1) {
        return undefined;
    }

    const definition = variable.defs[0];
    if (definition?.type !== 'Variable' || definition.parent.kind !== 'const') {
        return undefined;
    }

    const initializer: unknown = definition.node.init;
    if (!isNode(initializer)) {
        return undefined;
    }

    const initializerType: string = initializer.type;
    return initializerType === 'TSSatisfiesExpression' ? readStaticObjectValues(initializer) : undefined;
}

function isTranslationCall(node: Rule.Node, functionNames: ReadonlySet<string>, methodNames: ReadonlySet<string>): boolean {
    const callee = readChildNode(node, 'callee');
    if (callee?.type === 'Identifier') {
        const name = readNodeName(callee);
        return name !== undefined && functionNames.has(name);
    }

    if (callee?.type !== 'MemberExpression') {
        return false;
    }

    const methodName = readPropertyName(readChildNode(callee, 'property'));
    return methodName !== undefined && methodNames.has(methodName);
}

export const noUndefinedI18nKeysRule: Rule.RuleModule = {
    create(context) {
        const option = readFirstRuleOption(context);
        const translationKeys = new Set(readStringArrayOption(option, 'keys'));
        const functionNames = new Set(readStringArrayOption(option, 'functionNames'));
        const methodNames = new Set(readStringArrayOption(option, 'methodNames'));

        return {
            CallExpression(node): void {
                if (!isTranslationCall(node, functionNames, methodNames)) {
                    return;
                }

                const keyNode = readChildNodes(node, 'arguments')[0];
                if (keyNode === undefined) {
                    return;
                }

                if (castExpressionTypes.has(keyNode.type)) {
                    context.report({
                        messageId: 'dynamicKey',
                        node: keyNode,
                    });
                    return;
                }

                const key = readStaticString(keyNode);
                if (key !== undefined) {
                    if (!translationKeys.has(key)) {
                        context.report({
                            data: {
                                key,
                            },
                            messageId: 'undefinedKey',
                            node: keyNode,
                        });
                    }
                    return;
                }

                const mappedKeys = readConstMapValues(context, keyNode);
                if (mappedKeys === undefined) {
                    context.report({
                        messageId: 'dynamicKey',
                        node: keyNode,
                    });
                    return;
                }

                const undefinedKey = mappedKeys.find((mappedKey) => !translationKeys.has(mappedKey));
                if (undefinedKey !== undefined) {
                    context.report({
                        data: {
                            key: undefinedKey,
                        },
                        messageId: 'undefinedKey',
                        node: keyNode,
                    });
                }
            },
        };
    },
    meta: {
        docs: {
            description:
                'Require literal translation keys or statically analyzable satisfies-checked const key maps that exist in the configured source catalogue.',
        },
        messages: {
            dynamicKey: 'Translation keys must be literal catalogue keys; dynamic and cast keys are forbidden.',
            undefinedKey: 'Translation key "{{key}}" does not exist in the configured source catalogue.',
        },
        schema: [
            {
                additionalProperties: false,
                properties: {
                    functionNames: {
                        items: {
                            minLength: 1,
                            type: 'string',
                        },
                        type: 'array',
                        uniqueItems: true,
                    },
                    keys: {
                        items: {
                            minLength: 1,
                            type: 'string',
                        },
                        minItems: 1,
                        type: 'array',
                        uniqueItems: true,
                    },
                    methodNames: {
                        items: {
                            minLength: 1,
                            type: 'string',
                        },
                        type: 'array',
                        uniqueItems: true,
                    },
                },
                required: ['functionNames', 'keys', 'methodNames'],
                type: 'object',
            },
        ],
        type: 'problem',
    },
};
