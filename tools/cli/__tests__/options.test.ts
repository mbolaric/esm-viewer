import { describe, expect, it } from 'vitest';

import { parseCliOptions, readOptionValues, readOptionalOption, readRequiredOption } from '../options.js';

describe('parseCliOptions', () => {
    it('collects repeatable project-supplied options', () => {
        const options = parseCliOptions(['--source', 'source-a', '--source', 'source-b', '--allow', 'tokens.css']);

        expect(readOptionValues(options, '--source')).toEqual(['source-a', 'source-b']);
        expect(readRequiredOption(options, '--allow')).toBe('tokens.css');
        expect(readOptionalOption(options, '--root', '.')).toBe('.');
    });

    it('rejects missing option values', () => {
        expect(() => parseCliOptions(['--source'])).toThrow('Option "--source" requires a value.');
    });

    it('rejects ambiguous required options', () => {
        const options = parseCliOptions(['--root', '.', '--root', 'other']);

        expect(() => readRequiredOption(options, '--root')).toThrow('Option "--root" must be provided exactly once.');
    });

    it('returns provided or default value for optional options', () => {
        const options = parseCliOptions(['--root', 'custom-root']);

        expect(readOptionalOption(options, '--root', '.')).toBe('custom-root');
        expect(readOptionalOption(options, '--other', 'fallback')).toBe('fallback');
    });
});
