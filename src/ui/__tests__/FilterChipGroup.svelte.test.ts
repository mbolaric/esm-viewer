import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import FilterChipGroup from '../controls/FilterChipGroup.svelte';

afterEach(() => {
    cleanup();
});

describe('FilterChipGroup', () => {
    const options = [
        { count: 3, label: 'All', value: 'all' },
        { count: '2', label: 'Events', value: 'event' },
        { label: 'Faults', value: 'fault' },
    ] as const;

    it('labels a group of chips, adds counts, and presses the selected one', () => {
        render(FilterChipGroup, { props: { ariaLabel: 'Record type', onchange: vi.fn(), options, value: 'event' } });

        expect(screen.getByRole('group', { name: 'Record type' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'All (3)' }).getAttribute('aria-pressed')).toBe('false');
        expect(screen.getByRole('button', { name: 'Events (2)' }).getAttribute('aria-pressed')).toBe('true');
        expect(screen.getByRole('button', { name: 'Faults' })).toBeTruthy();
    });

    it('reports the chosen value and presses nothing while no value is known', async () => {
        const onchange = vi.fn();
        render(FilterChipGroup, { props: { ariaLabel: 'Record type', onchange, options, value: undefined } });

        expect(screen.getAllByRole('button').every((chip) => chip.getAttribute('aria-pressed') === 'false')).toBe(true);
        await fireEvent.click(screen.getByRole('button', { name: 'Faults' }));
        expect(onchange).toHaveBeenCalledWith('fault');
    });
});
