import { readFileSync } from 'node:fs';

export interface IPackageManifest {
    readonly name: string;
    readonly dependencies: Readonly<Record<string, string>>;
    readonly devDependencies: Readonly<Record<string, string>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function dependencyVersions(value: unknown): Readonly<Record<string, string>> {
    if (value === undefined) {
        return {};
    }
    if (!isRecord(value)) {
        throw new TypeError('Package dependency versions must be an object.');
    }
    const versions: Record<string, string> = {};
    for (const [name, version] of Object.entries(value)) {
        if (typeof version !== 'string' || version.length === 0) {
            throw new TypeError(`The dependency ${name} must declare a version.`);
        }
        versions[name] = version;
    }
    return versions;
}

export function decodePackageManifest(value: unknown): IPackageManifest {
    if (!isRecord(value) || typeof value['name'] !== 'string' || value['name'].length === 0) {
        throw new TypeError('A package manifest must declare its name.');
    }
    return {
        name: value['name'],
        dependencies: dependencyVersions(value['dependencies']),
        devDependencies: dependencyVersions(value['devDependencies']),
    };
}

export function readPackageManifest(path: string): IPackageManifest {
    const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return decodePackageManifest(value);
}

export function sharedRuntimeDependencies(
    source: IPackageManifest,
    consumer: IPackageManifest,
    requiredDevelopmentDependencies: readonly string[] = [],
): readonly string[] {
    for (const name of requiredDevelopmentDependencies) {
        if (source.devDependencies[name] === undefined) {
            throw new TypeError(`${source.name} must declare the shared development dependency ${name}.`);
        }
    }
    for (const section of ['dependencies', 'devDependencies'] as const) {
        for (const [name, version] of Object.entries(source[section])) {
            const consumedVersion = consumer[section][name];
            if (
                consumedVersion === undefined &&
                section === 'devDependencies' &&
                !requiredDevelopmentDependencies.includes(name)
            ) {
                continue;
            }
            if (consumedVersion !== version) {
                throw new TypeError(`${consumer.name} must use ${name}@${version} to consume ${source.name}.`);
            }
            if (
                (section === 'dependencies' || requiredDevelopmentDependencies.includes(name)) &&
                !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(version)
            ) {
                throw new TypeError(`The shared runtime dependency ${name} must use an exact version before deduplication.`);
            }
        }
    }
    return Object.keys(source.dependencies);
}
