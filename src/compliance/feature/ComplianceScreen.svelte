<script lang="ts">
    import { createComplianceDataTableLabels } from './helpers/data-table-labels.js';
    import type { JsonPointer } from '#tachograph-domain';
    import type { OpenedTachographDocument } from '#viewer-application';
    import type { IKeyValueStore, IPdfDocumentRequest } from '#contracts';
    import type { ILocalisationService } from '#localization';
    import type { DurationMilliseconds, UtcTimestamp } from '#tachograph-domain';
    import {
        BUILTIN_RULE_PROFILES,
        createAttestationFormViewModel,
        createComplianceViewModel,
        createInfringementLetterViewModel,
        type AttestationReason,
        type IComplianceTranslationService,
        type IInfringementViewModel,
        type INightWindow,
        type InfringementCategory,
        type InfringementSeverity,
        translateRuleProfileName,
    } from '#compliance';
    import ComplianceAssessmentsPanel from './components/ComplianceAssessmentsPanel.svelte';
    import ComplianceSummaryKpis from './components/ComplianceSummaryKpis.svelte';
    import type { ComplianceProfileController } from './controllers/compliance-profile-controller.svelte.js';
    import type { ComplianceExportController } from './controllers/compliance-export-controller.svelte.js';
    import {
        Button,
        DataTable,
        FilterChipGroup,
        Icon,
        InlineNotice,
        ReferenceLink,
        ScreenHeader,
        SearchInput,
        SectionMessage,
        SessionColumnVisibility,
        type IColumnPreferencesStore,
    } from '#ui';
    import DriverInfringementLetterDialog from './components/DriverInfringementLetterDialog.svelte';
    import AttestationFormDialog from './components/AttestationFormDialog.svelte';

    export interface IProps {
        readonly activeSection: string;
        readonly columnPreferencesStore?: IColumnPreferencesStore;
        readonly document: OpenedTachographDocument | null;
        readonly exportController: ComplianceExportController;
        readonly localisationService: ILocalisationService<UtcTimestamp, DurationMilliseconds>;
        readonly nightWindow: INightWindow;
        readonly onopensource: (path: JsonPointer) => void;
        readonly profileController: ComplianceProfileController;
        // Remembers company and driver details the letter and attestation dialogs reuse.
        readonly settingsStore: IKeyValueStore;
        readonly translationService: IComplianceTranslationService;
    }

    const {
        activeSection,
        columnPreferencesStore = undefined,
        document,
        exportController,
        localisationService,
        nightWindow,
        onopensource,
        profileController,
        settingsStore,
        translationService,
    }: IProps = $props();

    function handlePrint(html: string): Promise<void> {
        return exportController.print(html);
    }

    function handleSaveHtml(html: string, suggestedName: string): Promise<void> {
        return exportController.saveHtml(html, suggestedName, document?.source.sourceToken ?? null);
    }

    function handleSavePdf(suggestedName: string, pdfRequest: IPdfDocumentRequest): Promise<void> {
        return exportController.savePdf(suggestedName, document?.source.sourceToken ?? null, pdfRequest);
    }

    const exportErrorMessage = $derived(
        exportController.error !== null ? exportController.exportFailureReason(exportController.error) : null,
    );

    // App-wide selected profile synchronized across screens via controller.
    const selectedProfile = $derived(profileController.selectedProfile);
    let categoryFilter = $state<InfringementCategory | 'all'>('all');
    let severityFilter = $state<InfringementSeverity | 'all'>('all');
    let searchFilter = $state('');
    let groupByArticle = $state(false);
    const columnVisibility = new SessionColumnVisibility();

    const viewModel = $derived(
        createComplianceViewModel(
            document,
            translationService,
            selectedProfile,
            categoryFilter,
            severityFilter,
            searchFilter,
            nightWindow,
        ),
    );

    const letterViewModel = $derived(
        document !== null ? createInfringementLetterViewModel(document, viewModel, localisationService) : null,
    );

    const attestationViewModel = $derived(
        document !== null
            ? createAttestationFormViewModel(document, localisationService, {
                  reason: exportController.attestationReason,
              })
            : null,
    );

    function handleProfileChange(event: Event): void {
        const target = event.currentTarget;
        if (target instanceof HTMLSelectElement) {
            profileController.selectProfile(target.value);
        }
    }

    function handleCategoryChange(event: Event): void {
        const target = event.currentTarget;
        if (target instanceof HTMLSelectElement) {
            const val = target.value;
            if (
                val === 'all' ||
                val === 'break' ||
                val === 'dailyDriving' ||
                val === 'weeklyDriving' ||
                val === 'biWeeklyDriving' ||
                val === 'dailyRest' ||
                val === 'weeklyRest' ||
                val === 'workingTime' ||
                val === 'nightWork' ||
                val === 'ferryDerogation' ||
                val === 'anomaly'
            ) {
                categoryFilter = val;
            }
        }
    }

    function selectSeverity(severity: InfringementSeverity | 'all'): void {
        severityFilter = severity;
    }

    // Formats count suffix for filter chip labels matching other record screens.
    const columns = $derived([
        { cell: severityCell, id: 'severity', label: translationService.translate('compliance.colSeverity') },
        { cell: titleCell, id: 'title', label: translationService.translate('compliance.colTitle') },
        {
            cell: categoryCell,
            id: 'category',
            label: translationService.translate('compliance.colCategory'),
            priority: 'low' as const,
        },
        { cell: legalCell, id: 'legal', label: translationService.translate('compliance.colLegal') },
        { cell: allowedCell, id: 'allowed', label: translationService.translate('compliance.colAllowed') },
        { cell: measuredCell, id: 'measured', label: translationService.translate('compliance.colMeasured') },
        { cell: excessCell, id: 'excess', label: translationService.translate('compliance.colExcess') },
        {
            compact: true,
            cell: sourceCell,
            id: 'source',
            label: translationService.translate('compliance.colSource'),
            priority: 'low' as const,
        },
    ]);

    const tableLabels = $derived(createComplianceDataTableLabels(translationService));
</script>

{#snippet severityCell(row: IInfringementViewModel)}
    <span class="severity-badge" data-severity={row.severity}>
        {#if row.severity === 'mostSerious'}
            <Icon name="octagonAlert" size="small" />
        {:else if row.severity === 'verySerious'}
            <Icon name="circleAlert" size="small" />
        {:else if row.severity === 'serious'}
            <Icon name="triangleAlert" size="small" />
        {:else}
            <Icon name="circleHelp" size="small" />
        {/if}
        <span>{row.severityDisplay}</span>
    </span>
{/snippet}

{#snippet titleCell(row: IInfringementViewModel)}
    {row.title}
{/snippet}

{#snippet categoryCell(row: IInfringementViewModel)}
    {row.categoryDisplay}
{/snippet}

{#snippet legalCell(row: IInfringementViewModel)}
    {row.legalDisplay}
{/snippet}

{#snippet allowedCell(row: IInfringementViewModel)}
    {row.allowedDisplay}
{/snippet}

{#snippet measuredCell(row: IInfringementViewModel)}
    {row.measuredDisplay}
{/snippet}

{#snippet excessCell(row: IInfringementViewModel)}
    {row.excessDisplay}
{/snippet}

{#snippet sourceCell(row: IInfringementViewModel)}
    <ReferenceLink
        generation={row.generationDisplay}
        onopen={() => onopensource(row.sourcePath)}
        openLabel={translationService.translate('overview.openSource')}
        path={row.sourcePath}
    />
{/snippet}

<article class="compliance-screen" id={`compliance-section-${activeSection}`}>
    <div class="evidence-panel compliance-header">
        <ScreenHeader
            description={translationService.translate('compliance.subtitle')}
            heading={translationService.translate('navigator.section.compliance')}
        >
            {#snippet actions()}
                <Button
                    disabled={document === null || viewModel.infringements.length === 0}
                    icon="fileText"
                    label={translationService.translate('compliance.letter.button')}
                    onclick={() => exportController.openLetter()}
                    variant="secondary"
                />
                <Button
                    disabled={document === null}
                    icon="fileText"
                    label={translationService.translate('compliance.attestation.button')}
                    onclick={() => exportController.openAttestation()}
                    variant="secondary"
                />
            {/snippet}
        </ScreenHeader>
    </div>

    <ComplianceSummaryKpis summary={viewModel.summary} {translationService} />

    <section class="evidence-panel controls-panel">
        <InlineNotice label={translationService.translate('compliance.qualification')} leadingIcon="circleHelp" role="note" />

        <div class="controls-bar">
            <div class="filter-field profile-field">
                <label for="rule-profile-select">
                    {translationService.translate('compliance.regulatoryProfile')}
                </label>
                <select
                    id="rule-profile-select"
                    class="filter-select profile-select"
                    value={selectedProfile.profileId}
                    onchange={handleProfileChange}
                >
                    {#each BUILTIN_RULE_PROFILES as profile (profile.profileId)}
                        <option value={profile.profileId}>
                            {translationService.translate('compliance.profileVersion', {
                                name: translateRuleProfileName(profile.profileId, profile.name, translationService),
                                version: profile.version,
                            })}
                        </option>
                    {/each}
                </select>
                {#if selectedProfile.profileId === 'EU_MOBILITY_PACKAGE_2020'}
                    <InlineNotice
                        label={translationService.translate('compliance.mobilityPackageScopeNotice')}
                        leadingIcon="circleHelp"
                        role="note"
                    />
                {/if}
            </div>

            <div class="search-box">
                <SearchInput
                    label={translationService.translate('compliance.searchLabel')}
                    placeholder={translationService.translate('compliance.searchPlaceholder')}
                    value={searchFilter}
                    oninput={(val: string) => {
                        searchFilter = val;
                    }}
                />
            </div>

            <div class="filter-dropdowns">
                <div class="filter-field">
                    <label for="category-filter-select">
                        {translationService.translate('compliance.colCategory')}
                    </label>
                    <select
                        id="category-filter-select"
                        class="filter-select"
                        value={categoryFilter}
                        onchange={handleCategoryChange}
                    >
                        <option value="all">{translationService.translate('compliance.allCategories')}</option>
                        <option value="break">{translationService.translate('compliance.categoryBreak')}</option>
                        <option value="dailyDriving">{translationService.translate('compliance.categoryDailyDriving')}</option>
                        <option value="weeklyDriving">{translationService.translate('compliance.categoryWeeklyDriving')}</option>
                        <option value="biWeeklyDriving"
                            >{translationService.translate('compliance.categoryBiWeeklyDriving')}</option
                        >
                        <option value="dailyRest">{translationService.translate('compliance.categoryDailyRest')}</option>
                        <option value="weeklyRest">{translationService.translate('compliance.categoryWeeklyRest')}</option>
                        <option value="workingTime">{translationService.translate('compliance.categoryWorkingTime')}</option>
                        <option value="nightWork">{translationService.translate('compliance.categoryNightWork')}</option>
                        <option value="ferryDerogation"
                            >{translationService.translate('compliance.categoryFerryDerogation')}</option
                        >
                        <option value="anomaly">{translationService.translate('compliance.categoryAnomaly')}</option>
                    </select>
                </div>

                <div class="filter-field">
                    <span class="field-label">
                        {translationService.translate('compliance.colSeverity')}
                    </span>
                    <FilterChipGroup
                        ariaLabel={translationService.translate('compliance.colSeverity')}
                        onchange={selectSeverity}
                        options={[
                            {
                                count: viewModel.summary.totalInfringements,
                                label: translationService.translate('compliance.allSeverities'),
                                value: 'all',
                            },
                            {
                                count: viewModel.summary.mostSeriousCount,
                                label: translationService.translate('compliance.severityMostSerious'),
                                value: 'mostSerious',
                            },
                            {
                                count: viewModel.summary.verySeriousCount,
                                label: translationService.translate('compliance.severityVerySerious'),
                                value: 'verySerious',
                            },
                            {
                                count: viewModel.summary.seriousCount,
                                label: translationService.translate('compliance.severitySerious'),
                                value: 'serious',
                            },
                            {
                                count: viewModel.summary.minorCount,
                                label: translationService.translate('compliance.severityMinor'),
                                value: 'minor',
                            },
                        ]}
                        value={severityFilter}
                    />
                </div>

                <div class="filter-field">
                    <span class="field-label">
                        {translationService.translate('compliance.viewLabel')}
                    </span>
                    <Button
                        label={groupByArticle
                            ? translationService.translate('compliance.viewFlat')
                            : translationService.translate('compliance.groupByArticle')}
                        onclick={() => (groupByArticle = !groupByArticle)}
                        pressed={groupByArticle}
                    />
                </div>
            </div>
        </div>
    </section>

    {#if viewModel.assessments.length > 0}
        <ComplianceAssessmentsPanel assessments={viewModel.assessments} {translationService} />
    {/if}

    {#if viewModel.summary.totalInfringements === 0}
        <SectionMessage
            headingId="compliance-empty-heading"
            heading={translationService.translate('compliance.emptyTitle')}
            description={translationService.translate('compliance.emptyDescription')}
        />
    {:else if viewModel.infringements.length === 0}
        <SectionMessage
            headingId="compliance-no-results-heading"
            heading={translationService.translate('compliance.noResultsTitle')}
            description={translationService.translate('compliance.noResultsDescription', {
                count: String(viewModel.summary.totalInfringements),
            })}
        />
    {:else if groupByArticle}
        <div class="grouped-article-sections">
            {#each viewModel.groupedInfringements as group (group.article)}
                <section class="evidence-panel group-section">
                    <h3 class="article-group-heading">
                        <Icon name="layers" />
                        <span>
                            {translationService.translate('compliance.groupedHeading', {
                                article: group.article,
                                count: String(group.items.length),
                            })}
                        </span>
                    </h3>
                    <DataTable
                        labels={tableLabels}
                        caption={translationService.translate('compliance.groupedCaption', {
                            article: group.article,
                            caption: translationService.translate('compliance.tableCaption'),
                        })}
                        {columns}
                        {columnPreferencesStore}
                        hiddenColumnIds={columnVisibility.hiddenColumnIds}
                        ontogglecolumn={(columnId: string) => columnVisibility.toggle(columnId)}
                        preferenceKey="compliance.infringements"
                        rowKey={(item: IInfringementViewModel) => item.id}
                        rows={group.items}
                    />
                </section>
            {/each}
        </div>
    {:else}
        <section class="evidence-panel table-panel">
            <DataTable
                labels={tableLabels}
                caption={translationService.translate('compliance.tableCaption')}
                {columns}
                {columnPreferencesStore}
                hiddenColumnIds={columnVisibility.hiddenColumnIds}
                ontogglecolumn={(columnId: string) => columnVisibility.toggle(columnId)}
                preferenceKey="compliance.infringements"
                rowKey={(item: IInfringementViewModel) => item.id}
                rows={viewModel.infringements}
            />
        </section>
    {/if}

    {#if exportController.isLetterOpen && letterViewModel !== null}
        <DriverInfringementLetterDialog
            error={exportErrorMessage}
            {localisationService}
            model={letterViewModel}
            onclose={() => exportController.closeLetter()}
            onprint={handlePrint}
            onsaveHtml={handleSaveHtml}
            onsavePdf={handleSavePdf}
            {settingsStore}
            {translationService}
        />
    {/if}

    {#if exportController.isAttestationOpen && attestationViewModel !== null}
        <AttestationFormDialog
            error={exportErrorMessage}
            {localisationService}
            model={attestationViewModel}
            onchangeReason={(reason: AttestationReason) => exportController.setAttestationReason(reason)}
            onclose={() => exportController.closeAttestation()}
            onprint={handlePrint}
            onsaveHtml={handleSaveHtml}
            onsavePdf={handleSavePdf}
            {settingsStore}
            {translationService}
        />
    {/if}
</article>

<style>
    .compliance-screen {
        display: grid;
        gap: var(--space-shell);
    }

    .compliance-header {
        padding: var(--space-panel);
    }

    .profile-field {
        min-inline-size: var(--size-search-input-inline);
    }

    .profile-select,
    .filter-select {
        background: var(--color-surface-subtle);
        color: var(--color-text);
        border: var(--border-control);
        border-radius: var(--radius-control);
        padding: var(--space-compact) var(--space-actions);
        font-size: var(--font-size-metadata);
    }

    .controls-bar {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: var(--space-4);
    }

    .search-box {
        flex-grow: var(--layout-date-picker-fill-flex);
    }

    .filter-dropdowns {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: var(--space-4);
    }

    .filter-field {
        display: flex;
        flex-direction: column;
        gap: var(--space-compact);
    }

    .filter-field label,
    .field-label {
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
        font-weight: var(--font-weight-action);
    }

    .filter-select {
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        block-size: var(--size-control);
        padding-block: var(--space-none);
        padding-inline: var(--space-control-inline);
        background: var(--color-surface);
        border: var(--border-control);
        border-radius: var(--radius-control);
        color: var(--color-text);
        font: inherit;
        font-size: var(--font-size-body);
        line-height: normal;
    }

    .filter-select:focus-visible {
        outline: var(--border-focus);
        outline-offset: var(--space-focus-offset);
    }

    .table-panel {
        padding: var(--space-none);
        overflow: hidden;
    }

    .severity-badge {
        display: inline-flex;
        align-items: center;
        gap: var(--space-badge-gap);
        padding-block: var(--space-compact);
        padding-inline: var(--space-control-block);
        border-radius: var(--radius-chip);
        font-size: var(--font-size-badge);
        font-weight: var(--font-weight-action);
        line-height: var(--line-height-tight);
        white-space: nowrap;
    }

    .severity-badge[data-severity='mostSerious'],
    .severity-badge[data-severity='verySerious'] {
        background-color: var(--color-badge-critical-bg);
        border: var(--border-badge-critical);
        color: var(--color-danger);
    }

    .severity-badge[data-severity='serious'] {
        background-color: var(--color-badge-serious-bg);
        border: var(--border-badge-serious);
        color: var(--color-warning);
    }

    .severity-badge[data-severity='minor'] {
        background-color: var(--color-badge-minor-bg);
        border: var(--border-badge-minor);
        color: var(--color-info);
    }

    .grouped-article-sections {
        display: grid;
        gap: var(--space-section);
    }

    .group-section {
        display: grid;
        gap: var(--space-panel);
        padding: var(--space-panel);
    }

    .article-group-heading {
        display: inline-flex;
        align-items: center;
        gap: var(--space-compact);
        margin: var(--space-none);
        font-size: var(--font-size-section-heading);
        font-weight: var(--font-weight-title);
    }
</style>
