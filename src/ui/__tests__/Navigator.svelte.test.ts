import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Navigator from '../layout/Navigator.svelte';

describe('Navigator', () => {
    const onselect = vi.fn();

    afterEach(() => {
        cleanup();
        onselect.mockClear();
    });

    it('renders group headings and items with selection and badges', () => {
        render(Navigator, {
            props: {
                ariaLabel: 'Workspace navigation',
                closeLabel: 'Close navigation',
                drawerId: 'workspace-navigation-drawer',
                groups: [
                    {
                        heading: 'Overview',
                        items: [
                            {
                                badgeCount: null,
                                badgeVariant: null,
                                icon: 'layers',
                                label: 'Dashboard',
                                onselect,
                                selected: true,
                            },
                            {
                                badgeCount: 3,
                                badgeVariant: 'danger',
                                icon: 'triangleAlert',
                                label: 'Deadlines',
                                onselect,
                                selected: false,
                            },
                        ],
                    },
                    {
                        heading: 'Rosters',
                        items: [
                            {
                                badgeCount: null,
                                badgeVariant: null,
                                icon: 'creditCard',
                                label: 'Drivers',
                                onselect,
                                selected: false,
                            },
                        ],
                    },
                ],
            },
        });

        const nav = screen.getByRole('navigation', { name: 'Workspace navigation' });
        expect(nav).toBeTruthy();
        expect(within(nav).getByRole('heading', { name: 'Overview' })).toBeTruthy();
        expect(within(nav).getByRole('heading', { name: 'Rosters' })).toBeTruthy();

        const dashboard = within(nav).getByRole('button', { name: 'Dashboard' });
        expect(dashboard.getAttribute('aria-current')).toBe('page');

        const deadlines = within(nav).getByRole('button', { name: /Deadlines/ });
        expect(deadlines.getAttribute('aria-current')).toBeNull();
        expect(within(nav).getByText('3')).toBeTruthy();
    });

    it('invokes the item select handler and hides zero badges', () => {
        render(Navigator, {
            props: {
                ariaLabel: 'Navigation',
                closeLabel: 'Close navigation',
                drawerId: 'navigation-drawer',
                groups: [
                    {
                        heading: 'Group',
                        items: [
                            {
                                badgeCount: 0,
                                badgeVariant: 'warning',
                                icon: 'layers',
                                label: 'Item',
                                onselect,
                                selected: false,
                            },
                        ],
                    },
                ],
            },
        });

        const item = screen.getByRole('button', { name: 'Item' });
        expect(screen.queryByText('0')).toBeNull();
        item.click();
        expect(onselect).toHaveBeenCalledOnce();
    });

    it('renders loading state with aria-busy and spinner icon', () => {
        render(Navigator, {
            props: {
                ariaLabel: 'Navigation',
                closeLabel: 'Close navigation',
                drawerId: 'navigation-drawer',
                groups: [
                    {
                        heading: 'Records',
                        items: [
                            {
                                badgeCount: null,
                                badgeVariant: null,
                                icon: 'layers',
                                label: 'Activities',
                                loading: true,
                                onselect,
                                selected: true,
                            },
                        ],
                    },
                ],
            },
        });

        const item = screen.getByRole('button', { name: 'Activities' });
        expect(item.getAttribute('aria-busy')).toBe('true');
        expect(item.classList.contains('is-loading')).toBe(true);
    });

    it('opens a modal drawer, closes after selection, and restores trigger focus', async () => {
        render(Navigator, {
            props: {
                ariaLabel: 'Workspace navigation',
                closeLabel: 'Close navigation',
                drawerId: 'workspace-navigation-drawer',
                groups: [
                    {
                        heading: 'Overview',
                        items: [
                            {
                                badgeCount: null,
                                badgeVariant: null,
                                icon: 'layers',
                                label: 'Dashboard',
                                onselect,
                                selected: true,
                            },
                        ],
                    },
                ],
            },
        });

        const trigger = screen.getByRole('button', { name: 'Workspace navigation' });
        expect(trigger.getAttribute('aria-controls')).toBe('workspace-navigation-drawer');
        expect(document.getElementById('workspace-navigation-drawer')).toBeTruthy();
        await fireEvent.click(trigger);

        const drawer = screen.getByRole('dialog', { name: 'Workspace navigation' });
        expect(drawer.hasAttribute('open')).toBe(true);
        expect(within(drawer).getByRole('button', { name: 'Close navigation' })).toBeTruthy();

        await fireEvent.click(within(drawer).getByRole('button', { name: 'Dashboard' }));

        expect(onselect).toHaveBeenCalledOnce();
        expect(screen.queryByRole('dialog', { name: 'Workspace navigation' })).toBeNull();
        expect(document.activeElement).toBe(trigger);
    });
});
