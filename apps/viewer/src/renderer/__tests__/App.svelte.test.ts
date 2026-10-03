import { createViewerTestRenderOptions } from '#testing';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App.svelte';

afterEach(cleanup);

describe('standalone Viewer application composition', () => {
    it('retains the original welcome layout and mounts global dialogs and notifications exactly once', async () => {
        const viewerContext = createViewerTestRenderOptions().wrapperProps.context;
        render(App, { props: { title: 'ESM Viewer', viewerContext } });
        expect(screen.getByRole('heading', { name: 'Open a tachograph file' })).toBeTruthy();
        expect(screen.queryByRole('navigation', { name: 'Application commands' })).toBeNull();
        viewerContext.toastController.success('App notification');
        await waitFor(() => {
            expect(screen.getAllByText('App notification')).toHaveLength(1);
        });
        await fireEvent.keyDown(window, { key: 'F1' });
        expect(screen.getAllByRole('dialog')).toHaveLength(1);
        await fireEvent.keyDown(window, { key: 'F1' });
        viewerContext.commandController.execute('application.preferences');
        await waitFor(() => {
            expect(screen.getAllByRole('dialog', { name: 'Preferences' })).toHaveLength(1);
        });
        await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
