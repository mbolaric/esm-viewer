import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';

import KpiCard from '../layout/KpiCard.svelte';

afterEach(() => {
    cleanup();
});

describe('KpiCard', () => {
    it('renders a plain label and value without an icon header or subtext', () => {
        render(KpiCard, {
            props: {
                label: 'Active days',
                value: 42,
            },
        });

        expect(screen.getByText('Active days')).toBeTruthy();
        expect(screen.getByText('42')).toBeTruthy();
    });

    it('renders a subtext line when provided', () => {
        render(KpiCard, {
            props: {
                label: 'Warnings',
                subtext: 'No normalization warnings were reported.',
                value: 0,
            },
        });

        expect(screen.getByText('No normalization warnings were reported.')).toBeTruthy();
    });

    it('renders a header row with an icon when one is provided', () => {
        const { container } = render(KpiCard, {
            props: {
                icon: 'triangleAlert',
                label: 'Overdue',
                tone: 'danger',
                toneStyle: 'both',
                value: 3,
            },
        });

        expect(container.querySelector('.kpi-header')).toBeTruthy();
        expect(container.querySelector('svg')).toBeTruthy();
    });

    it('exposes the compact size variant for dense operational summaries', () => {
        const { container } = render(KpiCard, {
            props: {
                label: 'Overdue',
                size: 'compact',
                value: 3,
            },
        });

        expect(container.querySelector('.kpi-card')?.getAttribute('data-size')).toBe('compact');
    });

    it('exposes the tone and toneStyle as data attributes for CSS to key off', () => {
        const { container } = render(KpiCard, {
            props: {
                label: 'Total infringements',
                tone: 'warning',
                value: 5,
            },
        });

        const card = container.querySelector('.kpi-card');
        expect(card?.getAttribute('data-size')).toBe('default');
        expect(card?.getAttribute('data-tone')).toBe('warning');
        expect(card?.getAttribute('data-tone-style')).toBe('text');
    });
});
