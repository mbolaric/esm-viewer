<script lang="ts">
    import {
        NIGHT_WORK_WINDOW_LATEST_END_HOUR,
        NIGHT_WORK_WINDOW_MINIMUM_HOURS,
        type DensityPreference,
        type IViewerPreferences,
        type ThemePreference,
    } from '#contracts';
    import {
        defaultDateFormatForLocale,
        defaultDateFormatForTimeZone,
        defaultTimeFormatForLocale,
        defaultTimeFormatForTimeZone,
        isDateFormatKey,
        isTimeFormatKey,
        type DateFormatKey,
        type TimeFormatKey,
    } from '#localization';
    import { Button, Checkbox, Dialog, InlineError, Tabs } from '#ui';
    import { untrack } from 'svelte';

    import { isViewerLocale, type ViewerLocale } from '#i18n-locales';
    import { useViewerTranslationService } from '../../viewer-context.js';
    import type { IViewerPreferencesContribution, ViewerPreferencesTabId } from '../../user-guide-contribution.js';

    interface IProps {
        contributions?: readonly IViewerPreferencesContribution[] | undefined;
        availableNightWorkTimeZones: readonly string[];
        availableTimeZones: readonly string[];
        loadWarning: boolean;
        onapply: (preferences: IViewerPreferences) => void;
        oncancel: () => void;
        preferences: IViewerPreferences;
        saveError: boolean;
        saving: boolean;
    }

    let {
        contributions = [],
        availableNightWorkTimeZones,
        availableTimeZones,
        loadWarning,
        onapply,
        oncancel,
        preferences,
        saveError,
        saving,
    }: IProps = $props();

    const translationService = useViewerTranslationService();

    const PREFERENCES_TAB_IDS: readonly ViewerPreferencesTabId[] = [
        'general',
        'dateTime',
        'nightWork',
        'filesPrivacy',
        'appearance',
    ];

    function isPreferencesTabId(id: string): id is ViewerPreferencesTabId {
        return (PREFERENCES_TAB_IDS as readonly string[]).includes(id);
    }

    let activeTab = $state<string>('general');

    function selectTab(id: string): void {
        if (isPreferencesTabId(id) || contributions.some((contribution) => `host:${contribution.id}` === id)) {
            activeTab = id;
        }
    }

    const preferencesTabItems = $derived([
        {
            icon: 'circleGauge' as const,
            id: 'general' as const,
            label: translationService.translate('preferences.tab.general'),
        },
        {
            icon: 'hourglass' as const,
            id: 'dateTime' as const,
            label: translationService.translate('preferences.tab.dateTime'),
        },
        {
            icon: 'bed' as const,
            id: 'nightWork' as const,
            label: translationService.translate('preferences.tab.nightWork'),
        },
        {
            icon: 'folderOpen' as const,
            id: 'filesPrivacy' as const,
            label: translationService.translate('preferences.tab.filesPrivacy'),
        },
        {
            icon: 'columns' as const,
            id: 'appearance' as const,
            label: translationService.translate('preferences.tab.appearance'),
        },
        ...contributions
            .filter((contribution) => contribution.targetTab === undefined)
            .map((contribution) => ({
                icon: contribution.icon,
                id: `host:${contribution.id}`,
                label: contribution.label,
            })),
    ]);

    interface IPreferencesDraft {
        density: DensityPreference;
        displayDateFormat: DateFormatKey;
        displayTimeFormat: TimeFormatKey;
        displayTimeZone: string;
        locale: ViewerLocale;
        nightWorkEndHour: number;
        nightWorkStartHour: number;
        nightWorkTimeZone: string;
        recentFilesEnabled: boolean;
        recentFilePathsEnabled: boolean;
        theme: ThemePreference;
        verificationAutoRun: boolean;
    }

    function createPreferencesDraft(source: IViewerPreferences): IPreferencesDraft {
        const storedDateFormat = source.displayDateFormat;
        const storedTimeFormat = source.displayTimeFormat;
        return {
            density: source.density,
            displayDateFormat:
                isDateFormatKey(storedDateFormat) && storedDateFormat !== 'auto'
                    ? storedDateFormat
                    : defaultDateFormatForTimeZone(source.displayTimeZone),
            displayTimeFormat:
                isTimeFormatKey(storedTimeFormat) && storedTimeFormat !== 'auto'
                    ? storedTimeFormat
                    : defaultTimeFormatForTimeZone(source.displayTimeZone),
            displayTimeZone: source.displayTimeZone,
            locale: isViewerLocale(source.locale) ? source.locale : 'en',
            nightWorkEndHour: source.nightWorkEndHour,
            nightWorkStartHour: source.nightWorkStartHour,
            nightWorkTimeZone: source.nightWorkTimeZone,
            recentFilesEnabled: source.recentFilesEnabled,
            recentFilePathsEnabled: source.recentFilePathsEnabled,
            theme: source.theme,
            verificationAutoRun: source.verificationAutoRun,
        };
    }

    // Tracks if explicit format was chosen vs. 'auto' sentinel; controls whether applyPreferences submits draft format or 'auto'.
    let dateFormatTouched = $state(
        untrack(() => isDateFormatKey(preferences.displayDateFormat) && preferences.displayDateFormat !== 'auto'),
    );
    let timeFormatTouched = $state(
        untrack(() => isTimeFormatKey(preferences.displayTimeFormat) && preferences.displayTimeFormat !== 'auto'),
    );
    let draft = $state<IPreferencesDraft>(untrack(() => createPreferencesDraft(preferences)));
    // Directive 2002/15/EC Art. 3(h): the window lies between 00:00 and 07:00 and lasts at least four hours.
    const nightWorkStartHourOptions = Array.from(
        { length: NIGHT_WORK_WINDOW_LATEST_END_HOUR - NIGHT_WORK_WINDOW_MINIMUM_HOURS + 1 },
        (_, hour) => hour,
    );
    const nightWorkEndHourOptions = $derived(
        Array.from(
            { length: NIGHT_WORK_WINDOW_LATEST_END_HOUR - draft.nightWorkStartHour - NIGHT_WORK_WINDOW_MINIMUM_HOURS + 1 },
            (_, offset) => draft.nightWorkStartHour + NIGHT_WORK_WINDOW_MINIMUM_HOURS + offset,
        ),
    );

    // A later start can leave the chosen end too early; move it to the shortest valid window instead.
    function setNightWorkStartHour(hour: number): void {
        draft.nightWorkStartHour = hour;
        draft.nightWorkEndHour = Math.max(draft.nightWorkEndHour, hour + NIGHT_WORK_WINDOW_MINIMUM_HOURS);
    }

    function applyPreferences(): void {
        onapply({
            ...preferences,
            ...draft,
            displayDateFormat: dateFormatTouched ? draft.displayDateFormat : 'auto',
            displayTimeFormat: timeFormatTouched ? draft.displayTimeFormat : 'auto',
            // Disabling history clears remembered files immediately.
            recentFiles: draft.recentFilesEnabled ? preferences.recentFiles : [],
        });
    }

    function handleTimeZoneChange(event: Event): void {
        const target = event.currentTarget;
        if (!(target instanceof HTMLSelectElement)) {
            return;
        }
        draft.displayTimeZone = target.value;
        if (!dateFormatTouched) {
            draft.displayDateFormat = defaultDateFormatForTimeZone(draft.displayTimeZone);
        }
        if (!timeFormatTouched) {
            draft.displayTimeFormat = defaultTimeFormatForTimeZone(draft.displayTimeZone);
        }
    }

    function handleLocaleChange(event: Event): void {
        const target = event.currentTarget;
        if (!(target instanceof HTMLSelectElement) || !isViewerLocale(target.value)) {
            return;
        }
        draft.locale = target.value;
        if (!dateFormatTouched) {
            draft.displayDateFormat = defaultDateFormatForLocale(draft.locale);
        }
        if (!timeFormatTouched) {
            draft.displayTimeFormat = defaultTimeFormatForLocale(draft.locale);
        }
    }

    function handleSubmit(event: SubmitEvent): void {
        event.preventDefault();
        if (!saving) {
            applyPreferences();
        }
    }
</script>

{#snippet actions()}
    <Button disabled={saving} label={translationService.translate('opening.cancel')} onclick={oncancel} />
    <Button
        disabled={saving || contributions.some((contribution) => contribution.canApply?.() === false)}
        label={saving ? translationService.translate('preferences.saving') : translationService.translate('preferences.apply')}
        onclick={applyPreferences}
        variant="primary"
    />
{/snippet}

<Dialog
    {actions}
    onclose={oncancel}
    size="large"
    title={translationService.translate('preferences.heading')}
    titleId="preferences-dialog-title"
>
    <form class="preferences-form" onsubmit={handleSubmit}>
        {#if loadWarning}
            <p class="warning" role="status">
                {translationService.translate('preferences.loadWarning')}
            </p>
        {/if}
        {#if saveError}
            <InlineError message={translationService.translate('preferences.saveError')} />
        {/if}

        <Tabs
            items={preferencesTabItems}
            label={translationService.translate('preferences.heading')}
            onselect={selectTab}
            orientation="vertical"
            selectedId={activeTab}
        >
            {#snippet panel(tabId)}
                <div class="preferences-section">
                    {#if tabId === 'general'}
                        <label class="preferences-field">
                            <span class="preferences-field-label">
                                {translationService.translate('preferences.language')}
                            </span>
                            <select onchange={handleLocaleChange} value={draft.locale} disabled={saving}>
                                <option value="en">
                                    {translationService.translate('preferences.language.english')}
                                </option>
                                <option value="de">
                                    {translationService.translate('preferences.language.german')}
                                </option>
                                <option value="fr">
                                    {translationService.translate('preferences.language.french')}
                                </option>
                                <option value="it">
                                    {translationService.translate('preferences.language.italian')}
                                </option>
                                <option value="pl">
                                    {translationService.translate('preferences.language.polish')}
                                </option>
                                <option value="es">
                                    {translationService.translate('preferences.language.spanish')}
                                </option>
                                <option value="hr">
                                    {translationService.translate('preferences.language.croatian')}
                                </option>
                            </select>
                        </label>

                        <label class="preferences-field">
                            <span class="preferences-field-label">
                                {translationService.translate('preferences.theme')}
                            </span>
                            <select bind:value={draft.theme} disabled={saving}>
                                <option value="system">
                                    {translationService.translate('preferences.theme.system')}
                                </option>
                                <option value="light">
                                    {translationService.translate('preferences.theme.light')}
                                </option>
                                <option value="dark">
                                    {translationService.translate('preferences.theme.dark')}
                                </option>
                            </select>
                        </label>

                        <label class="preferences-field">
                            <span class="preferences-field-label">
                                {translationService.translate('preferences.verificationAutoRun')}
                            </span>
                            <Checkbox
                                checked={draft.verificationAutoRun}
                                disabled={saving}
                                onchange={(value: boolean) => {
                                    draft.verificationAutoRun = value;
                                }}
                            />
                        </label>
                    {:else if tabId === 'dateTime'}
                        <label class="preferences-field">
                            <span class="preferences-field-label">
                                {translationService.translate('preferences.timeDisplay')}
                            </span>
                            <select onchange={handleTimeZoneChange} value={draft.displayTimeZone} disabled={saving}>
                                {#each availableTimeZones as timeZone (timeZone)}
                                    <option value={timeZone}>{timeZone}</option>
                                {/each}
                            </select>
                        </label>

                        <label class="preferences-field">
                            <span class="preferences-field-label">
                                {translationService.translate('preferences.timeDisplay.dateFormat')}
                            </span>
                            <select
                                bind:value={draft.displayDateFormat}
                                disabled={saving}
                                onchange={() => {
                                    dateFormatTouched = true;
                                }}
                            >
                                <option value="ddMMyyyy">
                                    {translationService.translate('preferences.timeDisplay.dateFormat.ddMMyyyy')}
                                </option>
                                <option value="MMddyyyy">
                                    {translationService.translate('preferences.timeDisplay.dateFormat.MMddyyyy')}
                                </option>
                                <option value="yyyyMMdd">
                                    {translationService.translate('preferences.timeDisplay.dateFormat.yyyyMMdd')}
                                </option>
                                <option value="mediumDate">
                                    {translationService.translate('preferences.timeDisplay.dateFormat.mediumDate')}
                                </option>
                            </select>
                        </label>

                        <label class="preferences-field">
                            <span class="preferences-field-label">
                                {translationService.translate('preferences.timeDisplay.timeFormat')}
                            </span>
                            <select
                                bind:value={draft.displayTimeFormat}
                                disabled={saving}
                                onchange={() => {
                                    timeFormatTouched = true;
                                }}
                            >
                                <option value="h23">
                                    {translationService.translate('preferences.timeDisplay.timeFormat.h23')}
                                </option>
                                <option value="h12">
                                    {translationService.translate('preferences.timeDisplay.timeFormat.h12')}
                                </option>
                            </select>
                        </label>
                    {:else if tabId === 'nightWork'}
                        <p class="hint">
                            {translationService.translate('preferences.nightWork.hint')}
                        </p>

                        <label class="preferences-field">
                            <span class="preferences-field-label">
                                {translationService.translate('preferences.nightWork.timeZone')}
                            </span>
                            <select bind:value={draft.nightWorkTimeZone} disabled={saving}>
                                {#each availableNightWorkTimeZones as timeZone (timeZone)}
                                    <option value={timeZone}>{timeZone}</option>
                                {/each}
                            </select>
                        </label>

                        <label class="preferences-field">
                            <span class="preferences-field-label">
                                {translationService.translate('preferences.nightWork.startHour')}
                            </span>
                            <select bind:value={() => draft.nightWorkStartHour, setNightWorkStartHour} disabled={saving}>
                                {#each nightWorkStartHourOptions as hour (hour)}
                                    <option value={hour}>{hour}</option>
                                {/each}
                            </select>
                        </label>

                        <label class="preferences-field">
                            <span class="preferences-field-label">
                                {translationService.translate('preferences.nightWork.endHour')}
                            </span>
                            <select bind:value={draft.nightWorkEndHour} disabled={saving}>
                                {#each nightWorkEndHourOptions as hour (hour)}
                                    <option value={hour}>{hour}</option>
                                {/each}
                            </select>
                        </label>
                    {:else if tabId === 'filesPrivacy'}
                        <label class="preferences-field">
                            <span class="preferences-field-label">
                                {translationService.translate('preferences.recentFilePathsEnabled')}
                            </span>
                            <Checkbox
                                checked={draft.recentFilePathsEnabled}
                                disabled={saving}
                                onchange={(value: boolean) => {
                                    draft.recentFilePathsEnabled = value;
                                }}
                            />
                        </label>

                        <label class="preferences-field">
                            <span class="preferences-field-label">
                                {translationService.translate('preferences.recentFilesEnabled')}
                            </span>
                            <Checkbox
                                checked={draft.recentFilesEnabled}
                                disabled={saving}
                                onchange={(value: boolean) => {
                                    draft.recentFilesEnabled = value;
                                }}
                            />
                        </label>
                    {:else if tabId === 'appearance'}
                        <div aria-labelledby="preferences-density-heading" class="preferences-field" role="radiogroup">
                            <span class="preferences-field-label" id="preferences-density-heading">
                                {translationService.translate('preferences.density')}
                            </span>
                            <div class="radio-options">
                                <label>
                                    <input bind:group={draft.density} disabled={saving} type="radio" value="compact" />
                                    <span>
                                        {translationService.translate('preferences.density.compact')}
                                    </span>
                                </label>
                                <label>
                                    <input bind:group={draft.density} disabled={saving} type="radio" value="comfortable" />
                                    <span>
                                        {translationService.translate('preferences.density.comfortable')}
                                    </span>
                                </label>
                            </div>
                        </div>
                        <fieldset class="preview-field" disabled={saving}>
                            <legend>{translationService.translate('preferences.density.preview')}</legend>
                            <div class="density-preview">
                                <div class="preview-panel" data-density="compact">
                                    <span class="preview-heading">
                                        {translationService.translate('preferences.density.compact')}
                                    </span>
                                    <input
                                        class="viewer-input"
                                        readonly
                                        tabindex="-1"
                                        value={translationService.translate('preferences.density.compact')}
                                    />
                                    <div class="preview-row">
                                        <span>
                                            {translationService.translate('preferences.density.compact')}
                                        </span>
                                        <input
                                            class="viewer-input"
                                            readonly
                                            tabindex="-1"
                                            value={translationService.translate('preferences.density.compact')}
                                        />
                                    </div>
                                </div>
                                <div class="preview-panel" data-density="comfortable">
                                    <span class="preview-heading">
                                        {translationService.translate('preferences.density.comfortable')}
                                    </span>
                                    <input
                                        class="viewer-input"
                                        readonly
                                        tabindex="-1"
                                        value={translationService.translate('preferences.density.comfortable')}
                                    />
                                    <div class="preview-row">
                                        <span>
                                            {translationService.translate('preferences.density.comfortable')}
                                        </span>
                                        <input
                                            class="viewer-input"
                                            readonly
                                            tabindex="-1"
                                            value={translationService.translate('preferences.density.comfortable')}
                                        />
                                    </div>
                                </div>
                            </div>
                        </fieldset>
                    {:else}
                        {@const contribution = contributions.find((candidate) => `host:${candidate.id}` === tabId)}
                        {#if contribution !== undefined}
                            <fieldset class="preview-field" disabled={saving}>
                                <legend>{contribution.label}</legend>
                                {@render contribution.content()}
                            </fieldset>
                        {/if}
                    {/if}
                    {#each contributions.filter((contribution) => contribution.targetTab === tabId) as contribution (contribution.id)}
                        <fieldset class="contributed-preferences" disabled={saving} aria-label={contribution.label}>
                            {@render contribution.content()}
                        </fieldset>
                    {/each}
                </div>
            {/snippet}
        </Tabs>
    </form>
</Dialog>

<style>
    .contributed-preferences {
        min-inline-size: var(--space-none);
        margin: var(--space-none);
        padding: var(--space-none);
        border: none;
    }

    .preferences-form {
        display: flex;
        flex-direction: column;
        gap: var(--space-stack);
        block-size: var(--size-full);
        min-block-size: var(--space-none);
    }

    .preferences-form :global(.tabs) {
        flex: var(--layout-dialog-content-flex);
        min-block-size: var(--space-none);
    }

    /* Prevents vertical tab panel from stretching and inflating field rows. */
    .preferences-section {
        display: flex;
        flex-direction: column;
        gap: var(--space-none);
    }

    legend {
        min-inline-size: var(--space-none);
        overflow-wrap: break-word;
        font-weight: var(--font-weight-action);
    }

    select {
        min-block-size: var(--size-control);
        padding-block: var(--space-control-block);
        padding-inline: var(--space-control-inline);
        background: var(--color-surface);
        border: var(--border-control);
        border-radius: var(--radius-control);
        color: var(--color-text);
        font: inherit;
    }

    select:hover:not(:disabled) {
        border-color: var(--color-accent);
    }

    fieldset {
        display: grid;
        padding-block: var(--space-stack);
        padding-inline: var(--space-none);
        gap: var(--space-stack);
        border: none;
        margin: var(--space-none);
    }

    .radio-options {
        display: flex;
        flex-wrap: nowrap;
        gap: var(--space-actions);
    }

    .radio-options label {
        display: flex;
        min-block-size: var(--size-control);
        align-items: center;
        gap: var(--space-control-block);
        padding-inline: var(--space-control-inline);
        background: var(--color-surface-subtle);
        border: var(--border-panel);
        border-radius: var(--radius-control);
    }

    .preview-field {
        display: grid;
        gap: var(--space-stack);
        margin-block-start: var(--space-stack);
    }

    .density-preview {
        display: grid;
        gap: var(--space-actions);
        grid-template-columns: var(--layout-preferences-density-preview-columns);
    }

    .preview-panel {
        display: grid;
        align-content: start;
        gap: var(--space-stack);
        padding: var(--space-panel);
        background: var(--color-surface);
        border: var(--border-panel);
        border-radius: var(--radius-control);
    }

    .preview-heading {
        font-weight: var(--font-weight-action);
    }

    .preview-row {
        display: grid;
        align-items: start;
        gap: var(--space-compact);
    }

    .preview-row span {
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
    }

    input {
        accent-color: var(--color-accent);
    }

    .hint {
        margin: var(--space-none);
        padding-block-start: var(--space-stack);
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
    }

    .warning {
        padding: var(--space-control-inline);
        border-radius: var(--radius-control);
    }

    .warning {
        background: var(--color-accent-soft);
        color: var(--color-info);
    }
</style>
