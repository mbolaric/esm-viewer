import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const button = readFileSync(new URL('../controls/Button.svelte', import.meta.url), 'utf8');

describe('control layout', () => {
    it('centers button labels independently of the font baseline', () => {
        expect(button).toMatch(
            /\.button \.label \{[\s\S]*?display: var\(--display-button-label, inline-flex\);[\s\S]*?align-items: center;[\s\S]*?block-size: var\(--size-full\);[\s\S]*?line-height: var\(--line-height-tight\);/,
        );
    });
});
