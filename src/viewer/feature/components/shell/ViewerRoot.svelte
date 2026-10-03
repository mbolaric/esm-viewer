<script lang="ts">
    import { reportViewerRenderFailure, disposeViewerContext } from '../../viewer-render-failure.js';

    import { ApplicationFailure } from '#shell';
    import { onMount, type Snippet } from 'svelte';

    import type { ICommandPaletteDestination } from '../../command-palette-destination.js';
    import type { IUserGuideContribution, IViewerPreferencesContribution } from '../../user-guide-contribution.js';
    import ViewerApp from './ViewerApp.svelte';
    import { provideViewerContext, type IViewerContext } from '../../viewer-context.js';

    import type { ViewerApplicationMode, IViewerDocumentStatus } from '../../viewer-application-mode.js';

    interface IProps {
        applicationMode?: ViewerApplicationMode;
        commandBar?: Snippet | undefined;
        welcomeActions?: Snippet | undefined;
        failureActions?: Snippet | undefined;
        commandPaletteDestinations?: readonly ICommandPaletteDestination[] | undefined;
        context: IViewerContext;
        guideContributions?: readonly IUserGuideContribution[] | undefined;
        preferencesContributions?: readonly IViewerPreferencesContribution[] | undefined;
        ondocumentstatuschange?: ((status: IViewerDocumentStatus | null) => void) | undefined;
        title: string;
        visible?: boolean;
    }

    let {
        applicationMode = 'standalone',
        commandBar,
        welcomeActions,
        failureActions,
        commandPaletteDestinations = [],
        context,
        guideContributions = [],
        preferencesContributions = [],
        ondocumentstatuschange = undefined,
        title,
        visible = true,
    }: IProps = $props();

    provideViewerContext(() => context);

    onMount(() => {
        return (): void => {
            if (applicationMode === 'standalone') {
                disposeViewerContext(context);
            }
        };
    });

    function handleRendererFailure(error: unknown): void {
        reportViewerRenderFailure(context, error, 'viewer-root');
    }
</script>

{#snippet renderFailed(_error: unknown, reset: () => void)}
    <ApplicationFailure
        labels={{
            heading: context.translationService.translate('shell.boundary.heading'),
            description: context.translationService.translate('shell.boundary.description'),
            retry: context.translationService.translate('shell.boundary.retry'),
        }}
        onretry={reset}
        state={_error === undefined ? 'unknown' : 'caught'}
    />
{/snippet}

<svelte:boundary failed={renderFailed} onerror={handleRendererFailure}>
    <ViewerApp
        {applicationMode}
        {commandBar}
        {welcomeActions}
        {failureActions}
        {commandPaletteDestinations}
        {guideContributions}
        {preferencesContributions}
        {ondocumentstatuschange}
        {title}
        {visible}
    />
</svelte:boundary>
