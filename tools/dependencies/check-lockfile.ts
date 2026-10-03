import { readFile } from 'node:fs/promises';

const lockfile = await readFile('pnpm-lock.yaml', 'utf8');

// Disallow untrusted Git dependencies.
const gitSources = lockfile.match(/git\+(?:https|ssh):\/\/[^\s'",}\]]+/gu) ?? [];
const untrusted = gitSources.filter((source) => !source.includes('github.com/mbolaric/'));
if (untrusted.length > 0) {
    throw new Error(`Untrusted Git dependencies found: ${untrusted.join(', ')}`);
}

// Enforce reviewed version of sensitive transitive dependencies.
const matches = [...lockfile.matchAll(/brace-expansion@(\d+\.\d+\.\d+(?:-[^\s:]+)?)/gu)].flatMap((match) =>
    typeof match[1] === 'string' ? [match[1]] : [],
);
const versions = new Set(matches);

if (versions.size !== 1 || !versions.has('5.0.9')) {
    const versionList = [...versions].join(', ');
    throw new Error(
        `brace-expansion must resolve only to reviewed version 5.0.9; found: ${versionList.length > 0 ? versionList : 'none'}`,
    );
}
