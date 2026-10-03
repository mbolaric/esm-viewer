<script lang="ts">
    import { tick } from 'svelte';

    import { SectionMessage, Tabs, type IntervalTimelineRuntimeLoader } from '#ui';
    import type { DocumentSectionRecord } from '#viewer-application';
    import type { ActivityInterval, JsonPointer, UtcTimestamp } from '#viewer-domain';
    import type {
        ActivityLinkedSection,
        IActivityDayViewModel,
        IActivityInfringementPinViewModel,
        IActivitySectionViewModel,
    } from '#viewer-presentation';

    import ActivitiesAllDaysView from './ActivitiesAllDaysView.svelte';
    import ActivitiesCalendarView from './ActivitiesCalendarView.svelte';
    import ActivitiesDayView from './ActivitiesDayView.svelte';
    import RecordSectionLayout from '../records/RecordSectionLayout.svelte';
    import type { IDocumentScopedValue } from '../../controllers/document-scoped-value.svelte.js';
    import { useViewerTranslationService } from '../../viewer-context.js';

    type ActivitiesTab = 'allDays' | 'calendar' | 'day';

    interface IProps {
        allDaysFilterText: IDocumentScopedValue<string>;
        calendarFilterText: IDocumentScopedValue<string>;
        dayFilterText: IDocumentScopedValue<string>;
        onchartfailure: () => void;
        onclearrecord: () => void;
        onopenlinked: (section: ActivityLinkedSection, day: IActivityDayViewModel) => void;
        onopensource: (path: JsonPointer) => void;
        onselectinfringement?: ((pin: IActivityInfringementPinViewModel) => void) | undefined;
        onselectrecord: (record: ActivityInterval) => void;
        selectedRecord: DocumentSectionRecord | null;
        timelineRuntimeLoader?: IntervalTimelineRuntimeLoader | undefined;
        viewModel: IActivitySectionViewModel | null;
        requestedDayMidnight?: UtcTimestamp | null | undefined;
    }

    let {
        allDaysFilterText,
        calendarFilterText,
        dayFilterText,
        onchartfailure,
        onclearrecord,
        onopenlinked,
        onopensource,
        onselectinfringement = undefined,
        onselectrecord,
        requestedDayMidnight = undefined,
        selectedRecord,
        timelineRuntimeLoader = undefined,
        viewModel,
    }: IProps = $props();

    const translationService = useViewerTranslationService();
    let requestedDayIndex = $state<number | null>(null);
    let dateSelectionStatus = $state<'idle' | 'unavailable'>('idle');
    let activeTab = $state<ActivitiesTab>('day');

    $effect(() => {
        if (requestedDayMidnight !== null && requestedDayMidnight !== undefined && viewModel !== null) {
            chooseDateValue(requestedDayMidnight);
            activeTab = 'day';
        }
    });

    const selectedDayIndex = $derived.by(() => {
        if (viewModel === null || viewModel.days.length === 0) {
            return -1;
        }

        const latestIndex = viewModel.days.length - 1;
        return Math.min(Math.max(requestedDayIndex ?? latestIndex, 0), latestIndex);
    });
    const selectedDay = $derived<IActivityDayViewModel | null>(
        viewModel === null || selectedDayIndex < 0 ? null : (viewModel.days[selectedDayIndex] ?? null),
    );
    const minimumDate = $derived(viewModel?.days[0]?.midnightUtc ?? null);
    const maximumDate = $derived(viewModel?.days.at(-1)?.midnightUtc ?? null);
    const dayRows = $derived((viewModel?.days ?? []).map((day, index) => ({ day, index })));
    const tabItems = $derived([
        { id: 'day', label: translationService.translate('activities.tabs.day') },
        { id: 'calendar', label: translationService.translate('activities.tabs.calendar') },
        { id: 'allDays', label: translationService.translate('activities.tabs.allDays') },
    ]);

    function chooseDay(index: number): void {
        requestedDayIndex = index;
        dateSelectionStatus = 'idle';
        onclearrecord();
    }

    function chooseDateValue(value: number): void {
        if (viewModel === null) {
            return;
        }

        const matchingApplicationIndex = viewModel.days.findIndex(
            (day) => day.midnightUtc === value && day.generation === selectedDay?.generation,
        );
        const matchingIndex =
            matchingApplicationIndex >= 0
                ? matchingApplicationIndex
                : viewModel.days.findIndex((day) => day.midnightUtc === value);
        if (matchingIndex >= 0) {
            chooseDay(matchingIndex);
            return;
        }

        dateSelectionStatus = 'unavailable';
    }

    function choosePreviousDay(): void {
        if (selectedDayIndex > 0) {
            chooseDay(selectedDayIndex - 1);
        }
    }

    function chooseNextDay(): void {
        if (viewModel !== null && selectedDayIndex < viewModel.days.length - 1) {
            chooseDay(selectedDayIndex + 1);
        }
    }

    function chooseTab(tabId: string): void {
        activeTab = tabId === 'allDays' || tabId === 'calendar' ? tabId : 'day';
    }

    async function showDay(index: number): Promise<void> {
        chooseDay(index);
        activeTab = 'day';
        await tick();
        globalThis.document.getElementById('activity-date')?.focus();
    }
</script>

<RecordSectionLayout
    className="activities-screen wide-workspace"
    errorDescription={translationService.translate('activities.error')}
    errorHeading={translationService.translate('activities.errorHeading')}
    errorHeadingId="activities-error-heading"
    heading={translationService.translate('navigator.section.activities')}
    {viewModel}
>
    {#snippet content()}
        {#if selectedDay === null}
            <SectionMessage
                description={translationService.translate('activities.empty')}
                heading={translationService.translate('activities.dayHeading')}
                headingId="activities-empty-heading"
            />
        {:else if viewModel !== null}
            <Tabs
                items={tabItems}
                label={translationService.translate('activities.tabs.label')}
                onselect={chooseTab}
                selectedId={activeTab}
            >
                {#snippet panel(tabId)}
                    {#if tabId === 'allDays'}
                        <ActivitiesAllDaysView
                            days={dayRows}
                            filterText={allDaysFilterText}
                            onshowday={(index: number) => {
                                void showDay(index);
                            }}
                            {selectedDayIndex}
                        />
                    {:else if tabId === 'calendar'}
                        <ActivitiesCalendarView
                            {dateSelectionStatus}
                            days={viewModel.days}
                            filterText={calendarFilterText}
                            onsetstatus={(status: 'idle' | 'unavailable') => {
                                dateSelectionStatus = status;
                            }}
                            onshowday={(index: number) => {
                                void showDay(index);
                            }}
                            {selectedDayIndex}
                        />
                    {:else}
                        <ActivitiesDayView
                            {dateSelectionStatus}
                            dayCount={viewModel.days.length}
                            enabled={activeTab === 'day'}
                            filterText={dayFilterText}
                            {maximumDate}
                            {minimumDate}
                            onchange={chooseDateValue}
                            {onchartfailure}
                            {onclearrecord}
                            onnext={chooseNextDay}
                            {onopenlinked}
                            {onopensource}
                            onprevious={choosePreviousDay}
                            {onselectinfringement}
                            {onselectrecord}
                            {selectedDay}
                            {selectedDayIndex}
                            {selectedRecord}
                            timeZone={viewModel.timeZone}
                            {timelineRuntimeLoader}
                        />
                    {/if}
                {/snippet}
            </Tabs>
        {/if}
    {/snippet}
</RecordSectionLayout>
