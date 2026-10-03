import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ApplicationShellHarness from './ApplicationShellHarness.svelte';

afterEach(cleanup);

const copy = {
    appName: 'Application',
    clicks: 'clicks',
    dialogLabel: 'Application dialogs',
    moduleStatusText: 'status',
    notify: 'Notify',
    overlayLabel: 'Probe overlay',
    guideBody: 'Fleet guide body',
    statusText: 'Global status',
    visibilityLabel: 'visible',
    workspaceLabel: 'Workspaces',
};

describe('ApplicationShell', () => {
    it('preserves workspace state while switching and keeps global contributions accessible', async () => {
        const failure = vi.fn();
        render(ApplicationShellHarness, { props: { onerror: failure, copy } });
        await fireEvent.click(screen.getByRole('button', { name: 'viewer clicks: 0' }));
        await fireEvent.click(screen.getByRole('button', { name: 'Fleet' }));
        expect(screen.queryByRole('button', { name: 'viewer clicks: 1' })).toBeNull();
        await fireEvent.click(screen.getByRole('button', { name: 'fleet clicks: 0' }));
        expect(screen.getByText('Fleet guide body')).toBeTruthy();
        expect(screen.getByRole('contentinfo', { name: 'Application status' })).toBeTruthy();
        await fireEvent.click(screen.getByRole('button', { name: 'Viewer' }));
        expect(screen.getByRole('button', { name: 'viewer clicks: 1' })).toBeTruthy();
        expect(failure).not.toHaveBeenCalled();
    });

    it('renders one notification region regardless of the active workspace', async () => {
        render(ApplicationShellHarness, { props: { onerror: vi.fn(), copy } });
        await fireEvent.click(screen.getByRole('button', { name: 'Notify' }));
        expect(screen.getAllByRole('complementary', { name: 'Notifications' })).toHaveLength(1);
        await fireEvent.click(screen.getByRole('button', { name: 'Fleet' }));
        expect(screen.getAllByText('Notification from active workspace')).toHaveLength(1);
    });

    it('passes each registered module its identity and visibility without remounting hidden workspaces', async () => {
        const onerror = vi.fn();
        const ondispose = vi.fn();
        const onworkspacemount = vi.fn<(id: string) => void>();
        const onworkspaceunmount = vi.fn<(id: string) => void>();
        const component = render(ApplicationShellHarness, {
            props: { onerror, ondispose, onworkspacemount, onworkspaceunmount, copy, mode: 'modules' },
        });
        expect(onworkspacemount.mock.calls).toEqual([['viewer'], ['fleet'], ['probe']]);
        expect(screen.getByText('viewer visible: true')).toBeTruthy();
        expect(screen.getByText('fleet visible: false')).toBeTruthy();
        expect(screen.getByText('probe visible: false')).toBeTruthy();
        expect(screen.getAllByRole('region', { hidden: true })).toHaveLength(3);

        for (const [label, id] of [
            ['Viewer', 'viewer'],
            ['Fleet', 'fleet'],
            ['Probe', 'probe'],
        ] as const) {
            await fireEvent.click(screen.getByRole('button', { name: label }));
            expect(screen.getByText(`${id} visible: true`)).toBeTruthy();
            expect(screen.getAllByRole('region')).toHaveLength(1);
            const switcher = screen.getByRole('group', { name: 'Workspaces' });
            expect(
                within(switcher)
                    .getAllByRole('button')
                    .map((button) => button.getAttribute('aria-label')),
            ).toEqual(['Viewer', 'Fleet', 'Probe']);
            await fireEvent.click(screen.getByRole('button', { name: `${id} clicks: 0` }));
            await fireEvent.click(screen.getByRole('button', { name: 'Probe' }));
        }

        for (const [label, id] of [
            ['Viewer', 'viewer'],
            ['Fleet', 'fleet'],
            ['Probe', 'probe'],
        ] as const) {
            await fireEvent.click(screen.getByRole('button', { name: label }));
            expect(screen.getByRole('button', { name: `${id} clicks: 1` })).toBeTruthy();
        }
        expect(onworkspacemount).toHaveBeenCalledTimes(3);
        expect(onworkspaceunmount).not.toHaveBeenCalled();
        expect(ondispose).not.toHaveBeenCalled();
        expect(onerror).not.toHaveBeenCalled();
        component.unmount();
        expect(onworkspaceunmount.mock.calls).toEqual([['viewer'], ['fleet'], ['probe']]);
        expect(ondispose).toHaveBeenCalledOnce();
    });

    it.each([
        { mode: 'legacy', statuses: ['Global status'] },
        { mode: 'modules', statuses: ['viewer status', 'fleet status', 'probe status'] },
        { mode: 'combined', statuses: ['Global status', 'viewer status', 'fleet status', 'probe status'] },
    ] as const)('renders $mode statuses once in catalogue order', async ({ mode, statuses }) => {
        const onerror = vi.fn();
        render(ApplicationShellHarness, { props: { onerror, copy, mode } });
        const footer = screen.getByRole('contentinfo', { name: 'Application status' });
        expect(Array.from(footer.children, (element) => element.textContent)).toEqual(statuses);
        await fireEvent.click(screen.getByRole('button', { name: 'Fleet' }));
        expect(Array.from(footer.children, (element) => element.textContent)).toEqual(statuses);
        expect(onerror).not.toHaveBeenCalled();
    });

    it('keeps module overlays, global dialogs and one toast owner across third-workspace switches', async () => {
        render(ApplicationShellHarness, { props: { onerror: vi.fn(), copy, mode: 'modules' } });
        const dialog = screen.getByRole('dialog', { name: 'Application dialogs' });
        const overlay = screen.getByRole('complementary', { name: 'Probe overlay' });
        await fireEvent.click(screen.getByRole('button', { name: 'Notify' }));
        for (const label of ['Probe', 'Fleet', 'Viewer']) {
            await fireEvent.click(screen.getByRole('button', { name: label }));
            expect(screen.getByRole('dialog', { name: 'Application dialogs' })).toBe(dialog);
            expect(screen.getByRole('complementary', { name: 'Probe overlay' })).toBe(overlay);
            expect(within(dialog).getByText('Fleet guide body')).toBeTruthy();
            expect(screen.getAllByRole('complementary', { name: 'Notifications' })).toHaveLength(1);
            expect(screen.getAllByText('Notification from active workspace')).toHaveLength(1);
        }
    });

    it.each([
        { mode: 'legacy', failureSurface: 'workspace' },
        { mode: 'modules', failureSurface: 'workspace' },
        { mode: 'modules', failureSurface: 'status' },
    ] as const)(
        'retains $mode service ownership across a $failureSurface failure and retry, disposing only on app teardown',
        async ({ mode, failureSurface }) => {
            const onerror = vi.fn();
            const ondispose = vi.fn();
            const component = render(ApplicationShellHarness, {
                props: { onerror, ondispose, copy, mode, failureSurface, fail: true },
            });
            expect(screen.getByRole('alert')).toBeTruthy();
            expect(onerror).toHaveBeenCalledOnce();
            expect(ondispose).not.toHaveBeenCalled();
            await component.rerender({ onerror, ondispose, copy, mode, failureSurface, fail: false });
            await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
            expect(screen.getByRole('button', { name: 'viewer clicks: 0' })).toBeTruthy();
            expect(ondispose).not.toHaveBeenCalled();
            component.unmount();
            expect(ondispose).toHaveBeenCalledOnce();
        },
    );

    it.each([
        { name: 'duplicate workspace IDs', props: { duplicateIds: true }, message: /unique IDs|each_key_duplicate/ },
        {
            name: 'unregistered active workspace',
            props: { initialWorkspace: 'missing' },
            message: /active application workspace must belong/,
        },
    ] as const)('reports $name through the error boundary', ({ props, message }) => {
        const onerror = vi.fn<(error: unknown) => void>();
        const ondispose = vi.fn();
        const component = render(ApplicationShellHarness, { props: { ...props, onerror, ondispose, copy, mode: 'modules' } });
        expect(screen.getByRole('alert')).toBeTruthy();
        expect(onerror).toHaveBeenCalledOnce();
        const error = onerror.mock.calls[0]?.[0];
        if (!(error instanceof Error)) {
            throw new TypeError('Expected a reported composition error.');
        }
        expect(error.message).toMatch(message);
        expect(ondispose).not.toHaveBeenCalled();
        component.unmount();
        expect(ondispose).toHaveBeenCalledOnce();
    });
});
