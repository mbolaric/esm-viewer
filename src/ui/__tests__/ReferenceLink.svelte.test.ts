import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import ReferenceLink from '../controls/ReferenceLink.svelte';
import ReferenceLinkCell from '../controls/ReferenceLinkCell.svelte';

describe('ReferenceLink', () => {
    it('renders generation label and button and triggers onopen callback', async () => {
        const onopen = vi.fn();
        const { container } = render(ReferenceLink, {
            props: {
                generation: 'G1',
                onopen,
                openLabel: 'Open in Raw Data',
                path: '/faults/0',
            },
        });

        const wrapper = container.querySelector('.reference-link');
        expect(wrapper).toBeTruthy();
        expect(screen.getByText('G1').classList.contains('generation-label')).toBe(true);

        const button = screen.getByRole('button', { name: 'Open in Raw Data: /faults/0' });
        expect(button.classList.contains('icon-only')).toBe(true);
        // Line break allows floating tooltips to render label and path on two lines.
        expect(button.getAttribute('data-tooltip')).toBe('Open in Raw Data:\n/faults/0');

        await fireEvent.click(button);
        expect(onopen).toHaveBeenCalledOnce();
    });
});

describe('ReferenceLinkCell', () => {
    it('renders a td with compact-cell class and ReferenceLink', () => {
        const onopen = vi.fn();
        const { container } = render(ReferenceLinkCell, {
            props: {
                generation: 'G2',
                onopen,
                openLabel: 'Open in Raw Data',
                path: '/events/1',
            },
        });

        const td = container.querySelector('td');
        expect(td).toBeTruthy();
        expect(td?.classList.contains('compact-cell')).toBe(true);
        expect(screen.getByText('G2')).toBeTruthy();
    });
});
