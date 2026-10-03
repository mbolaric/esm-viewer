export const sourceModules = [
    {
        name: 'shell',
        path: 'src/shell',
        publicEntries: ['index\\.ts', 'startup-splash\\.ts', 'app-model\\.ts'],
    },
    {
        name: 'testing',
        path: 'src/__tests__',
        publicEntries: ['index\\.ts'],
    },
    {
        name: 'compliance',
        path: 'src/compliance',
        publicEntries: [
            'index\\.ts',
            'rules\\.ts',
            'feature/index\\.ts',
            'feature/controllers/compliance-export-controller\\.svelte\\.ts',
            'feature/controllers/compliance-profile-controller\\.svelte\\.ts',
        ],
    },
    {
        name: 'contracts',
        path: 'src/contracts',
        publicEntries: ['index\\.ts'],
    },
    {
        name: 'error-reporting',
        path: 'src/error-reporting',
        publicEntries: ['index\\.ts'],
    },
    {
        name: 'localization',
        path: 'src/localization',
        publicEntries: ['application-catalogue\\.ts', 'index\\.ts', 'catalogues/en\\.ts', 'catalogues/index\\.ts'],
    },
    {
        name: 'time',
        path: 'src/time',
        publicEntries: ['index\\.ts'],
    },
    {
        name: 'platform-tauri',
        path: 'src/platform/tauri',
        publicEntries: ['index\\.ts'],
    },
    {
        name: 'ui',
        path: 'src/ui',
        publicEntries: ['index\\.ts', 'styles/foundation\\.css'],
    },
    {
        name: 'viewer-application',
        path: 'src/viewer/application',
        publicEntries: ['index\\.ts'],
    },
    {
        name: 'tachograph-domain',
        path: 'src/tachograph-domain',
        publicEntries: ['index\\.ts'],
    },
    {
        name: 'viewer-feature',
        path: 'src/viewer/feature',
        publicEntries: ['index\\.ts', 'viewer-context\\.ts'],
    },
    {
        name: 'viewer-parser',
        path: 'src/viewer/parser',
        publicEntries: ['client\\.ts'],
    },
    {
        name: 'viewer-presentation',
        path: 'src/viewer/presentation',
        publicEntries: ['index\\.ts'],
    },
];

const publicEntryRules = sourceModules.map((module) => ({
    name: `no-private-imports-into-${module.name}`,
    severity: 'error',
    from: {
        pathNot: `^(?:${module.path}/|src/__tests__/)`,
    },
    to: {
        path: `^${module.path}/.+`,
        pathNot: `^${module.path}/(?:${module.publicEntries.join('|')})$`,
    },
}));

/** @type {import('dependency-cruiser').IConfiguration} */
const config = {
    forbidden: [
        {
            name: 'application-shell-has-no-capability-or-platform-dependency',
            severity: 'error',
            from: { path: '^src/shell/' },
            to: { path: '^(?:apps/|src/(?!shell(?:/|$)|ui(?:/|$)|contracts(?:/|$)|error-reporting(?:/|$)|localization(?:/|$)))' },
        },
        {
            name: 'no-circular',
            severity: 'error',
            from: {},
            to: {
                circular: true,
            },
        },
        {
            name: 'no-orphans',
            severity: 'warn',
            from: {
                orphan: true,
                pathNot: [
                    '(^|/)index\\.html$',
                    '(^|/)index\\.ts$',
                    '(^|/).*\\.config\\.(?:mjs|ts)$',
                    '(^|/).*\\.d\\.ts$',
                    '^tools/',
                ],
            },
            to: {},
        },
        ...publicEntryRules,
        {
            name: 'tooling-remains-application-independent',
            severity: 'error',
            from: {
                path: '^tools/',
                pathNot: '__tests__/',
            },
            to: {
                path: '^(?:apps|src)/',
            },
        },
        {
            name: 'contracts-remain-independent',
            severity: 'error',
            from: {
                path: '^src/contracts/',
            },
            to: {
                path: '^(?:apps/|src/(?!contracts(?:/|$)))',
            },
        },
        {
            name: 'error-reporting-depends-only-on-contracts',
            severity: 'error',
            from: {
                path: '^src/error-reporting/',
            },
            to: {
                path: '^(?:apps/|src/(?!contracts(?:/|$)|error-reporting(?:/|$)))',
            },
        },
        {
            name: 'time-has-no-dependency',
            severity: 'error',
            from: {
                path: '^src/time/',
            },
            to: {
                path: '^(?:apps/|src/(?!time(?:/|$)))',
            },
        },
        {
            name: 'localization-has-no-feature-or-platform-dependency',
            severity: 'error',
            from: {
                path: '^src/localization/',
            },
            to: {
                path: '^(?:apps/|src/(?:platform|ui|viewer)/)',
            },
        },
        {
            name: 'tachograph-domain-remains-independent',
            severity: 'error',
            from: {
                path: '^src/tachograph-domain/',
                pathNot: '^src/tachograph-domain/__tests__/',
            },
            to: {
                path: '^(?:apps/|src/(?!tachograph-domain(?:/|$)|time(?:/|$)))',
            },
        },
        {
            name: 'viewer-application-depends-only-on-inner-layers',
            severity: 'error',
            from: {
                path: '^src/viewer/application/',
            },
            to: {
                path: '^(?:apps/|src/(?!contracts(?:/|$)|tachograph-domain(?:/|$)|time(?:/|$)|viewer/(?:application|domain)(?:/|$)))',
            },
        },
        {
            name: 'viewer-presentation-has-no-platform-ui-or-parser-dependency',
            severity: 'error',
            from: {
                path: '^src/viewer/presentation/',
            },
            to: {
                path: '^(?:apps/|src/(?:platform|shell|ui|viewer/(?:feature|parser))/)',
            },
        },
        {
            name: 'generic-ui-remains-business-and-platform-independent',
            severity: 'error',
            from: {
                path: '^src/ui/',
            },
            to: {
                path: '^(?:apps/|src/(?!ui(?:/|$)))',
            },
        },
        {
            name: 'viewer-feature-has-no-platform-or-parser-dependency',
            severity: 'error',
            from: {
                path: '^src/viewer/feature/',
            },
            to: {
                path: '^(?:apps/|src/(?:platform|viewer/parser)/)',
            },
        },
        {
            name: 'viewer-parser-has-no-platform-presentation-or-ui-dependency',
            severity: 'error',
            from: {
                path: '^src/viewer/parser/',
            },
            to: {
                path: '^(?:apps/|src/(?:error-reporting|localization|platform|shell|ui|viewer/(?:feature|presentation))/)',
            },
        },
        {
            name: 'compliance-domain-remains-independent',
            severity: 'error',
            from: {
                path: '^src/compliance/domain/',
            },
            to: {
                path: '^(?:apps/|src/(?!compliance/domain(?:/|$)|tachograph-domain(?:/|$)|time(?:/|$)))',
            },
        },
        {
            name: 'compliance-application-depends-only-on-inner-layers',
            severity: 'error',
            from: {
                path: '^src/compliance/application/',
            },
            to: {
                path: '^(?:apps/|src/(?!compliance/(?:application|domain)(?:/|$)|contracts(?:/|$)|tachograph-domain(?:/|$)|time(?:/|$)|viewer/application(?:/|$)))',
            },
        },
        {
            name: 'compliance-presentation-has-no-platform-or-ui-dependency',
            severity: 'error',
            from: {
                path: '^src/compliance/presentation/',
            },
            to: {
                path: '^(?:apps/|src/(?:compliance/feature|platform|shell|ui|viewer/(?:feature|parser)))',
            },
        },
        {
            name: 'compliance-feature-has-no-platform-parser-or-viewer-feature-dependency',
            severity: 'error',
            from: {
                path: '^src/compliance/feature/',
            },
            to: {
                path: '^(?:apps/|src/(?:platform|viewer/(?:feature|parser)))',
            },
        },
    ],
    options: {
        doNotFollow: {
            dependencyTypes: ['npm-dev'],
        },
        enhancedResolveOptions: {
            exportsFields: ['exports'],
        },
        exclude: {
            path: '^(?:coverage|node_modules|src/viewer/parser/generated)/',
        },
        tsConfig: {
            fileName: 'tsconfig.renderer.json',
        },
        tsPreCompilationDeps: true,
    },
};

export default config;
