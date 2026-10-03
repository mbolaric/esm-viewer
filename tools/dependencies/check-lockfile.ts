import { readFile } from 'node:fs/promises';

const lockfile = await readFile('pnpm-lock.yaml', 'utf8');

function isTrustedGitSource(source: string): boolean {
    if (!source.startsWith('git+https://') && !source.startsWith('git+ssh://')) {
        return false;
    }
    const url = new URL(source.slice(4));
    return (
        url.hostname === 'github.com' &&
        url.port === '' &&
        url.password === '' &&
        url.search === '' &&
        (url.protocol === 'ssh:' ? url.username === 'git' : url.username === '') &&
        /^\/mbolaric\/[A-Za-z0-9][A-Za-z0-9_.-]*$/u.test(url.pathname)
    );
}

const gitSources = lockfile.match(/\b(?:git\+|git:\/\/|github:|git@)[^\s'",}\]]+/gu) ?? [];
const untrusted = gitSources.filter((source) => !isTrustedGitSource(source));
if (untrusted.length > 0) {
    throw new Error(`Untrusted Git dependencies found: ${untrusted.join(', ')}`);
}

for (const [name, reviewedVersion] of [
    ['brace-expansion', '5.0.12'],
    ['undici', '8.11.2'],
] as const) {
    const pattern = new RegExp(`\\b${name}@([^\\s:()'",}\\]]+)`, 'gu');
    const versions = new Set(
        [...lockfile.matchAll(pattern)].flatMap((match) => (typeof match[1] === 'string' ? [match[1]] : [])),
    );
    if (versions.size !== 1 || !versions.has(reviewedVersion)) {
        const versionList = [...versions].join(', ');
        throw new Error(
            `${name} must resolve only to reviewed version ${reviewedVersion}; found: ${versionList.length > 0 ? versionList : 'none'}`,
        );
    }
}
