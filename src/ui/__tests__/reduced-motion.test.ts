import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

function readComponent(relativePath: string): string {
    return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('reduced-motion fallbacks', () => {
    it('keeps drop feedback visible without its repeating pulse', () => {
        const source = readComponent('../layout/DropFeedback.svelte');

        expect(source).toMatch(
            /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.drop-feedback \{[\s\S]*?animation: none;[\s\S]*?box-shadow: var\(--shadow-drop-pulse-soft\);/,
        );
    });

    it('keeps the navigator loading indicator static', () => {
        const source = readComponent('../layout/Navigator.svelte');

        expect(source).toMatch(
            /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?:global\(\.navigator-spin\) \{[\s\S]*?animation: none;/,
        );
    });
});
