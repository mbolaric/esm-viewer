import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ColumnMenu from '../data-table/ColumnMenu.svelte';

afterEach(() => {
    cleanup();
});

const columns = [
    { id: 'id', label: 'ID' },
    { id: 'name', label: 'Name' },
    { id: 'value', label: 'Value' },
];

describe('ColumnMenu', () => {
    it('lists every column with its visibility state', async () => {
        render(ColumnMenu, {
            props: {
                columns,
                hiddenColumnIds: new Set(['value']),
                label: 'Columns',
                ontogglecolumn: vi.fn(),
            },
        });

        await fireEvent.click(screen.getByTitle('Columns'));
        const toggle = screen.getByRole('checkbox', { name: 'Value' });
        if (!(toggle instanceof HTMLInputElement)) {
            throw new TypeError('The column toggle must be an input element.');
        }
        expect(toggle.checked).toBe(false);
        expect(screen.getByRole('checkbox', { name: 'ID' })).toBeTruthy();
    });

    it('reports the toggled column id', async () => {
        const ontogglecolumn = vi.fn();
        render(ColumnMenu, {
            props: {
                columns,
                hiddenColumnIds: new Set(['value']),
                label: 'Columns',
                ontogglecolumn,
            },
        });

        await fireEvent.click(screen.getByTitle('Columns'));
        const toggle = screen.getByRole('checkbox', { name: 'Value' });
        await fireEvent.click(toggle);
        expect(ontogglecolumn).toHaveBeenCalledWith('value');
    });

    it('treats an absent hidden set as all visible', async () => {
        render(ColumnMenu, {
            props: {
                columns,
                label: 'Columns',
                ontogglecolumn: vi.fn(),
            },
        });

        // The menu content is only rendered while the disclosure is open.
        await fireEvent.click(screen.getByTitle('Columns'));
        const toggle = screen.getByRole('checkbox', { name: 'Value' });
        if (!(toggle instanceof HTMLInputElement)) {
            throw new TypeError('The column toggle must be an input element.');
        }
        expect(toggle.checked).toBe(true);
    });

    it('closes an open menu on an outside click or Escape', async () => {
        const closeActions: readonly (() => Promise<boolean>)[] = [
            () => fireEvent.pointerDown(document.body),
            () => fireEvent.keyDown(document.body, { key: 'Escape' }),
        ];

        for (const closeAction of closeActions) {
            const { container } = render(ColumnMenu, {
                props: {
                    columns,
                    label: 'Columns',
                    ontogglecolumn: vi.fn(),
                },
            });
            const details = container.querySelector('details');
            if (details === null) {
                throw new TypeError('The column menu must render a details element.');
            }

            await fireEvent.click(screen.getByTitle('Columns'));
            expect(details.open).toBe(true);

            await closeAction();
            expect(details.open).toBe(false);
            cleanup();
        }
    });
});
