import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { parseCliOptions, readOptionValues } from '../cli/options.ts';
import { findCssDesignValues } from './design-values.ts';

async function collectCssFiles(directory: string): Promise<readonly string[]> {
    const entries = await readdir(directory, {
        withFileTypes: true,
    });
    const files: string[] = [];

    for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await collectCssFiles(entryPath)));
        } else if (entry.isFile() && entry.name.endsWith('.css')) {
            files.push(entryPath);
        }
    }

    return files.sort();
}

async function findViolations(sourceRoots: readonly string[], allowedFiles: ReadonlySet<string>): Promise<readonly string[]> {
    const violations: string[] = [];

    for (const sourceRoot of sourceRoots) {
        for (const filePath of await collectCssFiles(sourceRoot)) {
            if (allowedFiles.has(filePath)) {
                continue;
            }

            const source = await readFile(filePath, 'utf8');
            for (const issue of findCssDesignValues(source)) {
                const relativePath = path.relative(process.cwd(), filePath);
                violations.push(`${relativePath}: ${issue.value}`);
            }
        }
    }

    return violations;
}

const DEFAULT_SOURCE_ROOTS = ['src'];
const DEFAULT_ALLOWED_FILES = ['src/ui/styles/tokens.css'];

const options = parseCliOptions(process.argv.slice(2));
const cliSources = readOptionValues(options, '--source');
const sourceRoots = (cliSources.length > 0 ? cliSources : DEFAULT_SOURCE_ROOTS).map((sourceRoot) => path.resolve(sourceRoot));

const cliAllowed = readOptionValues(options, '--allow');
const allowedFiles = new Set(
    (cliAllowed.length > 0 ? cliAllowed : DEFAULT_ALLOWED_FILES).map((filePath) => path.resolve(filePath)),
);
const violations = await findViolations(sourceRoots, allowedFiles);
if (violations.length > 0) {
    throw new Error(
        [
            'Hardcoded CSS design values must be moved to an allowed design-token file:',
            ...violations.map((violation) => `- ${violation}`),
        ].join('\n'),
    );
}
