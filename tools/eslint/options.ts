import type { Rule } from 'eslint';

export type RuleOption = Readonly<Record<string, unknown>>;

export function isRuleOption(value: unknown): value is RuleOption {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readFirstRuleOption(context: Rule.RuleContext): RuleOption | undefined {
    const options: unknown = Reflect.get(context, 'options');
    if (!Array.isArray(options)) {
        return undefined;
    }

    const option: unknown = options[0];
    return isRuleOption(option) ? option : undefined;
}

export function readStringArrayOption(option: RuleOption | undefined, propertyName: string): readonly string[] {
    if (option === undefined) {
        return [];
    }

    const value: unknown = option[propertyName];
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

export function readRuleOptionArray(option: RuleOption | undefined, propertyName: string): readonly RuleOption[] {
    if (option === undefined) {
        return [];
    }

    const value: unknown = option[propertyName];
    return Array.isArray(value) ? value.filter(isRuleOption) : [];
}
