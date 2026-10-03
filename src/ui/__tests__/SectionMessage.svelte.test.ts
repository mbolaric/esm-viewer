import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';

import SectionMessage from '../data-table/SectionMessage.svelte';

afterEach(() => {
    cleanup();
});

describe('SectionMessage', () => {
    it('associates the section with its heading and description', () => {
        render(SectionMessage, {
            props: {
                description: 'The exact records could not be presented.',
                heading: 'Records unavailable',
                headingId: 'records-unavailable-heading',
            },
        });

        const section = screen.getByRole('region', {
            name: 'Records unavailable',
        });
        expect(section.textContent).toContain('The exact records could not be presented.');
    });
});
