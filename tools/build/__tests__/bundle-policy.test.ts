import { describe, expect, it } from 'vitest';

import { bundledPackageRoots, requireLazyModuleChunks, requireSingleRuntimeCopies, type IBundleChunk } from '../bundle-policy.js';

const lazyRule = { name: 'optional capability', test: /\/capability\// };
const entry: IBundleChunk = {
    fileName: 'entry.js',
    isEntry: true,
    imports: ['shared.js'],
    dynamicImports: ['capability.js'],
    moduleIds: ['/app/root.js'],
};
const shared: IBundleChunk = {
    fileName: 'shared.js',
    isEntry: false,
    imports: [],
    dynamicImports: [],
    moduleIds: ['/app/shared.js'],
};
const capability: IBundleChunk = {
    fileName: 'capability.js',
    isEntry: false,
    imports: ['shared.js'],
    dynamicImports: [],
    moduleIds: ['/app/capability/root.js'],
};

describe('runtime bundle policy', () => {
    it('counts one installed package once across multiple modules and chunks', () => {
        const modules = ['/root/node_modules/runtime/a.js', '/root/node_modules/runtime/b.js'];
        expect(bundledPackageRoots(modules, 'runtime')).toEqual(['/root/node_modules/runtime/']);
        expect(() => {
            requireSingleRuntimeCopies(modules, ['runtime']);
        }).not.toThrow();
    });

    describe('lazy module bundle policy', () => {
        it('accepts dynamically reachable modules with shared dependencies', () => {
            expect(() => {
                requireLazyModuleChunks([entry, shared, capability], [lazyRule]);
            }).not.toThrow();
        });

        it('rejects eager imports, including transitive imports from a shared chunk', () => {
            for (const chunks of [
                [{ ...entry, imports: ['shared.js', 'capability.js'] }, shared, capability],
                [entry, { ...shared, imports: ['capability.js'] }, capability],
            ]) {
                expect(() => {
                    requireLazyModuleChunks(chunks, [lazyRule]);
                }).toThrow('dynamic imports');
            }
        });

        it('checks every entry point and every matching chunk', () => {
            const extraEntry = { ...entry, fileName: 'other.js', imports: ['capability.js'] };
            const eagerModule = { ...shared, moduleIds: ['/app/capability/shared.js'] };
            expect(() => {
                requireLazyModuleChunks([entry, shared, capability, extraEntry], [lazyRule]);
            }).toThrow('dynamic imports');
            expect(() => {
                requireLazyModuleChunks([entry, eagerModule, capability], [lazyRule]);
            }).toThrow('dynamic imports');
        });

        it('rejects absent rules, entries, modules, disconnected chunks and incomplete import graphs', () => {
            expect(() => {
                requireLazyModuleChunks([entry, shared, capability], []);
            }).toThrow('module rules');
            expect(() => {
                requireLazyModuleChunks([shared, capability], [lazyRule]);
            }).toThrow('entry chunks');
            expect(() => {
                requireLazyModuleChunks([entry, shared, capability], [{ ...lazyRule, test: /missing/ }]);
            }).toThrow('no modules');
            expect(() => {
                requireLazyModuleChunks([{ ...entry, dynamicImports: [] }, shared, capability], [lazyRule]);
            }).toThrow('dynamic imports');
            expect(() => {
                requireLazyModuleChunks([entry, shared], [lazyRule]);
            }).toThrow('cannot resolve');
            expect(() => {
                requireLazyModuleChunks([entry, shared, capability, capability], [lazyRule]);
            }).toThrow('unique file names');
        });

        it('normalizes Windows paths and terminates on cyclic chunk imports', () => {
            const windowsCapability = { ...capability, moduleIds: ['C:\\app\\capability\\root.js'] };
            const cyclicShared = { ...shared, imports: ['entry.js'] };
            expect(() => {
                requireLazyModuleChunks([entry, cyclicShared, windowsCapability], [lazyRule]);
            }).not.toThrow();
        });

        it('rejects unnamed or stateful rules', () => {
            for (const rule of [
                { ...lazyRule, name: '' },
                { ...lazyRule, test: /capability/g },
                { ...lazyRule, test: /capability/y },
            ]) {
                expect(() => {
                    requireLazyModuleChunks([entry, shared, capability], [rule]);
                }).toThrow('stateless pattern');
            }
        });
    });

    it('rejects nested installations even when they have the same package version', () => {
        const modules = [
            '/root/node_modules/.pnpm/runtime@1/node_modules/runtime/a.js',
            '/root/library/node_modules/.pnpm/runtime@1/node_modules/runtime/a.js',
        ];
        expect(() => {
            requireSingleRuntimeCopies(modules, ['runtime']);
        }).toThrow('found 2');
    });

    it('handles scoped packages and Windows module IDs', () => {
        expect(bundledPackageRoots(['C:\\root\\node_modules\\@scope\\runtime\\a.js'], '@scope/runtime')).toEqual([
            'C:/root/node_modules/@scope/runtime/',
        ]);
    });

    it('rejects missing packages and empty scan coverage', () => {
        expect(() => {
            requireSingleRuntimeCopies(['/root/source.js'], ['runtime']);
        }).toThrow('found 0');
        expect(() => {
            requireSingleRuntimeCopies([], ['runtime']);
        }).toThrow(TypeError);
        expect(() => {
            requireSingleRuntimeCopies(['/root/source.js'], []);
        }).toThrow(TypeError);
    });
});
