<script lang="ts">
    import { Button, ChartLegend, DatePicker, Icon, SegmentedControl } from '#ui';
    import type { ActivityKind } from '#viewer-domain';
    import type { IActivityDayViewModel, ICalendarDayViewModel, IYearPresenceDayViewModel } from '#viewer-presentation';
    import {
        calendarMonthOf,
        calendarWeekBounds,
        createActivityCalendarViewModel,
        createActivityRangeTotalsViewModel,
        createActivityYearPresenceViewModel,
        formatUtcDateInputValue,
        parseCalendarDateInput,
        shiftCalendarDate,
        shiftCalendarMonth,
    } from '#viewer-presentation';

    import { tick } from 'svelte';

    import ActivityDaySummaryTable from './ActivityDaySummaryTable.svelte';
    import ActivityTotalsList from './ActivityTotalsList.svelte';
    import { activityColorToken } from '../../helpers/activity-visual.js';
    import { createActivityDatePickerLocalisation } from '../../helpers/date-picker-localisation.js';
    import { translateActivityKind, translateCrewBadge } from '../../helpers/viewer-labels.js';
    import type { IDocumentScopedValue } from '../../controllers/document-scoped-value.svelte.js';
    import { useViewerContext } from '../../viewer-context.js';

    type CalendarView = 'month' | 'year';

    interface IProps {
        dateSelectionStatus: 'idle' | 'unavailable';
        days: readonly IActivityDayViewModel[];
        filterText: IDocumentScopedValue<string>;
        onsetstatus: (status: 'idle' | 'unavailable') => void;
        onshowday: (index: number) => void;
        selectedDayIndex: number;
    }

    let { dateSelectionStatus, days, filterText, onsetstatus, onshowday, selectedDayIndex }: IProps = $props();

    const viewerContext = useViewerContext();
    const translationService = viewerContext.translationService;
    const localisationService = viewerContext.localisationService;
    let calendarMode = $state<CalendarView>('month');
    let calendarFocusDate = $state<string | null>(null);
    let calendarRangeFrom = $state<string | null>(null);
    let calendarRangeTo = $state<string | null>(null);
    let calendarGrid = $state<HTMLDivElement | undefined>();

    const datePickerLocalisation = $derived(createActivityDatePickerLocalisation(viewerContext));
    const minimumDate = $derived(days[0]?.midnightUtc ?? null);
    const maximumDate = $derived(days.at(-1)?.midnightUtc ?? null);
    const defaultCalendarDate = $derived(days[selectedDayIndex]?.dateInputValue ?? null);
    const activeCalendarDate = $derived(calendarFocusDate ?? defaultCalendarDate);
    const calendarMonth = $derived(activeCalendarDate === null ? null : calendarMonthOf(activeCalendarDate));
    const calendarViewModel = $derived(
        calendarMonth === null || activeCalendarDate === null
            ? null
            : createActivityCalendarViewModel(
                  days,
                  {
                      focusedDate: activeCalendarDate,
                      month: calendarMonth,
                      selectedDayIndex,
                  },
                  localisationService,
              ),
    );
    const yearViewModel = $derived(
        activeCalendarDate === null || calendarMonth === null
            ? null
            : createActivityYearPresenceViewModel(days, calendarMonth.year, localisationService),
    );
    const effectiveRangeFrom = $derived(
        calendarRangeFrom ?? (calendarMode === 'year' ? (yearViewModel?.yearStart ?? '') : (calendarViewModel?.monthStart ?? '')),
    );
    const effectiveRangeTo = $derived(
        calendarRangeTo ?? (calendarMode === 'year' ? (yearViewModel?.yearEnd ?? '') : (calendarViewModel?.monthEnd ?? '')),
    );
    const effectiveRangeFromTimestamp = $derived(effectiveRangeFrom === '' ? null : parseCalendarDateInput(effectiveRangeFrom));
    const effectiveRangeToTimestamp = $derived(effectiveRangeTo === '' ? null : parseCalendarDateInput(effectiveRangeTo));
    const rangeTotals = $derived(
        effectiveRangeFrom === '' || effectiveRangeTo === ''
            ? null
            : createActivityRangeTotalsViewModel(days, effectiveRangeFrom, effectiveRangeTo, localisationService),
    );
    const calendarDayRows = $derived(calendarViewModel?.monthDays ?? []);
    const calendarTableDays = $derived(calendarMode === 'year' ? (yearViewModel?.yearDays ?? []) : calendarDayRows);
    const calendarTableHeading = $derived(
        calendarMode === 'year'
            ? translationService.translate('activities.calendar.yearDaysHeading', {
                  year: yearViewModel?.yearLabel ?? '',
              })
            : translationService.translate('activities.calendar.monthDaysHeading', {
                  month: calendarViewModel?.monthLabel ?? '',
              }),
    );
    const calendarTableCaption = $derived(
        calendarMode === 'year'
            ? translationService.translate('activities.calendar.yearDaysCaption')
            : translationService.translate('activities.calendar.monthDaysCaption'),
    );
    const calendarTableEmpty = $derived(
        calendarMode === 'year'
            ? translationService.translate('activities.calendar.yearDaysEmpty')
            : translationService.translate('activities.calendar.monthDaysEmpty'),
    );
    const calendarHeading = $derived(
        calendarMode === 'year'
            ? translationService.translate('activities.calendar.yearHeading')
            : translationService.translate('activities.calendar.heading'),
    );
    const middleTotalsHeading = $derived(
        calendarMode === 'year'
            ? translationService.translate('activities.calendar.yearTotals')
            : translationService.translate('activities.calendar.monthTotals'),
    );
    const middleTotals = $derived(
        calendarMode === 'year' ? (yearViewModel?.yearTotals ?? null) : (calendarViewModel?.monthTotals ?? null),
    );
    // The crew entry appears only while the visible month shows the crew glyph.
    const showsCrewGlyph = $derived(
        calendarMode === 'month' &&
            (calendarViewModel?.weeks.some((week) => week.some((cell) => crewBadge(cell) !== null)) ?? false),
    );
    const calendarLegend = $derived([
        ...(['driving', 'work', 'availability', 'breakOrRest', 'unknown'] as const).map((activity) => ({
            colorToken: activityColorToken(activity),
            id: activity,
            label: activityLabel(activity),
        })),
        ...(showsCrewGlyph
            ? [{ icon: 'users' as const, id: 'crew', label: translationService.translate('activities.crew.legend') }]
            : []),
    ]);

    function activityLabel(activity: ActivityKind): string {
        return translateActivityKind(activity, translationService);
    }

    function crewBadge(cell: ICalendarDayViewModel): string | null {
        return cell.crewStatus === null ? null : translateCrewBadge(cell.crewStatus, translationService);
    }

    function calendarDayLabel(cell: ICalendarDayViewModel): string {
        if (cell.strip.length === 0) {
            return cell.dateDisplay;
        }
        const activities = cell.strip.map((segment) => `${activityLabel(segment.activity)} ${segment.display}`).join(', ');
        const crew = crewBadge(cell);
        return crew === null ? `${cell.dateDisplay}: ${activities}` : `${cell.dateDisplay}: ${activities}; ${crew}`;
    }

    function activateCalendarDay(cell: ICalendarDayViewModel): void {
        calendarFocusDate = cell.dateInputValue;
        if (cell.indexInDays !== null) {
            void onshowday(cell.indexInDays);
            return;
        }
        onsetstatus('unavailable');
    }

    function activateYearDay(cell: IYearPresenceDayViewModel): void {
        if (!cell.isInMonth) {
            return;
        }
        calendarFocusDate = cell.dateInputValue;
        if (cell.indexInDays !== null) {
            void onshowday(cell.indexInDays);
            return;
        }
        onsetstatus('unavailable');
    }

    function moveCalendarMonth(months: number): void {
        const current = activeCalendarDate;
        if (current === null) {
            return;
        }
        const shifted = shiftCalendarMonth(current, months);
        if (shifted !== null) {
            calendarFocusDate = shifted;
        }
    }

    function moveCalendarYear(years: number): void {
        const current = activeCalendarDate;
        if (current === null) {
            return;
        }
        const shifted = shiftCalendarMonth(current, years * 12);
        if (shifted !== null) {
            calendarFocusDate = shifted;
        }
    }

    function heatCellLabel(cell: IYearPresenceDayViewModel): string {
        if (!cell.isInMonth || !cell.hasActivities) {
            return cell.dateDisplay;
        }
        return `${cell.dateDisplay}: ${translationService.translate('activities.calendar.presenceMinutes', {
            minutes: cell.minutesDisplay,
        })}`;
    }

    async function focusCalendarDate(dateInputValue: string): Promise<void> {
        await tick();
        calendarGrid?.querySelector<HTMLButtonElement>(`[data-date="${dateInputValue}"]`)?.focus();
    }

    function handleCalendarKeyboard(event: KeyboardEvent): void {
        const current = activeCalendarDate;
        if (current === null) {
            return;
        }
        let next: string | null = null;
        switch (event.key) {
            case 'ArrowLeft':
                next = shiftCalendarDate(current, -1);
                break;
            case 'ArrowRight':
                next = shiftCalendarDate(current, 1);
                break;
            case 'ArrowUp':
                next = shiftCalendarDate(current, -7);
                break;
            case 'ArrowDown':
                next = shiftCalendarDate(current, 7);
                break;
            case 'PageUp':
                next = shiftCalendarMonth(current, -1);
                break;
            case 'PageDown':
                next = shiftCalendarMonth(current, 1);
                break;
            case 'Home':
                next = calendarWeekBounds(current)?.start ?? null;
                break;
            case 'End':
                next = calendarWeekBounds(current)?.end ?? null;
                break;
        }
        if (next !== null && next !== current) {
            event.preventDefault();
            calendarFocusDate = next;
            void focusCalendarDate(next);
        }
    }

    function handleRangeFromValue(value: number): void {
        const formatted = formatUtcDateInputValue(value);
        if (formatted !== null) {
            calendarRangeFrom = formatted;
        }
    }

    function handleRangeToValue(value: number): void {
        const formatted = formatUtcDateInputValue(value);
        if (formatted !== null) {
            calendarRangeTo = formatted;
        }
    }
</script>

{#if calendarViewModel !== null}
    <section class="evidence-panel" aria-labelledby="activity-calendar-heading">
        <h2 id="activity-calendar-heading">
            {calendarHeading}
        </h2>
        <SegmentedControl
            ariaLabel={translationService.translate('activities.calendar.viewLabel')}
            onchange={(mode: CalendarView) => {
                calendarMode = mode;
            }}
            options={[
                {
                    label: translationService.translate('activities.calendar.viewMonth'),
                    value: 'month',
                },
                {
                    label: translationService.translate('activities.calendar.viewYear'),
                    value: 'year',
                },
            ]}
            value={calendarMode}
        />
        {#if calendarMode === 'month'}
            <div class="calendar-toolbar">
                <Button
                    icon="chevronLeft"
                    label={translationService.translate('activities.calendar.previousMonth')}
                    onclick={() => moveCalendarMonth(-1)}
                />
                <h3 class="calendar-month-label">{calendarViewModel.monthLabel}</h3>
                <Button
                    icon="chevronRight"
                    label={translationService.translate('activities.calendar.nextMonth')}
                    onclick={() => moveCalendarMonth(1)}
                />
            </div>
            {#if dateSelectionStatus === 'unavailable'}
                <p class="date-status" role="status">
                    {translationService.translate('activities.dateUnavailable')}
                </p>
            {/if}
            <div
                aria-label={translationService.translate('activities.calendar.gridLabel', {
                    month: calendarViewModel.monthLabel,
                })}
                bind:this={calendarGrid}
                class="calendar-grid"
                onkeydown={handleCalendarKeyboard}
                role="grid"
                tabindex="-1"
            >
                <div class="calendar-grid-row" role="row">
                    {#each calendarViewModel.weekdayLabels as weekday (weekday)}
                        <div class="calendar-weekday" role="columnheader">
                            {weekday}
                        </div>
                    {/each}
                </div>
                {#each calendarViewModel.weeks as week, weekIndex (weekIndex)}
                    <div class="calendar-grid-row" role="row">
                        {#each week as cell (cell.dateInputValue)}
                            {@const focused = cell.dateInputValue === activeCalendarDate}
                            {@const selected = cell.indexInDays !== null && cell.indexInDays === selectedDayIndex}
                            {@const crew = crewBadge(cell)}
                            <div class="calendar-cell" role="gridcell">
                                <button
                                    aria-label={calendarDayLabel(cell)}
                                    class="calendar-day"
                                    class:current-month={cell.isInCurrentMonth}
                                    class:selected
                                    data-date={cell.dateInputValue}
                                    onclick={() => activateCalendarDay(cell)}
                                    tabindex={focused ? 0 : -1}
                                    type="button"
                                >
                                    <span class="calendar-day-number">
                                        {cell.dayOfMonth}
                                        {#if crew !== null}
                                            <span
                                                aria-hidden="true"
                                                class="calendar-day-crew"
                                                data-status={cell.crewStatus}
                                                title={crew}
                                            >
                                                <Icon name="users" size="small" />
                                            </span>
                                        {/if}
                                    </span>
                                    {#if cell.drivingDisplay !== null}
                                        <span class="calendar-day-driving">
                                            <Icon name="circleGauge" />
                                            {cell.drivingDisplay}
                                        </span>
                                        <span aria-hidden="true" class="calendar-day-strip">
                                            {#each cell.strip as segment (segment.activity)}
                                                <span
                                                    class="calendar-strip-segment"
                                                    style:--data-strip-color={`var(${activityColorToken(segment.activity)})`}
                                                    style:--data-strip-inline={`${String(segment.inlinePercent)}%`}
                                                    title={`${activityLabel(segment.activity)} ${segment.display}`}
                                                ></span>
                                            {/each}
                                        </span>
                                    {/if}
                                </button>
                            </div>
                        {/each}
                    </div>
                {/each}
            </div>
            <ChartLegend ariaLabel={translationService.translate('activities.calendar.legendLabel')} items={calendarLegend} />
            <p class="note">
                {translationService.translate('activities.calendar.keyboardHelp')}
            </p>
        {:else if yearViewModel !== null}
            <div class="calendar-toolbar">
                <Button
                    icon="chevronLeft"
                    label={translationService.translate('activities.calendar.previousYear')}
                    onclick={() => moveCalendarYear(-1)}
                />
                <h3 class="calendar-month-label">{yearViewModel.yearLabel}</h3>
                <Button
                    icon="chevronRight"
                    label={translationService.translate('activities.calendar.nextYear')}
                    onclick={() => moveCalendarYear(1)}
                />
            </div>
            {#if dateSelectionStatus === 'unavailable'}
                <p class="date-status" role="status">
                    {translationService.translate('activities.dateUnavailable')}
                </p>
            {/if}
            <p>
                {translationService.translate('activities.calendar.presenceSummary', {
                    present: yearViewModel.presentDayCount.display,
                    total: yearViewModel.totalDayCount.display,
                })}
            </p>
            <div
                aria-label={translationService.translate('activities.calendar.yearLabel', {
                    year: yearViewModel.yearLabel,
                })}
                class="heatmap-grid"
                role="grid"
                tabindex="-1"
            >
                <div class="heatmap-row" role="row">
                    <div class="heatmap-day-number heatmap-corner" role="columnheader"></div>
                    {#each yearViewModel.monthLabels as month (month)}
                        <div class="heatmap-month" role="columnheader">
                            {month}
                        </div>
                    {/each}
                </div>
                {#each yearViewModel.days as row, rowIndex (rowIndex)}
                    <div class="heatmap-row" role="row">
                        <div class="heatmap-day-number" role="rowheader">
                            {row[0]?.dayOfMonth ?? ''}
                        </div>
                        {#each row as cell, cellIndex (cellIndex)}
                            {@const focused = cell.dateInputValue === activeCalendarDate}
                            {@const selected = cell.indexInDays !== null && cell.indexInDays === selectedDayIndex}
                            <div
                                aria-label={heatCellLabel(cell)}
                                class="heatmap-cell"
                                class:selected
                                data-has-activity={cell.hasActivities}
                                role="gridcell"
                            >
                                {#if cell.isInMonth}
                                    <button
                                        aria-label={heatCellLabel(cell)}
                                        class="heatmap-day-button"
                                        class:selected
                                        data-date={cell.dateInputValue}
                                        onclick={() => activateYearDay(cell)}
                                        tabindex={focused ? 0 : -1}
                                        type="button"
                                    >
                                        <span class="heat-fill" style:--data-heat-intensity={String(cell.intensity)}></span>
                                        <span class="heat-day">{cell.dayOfMonth}</span>
                                    </button>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/each}
            </div>
            <p class="note">
                {translationService.translate('activities.calendar.heatmapNote')}
            </p>
        {/if}
    </section>

    <section class="evidence-panel" aria-labelledby="calendar-totals-heading">
        <h2 id="calendar-totals-heading">
            {translationService.translate('activities.totalsHeading')}
        </h2>
        <div class="calendar-totals-group">
            <h3>{translationService.translate('activities.calendar.weekTotals')}</h3>
            <ActivityTotalsList totals={calendarViewModel.weekTotals} />
        </div>
        <div class="calendar-totals-group">
            <h3>{middleTotalsHeading}</h3>
            {#if middleTotals !== null}
                <ActivityTotalsList totals={middleTotals} />
            {/if}
        </div>
        <div class="calendar-totals-group">
            <h3>{translationService.translate('activities.calendar.rangeTotals')}</h3>
            <div class="calendar-range-controls">
                <div class="form-field">
                    <label for="calendar-range-from">
                        {translationService.translate('activities.calendar.rangeFrom')}
                    </label>
                    <DatePicker
                        id="calendar-range-from"
                        labels={datePickerLocalisation.labels}
                        localise={datePickerLocalisation.localise}
                        maximum={maximumDate}
                        minimum={minimumDate}
                        onchange={handleRangeFromValue}
                        onclear={() => {
                            calendarRangeFrom = null;
                        }}
                        placeholder={datePickerLocalisation.placeholder}
                        value={effectiveRangeFromTimestamp}
                    />
                </div>
                <div class="form-field">
                    <label for="calendar-range-to">
                        {translationService.translate('activities.calendar.rangeTo')}
                    </label>
                    <DatePicker
                        id="calendar-range-to"
                        labels={datePickerLocalisation.labels}
                        localise={datePickerLocalisation.localise}
                        maximum={maximumDate}
                        minimum={minimumDate}
                        onchange={handleRangeToValue}
                        onclear={() => {
                            calendarRangeTo = null;
                        }}
                        placeholder={datePickerLocalisation.placeholder}
                        value={effectiveRangeToTimestamp}
                    />
                </div>
            </div>
            {#if rangeTotals !== null}
                <ActivityTotalsList totals={rangeTotals} />
            {:else}
                <p class="date-status" role="status">
                    {translationService.translate('activities.calendar.rangeInvalid')}
                </p>
            {/if}
        </div>
        <p class="note">
            {translationService.translate('activities.viewerCalculationNote')}
        </p>
    </section>

    <section class="evidence-panel" aria-labelledby="calendar-month-days-heading">
        <h2 id="calendar-month-days-heading">
            {calendarTableHeading}
        </h2>
        {#if calendarTableDays.length === 0}
            <p>{calendarTableEmpty}</p>
        {:else}
            <ActivityDaySummaryTable
                caption={calendarTableCaption}
                {filterText}
                {onshowday}
                rows={calendarTableDays}
                {selectedDayIndex}
            />
            <p class="note">
                {translationService.translate('activities.viewerCalculationNote')}
            </p>
        {/if}
    </section>
{/if}

<style>
    .calendar-toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-actions);
    }

    .calendar-month-label {
        margin: var(--space-none);
        font-size: var(--font-size-section);
    }

    .calendar-grid {
        display: grid;
        gap: var(--space-compact);
        overflow-x: auto;
    }

    .calendar-grid-row {
        display: grid;
        grid-template-columns: var(--layout-calendar-grid-columns);
        gap: var(--space-compact);
    }

    .calendar-weekday {
        padding-block: var(--space-compact);
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
        text-align: center;
    }

    .calendar-cell {
        min-inline-size: var(--space-none);
    }

    .calendar-day {
        display: grid;
        gap: var(--space-compact);
        inline-size: var(--size-full);
        min-block-size: var(--size-calendar-day);
        padding: var(--space-compact);
        background: var(--color-surface-subtle);
        border: var(--border-region);
        border-radius: var(--radius-control);
        color: var(--color-text);
        font: inherit;
        cursor: pointer;
    }

    .calendar-day:not(.current-month) {
        background: var(--color-transparent);
        color: var(--color-text-muted);
    }

    .calendar-day:hover:not(.selected) {
        background: var(--color-surface-hover);
    }

    .calendar-day.selected {
        background: var(--color-surface-selected);
        border-color: var(--color-accent);
    }

    .calendar-day:focus-visible {
        outline: var(--size-focus-ring) solid var(--color-focus);
        outline-offset: calc(var(--size-focus-ring) * -1);
    }

    .calendar-day-number {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-weight: var(--font-weight-action);
        text-align: start;
    }

    .calendar-day-crew {
        display: inline-flex;
        color: var(--color-text-muted);
    }

    .calendar-day-crew[data-status='crewFailed'],
    .calendar-day-crew[data-status='unknown'] {
        color: var(--color-warning);
    }

    .calendar-day-driving {
        display: flex;
        align-items: center;
        gap: var(--space-compact);
        font-size: var(--font-size-metadata);
        font-variant-numeric: tabular-nums;
    }

    .calendar-day-strip {
        display: flex;
        block-size: var(--size-calendar-strip);
        overflow: hidden;
        background: var(--color-surface-hover);
        border-radius: var(--radius-control);
    }

    .calendar-strip-segment {
        inline-size: var(--data-strip-inline);
        background: var(--data-strip-color);
    }

    .calendar-totals-group {
        display: grid;
        gap: var(--space-actions);
    }

    .calendar-totals-group h3 {
        margin: var(--space-none);
        font-size: var(--font-size-section);
    }

    .calendar-range-controls {
        display: grid;
        grid-template-columns: var(--layout-calendar-range-controls);
        gap: var(--space-actions);
    }

    .heatmap-grid {
        display: grid;
        gap: var(--space-compact);
        overflow-x: auto;
    }

    .heatmap-row {
        display: grid;
        grid-template-columns: var(--layout-heatmap-grid-columns);
        gap: var(--space-compact);
        align-items: stretch;
    }

    .heatmap-month,
    .heatmap-day-number {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
        text-align: center;
    }

    .heatmap-cell {
        position: relative;
        display: grid;
        min-block-size: var(--size-heatmap-cell);
        min-inline-size: var(--space-none);
        padding: var(--space-none);
        background: var(--color-surface-subtle);
        border: var(--border-region);
        border-radius: var(--radius-control);
        overflow: hidden;
    }

    .heatmap-cell.selected {
        border-color: var(--color-accent);
    }

    .heatmap-day-button {
        position: relative;
        display: grid;
        place-items: center;
        inline-size: var(--size-full);
        block-size: var(--size-full);
        min-block-size: var(--size-heatmap-cell);
        padding: var(--space-none);
        background: var(--color-transparent);
        border: none;
        border-radius: var(--radius-control);
        color: var(--color-text);
        font: inherit;
        cursor: pointer;
    }

    .heatmap-day-button:hover:not(.selected) {
        background: var(--color-surface-hover);
    }

    .heatmap-day-button.selected {
        background: var(--color-surface-selected);
    }

    .heatmap-day-button:focus-visible {
        outline: var(--size-focus-ring) solid var(--color-focus);
        outline-offset: calc(var(--size-focus-ring) * -1);
    }

    .heat-fill {
        position: absolute;
        inset: var(--space-none);
        background: var(--color-accent);
        border-radius: var(--radius-control);
        opacity: var(--data-heat-intensity);
        pointer-events: none;
    }

    .heat-day {
        position: relative;
        font-size: var(--font-size-metadata);
        font-variant-numeric: tabular-nums;
        pointer-events: none;
    }

    @media (forced-colors: active) {
        .heatmap-cell[data-has-activity='true'],
        .heatmap-cell.selected {
            outline: var(--size-selection-marker) solid Highlight;
        }
    }

    .date-status,
    .note {
        color: var(--color-text-muted);
    }
</style>
