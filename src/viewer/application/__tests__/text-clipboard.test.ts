import { describe, expect, it, vi } from 'vitest';

import { writeTextToClipboard, type ITextClipboardPort } from '../index.js';

describe('writeTextToClipboard', () => {
    it('writes the exact requested evidence text', async () => {
        const writeText = vi.fn<ITextClipboardPort['writeText']>(() => Promise.resolve());

        await expect(writeTextToClipboard({ writeText }, '/identity/cardNumber')).resolves.toEqual({
            ok: true,
            value: null,
        });
        expect(writeText).toHaveBeenCalledWith('/identity/cardNumber');
    });

    it('contains unavailable or rejected clipboard writes', async () => {
        const clipboard: ITextClipboardPort = {
            writeText: () => Promise.reject(new Error('Clipboard unavailable')),
        };

        await expect(writeTextToClipboard(clipboard, 'private evidence')).resolves.toEqual({
            error: 'clipboardWriteFailed',
            ok: false,
        });
    });
});
