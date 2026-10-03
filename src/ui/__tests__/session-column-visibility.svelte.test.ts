import { describe, expect, it } from 'vitest';

import { SessionColumnVisibility } from '../data-table/session-column-visibility.svelte.js';

describe('SessionColumnVisibility', () => {
    it('starts with every column visible', () => {
        expect([...new SessionColumnVisibility().hiddenColumnIds]).toEqual([]);
    });

    it('hides a column on the first toggle and shows it again on the second', () => {
        const visibility = new SessionColumnVisibility();

        visibility.toggle('nation');
        expect(visibility.hiddenColumnIds.has('nation')).toBe(true);

        visibility.toggle('nation');
        expect(visibility.hiddenColumnIds.has('nation')).toBe(false);
    });

    it('tracks columns independently', () => {
        const visibility = new SessionColumnVisibility();

        visibility.toggle('nation');
        visibility.toggle('vin');
        visibility.toggle('nation');

        expect([...visibility.hiddenColumnIds]).toEqual(['vin']);
    });
});
