import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ConfirmDialog from '../controls/ConfirmDialog.svelte';

afterEach(() => {
    cleanup();
});

describe('ConfirmDialog', () => {
    it('renders the title and message', () => {
        render(ConfirmDialog, {
            props: {
                cancelLabel: 'Keep entry',
                confirmLabel: 'Remove entry',
                message: 'Remove synthetic.ddd from the comparison?',
                oncancel: vi.fn(),
                onconfirm: vi.fn(),
                title: 'Remove comparison entry',
                titleId: 'confirm-remove-title',
            },
        });

        expect(screen.getByRole('heading', { name: 'Remove comparison entry' })).toBeTruthy();
        expect(screen.getByText('Remove synthetic.ddd from the comparison?')).toBeTruthy();
    });

    it('invokes oncancel from the secondary button', async () => {
        const oncancel = vi.fn();
        render(ConfirmDialog, {
            props: {
                cancelLabel: 'Keep entry',
                confirmLabel: 'Remove entry',
                message: 'Remove synthetic.ddd from the comparison?',
                oncancel,
                onconfirm: vi.fn(),
                title: 'Remove comparison entry',
                titleId: 'confirm-remove-title',
            },
        });

        await fireEvent.click(screen.getByRole('button', { name: 'Keep entry' }));
        expect(oncancel).toHaveBeenCalledTimes(1);
    });

    it('invokes onconfirm from the primary button', async () => {
        const onconfirm = vi.fn();
        render(ConfirmDialog, {
            props: {
                cancelLabel: 'Keep entry',
                confirmLabel: 'Remove entry',
                message: 'Remove synthetic.ddd from the comparison?',
                oncancel: vi.fn(),
                onconfirm,
                title: 'Remove comparison entry',
                titleId: 'confirm-remove-title',
            },
        });

        await fireEvent.click(screen.getByRole('button', { name: 'Remove entry' }));
        expect(onconfirm).toHaveBeenCalledTimes(1);
    });
});
