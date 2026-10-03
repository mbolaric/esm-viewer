import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    decodePackageManifest,
    readPackageManifest,
    sharedRuntimeDependencies,
    type IPackageManifest,
} from '../package-manifest.js';

const source: IPackageManifest = {
    name: 'library',
    dependencies: { renderer: '1.2.3' },
    devDependencies: { compiler: '4.5.6' },
};

describe('shared dependency compatibility', () => {
    it('accepts an independent consumer with private additions and the same shared versions', () => {
        const consumer = decodePackageManifest({
            name: 'host',
            dependencies: { renderer: '1.2.3', private: '7.8.9' },
            devDependencies: { compiler: '4.5.6' },
        });
        expect(sharedRuntimeDependencies(source, consumer)).toEqual(['renderer']);
    });

    it('rejects missing runtime dependencies and differing runtime or compiler versions', () => {
        for (const manifest of [
            { name: 'host' },
            { name: 'host', dependencies: { renderer: '2.0.0' } },
            { name: 'host', dependencies: { renderer: '1.2.3' }, devDependencies: { compiler: '5.0.0' } },
        ]) {
            expect(() => sharedRuntimeDependencies(source, decodePackageManifest(manifest))).toThrow(TypeError);
        }
    });

    it('does not require library-only development tools in the consumer', () => {
        expect(
            sharedRuntimeDependencies(source, decodePackageManifest({ name: 'host', dependencies: source.dependencies })),
        ).toEqual(['renderer']);
    });

    it('requires explicitly shared compiler dependencies before singleton resolution', () => {
        const consumer = decodePackageManifest({ name: 'host', dependencies: source.dependencies });
        expect(() => sharedRuntimeDependencies(source, consumer, ['compiler'])).toThrow('compiler@4.5.6');
        expect(() => sharedRuntimeDependencies(source, consumer, ['missing'])).toThrow('missing');
    });

    it.each(['^1.2.3', '~1.2.3', '*', 'workspace:*'])('rejects matching unpinned runtime declarations: %s', (version) => {
        const manifest = { ...source, dependencies: { renderer: version } };
        expect(() => sharedRuntimeDependencies(manifest, manifest)).toThrow('exact version');
    });

    it('also requires an exact version for a deduplicated development runtime', () => {
        const manifest = { ...source, devDependencies: { compiler: '^4.5.6' } };
        expect(() => sharedRuntimeDependencies(manifest, manifest, ['compiler'])).toThrow('exact version');
    });

    it.each([null, [], {}, { name: '' }, { name: 'host', dependencies: [] }, { name: 'host', dependencies: { renderer: 123 } }])(
        'rejects malformed manifest boundaries: %j',
        (value: unknown) => {
            expect(() => decodePackageManifest(value)).toThrow(TypeError);
        },
    );

    it('decodes manifests from disk and exposes missing files, invalid JSON and malformed declarations', () => {
        const directory = mkdtempSync(join(tmpdir(), 'manifest-policy-test-'));
        const path = join(directory, 'package.json');
        try {
            expect(() => readPackageManifest(path)).toThrow();
            writeFileSync(path, JSON.stringify(source));
            expect(readPackageManifest(path)).toEqual(source);
            writeFileSync(path, '{');
            expect(() => readPackageManifest(path)).toThrow(SyntaxError);
            writeFileSync(path, JSON.stringify({ name: 'host', dependencies: { runtime: '' } }));
            expect(() => readPackageManifest(path)).toThrow(TypeError);
        } finally {
            rmSync(directory, { recursive: true });
        }
    });
});
