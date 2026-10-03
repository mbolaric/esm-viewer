import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Tabs from '../controls/Tabs.svelte';

afterEach(() => {
    cleanup();
});

const items = [
    { id: 'first', label: 'First view' },
    { id: 'second', label: 'Second view' },
];

const panel = createRawSnippet<[string]>((id) => ({
    render: () => `<p>Panel content for ${id()}</p>`,
}));

describe('Tabs', () => {
    it('renders the tabs pattern and shows only the selected panel', async () => {
        const onselect = vi.fn();
        const rendered = render(Tabs, {
            props: {
                items,
                label: 'Example views',
                onselect,
                panel,
                selectedId: 'first',
            },
        });

        expect(screen.getByRole('tablist', { name: 'Example views' })).toBeTruthy();
        const firstTab = screen.getByRole('tab', { name: 'First view' });
        const secondTab = screen.getByRole('tab', { name: 'Second view' });
        expect(firstTab.getAttribute('aria-selected')).toBe('true');
        expect(secondTab.getAttribute('aria-selected')).toBe('false');
        expect(firstTab.getAttribute('tabindex')).toBe('0');
        expect(secondTab.getAttribute('tabindex')).toBe('-1');

        const panelElement = screen.getByRole('tabpanel');
        expect(panelElement.getAttribute('aria-labelledby')).toBe(firstTab.id);
        expect(firstTab.getAttribute('aria-controls')).toBe(panelElement.id);
        expect(screen.getByText('Panel content for first')).toBeTruthy();
        expect(screen.queryByText('Panel content for second')).toBeNull();

        await fireEvent.click(secondTab);
        expect(onselect).toHaveBeenCalledWith('second');

        await rendered.rerender({ selectedId: 'second' });
        expect(secondTab.getAttribute('aria-selected')).toBe('true');
        expect(screen.getByText('Panel content for second')).toBeTruthy();
        expect(screen.queryByText('Panel content for first')).toBeNull();
    });

    it('moves focus and selection with arrow, home, and end keys', async () => {
        const onselect = vi.fn();
        const rendered = render(Tabs, {
            props: {
                items,
                label: 'Example views',
                onselect,
                panel,
                selectedId: 'first',
            },
        });

        const tablist = screen.getByRole('tablist', { name: 'Example views' });
        expect(tablist).toBeTruthy();
        const firstTab = screen.getByRole('tab', { name: 'First view' });
        const secondTab = screen.getByRole('tab', { name: 'Second view' });

        firstTab.focus();
        await fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
        expect(document.activeElement).toBe(secondTab);
        expect(onselect).toHaveBeenNthCalledWith(1, 'second');

        await rendered.rerender({ selectedId: 'second' });
        await fireEvent.keyDown(secondTab, { key: 'ArrowRight' });
        expect(document.activeElement).toBe(firstTab);
        expect(onselect).toHaveBeenNthCalledWith(2, 'first');

        await rendered.rerender({ selectedId: 'first' });
        await fireEvent.keyDown(firstTab, { key: 'End' });
        expect(document.activeElement).toBe(secondTab);
        expect(onselect).toHaveBeenNthCalledWith(3, 'second');

        await rendered.rerender({ selectedId: 'second' });
        await fireEvent.keyDown(secondTab, { key: 'Home' });
        expect(document.activeElement).toBe(firstTab);
        expect(onselect).toHaveBeenNthCalledWith(4, 'first');
    });
});
