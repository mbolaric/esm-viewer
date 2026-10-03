import type { Rule } from 'eslint';

import { readChildNode, readNodeName, readPropertyName } from './ast.ts';

const formatterNames = new Set([
    'Collator',
    'DateTimeFormat',
    'DisplayNames',
    'DurationFormat',
    'ListFormat',
    'NumberFormat',
    'PluralRules',
    'RelativeTimeFormat',
    'Segmenter',
]);
const localeImplicitMethods = new Set(['toLocaleDateString', 'toLocaleString', 'toLocaleTimeString']);

function isIntlFormatterReference(node: Rule.Node): boolean {
    if (node.type !== 'MemberExpression') {
        return false;
    }

    const objectName = readNodeName(readChildNode(node, 'object'));
    const propertyName = readPropertyName(readChildNode(node, 'property'));
    return objectName === 'Intl' && propertyName !== undefined && formatterNames.has(propertyName);
}

export const noRawIntlRule: Rule.RuleModule = {
    create(context) {
        return {
            CallExpression(node): void {
                const callee = readChildNode(node, 'callee');
                if (callee?.type !== 'MemberExpression') {
                    return;
                }

                const methodName = readPropertyName(readChildNode(callee, 'property'));
                if (methodName !== undefined && localeImplicitMethods.has(methodName)) {
                    context.report({
                        data: {
                            name: methodName,
                        },
                        messageId: 'localeImplicitMethod',
                        node,
                    });
                }
            },
            MemberExpression(node): void {
                if (isIntlFormatterReference(node)) {
                    context.report({
                        messageId: 'rawIntl',
                        node,
                    });
                }
            },
        };
    },
    meta: {
        docs: {
            description: 'Keep locale and time-zone formatting behind ILocalisationService.',
        },
        messages: {
            localeImplicitMethod: 'Do not call "{{name}}" directly; use the injected ILocalisationService.',
            rawIntl: 'Do not construct or access an Intl formatter directly; use ILocalisationService.',
        },
        schema: [],
        type: 'problem',
    },
};
