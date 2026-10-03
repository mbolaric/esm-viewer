import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ToastContainer from '../ToastContainer.svelte';
import type { IToastItem } from '../toast-types.js';

afterEach(() => {
    cleanup();
});

describe('ToastContainer Component', () => {
    it('renders nothing when toasts array is empty', () => {
        const ondismiss = vi.fn();
        const { container } = render(ToastContainer, {
            props: {
                ondismiss,
                toasts: [],
            },
        });

        expect(container.querySelector('.toast-container')).toBeNull();
    });

    it('renders all active toasts within container', () => {
        const ondismiss = vi.fn();
        const toasts: readonly IToastItem[] = [
            {
                createdAt: Date.now(),
                dismissible: true,
                durationMs: 4000,
                id: 't-1',
                message: 'First notification',
                variant: 'info',
            },
            {
                createdAt: Date.now(),
                dismissible: true,
                durationMs: 4000,
                id: 't-2',
                message: 'Second notification',
                variant: 'success',
            },
        ];

        render(ToastContainer, {
            props: {
                ondismiss,
                toasts,
            },
        });

        expect(screen.getByText('First notification')).toBeDefined();
        expect(screen.getByText('Second notification')).toBeDefined();
    });
});
