<script lang="ts">
    import { untrack } from 'svelte';
    import { ToastController } from '#ui';
    import ApplicationShell from '../ApplicationShell.svelte';
    import ApplicationWorkspaceHarness from './ApplicationWorkspaceHarness.svelte';
    import type { IApplicationContributions, IApplicationModule } from '../application-module.js';

    type WorkspaceId = 'viewer' | 'fleet' | 'probe' | 'missing';
    type TestModule = IApplicationModule<WorkspaceId, 'intro', 'general'>;
    type Contributions = IApplicationContributions<'intro', 'general'>;
    interface IProps {
        onerror: (error: unknown) => void;
        ondispose?: (() => void) | undefined;
        onworkspacemount?: ((workspace: WorkspaceId) => void) | undefined;
        onworkspaceunmount?: ((workspace: WorkspaceId) => void) | undefined;
        fail?: boolean;
        failureSurface?: 'workspace' | 'status';
        duplicateIds?: boolean;
        initialWorkspace?: WorkspaceId;
        mode?: 'legacy' | 'modules' | 'combined';
        copy: {
            readonly appName: string;
            readonly clicks: string;
            readonly dialogLabel: string;
            readonly moduleStatusText: string;
            readonly notify: string;
            readonly overlayLabel: string;
            readonly guideBody: string;
            readonly statusText: string;
            readonly visibilityLabel: string;
            readonly workspaceLabel: string;
        };
    }
    let {
        onerror,
        ondispose,
        onworkspacemount,
        onworkspaceunmount,
        fail = false,
        failureSurface = 'workspace',
        duplicateIds = false,
        initialWorkspace = 'viewer',
        mode = 'legacy',
        copy,
    }: IProps = $props();
    let activeWorkspace = $state<WorkspaceId>(untrack(() => initialWorkspace));
    const notifications = new ToastController();
    const modules = $derived<readonly TestModule[]>([
        {
            id: 'viewer',
            icon: 'creditCard',
            label: 'Viewer',
            workspace: mode === 'legacy' ? viewerWorkspace : moduleWorkspace,
            ...(mode === 'legacy' ? {} : { status: moduleStatus }),
        },
        {
            id: 'fleet',
            icon: 'truck',
            label: 'Fleet',
            workspace: mode === 'legacy' ? fleetWorkspace : moduleWorkspace,
            guide: [{ id: 'fleet', label: 'Fleet guide', icon: 'truck', content: guide }],
            ...(mode === 'legacy' ? {} : { status: moduleStatus }),
        },
        ...(mode === 'legacy'
            ? []
            : [
                  {
                      id: 'probe' as const,
                      icon: 'truck' as const,
                      label: 'Probe',
                      workspace: moduleWorkspace,
                      status: moduleStatus,
                      overlays: overlay,
                  },
              ]),
        ...(duplicateIds
            ? [{ id: 'viewer' as const, icon: 'creditCard' as const, label: 'Duplicate', workspace: viewerWorkspace }]
            : []),
    ]);

    function checkRender(surface: 'workspace' | 'status'): string {
        if (fail && surface === failureSurface) {
            throw new Error('A module cannot render.');
        }
        return '';
    }
</script>

{#snippet content(active: boolean, id: WorkspaceId)}
    {checkRender('workspace')}
    <ApplicationWorkspaceHarness
        {activeWorkspace}
        {copy}
        {modules}
        {onworkspacemount}
        {onworkspaceunmount}
        visible={active}
        workspaceId={id}
        onchangeworkspace={(workspace: WorkspaceId) => {
            activeWorkspace = workspace;
        }}
        onnotify={() => notifications.success('Notification from active workspace')}
    />
{/snippet}
{#snippet viewerWorkspace(active: boolean)}{@render content(active, 'viewer')}{/snippet}
{#snippet fleetWorkspace(active: boolean)}{@render content(active, 'fleet')}{/snippet}
{#snippet moduleWorkspace(active: boolean, id: WorkspaceId)}{@render content(active, id)}{/snippet}
{#snippet guide()}<p>{copy.guideBody}</p>{/snippet}
{#snippet dialogs(contributions: Contributions)}
    <dialog aria-label={copy.dialogLabel} open>
        {#each contributions.guide as section (section.id)}{@render section.content()}{/each}
    </dialog>
{/snippet}
{#snippet status()}{checkRender('status')}<span>{copy.statusText}</span>{/snippet}
{#snippet moduleStatus(id: WorkspaceId)}{checkRender('status')}<span>{`${id} ${copy.moduleStatusText}`}</span>{/snippet}
{#snippet overlay()}<aside aria-label={copy.overlayLabel}>{copy.overlayLabel}</aside>{/snippet}

<ApplicationShell
    {activeWorkspace}
    {modules}
    {dialogs}
    {...mode === 'modules' ? {} : { status }}
    {onerror}
    {ondispose}
    failureLabels={{ heading: 'Render failure', description: 'Try again', retry: 'Retry' }}
    ondismisstoast={(id: string) => notifications.dismiss(id)}
    statusLabel="Application status"
    toastLabel="Notifications"
    toasts={notifications.toasts}
/>
