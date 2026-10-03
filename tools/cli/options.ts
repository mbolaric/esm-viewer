export type CliOptions = ReadonlyMap<string, readonly string[]>;

export function parseCliOptions(arguments_: readonly string[]): CliOptions {
    const options = new Map<string, string[]>();

    for (let index = 0; index < arguments_.length; index += 2) {
        const name = arguments_[index];
        const value = arguments_[index + 1];

        if (name === undefined || !name.startsWith('--') || name.length === 2) {
            throw new Error(`Expected an option name at argument ${String(index + 1)}.`);
        }

        if (value === undefined || value.startsWith('--')) {
            throw new Error(`Option "${name}" requires a value.`);
        }

        const values = options.get(name) ?? [];
        values.push(value);
        options.set(name, values);
    }

    return options;
}

export function readOptionValues(options: CliOptions, name: string): readonly string[] {
    return options.get(name) ?? [];
}

export function readRequiredOption(options: CliOptions, name: string): string {
    const values = readOptionValues(options, name);
    if (values.length !== 1) {
        throw new Error(`Option "${name}" must be provided exactly once.`);
    }

    const value = values[0];
    if (value === undefined) {
        throw new Error(`Option "${name}" did not provide a value.`);
    }

    return value;
}

export function readOptionalOption(options: CliOptions, name: string, defaultValue: string): string {
    const values = readOptionValues(options, name);
    if (values.length === 0) {
        return defaultValue;
    }
    if (values.length > 1) {
        throw new Error(`Option "${name}" must not be provided more than once.`);
    }

    const value = values[0];
    if (value === undefined) {
        return defaultValue;
    }

    return value;
}
