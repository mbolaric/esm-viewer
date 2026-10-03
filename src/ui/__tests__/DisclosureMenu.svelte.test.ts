import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DisclosureMenu from '../controls/DisclosureMenu.svelte';

afterEach(() => {
    cleanup();
});

const children = createRawSnippet(() => ({
    render: () => '<button type="button">Menu action</button>',
}));

function menuDetails(): HTMLDetailsElement {
    const details = screen.getByTitle('Open menu').closest('details');
    if (!(details instanceof HTMLDetailsElement)) {
        throw new TypeError('The disclosure menu must render a details element.');
    }
    return details;
}

describe('DisclosureMenu', () => {
    it('labels the trigger and the menu group', () => {
        render(DisclosureMenu, {
            props: { children, icon: 'columns', menuLabel: 'Menu options', triggerLabel: 'Open menu' },
        });

        expect(screen.getByLabelText('Open menu').tagName).toBe('SUMMARY');
        expect(screen.getByRole('group', { name: 'Menu options' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Menu action' })).toBeTruthy();
    });

    it('uses a separate trigger title when one is given', () => {
        render(DisclosureMenu, {
            props: {
                children,
                icon: 'columns',
                menuLabel: 'Menu options',
                triggerLabel: 'Resize',
                triggerTitle: 'Open menu',
            },
        });

        expect(screen.getByLabelText('Resize').getAttribute('title')).toBe('Open menu');
    });

    it('closes on Escape and on a pointer press outside the menu', async () => {
        render(DisclosureMenu, {
            props: { children, icon: 'columns', menuLabel: 'Menu options', triggerLabel: 'Open menu' },
        });
        const details = menuDetails();

        details.open = true;
        await fireEvent.keyDown(window, { key: 'Escape' });
        expect(details.open).toBe(false);

        details.open = true;
        await fireEvent.pointerDown(screen.getByRole('button', { name: 'Menu action' }));
        expect(details.open).toBe(true);
        await fireEvent.pointerDown(document.body);
        expect(details.open).toBe(false);
    });

    it('forwards trigger key presses to the caller', async () => {
        const ontriggerkeydown = vi.fn();
        render(DisclosureMenu, {
            props: { children, icon: 'columns', menuLabel: 'Menu options', ontriggerkeydown, triggerLabel: 'Open menu' },
        });

        await fireEvent.keyDown(screen.getByTitle('Open menu'), { key: 'ArrowLeft' });

        expect(ontriggerkeydown).toHaveBeenCalledWith(expect.objectContaining({ key: 'ArrowLeft' }));
    });
});
