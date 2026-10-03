import { ESLint, type Linter } from 'eslint';
import svelte from 'eslint-plugin-svelte';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

import { localPlugin } from '../local-plugin.js';

type RuleSelection = Readonly<Record<string, Linter.RuleEntry>>;

async function lintSvelte(code: string, rules: RuleSelection): Promise<readonly Linter.LintMessage[]> {
    const eslint = new ESLint({
        overrideConfig: [
            ...svelte.configs['flat/base'],
            {
                files: ['**/*.svelte'],
                languageOptions: {
                    parserOptions: {
                        parser: tseslint.parser,
                    },
                },
                plugins: {
                    local: localPlugin,
                },
                rules,
            },
        ],
        overrideConfigFile: true,
    });
    const results = await eslint.lintText(code, {
        filePath: 'src/ui/Fixture.svelte',
    });
    const result = results[0];
    if (result === undefined) {
        throw new Error('ESLint did not return a Svelte fixture result.');
    }

    return result.messages;
}

async function lintTypeScript(code: string, filePath: string, rules: RuleSelection): Promise<readonly Linter.LintMessage[]> {
    const eslint = new ESLint({
        overrideConfig: [
            {
                files: ['**/*.ts'],
                languageOptions: {
                    parser: tseslint.parser,
                },
                plugins: {
                    local: localPlugin,
                },
                rules,
            },
        ],
        overrideConfigFile: true,
    });
    const results = await eslint.lintText(code, {
        filePath,
    });
    const result = results[0];
    if (result === undefined) {
        throw new Error('ESLint did not return a TypeScript fixture result.');
    }

    return result.messages;
}

function ruleIds(messages: readonly Linter.LintMessage[]): readonly (string | null)[] {
    return messages.map((message) => message.ruleId);
}

describe('local/no-hardcoded-ui-strings', () => {
    const rules: RuleSelection = {
        'local/no-hardcoded-ui-strings': [
            'error',
            {
                attributes: [
                    'alt',
                    'aria-description',
                    'aria-label',
                    'description',
                    'emptyMessage',
                    'help',
                    'label',
                    'placeholder',
                    'title',
                ],
            },
        ],
    };

    it('accepts translated props and rendered values', async () => {
        const messages = await lintSvelte(
            `
                <script lang="ts">
                    interface IProps {
                        label: string;
                    }

                    let { label }: IProps = $props();
                </script>

                <button aria-label={label}>{label}</button>
            `,
            rules,
        );

        expect(messages).toEqual([]);
    });

    it('rejects text, rendered literals, visible attributes, and feedback literals', async () => {
        const messages = await lintSvelte(
            `
                <script lang="ts">
                    alert('Failed');
                    dialog.showMessageBox({ message: 'Unavailable' });
                </script>

                <button aria-label="Open">Open</button>
                <p>{'Missing'}</p>
            `,
            rules,
        );

        expect(ruleIds(messages)).toEqual([
            'local/no-hardcoded-ui-strings',
            'local/no-hardcoded-ui-strings',
            'local/no-hardcoded-ui-strings',
        ]);
    });

    it('rejects local immutable literal bindings rendered by the component', async () => {
        const messages = await lintSvelte(
            `
                <script lang="ts">
                    const label = 'Open';
                </script>

                <button aria-label={label}>{label}</button>
            `,
            rules,
        );

        expect(ruleIds(messages)).toEqual(['local/no-hardcoded-ui-strings', 'local/no-hardcoded-ui-strings']);
    });
});

describe('local/no-untranslated-feedback', () => {
    const rules: RuleSelection = {
        'local/no-untranslated-feedback': [
            'error',
            {
                functions: ['alert', 'confirm', 'prompt'],
                methods: ['announce', 'notify', 'setStatus', 'showErrorBox', 'showMessage', 'showMessageBox'],
                objectProperties: ['description', 'detail', 'help', 'label', 'message', 'placeholder', 'title'],
            },
        ],
    };

    it('accepts translated feedback values', async () => {
        const messages = await lintTypeScript(
            `
                export function showFeedback(message: string): void {
                    notifications.notify(message);
                }
            `,
            'src/presentation/feedback.ts',
            rules,
        );

        expect(messages).toEqual([]);
    });

    it('rejects literal, template, and immutable-bound feedback copy', async () => {
        const messages = await lintTypeScript(
            `
                const title = 'Unavailable';
                alert(\`Failed\`);
                notifications.notify('Missing');
                dialog.showMessageBox({ title });
            `,
            'src/presentation/feedback.ts',
            rules,
        );

        expect(ruleIds(messages)).toEqual([
            'local/no-untranslated-feedback',
            'local/no-untranslated-feedback',
            'local/no-untranslated-feedback',
        ]);
    });
});

describe('local/no-hardcoded-design-values', () => {
    const rules = {
        'local/no-hardcoded-design-values': 'error',
    } as const;

    it('accepts component tokens and variable data geometry', async () => {
        const messages = await lintSvelte(
            `
                <script lang="ts">
                    interface IProps {
                        width: string;
                    }

                    let { width }: IProps = $props();
                </script>

                <div style:width></div>
                <style>
                    div {
                        padding: var(--space-stack);
                    }
                </style>
            `,
            rules,
        );

        expect(messages).toEqual([]);
    });

    it('rejects component CSS, inline-style, and style-directive literals', async () => {
        const messages = await lintSvelte(
            `
                <div style="padding: 12px" style:width={24}></div>
                <style>
                    div {
                        margin: 0;
                    }
                </style>
            `,
            rules,
        );

        expect(ruleIds(messages)).toEqual([
            'local/no-hardcoded-design-values',
            'local/no-hardcoded-design-values',
            'local/no-hardcoded-design-values',
        ]);
    });
});

describe('local/no-undefined-i18n-keys', () => {
    const rules: RuleSelection = {
        'local/no-undefined-i18n-keys': [
            'error',
            {
                functionNames: ['t', 'translate'],
                keys: ['welcome.description'],
                methodNames: ['translate'],
            },
        ],
    };

    it('accepts literal English catalogue keys', async () => {
        const messages = await lintTypeScript(
            `
                translation.translate('welcome.description');
                t(\`welcome.description\`);
            `,
            'src/features/viewer/view-model.ts',
            rules,
        );

        expect(messages).toEqual([]);
    });

    it('accepts indexed const maps containing only literal catalogue keys', async () => {
        const messages = await lintTypeScript(
            `
                const labels = {
                    primary: 'welcome.description',
                    secondary: 'welcome.description',
                } satisfies Readonly<Record<'primary' | 'secondary', TranslationKey>>;
                const nestedLabels = {
                    primary: {
                        compact: 'welcome.description',
                    },
                    secondary: {
                        compact: 'welcome.description',
                    },
                } satisfies Readonly<
                    Record<'primary' | 'secondary', Readonly<Record<'compact', TranslationKey>>>
                >;

                translation.translate(labels[variant]);
                translation.translate(nestedLabels[variant][density]);
            `,
            'src/features/viewer/view-model.ts',
            rules,
        );

        expect(messages).toEqual([]);
    });

    it('rejects missing, dynamic, and cast translation keys', async () => {
        const messages = await lintTypeScript(
            `
                translation.translate('missing.message');
                translation.translate(key);
                translation.translate('welcome.description' as TranslationKey);
            `,
            'src/features/viewer/view-model.ts',
            rules,
        );

        expect(ruleIds(messages)).toEqual([
            'local/no-undefined-i18n-keys',
            'local/no-undefined-i18n-keys',
            'local/no-undefined-i18n-keys',
        ]);
    });

    it('rejects const maps containing a missing catalogue key', async () => {
        const messages = await lintTypeScript(
            `
                const labels = {
                    known: 'welcome.description',
                    missing: 'missing.message',
                } satisfies Readonly<Record<'known' | 'missing', TranslationKey>>;

                translation.translate(labels[variant]);
            `,
            'src/features/viewer/view-model.ts',
            rules,
        );

        expect(ruleIds(messages)).toEqual(['local/no-undefined-i18n-keys']);
        expect(messages[0]?.message).toContain('missing.message');
    });

    it('rejects mutable const maps without a satisfies type contract', async () => {
        const messages = await lintTypeScript(
            `
                const labels = {
                    primary: 'welcome.description',
                };

                translation.translate(labels[variant]);
            `,
            'src/features/viewer/view-model.ts',
            rules,
        );

        expect(ruleIds(messages)).toEqual(['local/no-undefined-i18n-keys']);
    });
});

describe('local/no-raw-intl', () => {
    const rules = {
        'local/no-raw-intl': 'error',
    } as const;

    it('accepts injected localization service calls', async () => {
        const messages = await lintTypeScript('localisation.formatDate(instant);', 'src/presentation/view-model.ts', rules);

        expect(messages).toEqual([]);
    });

    it('rejects direct Intl formatters and locale-implicit methods', async () => {
        const messages = await lintTypeScript(
            `
                const formatter = new Intl['DateTimeFormat']('en');
                date['toLocaleString']();
            `,
            'src/presentation/view-model.ts',
            rules,
        );

        expect(messages.filter((message) => message.ruleId === 'local/no-raw-intl')).toHaveLength(2);
    });
});

describe('local/private-controller-state', () => {
    const rules: RuleSelection = {
        'local/private-controller-state': [
            'error',
            {
                privateNamePrefix: '_',
            },
        ],
    };

    it('accepts runtime-private #_ state fields', async () => {
        const messages = await lintTypeScript(
            `
                class WorkspaceController {
                    #_count = $state(0);
                }
            `,
            'src/presentation/workspace-controller.svelte.ts',
            rules,
        );

        expect(messages).toEqual([]);
    });

    it('rejects public and TypeScript-private state fields', async () => {
        const messages = await lintTypeScript(
            `
                class WorkspaceController {
                    count = $state(0);
                    private _selection = $state.raw(null);
                }
            `,
            'src/presentation/workspace-controller.svelte.ts',
            rules,
        );

        expect(ruleIds(messages)).toEqual(['local/private-controller-state', 'local/private-controller-state']);
    });
});

describe('local/no-module-service-singletons', () => {
    const rules: RuleSelection = {
        'local/no-module-service-singletons': [
            'error',
            {
                factoryNames: ['createTranslationService'],
                instanceNameSuffixes: ['Controller', 'Service'],
            },
        ],
    };

    it('accepts exported constructors and factories', async () => {
        const messages = await lintTypeScript(
            `
                export const matcher = new RegExp('value');
                export class WorkspaceController {}
                export function createWorkspaceController(): WorkspaceController {
                    return new WorkspaceController();
                }
            `,
            'src/presentation/workspace-controller.svelte.ts',
            rules,
        );

        expect(messages).toEqual([]);
    });

    it('rejects exported constructed, factory-created, and typed object instances', async () => {
        const messages = await lintTypeScript(
            `
                interface ILocaleService {
                    locale(): string;
                }

                export const errorService = new ErrorService([]);
                export const translation = createTranslationService(catalogue, errors);
                export const localeService: ILocaleService = {
                    locale: () => 'en',
                };
                const workspaceController = new WorkspaceController();
                export { workspaceController };
            `,
            'src/presentation/services.ts',
            rules,
        );

        expect(ruleIds(messages)).toEqual([
            'local/no-module-service-singletons',
            'local/no-module-service-singletons',
            'local/no-module-service-singletons',
            'local/no-module-service-singletons',
        ]);
    });
});

describe('local/no-ui-service-implementation-imports', () => {
    const rules: RuleSelection = {
        'local/no-ui-service-implementation-imports': [
            'error',
            {
                implementationExports: [
                    'ConsoleErrorProvider',
                    'ErrorService',
                    'LogFileErrorProvider',
                    'createTranslationService',
                ],
                implementationOnlyModules: ['#tauri-platform'],
                implementationOwningModules: [
                    '#tauri-platform',
                    '#error-reporting',
                    '#localization',
                    '#viewer-application',
                    '#viewer-presentation',
                ],
            },
        ],
    };

    it('accepts service contract imports', async () => {
        const messages = await lintSvelte(
            `
                <script lang="ts">
                    import type { IErrorService } from '#error-reporting';
                    import type { ITranslationService } from '#localization';
                </script>
            `,
            rules,
        );

        expect(messages).toEqual([]);
    });

    it('rejects concrete application, presentation, and platform service imports', async () => {
        const messages = await lintSvelte(
            `
                <script lang="ts">
                    import { ErrorService } from '#error-reporting';
                    import { createTranslationService } from '#localization';
                    import { ConsoleErrorProvider } from '#tauri-platform';
                    void import('#tauri-platform');
                </script>
            `,
            rules,
        );

        expect(ruleIds(messages)).toEqual([
            'local/no-ui-service-implementation-imports',
            'local/no-ui-service-implementation-imports',
            'local/no-ui-service-implementation-imports',
            'local/no-ui-service-implementation-imports',
        ]);
    });
});

describe('local/no-direct-brand-icon-imports', () => {
    const rules: RuleSelection = {
        'local/no-direct-brand-icon-imports': [
            'error',
            {
                allow: ['src/shell/app-branding.ts'],
                assetPathFragments: ['assets/app-icon.png'],
                brandExports: ['appIcon'],
                brandModules: ['#shell', '#ui'],
                libraryPathFragments: ['src/compliance/', 'src/shell/', 'src/ui/', 'src/viewer/'],
            },
        ],
    };

    it('accepts the branding model and unrelated UI and shell imports', async () => {
        const messages = await lintSvelte(
            `
                <script lang="ts">
                    import { Button } from '#ui';
                    import { useAppBranding } from '#shell';
                </script>
            `,
            rules,
        );

        expect(messages).toEqual([]);
    });

    it('rejects importing a raw brand icon export through a public entry', async () => {
        const messages = await lintSvelte(
            `
                <script lang="ts">
                    import { appIcon } from '#ui';
                </script>
            `,
            rules,
        );

        expect(ruleIds(messages)).toEqual(['local/no-direct-brand-icon-imports']);
    });

    it('rejects deep imports of the packaged brand asset inside the library', async () => {
        const messages = await lintTypeScript(
            "import appIcon from '../shell/assets/app-icon.png';\n",
            'src/viewer/feature/Fixture.ts',
            rules,
        );

        expect(ruleIds(messages)).toEqual(['local/no-direct-brand-icon-imports']);
    });

    it('allows the branding module to own the packaged asset', async () => {
        const messages = await lintTypeScript(
            "import appIcon from './assets/app-icon.png';\n",
            'src/shell/app-branding.ts',
            rules,
        );

        expect(messages).toEqual([]);
    });

    it('allows a host composition to provide its own brand asset', async () => {
        const messages = await lintTypeScript(
            "import appIcon from './assets/app-icon.png';\n",
            'apps/viewer/src/renderer/Fixture.ts',
            rules,
        );

        expect(messages).toEqual([]);
    });
});
