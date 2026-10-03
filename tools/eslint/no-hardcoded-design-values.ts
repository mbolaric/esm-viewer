import type { Rule } from 'eslint';

import { findSvelteDesignValues } from '../quality/design-values.ts';

export const noHardcodedDesignValuesRule: Rule.RuleModule = {
    create(context) {
        return {
            'Program:exit'(node): void {
                for (const issue of findSvelteDesignValues(context.sourceCode.text)) {
                    context.report({
                        data: {
                            value: issue.value,
                        },
                        messageId: 'hardcodedDesignValue',
                        node,
                    });
                }
            },
        };
    },
    meta: {
        docs: {
            description: 'Require component style values to use central design tokens or typed data geometry.',
        },
        messages: {
            hardcodedDesignValue: 'Move "{{value}}" to central token/theme ownership and consume it through var(...).',
        },
        schema: [],
        type: 'problem',
    },
};
