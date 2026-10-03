import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import Button from '../controls/Button.svelte';

describe('Button', () => {
    it('exposes its visible label and typed activation callback', async () => {
        const onclick = vi.fn<() => void>();
        render(Button, {
            props: {
                label: 'Open file',
                onclick,
                variant: 'primary',
            },
        });

        await fireEvent.click(screen.getByRole('button', { name: 'Open file' }));

        expect(onclick).toHaveBeenCalledOnce();
    });

    it('supports a more specific accessible label when repeated visible actions need context', () => {
        render(Button, {
            props: {
                ariaLabel: 'Open source record: /identity',
                label: 'Open source record',
                onclick: () => undefined,
            },
        });

        expect(
            screen.getByRole('button', {
                name: 'Open source record: /identity',
            }),
        ).toBeTruthy();
    });

    it('keeps a decorative registered icon out of the accessible name', () => {
        const rendered = render(Button, {
            props: {
                icon: 'folderOpen',
                label: 'Open file',
                onclick: () => undefined,
            },
        });

        expect(within(rendered.container).getByRole('button', { name: 'Open file' })).toBeTruthy();
        expect(rendered.container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('exposes toggle state when the owning workflow uses the button for selection', () => {
        render(Button, {
            props: {
                label: 'Driving',
                onclick: () => undefined,
                pressed: true,
            },
        });

        expect(screen.getByRole('button', { name: 'Driving', pressed: true })).toBeTruthy();
    });

    it('applies the compact size for dense in-table actions', () => {
        render(Button, {
            props: {
                icon: 'triangleAlert',
                label: 'Show day',
                onclick: () => undefined,
                size: 'compact',
            },
        });

        const button = screen.getByRole('button', { name: 'Show day' });
        expect(button.classList.contains('compact')).toBe(true);
        expect(screen.getByText('Show day').classList.contains('label')).toBe(true);
    });

    it('exposes an optional tooltip for dense evidence actions', () => {
        render(Button, {
            props: {
                ariaLabel: 'Open in Raw Data: /identity',
                label: 'Open in Raw Data',
                onclick: () => undefined,
                tooltip: '/identity',
            },
        });

        expect(screen.getByRole('button', { name: 'Open in Raw Data: /identity' }).getAttribute('data-tooltip')).toBe(
            '/identity',
        );
    });

    it('applies tooltip alignment classes when requested', () => {
        render(Button, {
            props: {
                ariaLabel: 'Aligned button',
                label: 'Aligned button',
                onclick: () => undefined,
                tooltip: 'Aligned tooltip',
                tooltipAlign: 'end',
            },
        });

        expect(screen.getByRole('button', { name: 'Aligned button' }).classList.contains('tooltip-end')).toBe(true);
    });

    it('applies tooltip position class when below is requested', () => {
        render(Button, {
            props: {
                ariaLabel: 'Below button',
                label: 'Below button',
                onclick: () => undefined,
                tooltip: 'Below tooltip',
                tooltipPosition: 'below',
            },
        });

        expect(screen.getByRole('button', { name: 'Below button' }).classList.contains('tooltip-below')).toBe(true);
    });

    it('positions floating tooltip below button when tooltipPosition is below', async () => {
        render(Button, {
            props: {
                ariaLabel: 'Floating below',
                label: 'Floating below',
                onclick: () => undefined,
                tooltip: 'Floating tooltip',
                tooltipFloating: true,
                tooltipPosition: 'below',
            },
        });

        const button = screen.getByRole('button', { name: 'Floating below' });
        await fireEvent.mouseEnter(button);

        expect(button.style.getPropertyValue('--tooltip-fixed-top')).toBe('4px');
        expect(button.style.getPropertyValue('--tooltip-fixed-bottom')).toBe('');
    });

    it('positions floating tooltip above button by default', async () => {
        render(Button, {
            props: {
                ariaLabel: 'Floating above',
                label: 'Floating above',
                onclick: () => undefined,
                tooltip: 'Floating tooltip',
                tooltipFloating: true,
            },
        });

        const button = screen.getByRole('button', { name: 'Floating above' });
        await fireEvent.focus(button);

        expect(button.style.getPropertyValue('--tooltip-fixed-bottom')).toBe(`${String(globalThis.innerHeight + 4)}px`);
        expect(button.style.getPropertyValue('--tooltip-fixed-top')).toBe('');
    });
});
