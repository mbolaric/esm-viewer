import { fileURLToPath } from 'node:url';
import type { UserConfig } from 'vite';

import { createRendererConfig, type IRendererConfigOptions } from './tools/build/renderer-config.js';
import { readPackageManifest, sharedRuntimeDependencies } from './tools/dependencies/package-manifest.js';

export interface IViewerRendererConfigOptions extends IRendererConfigOptions {
    readonly manifestPath: string;
}

const minimumJavaScriptGroupSize = 32 * 1024;
const maximumLocaleGroupSize = 480 * 1024;
const maximumChartVendorGroupSize = 1_750 * 1024;

export const viewerCodeSplittingGroups = [
    {
        maxSize: maximumLocaleGroupSize,
        minSize: minimumJavaScriptGroupSize,
        name: 'locales',
        test: /src[\\/]localization[\\/]catalogues[\\/]/,
    },
    {
        maxSize: maximumChartVendorGroupSize,
        minSize: minimumJavaScriptGroupSize,
        name: 'chart-vendor',
        test: /node_modules[\\/](?:echarts|zrender)[\\/]/,
    },
    {
        name: 'viewer-core',
        test: /src[\\/]viewer[\\/](?:parser|presentation)[\\/]/,
    },
    {
        name: 'initial-vendor',
        tags: ['$initial' as const],
        test: /node_modules[\\/]/,
    },
];

export function createViewerRendererConfig(options: IViewerRendererConfigOptions): UserConfig {
    const source = readPackageManifest(fileURLToPath(new URL('./package.json', import.meta.url)));
    const consumer = readPackageManifest(options.manifestPath);
    return createRendererConfig(
        {
            ...options,
            lazyModules: [
                { name: 'chart runtime', test: /\/src\/ui\/charts\/echarts-interval-timeline-runtime\.ts$/ },
                ...(options.lazyModules ?? []),
            ],
        },
        {
            runtimePackages: ['svelte', ...sharedRuntimeDependencies(source, consumer, ['svelte'])],
            startupPlaceholder: '<!-- %STARTUP_SPLASH% -->',
            warmupClientFiles: ['App.svelte'],
            build: {
                rolldownOptions: {
                    output: {
                        codeSplitting: {
                            groups: viewerCodeSplittingGroups,
                        },
                    },
                },
            },
        },
    );
}
