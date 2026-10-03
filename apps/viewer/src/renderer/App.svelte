<script lang="ts">
    import { ApplicationShell, type IApplicationContributions, type IApplicationModule } from '#shell';
    import {
        ViewerApplicationDialogs,
        ViewerApplicationStatus,
        ViewerRoot,
        reportViewerRenderFailure,
        disposeViewerContext,
        type IViewerContext,
        type IViewerDocumentStatus,
        type ViewerGuideTabId,
        type ViewerPreferencesTabId,
    } from '#viewer';

    interface IProps {
        title: string;
        viewerContext: IViewerContext;
    }

    type ViewerModule = IApplicationModule<'viewer', ViewerGuideTabId, ViewerPreferencesTabId>;
    type ViewerContributions = IApplicationContributions<ViewerGuideTabId, ViewerPreferencesTabId>;

    let { title, viewerContext }: IProps = $props();
    let documentStatus = $state<IViewerDocumentStatus | null>(null);
    const modules = $derived<readonly ViewerModule[]>([
        { id: 'viewer', icon: 'creditCard', label: title, workspace: viewerWorkspace },
    ]);
</script>

{#snippet viewerWorkspace(visible: boolean)}
    <ViewerRoot
        applicationMode="embedded"
        context={viewerContext}
        ondocumentstatuschange={(status: IViewerDocumentStatus | null) => {
            documentStatus = status;
        }}
        {title}
        {visible}
    />
{/snippet}

{#snippet dialogs(contributions: ViewerContributions)}
    <ViewerApplicationDialogs
        context={viewerContext}
        guideContributions={contributions.guide}
        preferencesContributions={contributions.preferences}
        commandPaletteDestinations={contributions.destinations}
        commands={contributions.commands}
        notificationOwner="applicationShell"
    />
{/snippet}

{#snippet status()}
    <ViewerApplicationStatus context={viewerContext} {documentStatus} />
{/snippet}

<ApplicationShell
    activeWorkspace="viewer"
    {modules}
    {dialogs}
    {status}
    failureLabels={{
        heading: viewerContext.translationService.translate('shell.boundary.heading'),
        description: viewerContext.translationService.translate('shell.boundary.description'),
        retry: viewerContext.translationService.translate('shell.boundary.retry'),
    }}
    onerror={(error: unknown) => reportViewerRenderFailure(viewerContext, error, 'application-shell')}
    ondispose={() => {
        disposeViewerContext(viewerContext);
    }}
    ondismisstoast={(id: string) => viewerContext.toastController.dismiss(id)}
    statusLabel={viewerContext.translationService.translate('shell.status')}
    toastLabel={viewerContext.translationService.translate('toast.notifications')}
    toasts={viewerContext.toastController.toasts}
/>
