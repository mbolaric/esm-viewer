import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ChartLegend from '../charts/ChartLegend.svelte';

afterEach(() => {
    cleanup();
});

describe('ChartLegend', () => {
    it('lists each item with a hidden swatch in its colour and pattern', () => {
        render(ChartLegend, {
            props: {
                ariaLabel: 'Activity key',
                items: [
                    { colorToken: '--color-activity-driving', id: 'driving', label: 'Driving' },
                    { colorToken: '--color-activity-work', id: 'work', label: 'Work', pattern: 'diagonal' },
                ],
            },
        });

        const legend = screen.getByRole('list', { name: 'Activity key' });
        const items = within(legend).getAllByRole('listitem');
        expect(items.map((item) => item.textContent.trim())).toEqual(['Driving', 'Work']);

        const swatches = legend.querySelectorAll('.legend-swatch');
        expect(swatches[0]?.getAttribute('aria-hidden')).toBe('true');
        expect(swatches[0]?.getAttribute('data-pattern')).toBe('solid');
        expect(swatches[1]?.getAttribute('data-pattern')).toBe('diagonal');
    });

    it('shows an icon entry for a marker drawn as an icon, beside the colour swatches', () => {
        render(ChartLegend, {
            props: {
                ariaLabel: 'Calendar key',
                items: [
                    { colorToken: '--color-activity-driving', id: 'driving', label: 'Driving' },
                    { icon: 'users', id: 'crew', label: 'Crew driving recorded' },
                ],
            },
        });

        const legend = screen.getByRole('list', { name: 'Calendar key' });
        const [swatchItem, iconItem] = within(legend).getAllByRole('listitem');
        expect(iconItem?.textContent.trim()).toBe('Crew driving recorded');
        expect(iconItem?.querySelector('.legend-icon')?.getAttribute('aria-hidden')).toBe('true');
        expect(iconItem?.querySelector('.legend-swatch')).toBeNull();
        expect(swatchItem?.querySelector('.legend-icon')).toBeNull();
    });
});
