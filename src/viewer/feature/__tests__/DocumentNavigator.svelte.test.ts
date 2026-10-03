import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DocumentNavigator from '../components/shell/DocumentNavigator.svelte';
import { createViewerTestRenderOptions } from './viewer-test-render.js';

afterEach(() => {
    cleanup();
});

function renderNavigator(onselect: (section: string) => void): void {
    render(
        DocumentNavigator,
        {
            props: {
                availableSections: ['overview', 'activities', 'speed'],
                disabled: false,
                documentKind: 'driverCard',
                onselect,
                selectedSection: 'overview',
            },
        },
        createViewerTestRenderOptions(),
    );
}

describe('DocumentNavigator', () => {
    it('renders available navigation sections', () => {
        render(
            DocumentNavigator,
            {
                props: {
                    availableSections: ['overview', 'activities', 'speed', 'rawData'],
                    disabled: false,
                    documentKind: 'driverCard',
                    onselect: vi.fn(),
                    selectedSection: 'overview',
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByRole('button', { name: 'Overview' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Activities' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Speed' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Raw data' })).toBeTruthy();
    });

    it('triggers pending and onselect when a new section is selected', async () => {
        const onselect = vi.fn();
        renderNavigator(onselect);

        const activitiesButton = screen.getByRole('button', { name: 'Activities' });
        await fireEvent.click(activitiesButton);

        expect(activitiesButton.getAttribute('aria-busy')).toBe('true');
        expect(activitiesButton.classList.contains('is-loading')).toBe(true);

        await new Promise((resolve) => setTimeout(resolve, 150));
        expect(onselect).toHaveBeenCalledWith('activities');
    });

    it('does not disable other buttons while a section is pending', async () => {
        const onselect = vi.fn();
        renderNavigator(onselect);

        const activitiesButton = screen.getByRole('button', { name: 'Activities' });
        const speedButton = screen.getByRole('button', { name: 'Speed' });
        await fireEvent.click(activitiesButton);

        // Unselected buttons remain enabled during pending transition.
        expect(speedButton.hasAttribute('disabled')).toBe(false);

        await new Promise((resolve) => setTimeout(resolve, 150));
        expect(onselect).toHaveBeenCalledTimes(1);
        expect(onselect).toHaveBeenCalledWith('activities');
    });

    it('lets a click on a different section while one is pending redirect the transition (last click wins)', async () => {
        const onselect = vi.fn();
        renderNavigator(onselect);

        const activitiesButton = screen.getByRole('button', { name: 'Activities' });
        const speedButton = screen.getByRole('button', { name: 'Speed' });
        await fireEvent.click(activitiesButton);
        await fireEvent.click(speedButton);

        // Second click overrides pending target.
        expect(activitiesButton.getAttribute('aria-busy')).toBeNull();
        expect(speedButton.getAttribute('aria-busy')).toBe('true');

        await new Promise((resolve) => setTimeout(resolve, 150));
        // Only one transition callback fires, carrying the latest target.
        expect(onselect).toHaveBeenCalledTimes(1);
        expect(onselect).toHaveBeenCalledWith('speed');
    });
});
