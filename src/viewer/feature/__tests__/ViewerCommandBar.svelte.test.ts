import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ViewerCommandBar from '../components/shell/ViewerCommandBar.svelte';

afterEach(() => {
    cleanup();
});

const baseProps = {
    appName: 'ESM Viewer',
    ariaLabel: 'Application commands',
    exportDisabled: false,
    exportLabel: 'Export',
    onexport: vi.fn(),
    onopen: vi.fn(),
    openDisabled: false,
    openLabel: 'Open',
} as const;

describe('ViewerCommandBar', () => {
    it('shows the compact brand anchor before the Open and Export actions', () => {
        render(ViewerCommandBar, { props: baseProps });

        const brand = screen.getByText('ESM Viewer');
        expect(brand.textContent).toBe('ESM Viewer');
        expect(screen.getByRole('button', { name: 'Open' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Export' })).toBeTruthy();
    });

    it('keeps the brand decorative and labels the navigation region', () => {
        const { container } = render(ViewerCommandBar, { props: baseProps });

        const nav = screen.getByRole('navigation', { name: 'Application commands' });
        expect(nav).toBeTruthy();
        const brand = container.querySelector('.brand');
        expect(brand?.getAttribute('aria-hidden')).toBe('true');
        expect(container.querySelectorAll('.brand-mark img')).toHaveLength(1);
    });

    it('runs the registered command when a button is activated', async () => {
        render(ViewerCommandBar, { props: baseProps });

        await fireEvent.click(screen.getByRole('button', { name: 'Open' }));
        await fireEvent.click(screen.getByRole('button', { name: 'Export' }));

        expect(baseProps.onopen).toHaveBeenCalledOnce();
        expect(baseProps.onexport).toHaveBeenCalledOnce();
    });

    it('respects the disabled command state', () => {
        render(ViewerCommandBar, {
            props: {
                ...baseProps,
                exportDisabled: true,
                openDisabled: true,
            },
        });

        expect(screen.getByRole('button', { name: 'Open' }).hasAttribute('disabled')).toBe(true);
        expect(screen.getByRole('button', { name: 'Export' }).hasAttribute('disabled')).toBe(true);
    });

    it('carries accessible names and tooltips so icon-only actions stay usable', () => {
        const { container } = render(ViewerCommandBar, { props: baseProps });

        const buttons = Array.from(container.querySelectorAll('button.button'));
        expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(['Open', 'Export']);
        expect(buttons.map((button) => button.getAttribute('data-tooltip'))).toEqual(['Open', 'Export']);
        expect(buttons.every((button) => button.classList.contains('tooltip-below'))).toBe(true);
    });
});
