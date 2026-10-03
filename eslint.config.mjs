import eslint from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import { en } from '#i18n';

import { localPlugin } from './tools/eslint/local-plugin.ts';

const typedFiles = ['**/*.ts', '**/*.svelte.ts'];
const namingConvention = [
    'error',
    {
        format: ['camelCase'],
        leadingUnderscore: 'require',
        modifiers: ['private'],
        selector: ['classProperty', 'parameterProperty'],
    },
    {
        format: ['camelCase'],
        leadingUnderscore: 'require',
        modifiers: ['#private'],
        selector: 'classProperty',
    },
    {
        custom: {
            match: true,
            regex: '^I[A-Z][A-Za-z0-9]*$',
        },
        format: ['PascalCase'],
        selector: 'interface',
    },
];
const noHardcodedUiStrings = [
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
];
const noUntranslatedFeedback = [
    'error',
    {
        functions: ['alert', 'confirm', 'prompt'],
        methods: ['announce', 'notify', 'setStatus', 'showErrorBox', 'showMessage', 'showMessageBox'],
        objectProperties: ['description', 'detail', 'help', 'label', 'message', 'placeholder', 'title'],
    },
];
const noUndefinedI18nKeys = [
    'error',
    {
        functionNames: ['t', 'translate'],
        keys: Object.keys(en),
        methodNames: ['translate'],
    },
];
const noModuleServiceSingletons = [
    'error',
    {
        factoryNames: ['createLocalisationService', 'createTranslationService'],
        instanceNameSuffixes: ['Controller', 'Service'],
    },
];
const noUiServiceImplementationImports = [
    'error',
    {
        implementationExports: [
            'ConsoleErrorProvider',
            'DocumentLifecycleController',
            'DocumentSelectionController',
            'ErrorService',
            'LogFileErrorProvider',
            'createLocalisationService',
            'createTranslationService',
        ],
        implementationOnlyModules: ['#viewer-parser-client'],
        implementationOwningModules: [
            '#error-reporting',
            '#localization',
            '#tauri-platform',
            '#viewer-application',
            '#viewer-presentation',
        ],
    },
];
const noDirectBrandIconImports = [
    'error',
    {
        allow: ['src/shell/app-branding.ts'],
        assetPathFragments: ['assets/app-icon.png'],
        brandExports: ['appIcon'],
        brandModules: ['#shell', '#ui'],
        libraryPathFragments: ['src/compliance/', 'src/shell/', 'src/ui/', 'src/viewer/'],
    },
];
const privateControllerState = [
    'error',
    {
        privateNamePrefix: '_',
    },
];
const noUnusedVars = [
    'error',
    {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        varsIgnorePattern: '^_',
    },
];

const noRestrictedImports = [
    'error',
    {
        paths: [
            {
                name: 'zod',
                message: 'Decode unknown values with application-owned decoder functions.',
            },
            {
                name: 'svelte/store',
                message: 'Do not import application state primitives from svelte/store; use Svelte 5 runes (.svelte.ts).',
            },
            {
                importNames: ['beforeUpdate', 'afterUpdate', 'createEventDispatcher'],
                name: 'svelte',
                message: 'Legacy Svelte API is forbidden; use Svelte 5 runes and callback props.',
            },
        ],
        patterns: [
            {
                group: [
                    '#viewer-application/*',
                    '#compliance/*',
                    '!#compliance',
                    '!#compliance-feature',
                    '#fleet-archive/*',
                    '!#fleet-archive-application',
                    '!#fleet-archive-domain',
                    '!#fleet-archive-feature',
                    '!#fleet-archive-infrastructure',
                    '!#fleet-archive-presentation',
                    '#contracts/*',
                    '#error-reporting/*',
                    '#localization/*',
                    '#testing/*',
                    '#time/*',
                    '#application-i18n/*',
                    '#viewer-domain/*',
                    '#tauri-platform/*',
                    '!#tauri-platform',
                    '#viewer-parser/*',
                    '#viewer-parser-client/*',
                    '#viewer-presentation/*',
                    '#ui/*',
                    '!#ui/styles/foundation.css',
                    '#viewer/*',
                ],
                message: 'Import another source module only through its public entry point.',
            },
        ],
    },
];

const complianceFeatureBoundaryMessage =
    'compliance/feature must not depend on viewer/feature (Finding 2); receive translation, ' +
    'localisation, export/pdf ports, toast, and the night-work window through typed props instead.';
const noRestrictedImportsForComplianceFeature = [
    'error',
    {
        paths: [
            ...noRestrictedImports[1].paths,
            { name: '#viewer', message: complianceFeatureBoundaryMessage },
            { name: '#viewer-context', message: complianceFeatureBoundaryMessage },
        ],
        patterns: noRestrictedImports[1].patterns,
    },
];

const config = tseslint.config(
    {
        ignores: [
            '**/coverage/**',
            '**/dist/**',
            '**/node_modules/**',
            '**/out/**',
            'src-tauri/target/**',
            'src/viewer/parser/generated/**',
            'vendor/esm-parser/**',
        ],
    },
    {
        linterOptions: {
            noInlineConfig: true,
            reportUnusedDisableDirectives: 'error',
            reportUnusedInlineConfigs: 'error',
        },
    },
    {
        ...eslint.configs.recommended,
        languageOptions: {
            globals: globals.node,
        },
    },
    ...tseslint.configs.strictTypeChecked.map((config) => ({
        ...config,
        files: typedFiles,
    })),
    ...tseslint.configs.stylisticTypeChecked.map((config) => ({
        ...config,
        files: typedFiles,
    })),
    ...svelte.configs['flat/recommended'],
    {
        files: typedFiles,
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: {
            local: localPlugin,
        },
        rules: {
            '@typescript-eslint/consistent-type-exports': 'error',
            '@typescript-eslint/consistent-type-imports': [
                'error',
                {
                    fixStyle: 'inline-type-imports',
                    prefer: 'type-imports',
                },
            ],
            '@typescript-eslint/explicit-module-boundary-types': 'error',
            '@typescript-eslint/explicit-function-return-type': [
                'error',
                {
                    allowExpressions: true,
                    allowTypedFunctionExpressions: true,
                },
            ],
            '@typescript-eslint/explicit-member-accessibility': [
                'error',
                {
                    accessibility: 'explicit',
                },
            ],
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/naming-convention': namingConvention,
            '@typescript-eslint/no-non-null-assertion': 'error',
            '@typescript-eslint/no-restricted-imports': noRestrictedImports,
            '@typescript-eslint/no-unnecessary-condition': 'error',
            '@typescript-eslint/no-unused-vars': noUnusedVars,
            '@typescript-eslint/no-unsafe-argument': 'error',
            '@typescript-eslint/no-unsafe-assignment': 'error',
            '@typescript-eslint/no-unsafe-call': 'error',
            '@typescript-eslint/no-unsafe-member-access': 'error',
            '@typescript-eslint/no-unsafe-return': 'error',
            '@typescript-eslint/no-unsafe-type-assertion': 'error',
            '@typescript-eslint/strict-boolean-expressions': 'error',
            '@typescript-eslint/switch-exhaustiveness-check': 'error',
        },
    },
    {
        files: ['**/*.ts'],
        ignores: ['**/*.svelte.ts'],
        rules: {
            'no-restricted-globals': [
                'error',
                {
                    name: '$bindable',
                    message: 'Svelte runes are only allowed in .svelte or .svelte.ts files.',
                },
                {
                    name: '$derived',
                    message: 'Svelte runes are only allowed in .svelte or .svelte.ts files.',
                },
                {
                    name: '$effect',
                    message: 'Svelte runes are only allowed in .svelte or .svelte.ts files.',
                },
                {
                    name: '$host',
                    message: 'Svelte runes are only allowed in .svelte or .svelte.ts files.',
                },
                {
                    name: '$inspect',
                    message: 'Svelte runes are only allowed in .svelte or .svelte.ts files.',
                },
                {
                    name: '$props',
                    message: 'Svelte runes are only allowed in .svelte or .svelte.ts files.',
                },
                {
                    name: '$state',
                    message: 'Svelte runes are only allowed in .svelte or .svelte.ts files.',
                },
            ],
        },
    },
    {
        files: ['apps/**/*.ts', 'src/**/*.ts', 'tools/**/*.ts'],
        ignores: ['**/__tests__/**', 'src/localization/catalogues/**'],
        plugins: {
            local: localPlugin,
        },
        rules: {
            'local/no-untranslated-feedback': noUntranslatedFeedback,
        },
    },
    {
        files: ['apps/**/*.ts', 'src/**/*.ts'],
        ignores: ['**/__tests__/**', 'src/localization/translation-service.ts', 'src/localization/catalogues/**'],
        plugins: {
            local: localPlugin,
        },
        rules: {
            'local/no-undefined-i18n-keys': noUndefinedI18nKeys,
        },
    },
    {
        files: ['apps/**/*.ts', 'src/**/*.ts'],
        // intl-primitives.ts owns the formatter factories; time-zone.ts reads civil date parts with a fixed locale for
        // UTC arithmetic, never for display.
        ignores: ['**/__tests__/**', 'src/localization/intl-primitives.ts', 'src/time/time-zone.ts'],
        plugins: {
            local: localPlugin,
        },
        rules: {
            'local/no-raw-intl': 'error',
        },
    },
    {
        files: ['src/**/*.ts'],
        ignores: ['**/__tests__/**', 'src/localization/catalogues/**'],
        plugins: {
            local: localPlugin,
        },
        rules: {
            'local/no-module-service-singletons': noModuleServiceSingletons,
        },
    },
    {
        files: ['**/*.svelte.ts'],
        languageOptions: {
            parserOptions: {
                parser: tseslint.parser,
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: {
            local: localPlugin,
        },
        rules: {
            'local/private-controller-state': privateControllerState,
        },
    },
    {
        files: ['src/ui/**/*.svelte', 'src/ui/**/*.ts', 'src/viewer/feature/**/*.svelte', 'src/viewer/feature/**/*.ts'],
        ignores: ['**/__tests__/**'],
        plugins: {
            local: localPlugin,
        },
        rules: {
            'local/no-ui-service-implementation-imports': noUiServiceImplementationImports,
        },
    },
    {
        files: ['apps/**/*.svelte', 'apps/**/*.ts', 'src/**/*.svelte', 'src/**/*.ts'],
        ignores: ['**/__tests__/**'],
        plugins: {
            local: localPlugin,
        },
        rules: {
            'local/no-direct-brand-icon-imports': noDirectBrandIconImports,
        },
    },
    {
        files: ['**/*.svelte'],
        plugins: {
            '@typescript-eslint': tseslint.plugin,
            local: localPlugin,
        },
        languageOptions: {
            parserOptions: {
                extraFileExtensions: ['.svelte'],
                parser: tseslint.parser,
                projectService: true,
                svelteConfig: {
                    compilerOptions: {
                        runes: true,
                    },
                },
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            '@typescript-eslint/explicit-member-accessibility': [
                'error',
                {
                    accessibility: 'explicit',
                },
            ],
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/naming-convention': namingConvention,
            '@typescript-eslint/no-non-null-assertion': 'error',
            '@typescript-eslint/no-unsafe-argument': 'error',
            '@typescript-eslint/no-unsafe-assignment': 'error',
            '@typescript-eslint/no-unsafe-call': 'error',
            '@typescript-eslint/no-unsafe-member-access': 'error',
            '@typescript-eslint/no-unsafe-return': 'error',
            '@typescript-eslint/no-unsafe-type-assertion': 'error',
            '@typescript-eslint/no-restricted-imports': noRestrictedImports,
            '@typescript-eslint/no-unused-vars': noUnusedVars,
            'local/no-hardcoded-design-values': 'error',
            'local/no-hardcoded-ui-strings': noHardcodedUiStrings,
            'local/no-module-service-singletons': noModuleServiceSingletons,
            'local/no-raw-intl': 'error',
            'local/no-undefined-i18n-keys': noUndefinedI18nKeys,
            'local/no-untranslated-feedback': noUntranslatedFeedback,
            'local/private-controller-state': privateControllerState,
        },
    },
    {
        files: ['src/compliance/feature/**/*.svelte', 'src/compliance/feature/**/*.ts'],
        ignores: ['**/__tests__/**'],
        rules: {
            '@typescript-eslint/no-restricted-imports': noRestrictedImportsForComplianceFeature,
        },
    },
    {
        // Record<never, never> is the only generic-default shape TypeScript accepts as
        // assignable to Readonly<Partial<Record<TKey, TranslationParameters>>> for an
        // abstract TKey; every non-Record rewrite (mapped-type literal, bare `{}`, `never`)
        // fails that constraint or changes keyof semantics for consuming translate() calls.
        files: ['src/localization/translation-service.ts'],
        rules: {
            '@typescript-eslint/no-generated-empty-object-type': 'off',
        },
    },
);

export function createEslintConfig(rootDirectory, translationKeys) {
    return config.map((entry) => ({
        ...entry,
        ...(entry.languageOptions?.parserOptions === undefined
            ? {}
            : {
                  languageOptions: {
                      ...entry.languageOptions,
                      parserOptions: { ...entry.languageOptions.parserOptions, tsconfigRootDir: rootDirectory },
                  },
              }),
        ...(entry.rules?.['local/no-undefined-i18n-keys'] === undefined
            ? {}
            : {
                  rules: {
                      ...entry.rules,
                      'local/no-undefined-i18n-keys': ['error', { ...noUndefinedI18nKeys[1], keys: translationKeys }],
                  },
              }),
    }));
}

export default config;
