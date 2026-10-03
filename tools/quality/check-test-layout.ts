import { readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

import { parseCliOptions, readOptionalOption, readOptionValues } from '../cli/options.ts';
import { findTestLayoutViolations } from './test-layout.ts';

async function collectFiles(directory: string, ignoredDirectories: ReadonlySet<string>): Promise<readonly string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
        if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
            continue;
        }

        const entryPath = join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await collectFiles(entryPath, ignoredDirectories)));
        } else if (entry.isFile()) {
            files.push(relative(repositoryRoot, entryPath));
        }
    }

    return files;
}

const DEFAULT_IGNORED_DIRECTORIES = ['.git', 'coverage', 'dist', 'node_modules', 'out', 'target', 'vendor'];

const options = parseCliOptions(process.argv.slice(2));
const repositoryRoot = resolve(readOptionalOption(options, '--root', '.'));
const cliIgnored = readOptionValues(options, '--ignore-directory');
const ignoredDirectories = new Set(cliIgnored.length > 0 ? cliIgnored : DEFAULT_IGNORED_DIRECTORIES);
const violations = findTestLayoutViolations(await collectFiles(repositoryRoot, ignoredDirectories));

if (violations.length > 0) {
    console.error('Tests must use the <module>/__tests__/*.test.ts layout:');
    for (const violation of violations) {
        console.error(`- ${violation}`);
    }
    process.exitCode = 1;
}
