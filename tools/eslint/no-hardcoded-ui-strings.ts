import type { Rule } from 'eslint';

import { readChildNode, readChildNodes, readNodeName, readStringProperty } from './ast.ts';
import { readFirstRuleOption, readStringArrayOption } from './options.ts';
import { readLocalStaticString } from './static-string.ts';

function hasDisplayContent(value: string): boolean {
    return value.trim().length > 0;
}

function readAttributeExpression(node: Rule.Node): Rule.Node {
    if (readStringProperty(node, 'type') !== 'SvelteMustacheTag') {
        return node;
    }

    return readChildNode(node, 'expression') ?? node;
}

export const noHardcodedUiStringsRule: Rule.RuleModule = {
    create(context) {
        const userVisibleAttributes = new Set(readStringArrayOption(readFirstRuleOption(context), 'attributes'));

        return {
            SvelteAttribute(node: Rule.Node): void {
                const key = readChildNode(node, 'key');
                const attributeName = readNodeName(key);
                if (attributeName === undefined || !userVisibleAttributes.has(attributeName)) {
                    return;
                }

                for (const valueNode of readChildNodes(node, 'value')) {
                    const expression = readAttributeExpression(valueNode);
                    const literal = readLocalStaticString(context, expression);
                    if (literal !== undefined && hasDisplayContent(literal)) {
                        context.report({
                            messageId: 'hardcodedAttribute',
                            node: expression,
                        });
                    }
                }
            },
            SvelteMustacheTag(node: Rule.Node): void {
                const parent = readChildNode(node, 'parent');
                if (parent !== undefined && readStringProperty(parent, 'type') === 'SvelteAttribute') {
                    return;
                }

                const expression = readChildNode(node, 'expression');
                const literal = readLocalStaticString(context, expression);
                if (literal !== undefined && hasDisplayContent(literal)) {
                    context.report({
                        messageId: 'hardcodedRenderedExpression',
                        node: expression ?? node,
                    });
                }
            },
            SvelteText(node: Rule.Node): void {
                const parent = readChildNode(node, 'parent');
                if (readStringProperty(parent ?? node, 'type') === 'SvelteStyleElement') {
                    return;
                }

                const value = readStringProperty(node, 'value');
                if (value !== undefined && hasDisplayContent(value)) {
                    context.report({
                        messageId: 'hardcodedText',
                        node,
                    });
                }
            },
        };
    },
    meta: {
        docs: {
            description: 'Require application-authored user-facing copy to come from typed translations.',
        },
        messages: {
            hardcodedAttribute: 'Do not hardcode a user-visible attribute or component prop; pass translated copy.',
            hardcodedRenderedExpression: 'Do not render a string literal; resolve a typed translation or render evidence data.',
            hardcodedText: 'Do not hardcode rendered text; resolve a typed translation or pass translated copy.',
        },
        schema: [
            {
                additionalProperties: false,
                properties: {
                    attributes: {
                        items: {
                            minLength: 1,
                            type: 'string',
                        },
                        minItems: 1,
                        type: 'array',
                        uniqueItems: true,
                    },
                },
                required: ['attributes'],
                type: 'object',
            },
        ],
        type: 'problem',
    },
};
