import { describe, expect, it } from 'vitest';

import { createRendererConfig, replaceHtmlPlaceholder } from '../renderer-config.js';

describe('reusable renderer configuration', () => {
    it('keeps renderer paths and startup content supplied by the consumer', () => {
        const config = createRendererConfig(
            { root: '/renderer', outDir: '/output', svelteConfigFile: '/compiler.js', startupHtml: '<main>Host</main>' },
            {
                build: {},
                runtimePackages: ['runtime'],
                startupPlaceholder: '<!-- startup -->',
                warmupClientFiles: ['Root.svelte'],
            },
        );
        expect(config.root).toBe('/renderer');
        expect(config.build?.outDir).toBe('/output');
        expect(config.build?.target).toBe('es2022');
        expect(config.build?.sourcemap).toBe(false);
        expect(config.build?.assetsInlineLimit).toBe(0);
        expect(config.resolve?.dedupe).toEqual(['runtime']);
        expect(config.server?.warmup?.clientFiles).toEqual(['Root.svelte']);
        expect(replaceHtmlPlaceholder('<div><!-- startup --></div>', '<!-- startup -->', '<main>Host</main>')).toBe(
            '<div><main>Host</main></div>',
        );
    });

    it.each(['<div></div>', '<!-- startup --><!-- startup -->'])('rejects invalid startup HTML: %s', (html) => {
        expect(() => replaceHtmlPlaceholder(html, '<!-- startup -->', 'content')).toThrow(TypeError);
    });

    it('preserves replacement content literally', () => {
        expect(replaceHtmlPlaceholder('<!-- startup -->', '<!-- startup -->', '$&')).toBe('$&');
    });

    it('retains chunk policy and explicit host plugin extensions without replacing shared plugins', () => {
        const extension = { name: 'host-extension' };
        const groups = [{ name: 'custom-group', test: /custom/ }];
        const config = createRendererConfig(
            {
                root: '/renderer',
                outDir: '/output',
                svelteConfigFile: '/compiler.js',
                startupHtml: 'Host',
                extensions: [extension],
                lazyModules: [{ name: 'optional', test: /optional/ }],
            },
            {
                build: { rolldownOptions: { output: { codeSplitting: { groups } } } },
                runtimePackages: ['runtime'],
                startupPlaceholder: '<!-- startup -->',
                warmupClientFiles: [],
            },
        );
        expect(config.build?.rolldownOptions).toEqual({ output: { codeSplitting: { groups } } });
        expect(config.plugins).toContain(extension);
        expect(config.plugins?.at(-1)).toEqual(expect.objectContaining({ name: 'runtime-bundle-policy', enforce: 'post' }));
        expect(config.plugins).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ name: 'startup-splash' }),
                expect.objectContaining({ name: 'runtime-bundle-policy', apply: 'build' }),
            ]),
        );
    });

    it('rejects an empty placeholder rather than replacing an arbitrary position', () => {
        expect(() => replaceHtmlPlaceholder('renderer', '', 'Host')).toThrow(TypeError);
    });
});
