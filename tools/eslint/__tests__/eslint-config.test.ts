import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

function readProperty(value: unknown, propertyName: string): unknown {
    if (typeof value !== 'object' || value === null) {
        return undefined;
    }

    const property: unknown = Reflect.get(value, propertyName);
    return property;
}

function readRuleSeverity(config: unknown, ruleId: string): unknown {
    const rules = readProperty(config, 'rules');
    const rule = readProperty(rules, ruleId);
    if (!Array.isArray(rule)) {
        return rule;
    }

    const severity: unknown = rule[0];
    return severity;
}

async function calculateConfig(filePath: string): Promise<unknown> {
    const eslint = new ESLint({
        cwd: process.cwd(),
    });
    const config: unknown = await eslint.calculateConfigForFile(filePath);
    return config;
}

function expectErrorRules(config: unknown, ruleIds: readonly string[]): void {
    for (const ruleId of ruleIds) {
        expect(readRuleSeverity(config, ruleId), ruleId).toBe(2);
    }
}

describe('flat ESLint policy', () => {
    it('keeps required TypeScript rules enabled at error severity', async () => {
        const config = await calculateConfig('src/error-reporting/error-service.ts');

        expectErrorRules(config, [
            '@typescript-eslint/explicit-module-boundary-types',
            '@typescript-eslint/no-explicit-any',
            '@typescript-eslint/no-unsafe-type-assertion',
            '@typescript-eslint/no-restricted-imports',
            'no-restricted-globals',
            'local/no-module-service-singletons',
            'local/no-raw-intl',
            'local/no-undefined-i18n-keys',
            'local/no-untranslated-feedback',
        ]);
    });

    it('keeps required Svelte rules enabled at error severity', async () => {
        const config = await calculateConfig('src/ui/AppShell.svelte');

        expectErrorRules(config, [
            '@typescript-eslint/no-explicit-any',
            '@typescript-eslint/no-unsafe-type-assertion',
            '@typescript-eslint/no-restricted-imports',
            'local/no-hardcoded-design-values',
            'local/no-hardcoded-ui-strings',
            'local/no-module-service-singletons',
            'local/no-raw-intl',
            'local/no-ui-service-implementation-imports',
            'local/no-undefined-i18n-keys',
            'local/no-untranslated-feedback',
            'local/private-controller-state',
            'svelte/no-at-html-tags',
        ]);
    });

    it('keeps rune-controller rules enabled at error severity', async () => {
        const config = await calculateConfig('src/viewer/feature/workspace-controller.svelte.ts');

        expectErrorRules(config, [
            '@typescript-eslint/no-restricted-imports',
            'local/no-module-service-singletons',
            'local/no-raw-intl',
            'local/no-ui-service-implementation-imports',
            'local/no-undefined-i18n-keys',
            'local/no-untranslated-feedback',
            'local/private-controller-state',
        ]);
    });

    it('forbids inline configuration and disable directives', async () => {
        const config = await calculateConfig('src/error-reporting/error-service.ts');
        const linterOptions = readProperty(config, 'linterOptions');

        expect(readProperty(linterOptions, 'noInlineConfig')).toBe(true);
        expect(readProperty(linterOptions, 'reportUnusedDisableDirectives')).toBe(2);
        expect(readProperty(linterOptions, 'reportUnusedInlineConfigs')).toBe(2);
    });
});
