import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import TaskState from '../layout/TaskState.svelte';

describe('TaskState', () => {
    it('renders a labelled task and moves focus when requested', () => {
        render(TaskState, {
            props: {
                description: 'The task is ready.',
                focusOnMount: true,
                live: 'polite',
                title: 'Ready task',
            },
        });

        const heading = screen.getByRole('heading', { name: 'Ready task' });
        expect(screen.getByText('The task is ready.')).toBeTruthy();
        expect(document.activeElement).toBe(heading);
    });

    it('renders an assertive live region when requested', () => {
        const { container } = render(TaskState, {
            props: {
                live: 'assertive',
                title: 'Error task',
            },
        });

        const section = container.querySelector('section');
        expect(section?.getAttribute('aria-live')).toBe('assertive');
    });
});
