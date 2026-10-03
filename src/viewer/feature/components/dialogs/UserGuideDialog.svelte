<script lang="ts">
    import { Button, Dialog, Tabs } from '#ui';

    import { useViewerTranslationService } from '../../viewer-context.js';
    import type { IUserGuideContribution, ViewerGuideTabId } from '../../user-guide-contribution.js';

    type GuideTabId = ViewerGuideTabId;

    interface IProps {
        contributions?: readonly IUserGuideContribution[] | undefined;
        onclose: () => void;
    }

    interface IShortcutRow {
        readonly action: string;
        readonly shortcut: string;
    }

    let { contributions = [], onclose }: IProps = $props();

    const translationService = useViewerTranslationService();

    let activeTab = $state<string>('gettingStarted');

    const modifierKey = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl+';

    const defaultGuideTabItems = $derived([
        {
            icon: 'folderOpen' as const,
            id: 'gettingStarted' as const,
            label: translationService.translate('guide.tab.gettingStarted'),
        },
        {
            icon: 'layers' as const,
            id: 'features' as const,
            label: translationService.translate('guide.tab.features'),
        },
        {
            icon: 'truck' as const,
            id: 'generations' as const,
            label: translationService.translate('guide.tab.generations'),
        },
        {
            icon: 'hourglass' as const,
            id: 'timeBases' as const,
            label: translationService.translate('guide.tab.timeBases'),
        },
        {
            icon: 'circleCheck' as const,
            id: 'integrity' as const,
            label: translationService.translate('overview.integrity'),
        },
        {
            icon: 'fileText' as const,
            id: 'regulations' as const,
            label: translationService.translate('guide.tab.regulations'),
        },
        {
            icon: 'hammer' as const,
            id: 'shortcuts' as const,
            label: translationService.translate('guide.tab.shortcuts'),
        },
    ]);

    const hostTabs = $derived(
        contributions.map((contribution) => ({
            icon: contribution.icon,
            id: `host:${contribution.id}`,
            label: contribution.label,
            beforeTab: contribution.beforeTab,
        })),
    );
    const guideTabItems = $derived([
        ...defaultGuideTabItems.flatMap((tab) => [...hostTabs.filter((host) => host.beforeTab === tab.id), tab]),
        ...hostTabs.filter((host) => host.beforeTab === undefined),
    ]);

    const shortcutRows: readonly IShortcutRow[] = $derived([
        {
            action: translationService.translate('command.file.open'),
            shortcut: `${modifierKey}O`,
        },
        {
            action: translationService.translate('command.view.commandPalette'),
            shortcut: `${modifierKey}K`,
        },
        {
            action: translationService.translate('command.file.export'),
            shortcut: `${modifierKey}⇧E`,
        },
        {
            action: translationService.translate('command.application.preferences'),
            shortcut: `${modifierKey},`,
        },
        {
            action: translationService.translate('command.application.userGuide'),
            shortcut: 'F1',
        },
        {
            action: translationService.translate('command.file.close'),
            shortcut: `${modifierKey}W`,
        },
        {
            action: translationService.translate('guide.shortcuts.closeDialog'),
            shortcut: 'Esc',
        },
    ]);

    const GUIDE_TAB_IDS: readonly GuideTabId[] = [
        'gettingStarted',
        'features',
        'generations',
        'timeBases',
        'integrity',
        'regulations',
        'shortcuts',
    ];

    function isGuideTabId(id: string): id is GuideTabId {
        return (GUIDE_TAB_IDS as readonly string[]).includes(id);
    }

    function selectTab(id: string): void {
        if (isGuideTabId(id) || contributions.some((contribution) => `host:${contribution.id}` === id)) {
            activeTab = id;
        }
    }
</script>

{#snippet descriptionCard(title: string, description: string)}
    <article class="handbook-card">
        <h3>{title}</h3>
        <p>{description}</p>
    </article>
{/snippet}

{#snippet ruleCard(title: string, items: readonly string[])}
    <article class="handbook-card">
        <h3>{title}</h3>
        <ul class="guide-list">
            {#each items as item (item)}
                <li>{item}</li>
            {/each}
        </ul>
    </article>
{/snippet}

{#snippet actions()}
    <Button label={translationService.translate('guide.close')} onclick={onclose} variant="primary" />
{/snippet}

<Dialog {actions} {onclose} size="large" title={translationService.translate('guide.title')} titleId="user-guide-dialog-title">
    <Tabs
        items={guideTabItems}
        label={translationService.translate('guide.title')}
        onselect={selectTab}
        orientation="vertical"
        selectedId={activeTab}
    >
        {#snippet panel(tabId)}
            {#if tabId === 'gettingStarted'}
                <div class="handbook-section">
                    <header class="handbook-header">
                        <h2>{translationService.translate('guide.tab.gettingStarted')}</h2>
                        <p class="handbook-intro">{translationService.translate('guide.start.intro')}</p>
                    </header>
                    <div class="handbook-card-stack">
                        {@render descriptionCard(
                            translationService.translate('command.file.open'),
                            translationService.translate('guide.start.openDesc'),
                        )}
                        {@render descriptionCard(
                            translationService.translate('guide.start.filesTitle'),
                            translationService.translate('guide.start.filesDesc'),
                        )}
                        {@render descriptionCard(
                            translationService.translate('preferences.tab.filesPrivacy'),
                            translationService.translate('guide.start.privacyDesc'),
                        )}
                    </div>
                </div>
            {:else if tabId === 'features'}
                <div class="handbook-section">
                    <header class="handbook-header">
                        <h2>{translationService.translate('guide.features.heading')}</h2>
                        <p class="handbook-intro">
                            {translationService.translate('guide.features.intro')}
                        </p>
                    </header>

                    <div class="handbook-card-stack">
                        <article class="handbook-card">
                            <h3>
                                {translationService.translate('guide.features.overviewTitle')}
                            </h3>
                            <p>{translationService.translate('guide.features.overviewDesc')}</p>
                        </article>

                        <article class="handbook-card">
                            <h3>
                                {translationService.translate('guide.features.activitiesTitle')}
                            </h3>
                            <p>{translationService.translate('guide.features.activitiesDesc')}</p>
                        </article>

                        <article class="handbook-card">
                            <h3>
                                {translationService.translate('guide.features.associationsTitle')}
                            </h3>
                            <p>{translationService.translate('guide.features.associationsDesc')}</p>
                        </article>

                        <article class="handbook-card">
                            <h3>{translationService.translate('guide.features.speedTitle')}</h3>
                            <p>{translationService.translate('guide.features.speedDesc')}</p>
                        </article>

                        <article class="handbook-card">
                            <h3>{translationService.translate('guide.features.placesTitle')}</h3>
                            <p>{translationService.translate('guide.features.placesDesc')}</p>
                        </article>

                        <article class="handbook-card">
                            <h3>{translationService.translate('guide.features.eventsTitle')}</h3>
                            <p>{translationService.translate('guide.features.eventsDesc')}</p>
                        </article>

                        <article class="handbook-card">
                            <h3>{translationService.translate('guide.features.technicalTitle')}</h3>
                            <p>{translationService.translate('guide.features.technicalDesc')}</p>
                        </article>

                        <article class="handbook-card">
                            <h3>
                                {translationService.translate('guide.features.complianceTitle')}
                            </h3>
                            <p>{translationService.translate('guide.features.complianceDesc')}</p>
                        </article>

                        <article class="handbook-card">
                            <h3>{translationService.translate('guide.features.rawTitle')}</h3>
                            <p>{translationService.translate('guide.features.rawDesc')}</p>
                        </article>
                    </div>
                </div>
            {:else if tabId === 'generations'}
                <div class="handbook-section">
                    <header class="handbook-header">
                        <h2>{translationService.translate('guide.generations.heading')}</h2>
                        <p class="handbook-intro">
                            {translationService.translate('guide.generations.intro')}
                        </p>
                    </header>

                    <div class="handbook-card-stack">
                        <article class="handbook-card">
                            <div class="card-badge-row">
                                <span class="card-tag">
                                    {translationService.translate('guide.generations.tagAnnex1b')}
                                </span>
                                <h3>{translationService.translate('guide.generations.g1Title')}</h3>
                            </div>
                            <p>{translationService.translate('guide.generations.g1Desc')}</p>
                        </article>

                        <article class="handbook-card">
                            <div class="card-badge-row">
                                <span class="card-tag accent">
                                    {translationService.translate('guide.generations.tagAnnex1c')}
                                </span>
                                <h3>{translationService.translate('guide.generations.g2Title')}</h3>
                            </div>
                            <p>{translationService.translate('guide.generations.g2Desc')}</p>
                        </article>

                        <article class="handbook-card">
                            <div class="card-badge-row">
                                <span class="card-tag highlight">
                                    {translationService.translate('guide.generations.tagSmart2')}
                                </span>
                                <h3>
                                    {translationService.translate('guide.generations.g2v2Title')}
                                </h3>
                            </div>
                            <p>{translationService.translate('guide.generations.g2v2Desc')}</p>
                        </article>
                    </div>
                </div>
            {:else if tabId === 'timeBases'}
                <div class="handbook-section">
                    <header class="handbook-header">
                        <h2>{translationService.translate('guide.timeBases.heading')}</h2>
                        <p class="handbook-intro">
                            {translationService.translate('guide.timeBases.intro')}
                        </p>
                    </header>

                    <div class="handbook-card-stack">
                        <article class="handbook-card">
                            <h3>{translationService.translate('guide.timeBases.utcTitle')}</h3>
                            <p>{translationService.translate('guide.timeBases.utcDesc')}</p>
                        </article>

                        <article class="handbook-card">
                            <h3>{translationService.translate('guide.timeBases.localTitle')}</h3>
                            <p>{translationService.translate('guide.timeBases.localDesc')}</p>
                        </article>

                        <article class="handbook-card">
                            <h3>{translationService.translate('guide.timeBases.shiftTitle')}</h3>
                            <p>{translationService.translate('guide.timeBases.shiftDesc')}</p>
                        </article>
                    </div>
                </div>
            {:else if tabId === 'integrity'}
                <div class="handbook-section">
                    <header class="handbook-header">
                        <h2>{translationService.translate('guide.integrity.heading')}</h2>
                        <p class="handbook-intro">
                            {translationService.translate('guide.integrity.intro')}
                        </p>
                    </header>

                    <div class="handbook-card-stack">
                        <article class="handbook-card">
                            <h3>{translationService.translate('guide.integrity.statusesTitle')}</h3>
                            <ul class="guide-list">
                                <li>{translationService.translate('guide.integrity.validDesc')}</li>
                                <li>
                                    {translationService.translate('guide.integrity.partiallyValidDesc')}
                                </li>
                                <li>
                                    {translationService.translate('guide.integrity.invalidDesc')}
                                </li>
                                <li>
                                    {translationService.translate('guide.integrity.notCheckedDesc')}
                                </li>
                                <li>
                                    {translationService.translate('guide.integrity.unsupportedDesc')}
                                </li>
                            </ul>
                        </article>

                        <article class="handbook-card">
                            <h3>{translationService.translate('guide.integrity.combinedTitle')}</h3>
                            <p>{translationService.translate('guide.integrity.combinedDesc')}</p>
                        </article>

                        <article class="handbook-card">
                            <h3>{translationService.translate('guide.integrity.vuChainTitle')}</h3>
                            <p>{translationService.translate('guide.integrity.vuChainDesc')}</p>
                        </article>
                    </div>
                </div>
            {:else if tabId === 'regulations'}
                <div class="handbook-section">
                    <header class="handbook-header">
                        <h2>{translationService.translate('guide.regulations.heading')}</h2>
                        <p class="handbook-intro">
                            {translationService.translate('guide.regulations.intro')}
                        </p>
                    </header>

                    <div class="handbook-card-stack">
                        {@render ruleCard(translationService.translate('guide.regulations.ec561Title'), [
                            translationService.translate('guide.regulations.continuousDriving'),
                            translationService.translate('guide.regulations.dailyDriving'),
                            translationService.translate('guide.regulations.weeklyDriving'),
                            translationService.translate('guide.regulations.dailyRest'),
                            translationService.translate('guide.regulations.dailyPeriod'),
                            translationService.translate('guide.regulations.weeklyRest'),
                            translationService.translate('guide.regulations.weekBoundary'),
                            translationService.translate('guide.regulations.ferryTrain'),
                        ])}
                        {@render ruleCard(translationService.translate('guide.regulations.mobilityTitle'), [
                            translationService.translate('guide.regulations.mobilityReview'),
                            translationService.translate('guide.regulations.mobilityLimits'),
                        ])}
                        {@render ruleCard(translationService.translate('guide.regulations.multiManningTitle'), [
                            translationService.translate('guide.regulations.multiManningCrew'),
                            translationService.translate('guide.regulations.multiManningRest'),
                            translationService.translate('guide.regulations.multiManningReduced'),
                            translationService.translate('guide.regulations.multiManningBreak'),
                        ])}
                        {@render ruleCard(translationService.translate('guide.regulations.workingTimeTitle'), [
                            translationService.translate('guide.regulations.workingTimeWeekly'),
                            translationService.translate('guide.regulations.workingTimeBreaks'),
                            translationService.translate('guide.regulations.workingTimeNight'),
                            translationService.translate('guide.regulations.workingTimeProfile'),
                        ])}
                        {@render ruleCard(translationService.translate('guide.regulations.eu581Title'), [
                            translationService.translate('guide.regulations.driverCardDeadline'),
                            translationService.translate('guide.regulations.vehicleUnitDeadline'),
                            translationService.translate('guide.regulations.downloadBasis'),
                        ])}
                        {@render ruleCard(translationService.translate('guide.regulations.anomaliesTitle'), [
                            translationService.translate('guide.regulations.anomalyNoCard'),
                            translationService.translate('guide.regulations.anomalyMotion'),
                        ])}
                        {@render ruleCard(translationService.translate('guide.regulations.severityTitle'), [
                            translationService.translate('guide.regulations.severityBands'),
                            translationService.translate('guide.regulations.severityOther'),
                        ])}
                        {@render ruleCard(translationService.translate('guide.regulations.profilesTitle'), [
                            translationService.translate('guide.regulations.profileEu'),
                            translationService.translate('guide.regulations.profileMobility'),
                            translationService.translate('guide.regulations.profileAetr'),
                            translationService.translate('guide.regulations.profileUk'),
                            translationService.translate('guide.regulations.profileWorkingTime'),
                        ])}
                        {@render ruleCard(translationService.translate('guide.regulations.limitsTitle'), [
                            translationService.translate('guide.regulations.limitMultiManning'),
                            translationService.translate('guide.regulations.limitEvidence'),
                            translationService.translate('guide.regulations.limitManual'),
                            translationService.translate('guide.regulations.limitUnrecorded'),
                            translationService.translate('guide.regulations.limitLegal'),
                            translationService.translate('guide.regulations.limitTime'),
                            translationService.translate('guide.regulations.limitPartialWeeks'),
                            translationService.translate('guide.regulations.limitSeverity'),
                        ])}
                    </div>
                </div>
            {:else if tabId === 'shortcuts'}
                <div class="handbook-section">
                    <header class="handbook-header">
                        <h2>{translationService.translate('guide.shortcuts.heading')}</h2>
                        <p class="handbook-intro">
                            {translationService.translate('guide.shortcuts.intro')}
                        </p>
                    </header>

                    <table class="shortcuts-table">
                        <thead>
                            <tr>
                                <th scope="col">{translationService.translate('guide.shortcuts.colShortcut')}</th>
                                <th scope="col">{translationService.translate('guide.shortcuts.colAction')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each shortcutRows as row (row.action)}
                                <tr>
                                    <td><kbd>{row.shortcut}</kbd></td>
                                    <td>{row.action}</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            {:else}
                {@const contribution = contributions.find((candidate) => `host:${candidate.id}` === tabId)}
                {#if contribution !== undefined}
                    <div class="handbook-section">
                        {@render contribution.content()}
                    </div>
                {/if}
            {/if}
        {/snippet}
    </Tabs>
</Dialog>

<style>
    .card-badge-row {
        display: flex;
        align-items: center;
        gap: var(--space-compact);
        margin-block-end: var(--space-compact);
    }

    .card-tag {
        font-size: var(--font-size-metadata);
        font-weight: var(--font-weight-action);
        padding-block: var(--space-none);
        padding-inline: var(--space-compact);
        border-radius: var(--radius-chip);
        background: var(--color-surface);
        border: var(--border-control);
        color: var(--color-text-muted);
    }

    .card-tag.accent {
        background: var(--color-surface-hover);
        color: var(--color-accent);
    }

    .card-tag.highlight {
        background: var(--color-accent-soft);
        color: var(--color-accent);
    }

    .guide-list {
        margin: var(--space-none);
        padding-inline-start: var(--space-section);
        display: flex;
        flex-direction: column;
        gap: var(--space-actions);
        margin-block-start: var(--space-actions);
        font-size: var(--font-size-metadata);
        color: var(--color-text-muted);
        line-height: var(--line-height-body);
    }

    .shortcuts-table {
        inline-size: var(--size-full);
        border-collapse: collapse;
        font-size: var(--font-size-metadata);
    }

    .shortcuts-table th,
    .shortcuts-table td {
        padding-block: var(--space-compact);
        padding-inline: var(--space-actions);
        text-align: start;
        border-block-end: var(--border-region);
    }

    .shortcuts-table th {
        color: var(--color-text-muted);
        font-weight: var(--font-weight-action);
        background: var(--color-surface-subtle);
    }

    kbd {
        display: inline-block;
        padding-block: var(--padding-kbd-block);
        padding-inline: var(--space-compact);
        font-family: var(--font-family-source);
        font-size: var(--font-size-metadata);
        background: var(--color-surface);
        border: var(--border-control);
        border-radius: var(--radius-chip);
        box-shadow: var(--shadow-dialog);
    }
</style>
