import type { Rule } from 'eslint';

import { readChildNode, readChildNodes, readLiteralString, readNodeName, readPropertyName } from './ast.ts';
import { readFirstRuleOption, readStringArrayOption } from './options.ts';
import { readLocalStaticString } from './static-string.ts';

function hasDisplayContent(value: string): boolean {
    return value.trim().length > 0;
}

function readCalleeName(node: Rule.Node): string | undefined {
    const callee = readChildNode(node, 'callee');
    if (callee === undefined) {
        return undefined;
    }

    if (callee.type === 'Identifier') {
        return readNodeName(callee);
    }

    if (callee.type !== 'MemberExpression') {
        return undefined;
    }

    return readPropertyName(readChildNode(callee, 'property'));
}

function reportFeedbackObject(
    context: Rule.RuleContext,
    argument: Rule.Node,
    feedbackObjectProperties: ReadonlySet<string>,
): void {
    if (argument.type !== 'ObjectExpression') {
        return;
    }

    for (const property of readChildNodes(argument, 'properties')) {
        if (property.type !== 'Property') {
            continue;
        }

        const key = readChildNode(property, 'key');
        const propertyName = readNodeName(key) ?? readLiteralString(key);
        if (propertyName === undefined || !feedbackObjectProperties.has(propertyName)) {
            continue;
        }

        const value = readChildNode(property, 'value');
        const feedback = readLocalStaticString(context, value);
        if (feedback !== undefined && hasDisplayContent(feedback)) {
            context.report({
                messageId: 'untranslatedFeedback',
                node: value ?? property,
            });
        }
    }
}

function reportFeedbackArguments(
    context: Rule.RuleContext,
    node: Rule.Node,
    feedbackFunctions: ReadonlySet<string>,
    feedbackMethods: ReadonlySet<string>,
    feedbackObjectProperties: ReadonlySet<string>,
): void {
    const calleeName = readCalleeName(node);
    if (calleeName === undefined || (!feedbackFunctions.has(calleeName) && !feedbackMethods.has(calleeName))) {
        return;
    }

    for (const argument of readChildNodes(node, 'arguments')) {
        const feedback = readLocalStaticString(context, argument);
        if (feedback !== undefined && hasDisplayContent(feedback)) {
            context.report({
                messageId: 'untranslatedFeedback',
                node: argument,
            });
        }

        reportFeedbackObject(context, argument, feedbackObjectProperties);
    }
}

export const noUntranslatedFeedbackRule: Rule.RuleModule = {
    create(context) {
        const option = readFirstRuleOption(context);
        const feedbackFunctions = new Set(readStringArrayOption(option, 'functions'));
        const feedbackMethods = new Set(readStringArrayOption(option, 'methods'));
        const feedbackObjectProperties = new Set(readStringArrayOption(option, 'objectProperties'));

        return {
            CallExpression(node): void {
                reportFeedbackArguments(context, node, feedbackFunctions, feedbackMethods, feedbackObjectProperties);
            },
        };
    },
    meta: {
        docs: {
            description: 'Require user-facing feedback and dialog copy to come from typed translations.',
        },
        messages: {
            untranslatedFeedback: 'Do not hardcode feedback copy; resolve a typed translation before calling the feedback API.',
        },
        schema: [
            {
                additionalProperties: false,
                properties: {
                    functions: {
                        items: {
                            minLength: 1,
                            type: 'string',
                        },
                        type: 'array',
                        uniqueItems: true,
                    },
                    methods: {
                        items: {
                            minLength: 1,
                            type: 'string',
                        },
                        type: 'array',
                        uniqueItems: true,
                    },
                    objectProperties: {
                        items: {
                            minLength: 1,
                            type: 'string',
                        },
                        type: 'array',
                        uniqueItems: true,
                    },
                },
                required: ['functions', 'methods', 'objectProperties'],
                type: 'object',
            },
        ],
        type: 'problem',
    },
};
