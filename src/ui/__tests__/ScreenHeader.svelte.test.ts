import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ScreenHeader from '../layout/ScreenHeader.svelte';

afterEach(() => {
    cleanup();
});

describe('ScreenHeader', () => {
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
