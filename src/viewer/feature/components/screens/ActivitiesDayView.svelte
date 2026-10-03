<script lang="ts">
    import { createViewerDataTableLabels } from '../../helpers/data-table-labels.js';
    import { logBoundaryError } from '#error-reporting';
    import {
        Button,
        createStandardSortValue,
        DataTable,
        DatePicker,
        Icon,
        InlineNotice,
        type IInlineNoticeAction,
        type IntervalTimelineRuntimeLoader,
        type IntervalTimelineVariant,
        ReferenceLinkButton,
        SegmentedControl,
    } from '#ui';
    import type { DocumentSectionRecord } from '#viewer-application';
    import { type ActivityInterval, type ActivityKind, type JsonPointer, type UtcTimestamp } from '#viewer-domain';
    import {
        getDutyShiftDayRelation,
        type ActivityLinkedSection,
        type IActivityDayViewModel,
        type IActivityInfringementPinViewModel,
        type IActivityRecordViewModel,
        type IDutyShiftCrewViewModel,
        type IDutyShiftViewModel,
    } from '#viewer-presentation';

    import ActivityTimeline from './ActivityTimeline.svelte';
    import ActivityTotalsList from './ActivityTotalsList.svelte';
    import ChartError from './ChartError.svelte';
    import { activityIcon } from '../../helpers/activity-visual.js';
    import { createActivityDatePickerLocalisation } from '../../helpers/date-picker-localisation.js';
    import type { TranslationKey } from '#i18n-locales';
    import { TableToolingController } from '../../controllers/table-tooling-controller.svelte.js';
    import type { IDocumentScopedValue } from '../../controllers/document-scoped-value.svelte.js';
    import {
        translateActivityKind,
        translateCardSlot,
        translateCrewBadge,
        translateCrewPresence,
        translateGeneration,
    } from '../../helpers/viewer-labels.js';
    import { useViewerContext } from '../../viewer-context.js';

    type ActivityOrigin = ActivityInterval['origin'];

    interface IProps {
        dateSelectionStatus: 'idle' | 'unavailable';
        dayCount: number;
        enabled: boolean;
        filterText: IDocumentScopedValue<string>;
        maximumDate: UtcTimestamp | null;
        minimumDate: UtcTimestamp | null;
        onchange: (value: number) => void;
        onchartfailure: () => void;
        onclearrecord: () => void;
        onnext: () => void;
        onopenlinked: (section: ActivityLinkedSection, day: IActivityDayViewModel) => void;
        onopensource: (path: JsonPointer) => void;
        onprevious: () => void;
        onselectinfringement?: ((pin: IActivityInfringementPinViewModel) => void) | undefined;
        onselectrecord: (record: ActivityInterval) => void;
        selectedDay: IActivityDayViewModel | null;
        selectedDayIndex: number;
        selectedRecord: DocumentSectionRecord | null;
        timeZone: string;
        timelineRuntimeLoader?: IntervalTimelineRuntimeLoader | undefined;
    }

    let {
        dateSelectionStatus,
        dayCount,
        enabled,
        filterText,
        maximumDate,
        minimumDate,
        onchange,
        onchartfailure,
        onclearrecord,
        onnext,
        onopenlinked,
        onopensource,
        onprevious,
        onselectinfringement = undefined,
        onselectrecord,
        selectedDay,
        selectedDayIndex,
        selectedRecord,
        timeZone,
        timelineRuntimeLoader = undefined,
    }: IProps = $props();

    const viewerContext = useViewerContext();
    const translationService = viewerContext.translationService;
    const originTranslationKeys = {
        inferredGap: 'activities.origin.inferredGap',
        recorded: 'activities.origin.recorded',
    } satisfies Readonly<Record<ActivityOrigin, TranslationKey>>;
    let timelineVariant = $state<IntervalTimelineVariant>('lanes');
    let viewMode = $state<'utc' | 'shift'>('utc');

    const datePickerLocalisation = $derived(createActivityDatePickerLocalisation(viewerContext));
    const columns = $derived([
        {
            cell: activityCell,
            id: 'activity',
            label: translationService.translate('activities.activityColumn'),
            sortable: true,
        },
        {
            cell: startCell,
            id: 'start',
            label: translationService.translate('activities.start'),
            sortable: true,
        },
        {
            cell: endCell,
            id: 'end',
            label: translationService.translate('activities.end'),
            sortable: true,
        },
        {
            cell: durationCell,
            id: 'duration',
            label: translationService.translate('activities.duration'),
            sortable: true,
        },
        {
            cell: slotCell,
            id: 'slot',
            label: translationService.translate('associations.slot'),
            priority: 'low' as const,
            sortable: true,
        },
        {
            cell: crewCell,
            id: 'crew',
            label: translationService.translate('activities.crew.column'),
            priority: 'low' as const,
            sortable: true,
        },
        {
            cell: originCell,
            id: 'origin',
            label: translationService.translate('activities.evidence'),
            priority: 'low' as const,
            sortable: true,
        },
        {
            compact: true,
            cell: sourceCell,
            id: 'source',
            label: translationService.translate('overview.identity.sourceReference'),
            priority: 'low' as const,
            sortable: true,
        },
    ]);
    const recordTooling = new TableToolingController<IActivityRecordViewModel>({
        columns: () => columns,
        filterText: () => filterText,
        filterValues: (record) => [
            translateActivityKind(record.activity, translationService),
            record.start.display,
            record.end.display,
            record.duration.display,
            translateCardSlot(record.record.slot, translationService),
            translateCrewPresence(record.record.crewPresence, translationService),
            originLabel(record.origin),
            record.source?.path ?? '',
            ...record.searchValues,
        ],
        sortValue: createStandardSortValue({
            activity: (record) => record.activity,
            crew: (record) => record.record.crewPresence,
            duration: (record) => record.duration.value,
            end: (record) => record.end.value,
            origin: (record) => record.origin,
            slot: (record) => record.record.slot,
            source: (record) => record.source?.path ?? '',
            start: (record) => record.start.value,
        }),
    });

    function activityLabel(activity: ActivityKind): string {
        return translateActivityKind(activity, translationService);
    }

    function originLabel(origin: ActivityOrigin): string {
        return translationService.translate(originTranslationKeys[origin]);
    }

    function recordKey(record: IActivityRecordViewModel): string {
        return `${String(record.start.value)}:${String(record.end.value)}:${record.activity}:${record.origin}`;
    }

    function recordSelectionLabel(record: IActivityRecordViewModel): string {
        return `${translationService.translate('activities.selectRecord')}: ${activityLabel(record.activity)}, ${record.start.display}–${record.end.display}`;
    }

    function chooseRecord(record: IActivityRecordViewModel): void {
        onselectrecord(record.record);
    }

    function openRecordSource(record: IActivityRecordViewModel): void {
        if (record.source !== null) {
            onopensource(record.source.path);
        }
    }

    function restWindowLabel(crew: IDutyShiftCrewViewModel): string {
        const params = {
            end: crew.restWindowEnd.display,
            hours: String(crew.restWindowHours),
            start: crew.restWindowStart.display,
        };
        return crew.restWindowEndDayOffset > 0
            ? translationService.translate('activities.crew.restWindowValueNextDay', {
                  ...params,
                  days: String(crew.restWindowEndDayOffset),
              })
            : translationService.translate('activities.crew.restWindowValue', params);
    }

    // Only a failed or undecidable crew period names the driving that decided it.
    function crewNoticeLabel(crew: IDutyShiftCrewViewModel): string | null {
        if (crew.failedAt === null) {
            return null;
        }
        switch (crew.status) {
            case 'crewFailed':
                return translationService.translate('activities.crew.notice.crewFailed', { time: crew.failedAt.display });
            case 'unknown':
                return translationService.translate('activities.crew.notice.unknown', { time: crew.failedAt.display });
            case 'crew':
            case 'single':
                return null;
        }
    }

    function crewNoticeActions(shift: IDutyShiftViewModel, crew: IDutyShiftCrewViewModel): readonly IInlineNoticeAction[] {
        const failedRecord = shift.records.find((record) => record.id === crew.failedRecordId);
        return failedRecord === undefined
            ? []
            : [
                  {
                      label: translationService.translate('activities.crew.showOnTimeline'),
                      onclick: () => chooseRecord(failedRecord),
                  },
              ];
    }

    function handleChartBoundaryError(error: unknown): void {
        logBoundaryError('activities-day-chart', error);
        onchartfailure();
    }

    function handleDayViewKeyDown(event: KeyboardEvent): void {
        if (event.defaultPrevented || !enabled) {
            return;
        }

        const target = event.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
            return;
        }

        if (event.key === 'ArrowLeft' && selectedDayIndex > 0) {
            event.preventDefault();
            onprevious();
        } else if (event.key === 'ArrowRight' && selectedDayIndex < dayCount - 1) {
            event.preventDefault();
            onnext();
        }
    }
    function isRecordSelected(record: IActivityRecordViewModel): boolean {
        return record.record === selectedRecord;
    }

    const tableLabels = $derived(createViewerDataTableLabels(translationService));
</script>

{#snippet chartFailed(error: unknown, reset: () => void)}
    <ChartError
        {error}
        onretry={reset}
        description={translationService.translate('activities.timeline.failureDescription')}
        heading={translationService.translate('activities.timeline.failureHeading')}
        retryLabel={translationService.translate('activities.timeline.retry')}
    />
{/snippet}

{#snippet activityCell(record: IActivityRecordViewModel)}
    {@const selected = isRecordSelected(record)}
    <Button
        ariaLabel={recordSelectionLabel(record)}
        icon={activityIcon(record.activity)}
        label={activityLabel(record.activity)}
        onclick={() => chooseRecord(record)}
        pressed={selected}
        size="compact"
        variant="ghost"
    />
{/snippet}

{#snippet startCell(record: IActivityRecordViewModel)}
    {record.start.display}
{/snippet}

{#snippet endCell(record: IActivityRecordViewModel)}
    {record.end.display}
{/snippet}

{#snippet durationCell(record: IActivityRecordViewModel)}
    {record.duration.display}
{/snippet}

{#snippet slotCell(record: IActivityRecordViewModel)}
    {translateCardSlot(record.record.slot, translationService)}
{/snippet}

{#snippet crewCell(record: IActivityRecordViewModel)}
    {translateCrewPresence(record.record.crewPresence, translationService)}
{/snippet}

{#snippet originCell(record: IActivityRecordViewModel)}
    {originLabel(record.origin)}
{/snippet}

{#snippet sourceCell(record: IActivityRecordViewModel)}
    {#if record.source === null}
        <span>{translationService.translate('activities.noRecordedSource')}</span>
    {:else}
        <div class="source-evidence">
            <ReferenceLinkButton
                onopen={() => openRecordSource(record)}
                openLabel={translationService.translate('overview.openSource')}
                path={record.source.path}
            />
        </div>
    {/if}
{/snippet}

{#if selectedDay !== null}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <section class="evidence-panel" aria-labelledby="activities-day-heading" onkeydown={handleDayViewKeyDown}>
        <h2 id="activities-day-heading">
            {translationService.translate('activities.dayHeading')}
        </h2>
        <div class="day-toolbar">
            <Button
                disabled={selectedDayIndex <= 0}
                icon="chevronLeft"
                label={translationService.translate('activities.previousDay')}
                onclick={onprevious}
                tooltip={translationService.translate('activities.previousDayTooltip')}
            />
            <div class="form-field">
                <label for="activity-date">
                    {translationService.translate('activities.date')}
                </label>
                <DatePicker
                    id="activity-date"
                    labels={datePickerLocalisation.labels}
                    localise={datePickerLocalisation.localise}
                    maximum={maximumDate}
                    minimum={minimumDate}
                    {onchange}
                    placeholder={datePickerLocalisation.placeholder}
                    value={selectedDay.midnightUtc}
                />
            </div>
            <Button
                disabled={selectedDayIndex >= dayCount - 1}
                icon="chevronRight"
                label={translationService.translate('activities.nextDay')}
                onclick={onnext}
                tooltip={translationService.translate('activities.nextDayTooltip')}
            />
        </div>
        {#if dateSelectionStatus === 'unavailable'}
            <p class="date-status" role="status">
                {translationService.translate('activities.dateUnavailable')}
            </p>
        {/if}
        <dl class="day-context">
            <div>
                <dt>{translationService.translate('activities.application')}</dt>
                <dd>{translateGeneration(selectedDay.generation, translationService)}</dd>
            </div>
            <div>
                <dt>{translationService.translate('activities.timeZone')}</dt>
                <dd>{timeZone}</dd>
            </div>
        </dl>
    </section>

    <section class="evidence-panel" aria-labelledby="activity-totals-heading">
        <div class="panel-header-with-toggle">
            <h2 id="activity-totals-heading">
                {translationService.translate('activities.totalsHeading')}
            </h2>
            <SegmentedControl
                ariaLabel={translationService.translate('activities.viewMode.aria')}
                onchange={(mode: 'shift' | 'utc') => {
                    viewMode = mode;
                }}
                options={[
                    {
                        label: translationService.translate('activities.viewMode.utc'),
                        value: 'utc',
                    },
                    {
                        label: translationService.translate('activities.viewMode.shift'),
                        value: 'shift',
                    },
                ]}
                value={viewMode}
            />
        </div>

        {#if viewMode === 'utc'}
            <ActivityTotalsList continuousDriving={selectedDay.continuousDriving} totals={selectedDay.totals} />
            <p class="note">
                {translationService.translate('activities.viewerCalculationNote')}
            </p>
        {:else if selectedDay.dutyShifts.length > 0}
            <div class="duty-shifts-container">
                {#each selectedDay.dutyShifts as shift, index (shift.id)}
                    {@const relation = getDutyShiftDayRelation(shift, selectedDay.midnightUtc)}
                    {@const crewBadge = shift.crew === null ? null : translateCrewBadge(shift.crew.status, translationService)}
                    {@const crewNotice = shift.crew === null ? null : crewNoticeLabel(shift.crew)}
                    <div class="duty-shift-card">
                        <div class="duty-shift-header">
                            <div class="shift-title">
                                <Icon name="truck" />
                                <strong>
                                    {translationService.translate('activities.shift.heading', {
                                        index: String(index + 1),
                                        span: shift.formattedSpan,
                                    })}
                                </strong>
                                {#if relation === 'startedPreviousDay'}
                                    <span class="shift-continuity-badge">
                                        <Icon name="chevronLeft" />
                                        {translationService.translate('activities.shift.continuedFromPrevious', {
                                            startTime: shift.shiftStart.display,
                                        })}
                                    </span>
                                {:else if relation === 'continuesNextDay'}
                                    <span class="shift-continuity-badge">
                                        <Icon name="chevronRight" />
                                        {translationService.translate('activities.shift.continuesIntoNext', {
                                            endTime: shift.shiftEnd.display,
                                        })}
                                    </span>
                                {:else if relation === 'spansAcrossDay'}
                                    <span class="shift-continuity-badge">
                                        <Icon name="layers" />
                                        {translationService.translate('activities.shift.spansAcrossDay', {
                                            endTime: shift.shiftEnd.display,
                                            startTime: shift.shiftStart.display,
                                        })}
                                    </span>
                                {/if}
                                {#if shift.crew !== null && crewBadge !== null}
                                    <span class="shift-crew-badge" data-status={shift.crew.status}>
                                        <Icon name="users" />
                                        {crewBadge}
                                    </span>
                                {/if}
                            </div>
                            <div class="shift-duration-badge">
                                <span>{translationService.translate('activities.shift.dutyDuration')}</span>
                                <strong>{shift.totalDutyDuration.display}</strong>
                            </div>
                        </div>
                        <div class="shift-stats-grid">
                            <div class="shift-stat-item">
                                <span class="stat-label">{translationService.translate('activities.shift.driving')}</span>
                                <strong class="stat-value">{shift.drivingDuration.display}</strong>
                            </div>
                            <div class="shift-stat-item">
                                <span class="stat-label">{translationService.translate('activities.shift.work')}</span>
                                <strong class="stat-value">{shift.workDuration.display}</strong>
                            </div>
                            <div class="shift-stat-item">
                                <span class="stat-label">{translationService.translate('activities.shift.breakRest')}</span>
                                <strong class="stat-value">{shift.restDuration.display}</strong>
                            </div>
                            {#if shift.crew !== null}
                                <div class="shift-stat-item">
                                    <span class="stat-label">{translationService.translate('activities.crew.restWindow')}</span>
                                    <strong class="stat-value">{restWindowLabel(shift.crew)}</strong>
                                </div>
                            {/if}
                        </div>
                        {#if shift.crew !== null && crewNotice !== null}
                            <InlineNotice
                                actions={crewNoticeActions(shift, shift.crew)}
                                label={crewNotice}
                                leadingIcon="users"
                                role="note"
                            />
                        {/if}
                    </div>
                {/each}
            </div>
        {:else}
            <p class="note">
                {translationService.translate('activities.shift.noWorkShift')}
            </p>
        {/if}
    </section>

    <section class="evidence-panel" aria-labelledby="activity-links-heading">
        <h2 id="activity-links-heading">
            {translationService.translate('activities.links.heading')}
        </h2>
        <div aria-label={translationService.translate('activities.links.heading')} class="filter-actions" role="group">
            <Button
                label={translationService.translate('activities.links.vehicles')}
                onclick={() => onopenlinked('associations', selectedDay)}
            />
            <Button
                label={translationService.translate('activities.links.places')}
                onclick={() => onopenlinked('places', selectedDay)}
            />
            <Button
                label={translationService.translate('activities.links.eventsFaults')}
                onclick={() => onopenlinked('eventsAndFaults', selectedDay)}
            />
        </div>
    </section>

    <section class="evidence-panel" aria-labelledby="activity-timeline-heading">
        <h2 id="activity-timeline-heading">
            {translationService.translate('activities.timeline.heading')}
        </h2>
        <p>{translationService.translate('activities.timeline.summary')}</p>
        <SegmentedControl
            ariaLabel={translationService.translate('activities.timeline.styleHeading')}
            onchange={(variant: IntervalTimelineVariant) => {
                timelineVariant = variant;
            }}
            options={[
                {
                    label: translationService.translate('activities.timeline.styleLanes'),
                    value: 'lanes',
                },
                {
                    label: translationService.translate('activities.timeline.styleBand'),
                    value: 'band',
                },
            ]}
            value={timelineVariant}
        />
        <svelte:boundary failed={chartFailed} onerror={handleChartBoundaryError}>
            <ActivityTimeline
                day={selectedDay}
                {onclearrecord}
                onfailure={onchartfailure}
                {onselectinfringement}
                {onselectrecord}
                runtimeLoader={timelineRuntimeLoader}
                selectedRecord={selectedRecord !== null && 'activity' in selectedRecord ? selectedRecord : null}
                timeBasis={timeZone}
                variant={timelineVariant}
            />
        </svelte:boundary>
    </section>

    <section class="evidence-panel" aria-labelledby="activity-records-heading">
        <h2 id="activity-records-heading">
            {translationService.translate('activities.recordsHeading')}
        </h2>
        {#if selectedDay.records.length === 0}
            <p>{translationService.translate('activities.recordsEmpty')}</p>
        {:else}
            {@const activityTableSnapshot = recordTooling.snapshot(selectedDay.records)}
            <DataTable
                labels={tableLabels}
                tooling={recordTooling}
                caption={translationService.translate('activities.recordsCaption')}
                columnPreferencesStore={viewerContext.preferencesController}
                {columns}
                filterSummaryLabel={translationService.translate('table.filterResultCount', {
                    shown: String(activityTableSnapshot.rows.length),
                    total: String(selectedDay.records.length),
                })}
                preferenceKey="activities.dayRecords"
                isRowSelected={isRecordSelected}
                rowKey={recordKey}
                rows={activityTableSnapshot.rows}
            />
        {/if}
    </section>
{/if}

<style>
    .day-toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: end;
        gap: var(--space-actions);
    }

    dt {
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
        font-weight: var(--font-weight-action);
    }

    .day-context {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-section);
    }

    .day-context > div {
        display: grid;
        gap: var(--space-compact);
    }

    .panel-header-with-toggle {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-actions);
        margin-block-end: var(--space-actions);
    }

    .duty-shifts-container {
        display: flex;
        flex-direction: column;
        gap: var(--space-actions);
    }

    .duty-shift-card {
        display: flex;
        flex-direction: column;
        gap: var(--space-compact);
        padding: var(--space-actions) var(--space-panel);
        background: var(--color-surface-subtle);
        border: var(--border-region);
        border-radius: var(--radius-card);
    }

    .duty-shift-header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-actions);
    }

    .shift-title {
        display: flex;
        align-items: center;
        gap: var(--space-compact);
        font-size: var(--font-size-body);
        flex-wrap: wrap;
    }

    .shift-continuity-badge,
    .shift-crew-badge {
        display: inline-flex;
        align-items: center;
        gap: var(--space-compact);
        padding: var(--padding-badge);
        border: var(--border-region);
        border-radius: var(--radius-chip);
        font-size: var(--font-size-metadata);
        font-weight: var(--font-weight-body);
        white-space: nowrap;
        background: var(--color-surface-subtle);
        color: var(--color-text-muted);
    }

    .shift-crew-badge[data-status='crew'] {
        background: var(--color-badge-minor-bg);
        border: var(--border-badge-minor);
        color: var(--color-text);
    }

    .shift-crew-badge[data-status='crewFailed'],
    .shift-crew-badge[data-status='unknown'] {
        background: var(--color-badge-serious-bg);
        border: var(--border-badge-serious);
        color: var(--color-text);
    }

    .shift-duration-badge {
        display: flex;
        align-items: center;
        gap: var(--space-compact);
        font-size: var(--font-size-metadata);
        color: var(--color-text-muted);
    }

    .shift-duration-badge strong {
        color: var(--color-text);
        font-variant-numeric: tabular-nums;
    }

    .shift-stats-grid {
        display: grid;
        grid-template-columns: var(--layout-duty-shift-columns);
        gap: var(--space-actions);
        padding-block-start: var(--space-compact);
        border-block-start: var(--border-region);
    }

    .shift-stat-item {
        display: flex;
        flex-direction: column;
        gap: var(--gap-step-info);
    }

    .stat-label {
        font-size: var(--font-size-metadata);
        color: var(--color-text-muted);
    }

    .stat-value {
        font-size: var(--font-size-body);
        font-weight: var(--font-weight-action);
        font-variant-numeric: tabular-nums;
    }

    .date-status,
    .note {
        color: var(--color-text-muted);
    }

    .source-evidence {
        display: inline-flex;
        align-items: center;
        vertical-align: middle;
    }
</style>
