import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { createViewerRendererConfig, viewerCodeSplittingGroups } from '../../../renderer.config.js';
import { decodePackageManifest } from '../../../tools/dependencies/package-manifest.js';
import { decodeTauriConfiguration } from '../../../tools/quality/tauri-configuration.js';

describe('standalone build policy', () => {
    it('keeps release packaging build profiles aligned with artifact discovery', () => {
        const workflow = readFileSync(new URL('../../../.github/workflows/release.yml', import.meta.url), 'utf8');
        expect(workflow).toContain("includeDebug: ${{ matrix.build_type == 'debug' }}");
        expect(workflow).toContain("includeRelease: ${{ matrix.build_type == 'release' }}");
        expect(workflow).toContain("args: ${{ matrix.build_type == 'debug' && '--features devtools' || '' }}");
    });

    it('consumes the public renderer preset with independently owned paths and singleton runtimes', () => {
        const config = createViewerRendererConfig({
            root: '/standalone/renderer',
            outDir: '/standalone/output',
            svelteConfigFile: fileURLToPath(new URL('../../../svelte.config.js', import.meta.url)),
            manifestPath: fileURLToPath(new URL('../../../package.json', import.meta.url)),
            startupHtml: '<main>Standalone</main>',
        });
        expect(config.root).toBe('/standalone/renderer');
        expect(config.build?.outDir).toBe('/standalone/output');
        expect(config.base).toBe('/');
        expect(config.resolve?.dedupe).toEqual([
            'svelte',
            '@lucide/svelte',
            '@tauri-apps/api',
            '@tauri-apps/plugin-dialog',
            '@tauri-apps/plugin-fs',
            'echarts',
        ]);
    });

    it('preserves the renderer chunk groups and their existing budgets', () => {
        expect(viewerCodeSplittingGroups.map((group) => group.name)).toEqual([
            'locales',
            'chart-vendor',
            'viewer-core',
            'initial-vendor',
        ]);
        expect(viewerCodeSplittingGroups.find((group) => group.name === 'locales')?.maxSize).toBe(480 * 1024);
        expect(viewerCodeSplittingGroups.find((group) => group.name === 'chart-vendor')?.maxSize).toBe(1_750 * 1024);
        expect(viewerCodeSplittingGroups.find((group) => group.name === 'locales')?.minSize).toBe(32 * 1024);
    });

    it('verifies native policy using only standalone application configuration', () => {
        const value: unknown = JSON.parse(readFileSync(new URL('../../../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
        const config = decodeTauriConfiguration(value, 'main');
        expect(config.productName).toBe('ESM Viewer');
        expect(config.identifier).toBe('com.esmviewer.desktop');
        expect(config.policy.devCsp).toEqual(config.policy.csp);
    });

    it('rejects incompatible consumer runtime versions before creating a deduplicated renderer', () => {
        const value: unknown = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'));
        const source = decodePackageManifest(value);
        const directory = mkdtempSync(join(tmpdir(), 'renderer-policy-test-'));
        const manifestPath = join(directory, 'package.json');
        try {
            writeFileSync(
                manifestPath,
                JSON.stringify({ ...source, name: 'test-host', dependencies: { ...source.dependencies, echarts: '0.0.0' } }),
            );
            expect(() =>
                createViewerRendererConfig({
                    root: '/host/renderer',
                    outDir: '/host/output',
                    svelteConfigFile: fileURLToPath(new URL('../../../svelte.config.js', import.meta.url)),
                    manifestPath,
                    startupHtml: '<main>Host</main>',
                }),
            ).toThrow('echarts@');
        } finally {
            rmSync(directory, { recursive: true });
        }
    });
});
