<script lang="ts">
    import type { IViewerPreferences } from '#contracts';
    import type { IApplicationCommand } from '#shell';
    import type { DocumentWorkspaceSection } from '#viewer-application';
    import { ToastContainer } from '#ui';

    import type { ICommandPaletteDestination } from '../../command-palette-destination.js';
    import type { IUserGuideContribution, IViewerPreferencesContribution } from '../../user-guide-contribution.js';
    import { provideViewerContext, type IViewerContext } from '../../viewer-context.js';
    import AboutDialog from '../dialogs/AboutDialog.svelte';
    import CommandPaletteDialog from '../dialogs/CommandPaletteDialog.svelte';
    import PreferencesDialog from '../dialogs/PreferencesDialog.svelte';
    import UserGuideDialog from '../dialogs/UserGuideDialog.svelte';

    type NotificationOwner = 'applicationShell' | 'dialogHost';

    interface IProps {
        context: IViewerContext;
        commandPaletteDestinations?: readonly ICommandPaletteDestination[];
        commands?: readonly IApplicationCommand[];
        guideContributions?: readonly IUserGuideContribution[];
        preferencesContributions?: readonly IViewerPreferencesContribution[];
        notificationOwner?: NotificationOwner;
        onactivateworkspace?: () => void;
    }

    let {
        context,
        commandPaletteDestinations = [],
        commands = [],
        guideContributions = [],
        preferencesContributions = [],
        notificationOwner = 'dialogHost',
        onactivateworkspace,
    }: IProps = $props();

    provideViewerContext(() => context);
    const preferences = $derived(context.preferencesController.snapshot);
    const about = $derived(context.aboutController.snapshot);
    const selection = $derived(context.documentController.selectionSnapshot);
    let isCommandPaletteOpen = $state(false);
    let isUserGuideOpen = $state(false);

    $effect(() => {
        const unregisterPalette = context.commandController.registerCommandPaletteHandler(() => {
            isCommandPaletteOpen = true;
        });
        const unregisterGuide = context.commandController.registerUserGuideHandler(() => {
            isUserGuideOpen = true;
        });
        return () => {
            unregisterPalette();
            unregisterGuide();
        };
    });

    $effect(() => {
        context.commandController.synchronize();
    });

    function handleWindowKeydown(event: KeyboardEvent): void {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            if (isCommandPaletteOpen) {
                isCommandPaletteOpen = false;
            } else {
                context.commandController.execute('view.commandPalette');
            }
        } else if (event.key === 'F1') {
            event.preventDefault();
            if (isUserGuideOpen) {
                isUserGuideOpen = false;
            } else {
                context.commandController.execute('application.userGuide');
            }
        }
    }

    async function applyPreferences(candidate: IViewerPreferences): Promise<void> {
        if (preferencesContributions.some((contribution) => contribution.canApply?.() === false)) {
            return;
        }
        if (await context.preferencesController.apply(candidate)) {
            for (const contribution of preferencesContributions) {
                if (!contribution.onapply()) {
                    return;
                }
            }
            context.toastController.success(context.translationService.translate('preferences.toast.saved'));
        }
    }

    function cancelPreferences(): void {
        if (context.preferencesController.cancel()) {
            for (const contribution of preferencesContributions) {
                contribution.oncancel();
            }
        }
    }

    async function copyDiagnostics(): Promise<void> {
        await context.aboutController.copyDiagnostics();
        if (context.aboutController.snapshot.copied) {
            context.toastController.info(context.translationService.translate('about.toast.copied'));
        }
    }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if preferences.isOpen}
    <PreferencesDialog
        contributions={preferencesContributions}
        availableNightWorkTimeZones={context.preferencesController.availableNightWorkTimeZones}
        availableTimeZones={context.preferencesController.availableTimeZones}
        loadWarning={preferences.loadWarning}
        onapply={(candidate: IViewerPreferences) => void applyPreferences(candidate)}
        oncancel={cancelPreferences}
        preferences={preferences.preferences}
        saveError={preferences.saveError}
        saving={preferences.saving}
    />
{/if}

{#if about.isOpen}
    <AboutDialog
        copied={about.copied}
        copyFailed={about.copyFailed}
        loading={about.loading}
        onclose={() => context.aboutController.cancel()}
        oncopy={() => void copyDiagnostics()}
        versions={about.versions}
        versionsFailed={about.versionsFailed}
    />
{/if}

<CommandPaletteDialog
    availableSections={selection?.availableSections ?? []}
    documentKind={context.documentController.snapshot.current?.content.documentKind}
    isOpen={isCommandPaletteOpen}
    onclose={() => {
        isCommandPaletteOpen = false;
    }}
    onselectsection={(section: DocumentWorkspaceSection) => {
        onactivateworkspace?.();
        context.commandController.selectSection(section);
    }}
    paletteDestinations={commandPaletteDestinations}
    additionalCommands={commands}
/>

{#if isUserGuideOpen}
    <UserGuideDialog
        contributions={guideContributions}
        onclose={() => {
            isUserGuideOpen = false;
        }}
    />
{/if}

{#if notificationOwner === 'dialogHost'}
    <ToastContainer
        ariaLabel={context.translationService.translate('toast.notifications')}
        ondismiss={(id: string) => context.toastController.dismiss(id)}
        toasts={context.toastController.toasts}
    />
{/if}
