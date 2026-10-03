import { fileURLToPath } from 'node:url';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

const svelteConfigFile = fileURLToPath(new URL('./svelte.config.js', import.meta.url));
const testFiles = ['apps/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.ts', 'tools/**/__tests__/**/*.test.ts'];
const svelteTestFiles = ['apps/**/__tests__/**/*.svelte.test.ts', 'src/**/__tests__/**/*.svelte.test.ts'];

export function createVitestConfig(options?: {
    readonly dedupeSvelte?: boolean;
    readonly svelteConfigFile?: string;
}): ReturnType<typeof defineConfig> {
    const configFile = options?.svelteConfigFile ?? svelteConfigFile;
    return defineConfig({
        ...(options?.dedupeSvelte === true ? { resolve: { dedupe: ['svelte'] } } : {}),
        plugins: [svelte({ configFile })],
        test: {
            coverage: {
                include: ['src/**/*.ts'],
                provider: 'v8',
                reporter: ['text', 'json-summary'],
            },
            fsModuleCache: true,
            passWithNoTests: false,
            projects: [
                {
                    extends: true,
                    test: {
                        environment: 'node',
                        exclude: svelteTestFiles,
                        include: testFiles,
                        name: 'node',
                    },
                },
                {
                    extends: true,
                    resolve: {
                        conditions: ['browser'],
                    },
                    test: {
                        environment: 'jsdom',
                        include: svelteTestFiles,
                        name: 'svelte',
                        pool: 'vmThreads',
                    },
                },
            ],
        },
    });
}

export default createVitestConfig();
