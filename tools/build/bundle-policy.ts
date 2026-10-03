import type { Plugin } from 'vite';

export interface IBundleChunk {
    readonly fileName: string;
    readonly isEntry: boolean;
    readonly imports: readonly string[];
    readonly dynamicImports: readonly string[];
    readonly moduleIds: readonly string[];
}

export interface ILazyModuleRule {
    readonly name: string;
    readonly test: RegExp;
}

export function bundledPackageRoots(moduleIds: readonly string[], packageName: string): readonly string[] {
    const roots = new Set<string>();
    const marker = `/node_modules/${packageName}/`;
    for (const moduleId of moduleIds) {
        const normalized = moduleId.replaceAll('\\', '/');
        const position = normalized.lastIndexOf(marker);
        if (position >= 0) {
            roots.add(normalized.slice(0, position + marker.length));
        }
    }
    return [...roots];
}

export function requireSingleRuntimeCopies(moduleIds: readonly string[], packageNames: readonly string[]): void {
    if (moduleIds.length === 0 || packageNames.length === 0) {
        throw new TypeError('Runtime bundle verification requires modules and package names.');
    }
    for (const packageName of packageNames) {
        const count = bundledPackageRoots(moduleIds, packageName).length;
        if (count !== 1) {
            throw new TypeError(`The renderer must bundle exactly one copy of ${packageName}; found ${count.toString()}.`);
        }
    }
}

export function requireLazyModuleChunks(chunks: readonly IBundleChunk[], rules: readonly ILazyModuleRule[]): void {
    const entries = chunks.filter((chunk) => chunk.isEntry).map((chunk) => chunk.fileName);
    if (entries.length === 0 || rules.length === 0) {
        throw new TypeError('Lazy bundle verification requires entry chunks and module rules.');
    }
    const byFileName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
    if (byFileName.size !== chunks.length) {
        throw new TypeError('Bundle chunks must have unique file names.');
    }
    function reachableChunks(includeDynamicImports: boolean): ReadonlySet<string> {
        const visited = new Set<string>();
        const pending = [...entries];
        for (const fileName of pending) {
            if (visited.has(fileName)) {
                continue;
            }
            const chunk = byFileName.get(fileName);
            if (chunk === undefined) {
                throw new TypeError(`Bundle verification cannot resolve the imported chunk ${fileName}.`);
            }
            visited.add(fileName);
            pending.push(...chunk.imports);
            if (includeDynamicImports) {
                pending.push(...chunk.dynamicImports);
            }
        }
        return visited;
    }
    const initial = reachableChunks(false);
    const reachable = reachableChunks(true);
    for (const rule of rules) {
        if (rule.name.length === 0 || rule.test.global || rule.test.sticky) {
            throw new TypeError('Lazy module rules must have a name and a stateless pattern.');
        }
        const matching = chunks.filter((chunk) =>
            chunk.moduleIds.some((moduleId) => rule.test.test(moduleId.replaceAll('\\', '/'))),
        );
        if (matching.length === 0) {
            throw new TypeError(`Bundle verification found no modules for ${rule.name}.`);
        }
        for (const chunk of matching) {
            if (initial.has(chunk.fileName) || !reachable.has(chunk.fileName)) {
                throw new TypeError(`${rule.name} must only be reachable through dynamic imports.`);
            }
        }
    }
}

export function runtimeBundlePolicy(packageNames: readonly string[], lazyModules: readonly ILazyModuleRule[] = []): Plugin {
    return {
        name: 'runtime-bundle-policy',
        apply: 'build',
        enforce: 'post',
        generateBundle: {
            order: 'post',
            handler(_options, bundle) {
                const chunks = Object.values(bundle).flatMap((output) =>
                    output.type === 'chunk'
                        ? [
                              {
                                  fileName: output.fileName,
                                  isEntry: output.isEntry,
                                  imports: output.imports,
                                  dynamicImports: output.dynamicImports,
                                  moduleIds: Object.keys(output.modules),
                              },
                          ]
                        : [],
                );
                requireSingleRuntimeCopies(
                    chunks.flatMap((chunk) => chunk.moduleIds),
                    packageNames,
                );
                if (lazyModules.length > 0) {
                    requireLazyModuleChunks(chunks, lazyModules);
                }
            },
        },
    };
}
