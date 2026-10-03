import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Toast from '../Toast.svelte';
import type { IToastItem } from '../toast-types.js';

afterEach(() => {
    cleanup();
});

describe('Toast Component', () => {
    it('renders message, title, and handles dismiss', async () => {
        const ondismiss = vi.fn();
        const toast: IToastItem = {
            createdAt: Date.now(),
            dismissible: true,
            durationMs: 4000,
            id: 'toast-1',
            message: 'File exported successfully',
            title: 'Export Complete',
            variant: 'success',
        };

        render(Toast, {
            props: {
                ondismiss,
                toast,
            },
        });

        expect(screen.getByText('Export Complete')).toBeDefined();
        expect(screen.getByText('File exported successfully')).toBeDefined();

        const dismissBtn = screen.getByRole('button', { name: /dismiss notification/i });
        await fireEvent.click(dismissBtn);

        expect(ondismiss).toHaveBeenCalledWith('toast-1');
    });

    it('renders action button and triggers callback', async () => {
        const ondismiss = vi.fn();
        const onclickAction = vi.fn();
        const toast: IToastItem = {
            action: {
                label: 'View in folder',
                onclick: onclickAction,
            },
            createdAt: Date.now(),
            dismissible: true,
            durationMs: 4000,
            id: 'toast-2',
            message: 'New document saved',
            variant: 'info',
        };

        render(Toast, {
            props: {
                ondismiss,
                toast,
            },
        });

        const actionBtn = screen.getByRole('button', { name: 'View in folder' });
        await fireEvent.click(actionBtn);

        expect(onclickAction).toHaveBeenCalledOnce();
    });
});
