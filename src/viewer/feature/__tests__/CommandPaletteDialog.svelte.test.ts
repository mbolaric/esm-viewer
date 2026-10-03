import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import CommandPaletteDialog from '../components/dialogs/CommandPaletteDialog.svelte';
import { createViewerTestRenderOptions } from './viewer-test-render.js';

afterEach(() => {
    cleanup();
});

describe('CommandPaletteDialog', () => {
    it('renders global command palette dialog and triggers section selection', async () => {
        const onclose = vi.fn();
        const onselectsection = vi.fn();

        render(
            CommandPaletteDialog,
            {
                props: {
                    availableSections: ['overview', 'speed', 'compliance'],
                    isOpen: true,
                    onclose,
                    onselectsection,
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByRole('dialog', { name: 'Global Command Palette' })).toBeTruthy();
        expect(screen.getByPlaceholderText(/Search commands or jump to section/i)).toBeTruthy();

        const speedButton = screen.getByRole('button', { name: /Speed/i });
        expect(speedButton).toBeTruthy();

        await fireEvent.click(speedButton);
        expect(onselectsection).toHaveBeenCalledWith('speed');
        expect(onclose).toHaveBeenCalledOnce();
    });

    it('filters items dynamically based on search query', async () => {
        const onclose = vi.fn();
        const onselectsection = vi.fn();

        render(
            CommandPaletteDialog,
            {
                props: {
                    availableSections: ['overview', 'speed', 'compliance'],
                    isOpen: true,
                    onclose,
                    onselectsection,
                },
            },
            createViewerTestRenderOptions(),
        );

        const input = screen.getByPlaceholderText(/Search commands or jump to section/i);
        await fireEvent.input(input, { target: { value: 'Compliance' } });

        expect(screen.getByRole('button', { name: /Compliance/i })).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Speed Analysis/i })).toBeNull();
    });

    it('matches the search query regardless of diacritics', async () => {
        render(
            CommandPaletteDialog,
            {
                props: {
                    availableSections: ['overview', 'speed', 'compliance'],
                    isOpen: true,
                    onclose: vi.fn(),
                    onselectsection: vi.fn(),
                },
            },
            createViewerTestRenderOptions(),
        );

        const input = screen.getByPlaceholderText(/Search commands or jump to section/i);
        await fireEvent.input(input, { target: { value: 'cömpliance' } });

        expect(screen.getByRole('button', { name: /Compliance/i })).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Speed Analysis/i })).toBeNull();
    });

    it('omits section jumps and document commands when no file is open', () => {
        render(
            CommandPaletteDialog,
            {
                props: {
                    availableSections: [],
                    isOpen: true,
                    onclose: vi.fn(),
                    onselectsection: vi.fn(),
                },
            },
            createViewerTestRenderOptions(),
        );

        const listbox = screen.getByRole('listbox');
        expect(within(listbox).getByRole('button', { name: /Open/i })).toBeTruthy();
        expect(within(listbox).queryByRole('button', { name: /Close/i })).toBeNull();
        expect(within(listbox).queryByRole('button', { name: /Export/i })).toBeNull();
        expect(within(listbox).queryByRole('button', { name: /Overview/i })).toBeNull();
    });

    it('renders and activates application-composed destinations', async () => {
        const onclose = vi.fn();
        const onselect = vi.fn();

        render(
            CommandPaletteDialog,
            {
                props: {
                    availableSections: [],
                    isOpen: true,
                    onclose,
                    onselectsection: vi.fn(),
                    paletteDestinations: [
                        {
                            icon: 'layers',
                            id: 'desktop-dashboard',
                            label: 'Dashboard',
                            onselect: vi.fn(),
                        },
                        {
                            icon: 'triangleAlert',
                            id: 'desktop-alerts',
                            label: 'Deadlines',
                            onselect,
                        },
                        {
                            icon: 'folderOpen',
                            id: 'desktop-documents',
                            label: 'All documents',
                            onselect: vi.fn(),
                        },
                        {
                            icon: 'creditCard',
                            id: 'desktop-drivers',
                            label: 'Drivers',
                            onselect: vi.fn(),
                        },
                        {
                            icon: 'truck',
                            id: 'desktop-vehicles',
                            label: 'Vehicles',
                            onselect: vi.fn(),
                        },
                    ],
                },
            },
            createViewerTestRenderOptions(),
        );

        const deadlinesButton = screen.getByRole('button', { name: 'Deadlines' });
        expect(screen.getByRole('button', { name: 'Dashboard' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'All documents' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Drivers' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Vehicles' })).toBeTruthy();

        await fireEvent.click(deadlinesButton);
        expect(onselect).toHaveBeenCalledOnce();
        expect(onclose).toHaveBeenCalledOnce();
    });

    it('contains keyboard focus and restores the invoking control when closed', async () => {
        const invokingButton = document.createElement('button');
        invokingButton.textContent = 'Open palette';
        document.body.append(invokingButton);
        invokingButton.focus();

        const rendered = render(
            CommandPaletteDialog,
            {
                props: {
                    availableSections: ['overview'],
                    isOpen: true,
                    onclose: vi.fn(),
                    onselectsection: vi.fn(),
                },
            },
            createViewerTestRenderOptions(),
        );

        const dialog = await screen.findByRole('dialog', { name: 'Global Command Palette' });
        const input = screen.getByPlaceholderText(/Search commands or jump to section/i);
        await waitFor(() => {
            expect(document.activeElement).toBe(input);
        });

        const focusableButtons = within(dialog).getAllByRole('button');
        const lastButton = focusableButtons.at(-1);
        if (lastButton === undefined) {
            throw new TypeError('The command palette must have a final focusable button.');
        }
        lastButton.focus();
        await fireEvent.keyDown(dialog, { key: 'Tab' });
        expect(document.activeElement).toBe(input);

        input.focus();
        await fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
        expect(document.activeElement).toBe(lastButton);

        await rendered.rerender({ isOpen: false });
        await waitFor(() => {
            expect(document.activeElement).toBe(invokingButton);
        });
        invokingButton.remove();
    });

    it('routes the native dialog cancel event through the close callback', async () => {
        const onclose = vi.fn();
        render(
            CommandPaletteDialog,
            {
                props: {
                    availableSections: [],
                    isOpen: true,
                    onclose,
                    onselectsection: vi.fn(),
                },
            },
            createViewerTestRenderOptions(),
        );

        const dialog = await screen.findByRole('dialog', { name: 'Global Command Palette' });
        await fireEvent(dialog, new Event('cancel', { cancelable: true }));

        expect(onclose).toHaveBeenCalledOnce();
    });
});
