import { svelte } from '@sveltejs/vite-plugin-svelte';
import type { PluginOption, UserConfig } from 'vite';

import { runtimeBundlePolicy, type ILazyModuleRule } from './bundle-policy.js';

export interface IRendererConfigOptions {
    readonly root: string;
    readonly outDir: string;
    readonly svelteConfigFile: string;
    readonly startupHtml: string;
    readonly extensions?: readonly PluginOption[];
    readonly lazyModules?: readonly ILazyModuleRule[];
}

export interface IRendererBuildPolicy {
    readonly build: UserConfig['build'];
    readonly runtimePackages: readonly string[];
    readonly startupPlaceholder: string;
    readonly warmupClientFiles: readonly string[];
}

export function replaceHtmlPlaceholder(html: string, placeholder: string, content: string): string {
    if (placeholder.length === 0 || html.split(placeholder).length !== 2) {
        throw new TypeError('The renderer HTML must contain exactly one startup placeholder.');
    }
    return html.replace(placeholder, () => content);
}

export function createRendererConfig(options: IRendererConfigOptions, policy: IRendererBuildPolicy): UserConfig {
    return {
        base: '/',
        root: options.root,
        resolve: { dedupe: [...policy.runtimePackages] },
        build: {
            ...policy.build,
            assetsInlineLimit: 0,
            emptyOutDir: true,
            outDir: options.outDir,
            sourcemap: false,
            target: 'es2022',
        },
        plugins: [
            svelte({ configFile: options.svelteConfigFile }),
            {
                name: 'startup-splash',
                transformIndexHtml(html: string): string {
                    return replaceHtmlPlaceholder(html, policy.startupPlaceholder, options.startupHtml);
                },
            },
            ...(options.extensions ?? []),
            runtimeBundlePolicy(policy.runtimePackages, options.lazyModules),
        ],
        server: { warmup: { clientFiles: [...policy.warmupClientFiles] } },
    };
}
