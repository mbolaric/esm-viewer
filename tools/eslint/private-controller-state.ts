import type { Rule } from 'eslint';

import { readChildNode, readNodeName, unwrapExpression } from './ast.ts';
import { readFirstRuleOption } from './options.ts';

function isStateRuneCall(node: Rule.Node | undefined): boolean {
    const expression = unwrapExpression(node);
    if (expression?.type !== 'CallExpression') {
        return false;
    }

    const callee = readChildNode(expression, 'callee');
    if (callee?.type === 'Identifier') {
        return readNodeName(callee) === '$state';
    }

    if (callee?.type !== 'MemberExpression') {
        return false;
    }

    return readNodeName(readChildNode(callee, 'object')) === '$state';
}

function hasRuntimePrivateName(node: Rule.Node, privateNamePrefix: string): boolean {
    const key = readChildNode(node, 'key');
    const name = readNodeName(key);
    return key?.type === 'PrivateIdentifier' && name?.startsWith(privateNamePrefix) === true;
}

export const privateControllerStateRule: Rule.RuleModule = {
    create(context) {
        const option = readFirstRuleOption(context);
        const configuredPrefix: unknown = option?.['privateNamePrefix'];
        const privateNamePrefix = typeof configuredPrefix === 'string' ? configuredPrefix : '';

        return {
            PropertyDefinition(node): void {
                if (!isStateRuneCall(readChildNode(node, 'value')) || hasRuntimePrivateName(node, privateNamePrefix)) {
                    return;
                }

                context.report({
                    data: {
                        prefix: privateNamePrefix,
                    },
                    messageId: 'publicControllerState',
                    node,
                });
            },
        };
    },
    meta: {
        docs: {
            description: 'Require class state runes to use configured runtime-private controller fields.',
        },
        messages: {
            publicControllerState:
                'Controller $state fields must be runtime-private #{{prefix}} fields and mutate through explicit methods.',
        },
        schema: [
            {
                additionalProperties: false,
                properties: {
                    privateNamePrefix: {
                        minLength: 1,
                        type: 'string',
                    },
                },
                required: ['privateNamePrefix'],
                type: 'object',
            },
        ],
        type: 'problem',
    },
};
