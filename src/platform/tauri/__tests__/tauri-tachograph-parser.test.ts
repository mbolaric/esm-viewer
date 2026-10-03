import { beforeEach, describe, expect, it, vi } from 'vitest';

import { classifyParseError, err } from '#contracts';

const { invokeMock } = vi.hoisted(() => ({
    invokeMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
    invoke: invokeMock,
}));

import { TauriTachographParser } from '../tauri-tachograph-parser.js';

describe('TauriTachographParser', () => {
    beforeEach(() => {
        invokeMock.mockReset();
    });

    it('sends the file as the raw request body rather than a JSON number array', async () => {
        invokeMock.mockResolvedValueOnce({ data: null, error: 'Parsing error', ok: false });
        const bytes = Uint8Array.from([1, 2, 3]);

        const result = await new TauriTachographParser().parse(bytes).completion;

        expect(invokeMock).toHaveBeenCalledWith('parse_ddd_memory', bytes);
        expect(result).toEqual(err(classifyParseError('parseFailed')));
    });

    it('treats a native answer of an unexpected shape as a failed parse', async () => {
        invokeMock.mockResolvedValueOnce('not a parse response');

        const result = await new TauriTachographParser().parse(Uint8Array.from([1])).completion;

        expect(result).toEqual(err(classifyParseError('parseFailed')));
    });
});
