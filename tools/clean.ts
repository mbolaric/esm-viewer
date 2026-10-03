import { rm } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

import { parseCliOptions, readOptionalOption, readOptionValues } from './cli/options.ts';

const DEFAULT_DIRECTORIES = ['apps/viewer/dist', 'coverage'];

const options = parseCliOptions(process.argv.slice(2));
const repositoryRoot = resolve(readOptionalOption(options, '--root', '.'));
const cliDirectories = readOptionValues(options, '--directory');
const generatedDirectories = (cliDirectories.length > 0 ? cliDirectories : DEFAULT_DIRECTORIES).map((directory) =>
    resolve(repositoryRoot, directory),
);

for (const directory of generatedDirectories) {
    const relativePath = relative(repositoryRoot, directory);
    if (relativePath === '' || relativePath.startsWith('..') || isAbsolute(relativePath)) {
        throw new Error(`Refusing to clean path outside the configured root: ${directory}`);
    }
}

await Promise.all(
    generatedDirectories.map(async (directory): Promise<void> => {
        await rm(directory, { force: true, recursive: true });
    }),
);
