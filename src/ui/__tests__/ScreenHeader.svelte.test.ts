import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ScreenHeader from '../layout/ScreenHeader.svelte';

afterEach(() => {
    cleanup();
});

describe('ScreenHeader', () => {
    it('places an optional return action before the focused view heading', async () => {
        const back = vi.fn();
        render(ScreenHeader, {
            props: { heading: 'Source evidence', backAction: { label: 'Return to Activities', onclick: back } },
        });
        const action = screen.getByRole('button', { name: 'Return to Activities' });
        const heading = screen.getByRole('heading', { level: 1, name: 'Source evidence' });
        expect(action.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
        expect(document.activeElement).toBe(heading);
        await fireEvent.click(action);
        expect(back).toHaveBeenCalledOnce();
    });

    it('renders and focuses the screen heading', () => {
        render(ScreenHeader, {
            props: {
                heading: 'Recorded activities',
            },
        });

        const heading = screen.getByRole('heading', {
            level: 1,
            name: 'Recorded activities',
        });
        expect(document.activeElement).toBe(heading);
    });

    it('renders optional supporting description without changing the heading contract', () => {
        render(ScreenHeader, {
            props: {
                description: 'Supporting evidence description',
                heading: 'Recorded activities',
            },
        });

        expect(screen.getByText('Supporting evidence description')).toBeTruthy();
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Recorded activities',
            }),
        ).toBe(document.activeElement);
    });
});
