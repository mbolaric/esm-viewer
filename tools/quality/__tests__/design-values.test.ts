import { describe, expect, it } from 'vitest';

import { findCssDesignValues, findSvelteDesignValues } from '../design-values.js';

describe('findCssDesignValues', () => {
    it('accepts semantic keywords and central token references', () => {
        expect(
            findCssDesignValues(`
                .panel {
                    display: grid;
                    margin: var(--space-none);
                    color: var(--color-text);
                }
            `),
        ).toEqual([]);
    });

    it('rejects numeric and color literals including zero', () => {
        expect(
            findCssDesignValues(`
                .panel {
                    margin: 0;
                    color: #ffffff;
                }
            `).map((issue) => issue.value),
        ).toEqual(['margin: 0', 'color: #ffffff']);
    });
});

describe('findSvelteDesignValues', () => {
    it('accepts tokenized component CSS and variable data geometry', () => {
        expect(
            findSvelteDesignValues(`
                <div style:width={width}></div>
                <style>
                    div {
                        gap: var(--space-stack);
                    }
                </style>
            `),
        ).toEqual([]);
    });

    it('rejects literals in style blocks, attributes, and directives', () => {
        expect(
            findSvelteDesignValues(`
                <div
                    style="padding: 12px"
                    style={'color: red'}
                    style:color={'blue'}
                    style:width={24}
                ></div>
                <style>
                    div {
                        border-radius: 4px;
                    }
                </style>
            `).map((issue) => issue.value),
        ).toEqual(['border-radius: 4px', 'padding: 12px', 'color: red', "style:color={'blue'}", 'style:width={24}']);
    });
});
