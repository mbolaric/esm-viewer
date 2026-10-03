import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import InlineNotice from '../controls/InlineNotice.svelte';

afterEach(() => {
    cleanup();
});

describe('InlineNotice', () => {
    it('renders the label and announces it with the default status role', () => {
        render(InlineNotice, {
            props: {
                actions: [{ label: 'Show all records', onclick: vi.fn() }],
                label: 'Showing records for 27 Jun 2026',
            },
        });

        const notice = screen.getByRole('status');
        expect(notice.textContent).toContain('Showing records for 27 Jun 2026');
    });

    it('emits the action callback from its button', async () => {
        const onclick = vi.fn();
        render(InlineNotice, {
            props: {
                actions: [{ label: 'Show all records', onclick }],
                label: 'Showing records for 27 Jun 2026',
            },
        });

        await fireEvent.click(screen.getByRole('button', { name: 'Show all records' }));
        expect(onclick).toHaveBeenCalledTimes(1);
    });

    it('supports a leading icon, a note role, and multiple actions including an icon-only one', async () => {
        const onOpenGuide = vi.fn();
        const onDismiss = vi.fn();
        render(InlineNotice, {
            props: {
                actions: [
                    { label: 'Open User Guide', onclick: onOpenGuide },
                    {
                        ariaLabel: 'Dismiss',
                        icon: 'x',
                        iconOnly: true,
                        label: 'Dismiss',
                        onclick: onDismiss,
                    },
                ],
                label: 'First time here? Read the guide.',
                leadingIcon: 'circleHelp',
                role: 'note',
            },
        });

        const notice = screen.getByRole('note');
        expect(notice.textContent).toContain('First time here? Read the guide.');
        const label = screen.getByText('First time here? Read the guide.');
        expect(label.parentElement?.querySelector('svg')).not.toBeNull();

        await fireEvent.click(screen.getByRole('button', { name: 'Open User Guide' }));
        expect(onOpenGuide).toHaveBeenCalledTimes(1);

        await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });
});
