<script lang="ts">
    import type { Snippet } from 'svelte';

    import {
        documentKindIcon,
        generationIcon,
        translateDocumentKind,
        translateDocumentSection,
        translateGeneration,
        translateIntegrityStatus,
        translateParseErrorDescription,
    } from '../../helpers/viewer-labels.js';
    import { ERROR_CODES, type ReopenToken } from '#contracts';
    import { logBoundaryError } from '#error-reporting';
    import { AppShell, FileDropSurface } from '#ui';
    import {
        writeTextToClipboard,
        type AssociationGenerationFilter,
        type DocumentWorkspaceSection,
        type EventFaultTypeFilter,
        type IDocumentSelectionSnapshot,
        type LocationRecordTypeFilter,
    } from '#viewer-application';
    import type {
        ActivityInterval,
        IDetailedSpeedSample,
        JsonPointer,
        TachographAssociation,
        TachographEventFault,
        TachographLocationRecord,
        TachographTechnicalRecord,
        UtcTimestamp,
    } from '#viewer-domain';
    import {
        createRecentFilesViewModel,
        type ActivityLinkedSection,
        type IActivityDayViewModel,
        type IActivityInfringementPinViewModel,
        type IDocumentOverviewViewModel,
    } from '#viewer-presentation';

    import RecordInspector from '../records/RecordInspector.svelte';
    import ActivitiesScreen from '../screens/ActivitiesScreen.svelte';
    import AssociationsScreen from '../screens/AssociationsScreen.svelte';
    import ChartError from '../screens/ChartError.svelte';
    import ComparisonScreen from '../screens/ComparisonScreen.svelte';
    import { ComplianceScreen } from '#compliance-feature';
    import DocumentHeader from './DocumentHeader.svelte';
    import DocumentNavigator from './DocumentNavigator.svelte';
    import ViewerDialogHost from './ViewerDialogHost.svelte';
    import EventsFaultsScreen from '../screens/EventsFaultsScreen.svelte';
    import IntegrityScreen from '../screens/IntegrityScreen.svelte';
    import OpenFailureScreen from '../screens/OpenFailureScreen.svelte';
    import OpeningScreen from '../screens/OpeningScreen.svelte';
    import OverviewScreen from '../screens/OverviewScreen.svelte';
    import PendingSectionScreen from '../screens/PendingSectionScreen.svelte';
    import PlacesScreen from '../screens/PlacesScreen.svelte';
    import RawDataScreen from '../screens/RawDataScreen.svelte';
    import SpeedScreen from '../screens/SpeedScreen.svelte';
    import TechnicalScreen from '../screens/TechnicalScreen.svelte';
    import ViewerCommandBar from './ViewerCommandBar.svelte';
    import WelcomeScreen from '../screens/WelcomeScreen.svelte';
    import { loadInspectorWidth, saveInspectorWidth } from '../../helpers/inspector-preference.js';
    import { ViewerDocumentSession } from '../../controllers/viewer-document-session.svelte.js';
    import { ViewerSectionViewModels } from '../../controllers/viewer-section-view-models.svelte.js';
    import { useViewerContext } from '../../viewer-context.js';
    import { loadWelcomeHelpDismissed, saveWelcomeHelpDismissed } from '../../helpers/welcome-help-preference.js';
    import type { ICommandPaletteDestination } from '../../command-palette-destination.js';
    import type { IUserGuideContribution, IViewerPreferencesContribution } from '../../user-guide-contribution.js';

    import type { ViewerApplicationMode, IViewerDocumentStatus } from '../../viewer-application-mode.js';
    import ViewerApplicationDialogs from './ViewerApplicationDialogs.svelte';

    interface IProps {
        applicationMode?: ViewerApplicationMode;
        commandBar?: Snippet | undefined;
        welcomeActions?: Snippet | undefined;
        failureActions?: Snippet | undefined;
        commandPaletteDestinations?: readonly ICommandPaletteDestination[] | undefined;
        guideContributions?: readonly IUserGuideContribution[] | undefined;
        preferencesContributions?: readonly IViewerPreferencesContribution[] | undefined;
        ondocumentstatuschange?: ((status: IViewerDocumentStatus | null) => void) | undefined;
        title: string;
        visible?: boolean;
    }

    // Passed to section snippets; each destructures needed context.
    interface ISectionSnippetContext {
        readonly overview: IDocumentOverviewViewModel;
        readonly selection: IDocumentSelectionSnapshot;
    }

    let {
        applicationMode = 'standalone',
        commandBar,
        welcomeActions,
        failureActions,
        commandPaletteDestinations = [],
        guideContributions = [],
        preferencesContributions = [],
        ondocumentstatuschange = undefined,
        title,
        visible = true,
    }: IProps = $props();

    const viewerContext = useViewerContext();
    const commandController = viewerContext.commandController;
    const documentController = viewerContext.documentController;
    const preferencesController = viewerContext.preferencesController;
    const preferences = $derived(preferencesController.snapshot);
    const snapshot = $derived(documentController.snapshot);
    const selection = $derived(documentController.selectionSnapshot);
    // Filters, table searches, and links that start fresh for every opened document.
    const session = new ViewerDocumentSession();
    const sections = new ViewerSectionViewModels(viewerContext, session);
    const overview = $derived(sections.overview);
    let inspectorWidth = $state(loadInspectorWidth(viewerContext.keyValueStore));

    let welcomeHelpHintDismissed = $state(loadWelcomeHelpDismissed(viewerContext.keyValueStore));
    let pendingHistoryRemoval = $state<string | null>(null);
    let pendingHistoryRemovalName = $derived(
        pendingHistoryRemoval === null
            ? null
            : (documentController.comparisonSnapshot.records.find((record) => record.key === pendingHistoryRemoval)
                  ?.displayName ?? null),
    );

    $effect(() => commandController.registerSectionSelectionHandler(selectSection));

    // Document viewing session key; triggers remount and resets document-scoped state on change.
    const documentSessionKey = $derived(
        snapshot.current === null ? '' : `${snapshot.current.source.sha256}:${String(snapshot.current.source.openedAt)}`,
    );
    const inspectorOpen = $derived(
        (selection !== null && selection.selectedRecord !== null) || session.selectedActivityInfringement.value !== null,
    );
    // Lookup table dispatching section snippets without repetitive else-if branches.
    const sectionSnippets = $derived<Partial<Record<DocumentWorkspaceSection, Snippet<[ISectionSnippetContext]>>>>({
        activities: activitiesSection,
        associations: associationsSection,
        comparison: comparisonSection,
        eventsAndFaults: eventsAndFaultsSection,
        integrity: integritySection,
        overview: overviewSection,
        places: placesSection,
        rawData: rawDataSection,
        speed: speedSection,
        technical: technicalSection,
    });
    const recentFiles = $derived(
        createRecentFilesViewModel(preferences.preferences.recentFiles, viewerContext.localisationService).map((file) => ({
            displayName: file.displayName,
            openedAtDisplay: file.openedAt?.display ?? null,
            reopenAriaLabel: viewerContext.translationService
                .translate('welcome.recentFiles.reopen')
                .replace('{name}', file.displayName),
            reopenToken: file.reopenToken,
        })),
    );
    let requestedRawDataPointer = $state<JsonPointer | null>(null);

    // Syncs pre-computed overview counts to shell status bar.
    $effect(() => {
        ondocumentstatuschange?.(overview === null ? null : { warningCount: overview.counts.warnings.display });
    });

    // Resets document-scoped filters and search inputs to initial state when document changes.
    $effect(() => {
        session.syncDocumentKey(documentSessionKey);
    });

    function cancelOpening(): void {
        documentController.cancel();
    }

    function dismissFailure(): void {
        documentController.dismissFailure();
    }

    $effect(() => {
        if (!visible && snapshot.error !== null) {
            dismissFailure();
        }
    });

    function openDocument(): void {
        commandController.execute('file.open');
    }

    function verifyDocumentSignatures(): void {
        void documentController.verifyDocument();
    }

    function openDroppedFiles(files: readonly File[]): void {
        void documentController.openDroppedFiles(files);
    }

    function reopenRecentFile(reopenToken: ReopenToken): void {
        void documentController.reopenDocument(reopenToken);
    }

    function clearRecentFiles(): void {
        preferencesController.clearRecentFiles();
    }

    function openRawDataSource(path: JsonPointer): void {
        requestedRawDataPointer = path;
        documentController.selectSection('rawData');
    }

    function clearSelectedRecord(): void {
        session.selectedActivityInfringement.set(null);
        documentController.clearRecord();
    }

    function changeInspectorWidth(width: number): void {
        inspectorWidth = width;
        saveInspectorWidth(viewerContext.keyValueStore, width);
    }

    function dismissWelcomeHelpHint(): void {
        welcomeHelpHintDismissed = true;
        saveWelcomeHelpDismissed(viewerContext.keyValueStore);
    }

    function openUserGuideFromWelcome(): void {
        dismissWelcomeHelpHint();
        commandController.execute('application.userGuide');
    }

    function reportChartFailure(): void {
        void viewerContext.errorService.report({
            code: ERROR_CODES.chartRenderFailed,
            severity: 'error',
            source: 'viewer',
        });
    }

    function reportWorkspaceFailure(error: unknown): void {
        // Reports uncaught workspace boundary errors to error service and native debug log.
        logBoundaryError('viewer-workspace', error);
        void viewerContext.errorService.report(
            { code: ERROR_CODES.workspaceRenderFailed, severity: 'error', source: 'viewer' },
            error,
        );
    }

    function selectActivityRecord(record: ActivityInterval): void {
        session.selectedActivityInfringement.set(null);
        documentController.selectRecord(record);
    }

    function selectActivityInfringement(pin: IActivityInfringementPinViewModel): void {
        documentController.clearRecord();
        session.selectedActivityInfringement.set(pin);
    }

    function selectSpeedRecord(record: IDetailedSpeedSample): void {
        documentController.selectRecord(record);
    }

    function selectAssociationRecord(record: TachographAssociation): void {
        documentController.selectRecord(record);
    }

    function selectEventFaultRecord(record: TachographEventFault): void {
        documentController.selectRecord(record);
    }

    function selectLocationRecord(record: TachographLocationRecord): void {
        documentController.selectRecord(record);
    }

    function selectTechnicalRecord(record: TachographTechnicalRecord): void {
        documentController.selectRecord(record);
    }

    function selectSpeedPage(pageIndex: number): void {
        session.setSpeedPage(pageIndex);
    }

    function applySpeedRange(start: UtcTimestamp, end: UtcTimestamp): void {
        session.setSpeedRange(start, end);
        clearSelectedRecord();
    }

    function resetSpeedRange(): void {
        session.setSpeedRange(null, null);
        clearSelectedRecord();
    }

    function filterEventFaults(filter: EventFaultTypeFilter): void {
        session.eventFaultFilter.set(filter);
        clearSelectedRecord();
    }

    function filterAssociations(filter: AssociationGenerationFilter): void {
        session.associationFilter.set(filter);
        clearSelectedRecord();
    }

    function filterLocations(filter: LocationRecordTypeFilter): void {
        session.locationFilter.set(filter);
        clearSelectedRecord();
    }

    async function copyRawDataEvidence(value: string): Promise<boolean> {
        const result = await writeTextToClipboard(viewerContext.clipboard, value);
        if (result.ok) {
            viewerContext.toastController.info(viewerContext.translationService.translate('places.copied'));
        }
        return result.ok;
    }

    let requestedActivityDayMidnight = $state<UtcTimestamp | null>(null);

    function selectSection(section: DocumentWorkspaceSection): void {
        requestedRawDataPointer = null;
        session.linkedActivityDay.set(null);
        session.selectedActivityInfringement.set(null);
        requestedActivityDayMidnight = null;
        documentController.selectSection(section);
    }

    function openLinkedSection(section: ActivityLinkedSection, day: IActivityDayViewModel): void {
        session.linkedActivityDay.set({ label: day.date.display, midnight: day.midnightUtc });
        clearSelectedRecord();
        documentController.selectSection(section);
    }

    function returnToActivities(): void {
        const midnight = session.linkedActivityDay.value?.midnight ?? null;
        if (midnight !== null) {
            requestedActivityDayMidnight = midnight;
        }
        session.linkedActivityDay.set(null);
        clearSelectedRecord();
        documentController.selectSection('activities');
    }

    function clearLinkedActivityDay(): void {
        session.linkedActivityDay.set(null);
    }
</script>

<svelte:head>
    <title>{title}</title>
</svelte:head>

{#snippet commands()}
    {#if commandBar !== undefined}
        {@render commandBar()}
    {:else}
        <ViewerCommandBar
            appName={viewerContext.translationService.translate('application.name')}
            ariaLabel={viewerContext.translationService.translate('shell.commandBar')}
            exportDisabled={!commandController.state['file.export']}
            exportLabel={commandController.label('file.export')}
            onexport={() => {
                commandController.execute('file.export');
            }}
            onopen={openDocument}
            openDisabled={!commandController.state['file.open']}
            openLabel={commandController.label('file.open')}
        />
    {/if}
{/snippet}

{#snippet documentHeader()}
    {#if overview !== null}
        <DocumentHeader
            ariaLabel={viewerContext.translationService.translate('shell.documentHeader')}
            displayName={overview.displayName}
            documentKind={translateDocumentKind(overview.documentKind, viewerContext.translationService)}
            documentKindIcon={documentKindIcon(overview.documentKind)}
            generation={translateGeneration(overview.generation, viewerContext.translationService)}
            generationIcon={generationIcon(overview.generation)}
            integrity={translateIntegrityStatus(overview.integrity.status, viewerContext.translationService)}
            integrityStatus={overview.integrity.status}
        />
    {/if}
{/snippet}

{#snippet navigation()}
    {#if overview !== null && selection !== null}
        <DocumentNavigator
            availableSections={selection.availableSections}
            disabled={snapshot.status === 'opening' || snapshot.error !== null}
            documentKind={overview.documentKind}
            onselect={selectSection}
            selectedSection={selection.projection.section}
        />
    {/if}
{/snippet}

{#snippet inspector()}
    <RecordInspector
        onclear={clearSelectedRecord}
        onopenraw={openRawDataSource}
        titleId="record-inspector-heading"
        viewModel={sections.inspector}
    />
{/snippet}

{#snippet workspaceFailed(error: unknown, reset: () => void)}
    <ChartError
        {error}
        onretry={reset}
        description={viewerContext.translationService.translate('shell.boundary.description')}
        heading={viewerContext.translationService.translate('shell.boundary.heading')}
        retryLabel={viewerContext.translationService.translate('shell.boundary.retry')}
    />
{/snippet}

<!--
Every section except `compliance` (rendered through its own explicit branch -
its prop contract is unlike every other section's `viewModel`-shaped one) is
dispatched through the `sectionSnippets` table instead of a hand-written
`{:else if}` chain. Each snippet takes the document's overview/selection as a
single destructured context object (rather than relying on the render site's
own `overview !== null && selection !== null` narrowing, which a snippet body
declared outside that guard cannot see, and rather than positional
parameters, which would force every snippet to name both even when it only
needs one) - `sectionSnippets` itself is a script-level `$derived`, and
top-level snippets are needed for it to reference them at all.
-->
{#snippet overviewSection({ overview: currentOverview }: ISectionSnippetContext)}
    <OverviewScreen
        onopenintegrity={() => selectSection('integrity')}
        onopensource={openRawDataSource}
        onverify={verifyDocumentSignatures}
        verifying={documentController.verifying}
        viewModel={currentOverview}
    />
{/snippet}
{#snippet comparisonSection()}
    <ComparisonScreen
        exportPort={viewerContext.exportPort}
        filterText={session.comparisonSearchText}
        localisationService={viewerContext.localisationService}
        onclear={() => {
            documentController.clearComparison();
        }}
        onremove={(key: string) => {
            pendingHistoryRemoval = key;
        }}
        onreopen={(key: string) => {
            void documentController.reopenComparisonRecord(key);
        }}
        pdfPort={viewerContext.pdfPort}
        toastController={viewerContext.toastController}
        translationService={viewerContext.translationService}
        viewModel={sections.comparison}
    />
{/snippet}
{#snippet activitiesSection({ selection: currentSelection }: ISectionSnippetContext)}
    <ActivitiesScreen
        allDaysFilterText={session.activitiesAllDaysSearchText}
        calendarFilterText={session.activitiesCalendarSearchText}
        dayFilterText={session.activitiesDaySearchText}
        onchartfailure={reportChartFailure}
        onclearrecord={clearSelectedRecord}
        onopenlinked={openLinkedSection}
        onselectinfringement={selectActivityInfringement}
        onselectrecord={selectActivityRecord}
        onopensource={openRawDataSource}
        requestedDayMidnight={requestedActivityDayMidnight}
        selectedRecord={currentSelection.selectedRecord}
        viewModel={sections.activity}
    />
{/snippet}
{#snippet associationsSection({ selection: currentSelection }: ISectionSnippetContext)}
    <AssociationsScreen
        activityDayLabel={session.linkedActivityDay.value?.label ?? null}
        activityDayMidnight={session.linkedActivityDay.value?.midnight ?? null}
        filterText={session.associationsSearchText}
        onclearactivityday={clearLinkedActivityDay}
        onreturnactivityday={returnToActivities}
        onfilter={filterAssociations}
        onopensource={openRawDataSource}
        onselectrecord={selectAssociationRecord}
        selectedRecord={currentSelection.selectedRecord}
        viewModel={sections.association}
    />
{/snippet}
{#snippet placesSection({ selection: currentSelection }: ISectionSnippetContext)}
    <PlacesScreen
        activityDayLabel={session.linkedActivityDay.value?.label ?? null}
        activityDayMidnight={session.linkedActivityDay.value?.midnight ?? null}
        filterText={session.placesSearchText}
        onclearactivityday={clearLinkedActivityDay}
        onreturnactivityday={returnToActivities}
        oncopycoordinates={copyRawDataEvidence}
        onfilter={filterLocations}
        onopensource={openRawDataSource}
        onselectrecord={selectLocationRecord}
        selectedRecord={currentSelection.selectedRecord}
        viewModel={sections.location}
    />
{/snippet}
{#snippet eventsAndFaultsSection({ selection: currentSelection }: ISectionSnippetContext)}
    <EventsFaultsScreen
        activityDayLabel={session.linkedActivityDay.value?.label ?? null}
        activityDayMidnight={session.linkedActivityDay.value?.midnight ?? null}
        filterText={session.eventsAndFaultsSearchText}
        onclearactivityday={clearLinkedActivityDay}
        onreturnactivityday={returnToActivities}
        onfilter={filterEventFaults}
        onopensource={openRawDataSource}
        onselectrecord={selectEventFaultRecord}
        selectedRecord={currentSelection.selectedRecord}
        viewModel={sections.eventFault}
    />
{/snippet}
{#snippet technicalSection({ overview: currentOverview, selection: currentSelection }: ISectionSnippetContext)}
    <TechnicalScreen
        documentKind={currentOverview.documentKind}
        filterText={session.technicalSearchText}
        oncopy={copyRawDataEvidence}
        onopensource={openRawDataSource}
        onselectrecord={selectTechnicalRecord}
        selectedRecord={currentSelection.selectedRecord}
        viewModel={sections.technical}
    />
{/snippet}
{#snippet speedSection()}
    <SpeedScreen
        onchartfailure={reportChartFailure}
        onclearrecord={clearSelectedRecord}
        onpage={selectSpeedPage}
        onrange={applySpeedRange}
        onreset={resetSpeedRange}
        onselectrecord={selectSpeedRecord}
        onopensource={openRawDataSource}
        overspeedFilterText={session.speedOverspeedSearchText}
        sampleFilterText={session.speedSampleSearchText}
        selectedRecord={sections.selectedSpeedRecord}
        viewModel={sections.speed}
    />
{/snippet}
{#snippet integritySection({ overview: currentOverview }: ISectionSnippetContext)}
    {#if sections.integrityDetail !== null}
        <IntegrityScreen
            filterText={session.integritySearchText}
            onopensource={openRawDataSource}
            onverify={verifyDocumentSignatures}
            verifying={documentController.verifying}
            viewModel={sections.integrityDetail}
        />
    {:else}
        <PendingSectionScreen
            description={viewerContext.translationService.translate('section.pending.description')}
            heading={translateDocumentSection('integrity', currentOverview.documentKind, viewerContext.translationService)}
        />
    {/if}
{/snippet}
{#snippet rawDataSection({ overview: currentOverview }: ISectionSnippetContext)}
    {#if sections.rawDataExplorer !== null}
        <RawDataScreen
            explorer={sections.rawDataExplorer}
            initialPath={requestedRawDataPointer}
            locale={currentOverview.locale}
            oncopy={copyRawDataEvidence}
        />
    {:else}
        <PendingSectionScreen
            description={viewerContext.translationService.translate('section.pending.description')}
            heading={translateDocumentSection('rawData', currentOverview.documentKind, viewerContext.translationService)}
        />
    {/if}
{/snippet}

<div class="viewer-workspace-shell" hidden={!visible}>
    <FileDropSurface
        ariaLabel={viewerContext.translationService.translate('drop.area')}
        disabled={!visible || documentController.busy || preferences.isOpen}
        dropLabel={viewerContext.translationService.translate('drop.open')}
        ondropfiles={openDroppedFiles}
    >
        <AppShell
            {commands}
            document={overview === null
                ? null
                : {
                      header: documentHeader,
                      navigation,
                  }}
            {inspector}
            inspectorLabel={viewerContext.translationService.translate('inspector.region')}
            inspectorLabels={{
                defaultLabel: viewerContext.translationService.translate('inspector.widthDefault'),
                menuLabel: viewerContext.translationService.translate('inspector.widthMenu'),
                narrowLabel: viewerContext.translationService.translate('inspector.widthNarrow'),
                resizeLabel: viewerContext.translationService.translate('inspector.resize'),
                wideLabel: viewerContext.translationService.translate('inspector.widthWide'),
            }}
            {inspectorOpen}
            {inspectorWidth}
            oninspectorwidthchange={changeInspectorWidth}
        >
            {#if snapshot.status === 'opening'}
                <div class="centered-panel">
                    <OpeningScreen
                        cancelLabel={viewerContext.translationService.translate('opening.cancel')}
                        displayName={snapshot.candidateDisplayName}
                        heading={viewerContext.translationService.translate('opening.heading')}
                        oncancel={cancelOpening}
                        phaseLabel={viewerContext.translationService.translate('opening.phase')}
                        readOnlyLabel={viewerContext.translationService.translate('opening.sourceReadOnly')}
                    />
                </div>
            {:else if snapshot.error !== null}
                <div class="centered-panel">
                    <OpenFailureScreen
                        extraActions={failureActions}
                        chooseAnotherLabel={viewerContext.translationService.translate('failure.chooseAnother')}
                        description={translateParseErrorDescription(snapshot.error, viewerContext.translationService)}
                        displayName={snapshot.candidateDisplayName}
                        errorCode={snapshot.error.code}
                        errorCodeLabel={viewerContext.translationService.translate('failure.errorCode')}
                        hasCurrentDocument={snapshot.current !== null}
                        heading={viewerContext.translationService.translate('failure.heading')}
                        onchooseanother={openDocument}
                        onreturn={dismissFailure}
                        returnLabel={viewerContext.translationService.translate('failure.returnCurrent')}
                        unchangedLabel={viewerContext.translationService.translate('failure.sourceUnchanged')}
                    />
                </div>
            {:else if overview !== null && selection !== null}
                <svelte:boundary failed={workspaceFailed} onerror={reportWorkspaceFailure}>
                    {#key preferences.preferences.locale}
                        {#key documentSessionKey}
                            {#key selection.projection.section}
                                {#if selection.projection.section === 'compliance'}
                                    <ComplianceScreen
                                        activeSection="compliance"
                                        columnPreferencesStore={viewerContext.preferencesController}
                                        document={snapshot.current}
                                        exportController={viewerContext.complianceExportController}
                                        localisationService={viewerContext.localisationService}
                                        nightWindow={sections.complianceNightWindow}
                                        onopensource={openRawDataSource}
                                        profileController={viewerContext.complianceProfileController}
                                        settingsStore={viewerContext.keyValueStore}
                                        translationService={viewerContext.translationService}
                                    />
                                {:else}
                                    {@const activeSnippet = sectionSnippets[selection.projection.section]}
                                    {#if activeSnippet !== undefined}
                                        {@render activeSnippet({ overview, selection })}
                                    {:else}
                                        <PendingSectionScreen
                                            description={viewerContext.translationService.translate(
                                                'section.pending.description',
                                            )}
                                            heading={translateDocumentSection(
                                                selection.projection.section,
                                                overview.documentKind,
                                                viewerContext.translationService,
                                            )}
                                        />
                                    {/if}
                                {/if}
                            {/key}
                        {/key}
                    {/key}
                </svelte:boundary>
            {:else}
                <WelcomeScreen
                    extraActions={welcomeActions}
                    clearRecentFilesLabel={viewerContext.translationService.translate('welcome.recentFiles.clear')}
                    description={viewerContext.translationService.translate('welcome.description')}
                    heading={viewerContext.translationService.translate('welcome.heading')}
                    helpHintDismissLabel={viewerContext.translationService.translate('welcome.help.dismiss')}
                    helpHintOpenGuideLabel={viewerContext.translationService.translate('welcome.help.openGuide')}
                    helpHintText={viewerContext.translationService.translate('welcome.help.hint')}
                    helpHintVisible={!welcomeHelpHintDismissed}
                    ondismisshelphint={dismissWelcomeHelpHint}
                    onclearrecent={clearRecentFiles}
                    onopen={openDocument}
                    onopenguide={openUserGuideFromWelcome}
                    onreopenrecent={reopenRecentFile}
                    openLabel={commandController.label('file.open')}
                    openTooltip={viewerContext.translationService.translate('welcome.openTooltip')}
                    privacyLabel={viewerContext.translationService.translate('welcome.privacy')}
                    {recentFiles}
                    recentFilesHeading={viewerContext.translationService.translate('welcome.recentFiles.heading')}
                    shortcutHint={viewerContext.translationService.translate('welcome.shortcutHint')}
                    supportedFilesLabel={viewerContext.translationService.translate('welcome.supportedFiles')}
                />
            {/if}
        </AppShell>
    </FileDropSurface>
</div>

<ViewerDialogHost
    currentDocument={snapshot.current}
    onhistoryremovalclose={() => {
        pendingHistoryRemoval = null;
    }}
    {pendingHistoryRemoval}
    {pendingHistoryRemovalName}
/>

{#if applicationMode === 'standalone'}
    <ViewerApplicationDialogs
        context={viewerContext}
        {commandPaletteDestinations}
        {guideContributions}
        {preferencesContributions}
    />
{/if}

<style>
    .viewer-workspace-shell[hidden] {
        display: none;
    }

    .viewer-workspace-shell {
        inline-size: var(--size-full);
        block-size: var(--size-full);
        min-block-size: var(--space-none);
        overflow: hidden;
    }

    /* Keeps opening and failure task-state panels centered even when main content stretches. */
    .centered-panel {
        display: grid;
        place-items: center;
        inline-size: var(--size-full);
        block-size: var(--size-full);
    }
</style>
