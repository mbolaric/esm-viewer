import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';

import DropFeedback from '../layout/DropFeedback.svelte';

describe('DropFeedback', () => {
    it('renders a live status region for drop feedback', () => {
        const children = createRawSnippet(() => ({
            render: () => '<span>Drop files here</span>',
        }));

        render(DropFeedback, {
            props: {
                children,
            },
        });

        const region = screen.getByRole('status');
        expect(region).toBeTruthy();
        expect(region.getAttribute('aria-atomic')).toBe('true');
        expect(region.getAttribute('aria-live')).toBe('polite');
    });
});
