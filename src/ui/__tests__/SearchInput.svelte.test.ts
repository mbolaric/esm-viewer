import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SearchInput from '../controls/SearchInput.svelte';

afterEach(() => {
    cleanup();
});

describe('SearchInput', () => {
    it('renders a labelled searchbox and reports input changes', async () => {
        const oninput = vi.fn();
        render(SearchInput, {
            props: {
                clearLabel: 'Clear filter',
                label: 'Filter records',
                oninput,
                value: '',
            },
        });

        const searchbox = screen.getByRole('searchbox', { name: 'Filter records' });
        await fireEvent.input(searchbox, { target: { value: 'alpha' } });
        expect(oninput).toHaveBeenCalledWith('alpha');
    });

    it('keeps the supplied value in the control', () => {
        render(SearchInput, {
            props: {
                clearLabel: 'Clear filter',
                label: 'Filter records',
                oninput: vi.fn(),
                value: 'beta',
            },
        });

        const searchbox = screen.getByRole('searchbox', { name: 'Filter records' });
        if (!(searchbox instanceof HTMLInputElement)) {
            throw new TypeError('The search control must be an input element.');
        }
        expect(searchbox.value).toBe('beta');
    });

    it('does not render a clear button while the field is empty', () => {
        render(SearchInput, {
            props: {
                clearLabel: 'Clear filter',
                label: 'Filter records',
                oninput: vi.fn(),
                value: '',
            },
        });

        expect(screen.queryByRole('button', { name: 'Clear filter' })).toBeNull();
    });

    it('clears the value and keeps focus in the field when the clear button is activated', async () => {
        const oninput = vi.fn();
        render(SearchInput, {
            props: {
                clearLabel: 'Clear filter',
                label: 'Filter records',
                oninput,
                value: 'alpha',
            },
        });

        const clearButton = screen.getByRole('button', { name: 'Clear filter' });
        await fireEvent.click(clearButton);

        expect(oninput).toHaveBeenCalledWith('');
        expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Filter records' }));
    });

    it('clears the value when Escape is pressed', async () => {
        const oninput = vi.fn();
        render(SearchInput, {
            props: {
                clearLabel: 'Clear filter',
                label: 'Filter records',
                oninput,
                value: 'alpha',
            },
        });

        await fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Filter records' }), {
            key: 'Escape',
        });

        expect(oninput).toHaveBeenCalledWith('');
    });
});
