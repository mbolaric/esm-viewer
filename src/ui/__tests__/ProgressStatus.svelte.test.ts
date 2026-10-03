import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ProgressStatus from '../layout/ProgressStatus.svelte';

afterEach(cleanup);

describe('ProgressStatus', () => {
    it('renders a labelled determinate progress bar with a visible count', () => {
        render(ProgressStatus, {
            props: { completed: 3, label: 'Re-evaluating', total: 12, valueLabel: '3 of 12' },
        });

        const bar = screen.getByRole('progressbar', { name: 'Re-evaluating' });
        expect(bar.getAttribute('max')).toBe('12');
        expect(bar.getAttribute('value')).toBe('3');
        expect(screen.getByText('3 of 12')).toBeTruthy();
    });

    it('announces only the label as a live status, not the changing count', () => {
        render(ProgressStatus, {
            props: { completed: 1, label: 'Re-evaluating', total: 2, valueLabel: '1 of 2' },
        });

        expect(screen.getByRole('status').textContent).toBe('Re-evaluating');
    });
});
