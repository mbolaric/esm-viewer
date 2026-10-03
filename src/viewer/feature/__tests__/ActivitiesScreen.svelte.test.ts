import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_HOUR } from '#time';
import {
    createRecordedActivityInterval,
    createSourceReference,
    isDurationMilliseconds,
    isJsonPointer,
    isUtcTimestamp,
    type ActivityInterval,
    type DurationMilliseconds,
    type JsonPointer,
    type ISourceReference,
    type UtcTimestamp,
} from '#viewer-domain';
import type {
    ActivityLinkedSection,
    IActivityDayViewModel,
    IActivityInfringementPinViewModel,
    IActivityRecordViewModel,
    IActivitySectionViewModel,
    IActivityTotalsViewModel,
    IDutyShiftViewModel,
    IFormattedValue,
} from '#viewer-presentation';
import type { IIntervalTimelineChartModel, IIntervalTimelineRuntimeCallbacks } from '#ui';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ActivitiesScreen from '../components/screens/ActivitiesScreen.svelte';
import ActivityTimeline from '../components/screens/ActivityTimeline.svelte';
import { createDocumentScopedValue } from '../controllers/document-scoped-value.svelte.js';
import { createViewerDocumentHarness } from './viewer-document-harness.js';
import { buildTestViewerPreferences, createViewerTestContext } from './viewer-test-context.js';
import { createViewerTestRenderOptionsWithContext } from './viewer-test-render.js';
import { createViewerTestRenderOptions } from './viewer-test-render.js';
import { createCapturingIntervalTimelineRuntimeLoader, fixtureSingleDriverCrew, VisibleIntersectionObserver } from '#testing';

afterEach(() => {
    cleanup();
});

function timestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The activity screen timestamp fixture must be valid.');
    }
    return value;
}

function duration(value: number): DurationMilliseconds {
    if (!isDurationMilliseconds(value)) {
        throw new TypeError('The activity screen duration fixture must be valid.');
    }
    return value;
}

function source(path: string): ISourceReference<'g1', 'driverCard'> {
    if (!isJsonPointer(path)) {
        throw new TypeError('The activity screen source fixture must be valid.');
    }
    return createSourceReference('driverCard', 'g1', path);
}

function formatted<TValue>(value: TValue, display: string): IFormattedValue<TValue> {
    return { display, value };
}

function totals(overrides: Partial<IActivityTotalsViewModel> = {}): IActivityTotalsViewModel {
    const zero = formatted(duration(0), '0 min');
    return {
        availability: overrides.availability ?? zero,
        breakOrRest: overrides.breakOrRest ?? zero,
        driving: overrides.driving ?? zero,
        unknown: overrides.unknown ?? zero,
        work: overrides.work ?? zero,
    };
}

function activityRecord(
    record: ActivityInterval,
    display: Readonly<{ readonly duration: string; readonly end: string; readonly start: string }>,
    midnight: UtcTimestamp,
): IActivityRecordViewModel {
    const durationValue = duration(record.end - record.start);
    return {
        activity: record.activity,
        duration: formatted(durationValue, display.duration),
        end: formatted(record.end, display.end),
        generation: 'g1',
        id: `g1:${String(record.start)}:${String(record.end)}:${record.activity}:${record.origin}`,
        origin: record.origin,
        record,
        searchValues: [display.start, display.end],
        source: record.source,
        start: formatted(record.start, display.start),
        timelineEnd: duration(record.end - midnight),
        timelineStart: duration(record.start - midnight),
    };
}

function day(
    midnight: UtcTimestamp,
    inputValue: string,
    dateDisplay: string,
    records: readonly IActivityRecordViewModel[],
    dayTotals: IActivityTotalsViewModel,
): IActivityDayViewModel {
    return {
        continuousDriving: {
            currentContinuousDriving: formatted(duration(0), '0 min'),
            maxContinuousDrivingLimit: formatted(duration((4 * 60 + 30) * 60 * 1_000), '4h 30m'),
            peakContinuousDriving: null,
            percentage: 0,
            status: 'normal',
        },
        creditedBreaks: [],
        crewStatus: 'single',
        date: formatted(midnight, dateDisplay),
        dateInputValue: inputValue,
        dutyShifts: [],
        generation: 'g1',
        infringements: [],
        midnightUtc: midnight,
        records: records,
        restWindows: [],
        timelineEnd: duration(24 * 60 * 60 * 1_000),
        timelineTicks: [0, 6, 12, 18, 24].map((hour) => ({
            display: `${String(hour).padStart(2, '0')}:00`,
            offset: duration(hour * 60 * 60 * 1_000),
        })),
        totals: dayTotals,
    };
}

function viewModel(): IActivitySectionViewModel {
    const firstMidnight = timestamp(Date.UTC(2026, 6, 26));
    const secondMidnight = timestamp(Date.UTC(2026, 6, 27));
    const firstInterval = createRecordedActivityInterval(
        'driving',
        timestamp(firstMidnight + 8 * 60 * 60 * 1_000),
        timestamp(firstMidnight + 9 * 60 * 60 * 1_000),
        source('/activities/0'),
        fixtureSingleDriverCrew,
    );
    const secondInterval = createRecordedActivityInterval(
        'work',
        timestamp(secondMidnight + 9 * 60 * 60 * 1_000),
        timestamp(secondMidnight + 10 * 60 * 60 * 1_000 + 30 * 60 * 1_000),
        source('/activities/1'),
        fixtureSingleDriverCrew,
    );
    if (firstInterval === null || secondInterval === null) {
        throw new TypeError('The activity screen interval fixture must be valid.');
    }
    const inferredGap = {
        activity: 'unknown',
        crewPresence: 'unknown',
        end: timestamp(secondMidnight + 11 * 60 * 60 * 1_000),
        origin: 'inferredGap',
        slot: 'Unknown',
        source: null,
        start: secondInterval.end,
    } satisfies ActivityInterval;

    return {
        days: [
            day(
                firstMidnight,
                '2026-07-26',
                'July 26, 2026',
                [
                    activityRecord(
                        firstInterval,
                        {
                            duration: '1 hr',
                            end: '09:00',
                            start: '08:00',
                        },
                        firstMidnight,
                    ),
                ],
                totals({ driving: formatted(duration(60 * 60 * 1_000), '1 hr') }),
            ),
            day(
                secondMidnight,
                '2026-07-27',
                'July 27, 2026',
                [
                    activityRecord(
                        secondInterval,
                        {
                            duration: '1 hr, 30 min',
                            end: '10:30',
                            start: '09:00',
                        },
                        secondMidnight,
                    ),
                    activityRecord(
                        inferredGap,
                        {
                            duration: '30 min',
                            end: '11:00',
                            start: '10:30',
                        },
                        secondMidnight,
                    ),
                ],
                totals({
                    unknown: formatted(duration(30 * 60 * 1_000), '30 min'),
                    work: formatted(duration(90 * 60 * 1_000), '1 hr, 30 min'),
                }),
            ),
        ],
        locale: 'en',
        timeZone: 'UTC',
    };
}

interface IActivitiesScreenRenderOptions {
    readonly onclearrecord?: () => void;
    readonly onopenlinked?: (section: ActivityLinkedSection, day: IActivityDayViewModel) => void;
    readonly onopensource?: (path: JsonPointer) => void;
    readonly onselectinfringement?: (pin: IActivityInfringementPinViewModel) => void;
    readonly onselectrecord?: (record: ActivityInterval) => void;
    readonly viewModel?: IActivitySectionViewModel | null;
}

function renderActivitiesScreen(options: IActivitiesScreenRenderOptions = {}): ReturnType<typeof render> {
    return render(
        ActivitiesScreen,
        {
            props: {
                allDaysFilterText: createDocumentScopedValue(''),
                calendarFilterText: createDocumentScopedValue(''),
                dayFilterText: createDocumentScopedValue(''),
                onchartfailure: vi.fn(),
                onclearrecord: options.onclearrecord ?? vi.fn(),
                onopenlinked: options.onopenlinked ?? vi.fn(),
                onopensource: options.onopensource ?? vi.fn(),
                onselectinfringement: options.onselectinfringement ?? vi.fn(),
                onselectrecord: options.onselectrecord ?? vi.fn(),
                selectedRecord: null,
                viewModel: options.viewModel === undefined ? viewModel() : options.viewModel,
            },
        },
        createViewerTestRenderOptions(),
    );
}

describe('ActivityTimeline multi-manning lanes', () => {
    const midnight = timestamp(Date.UTC(2026, 6, 26));
    const hour = 60 * 60 * 1_000;

    function crewRecord(
        activity: 'availability' | 'driving',
        fromHour: number,
        toHour: number,
        slot: 'CoDriver' | 'Driver',
    ): IActivityRecordViewModel {
        const interval = createRecordedActivityInterval(
            activity,
            timestamp(midnight + fromHour * hour),
            timestamp(midnight + toHour * hour),
            source(`/activities/${String(fromHour)}`),
            { crewPresence: 'crew', slot },
        );
        if (interval === null) {
            throw new TypeError('The crew timeline interval fixture must be valid.');
        }
        return activityRecord(
            interval,
            { duration: `${String(toHour - fromHour)} hr`, end: `${String(toHour)}:00`, start: `${String(fromHour)}:00` },
            midnight,
        );
    }

    const driving = crewRecord('driving', 6, 10, 'Driver');
    const availability = crewRecord('availability', 10, 14, 'CoDriver');
    const crewDay: IActivityDayViewModel = {
        ...day(midnight, '2026-07-26', 'July 26, 2026', [driving, availability], totals()),
        creditedBreaks: [
            {
                end: formatted(timestamp(midnight + 10.75 * hour), '10:45'),
                recordId: availability.id,
                start: formatted(availability.start.value, '10:00'),
                timelineEnd: duration(10.75 * hour),
                timelineStart: availability.timelineStart,
            },
        ],
        restWindows: [
            {
                hours: 30,
                id: 'rest-window-1',
                status: 'crew',
                timelineEnd: duration(24 * hour),
                timelineStart: duration(6 * hour),
            },
        ],
    };

    async function renderTimeline(
        variant: 'band' | 'lanes',
        onselectrecord = vi.fn(),
    ): Promise<{
        readonly callbacks: readonly IIntervalTimelineRuntimeCallbacks[];
        readonly model: IIntervalTimelineChartModel;
    }> {
        vi.stubGlobal('IntersectionObserver', VisibleIntersectionObserver);
        const { callbacks, capturedModels, runtimeLoader } = createCapturingIntervalTimelineRuntimeLoader();
        render(
            ActivityTimeline,
            {
                props: {
                    day: crewDay,
                    onclearrecord: vi.fn(),
                    onfailure: vi.fn(),
                    onselectrecord,
                    runtimeLoader,
                    selectedRecord: null,
                    timeBasis: 'UTC',
                    variant,
                },
            },
            createViewerTestRenderOptions(),
        );
        await waitFor(() => {
            expect(runtimeLoader).toHaveBeenCalledTimes(1);
        });
        const model = capturedModels.at(-1);
        if (model === undefined) {
            throw new TypeError('The timeline runtime must capture the chart model.');
        }
        return { callbacks, model };
    }

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('adds the credited break, co-driver slot and two-card lanes, and shades the 30-hour window', async () => {
        const { model } = await renderTimeline('lanes');

        expect(model.lanes.map((lane) => lane.id).slice(-3)).toEqual(['creditedBreak', 'coDriverSlot', 'twoCards']);
        expect(model.lanes.find((lane) => lane.id === 'creditedBreak')?.pattern).toBe('diagonal');
        expect(model.segments.filter((segment) => segment.laneId === 'twoCards')).toHaveLength(2);
        expect(model.segments.filter((segment) => segment.laneId === 'coDriverSlot').map((segment) => segment.start)).toEqual([
            availability.timelineStart,
        ]);
        expect(model.segments.find((segment) => segment.laneId === 'creditedBreak')).toMatchObject({
            description: 'Availability counted as a break, 10:00–10:45, UTC',
            end: 10.75 * hour,
        });
        expect(model.ranges).toEqual([
            {
                colorToken: '--color-chart-range-fill',
                end: 24 * hour,
                id: 'rest-window-1',
                label: '30-hour daily rest window',
                start: 6 * hour,
            },
        ]);
    });

    it('keeps crew rows out of the band view, where they would cover the activity band', async () => {
        const { model } = await renderTimeline('band');

        expect(model.lanes.map((lane) => lane.id)).not.toContain('twoCards');
        expect(model.lanes.map((lane) => lane.id)).toContain('creditedBreak');
    });

    it('selects the activity record when one of its crew segments is chosen', async () => {
        const onselectrecord = vi.fn();
        const { callbacks } = await renderTimeline('lanes', onselectrecord);

        callbacks[0]?.onselect(`${availability.id}#twoCards`);
        expect(onselectrecord).toHaveBeenCalledWith(availability.record);
    });
});

describe('ActivitiesScreen', () => {
    it('formats the day date picker according to the display date format preference', async () => {
        const harness = createViewerDocumentHarness();
        const context = createViewerTestContext(harness.controller);
        render(
            ActivitiesScreen,
            {
                props: {
                    allDaysFilterText: createDocumentScopedValue(''),
                    calendarFilterText: createDocumentScopedValue(''),
                    dayFilterText: createDocumentScopedValue(''),
                    onchartfailure: vi.fn(),
                    onclearrecord: vi.fn(),
                    onopenlinked: vi.fn(),
                    onopensource: vi.fn(),
                    onselectrecord: vi.fn(),
                    selectedRecord: null,
                    viewModel: viewModel(),
                },
            },
            createViewerTestRenderOptionsWithContext(context),
        );

        const dateControl = screen.getByLabelText('Activity date');
        if (!(dateControl instanceof HTMLInputElement)) {
            throw new TypeError('The activity date control must be an input.');
        }
        expect(dateControl.value).toBe('Jul 27, 2026');

        context.preferencesController.open();
        await context.preferencesController.apply(
            buildTestViewerPreferences({ displayDateFormat: 'ddMMyyyy', displayTimeFormat: 'h23' }),
        );

        await waitFor(() => {
            expect(dateControl.value).toBe('27.07.2026');
        });
    });

    it('navigates UTC days and exposes selectable records with exact source actions', async () => {
        const selectRecord = vi.fn();
        const clearRecord = vi.fn();
        const openSource = vi.fn();
        const rendered = renderActivitiesScreen({
            onclearrecord: clearRecord,
            onopensource: openSource,
            onselectrecord: selectRecord,
        });

        const heading = screen.getByRole('heading', { level: 1, name: 'Activities' });
        expect(document.activeElement).toBe(heading);
        expect(rendered.container.querySelectorAll('svg[aria-hidden="true"]').length).toBeGreaterThanOrEqual(5);

        const dateControl = screen.getByLabelText('Activity date');
        if (!(dateControl instanceof HTMLInputElement)) {
            throw new TypeError('The activity date control must be an input.');
        }
        expect(dateControl.value).toBe('Jul 27, 2026');
        await fireEvent.input(dateControl, { target: { value: '2026-07-25' } });
        await fireEvent.blur(dateControl);
        expect(dateControl.value).toBe('Jul 27, 2026');
        expect(screen.getByText('No decoded activity day exists for that date.')).toBeTruthy();
        expect(screen.getAllByText('1 hr, 30 min')).toHaveLength(2);
        expect(screen.getByText('Viewer-inferred gap; no recorded source')).toBeTruthy();

        const timeline = screen.getByRole('button', {
            name: 'A 24-hour UTC activity timeline. Use the arrow keys to move through chronological records.',
        });
        await fireEvent.focus(timeline);
        expect(screen.getByText('Other work, 09:00–10:30, 1 hr, 30 min, UTC')).toBeTruthy();
        await fireEvent.keyDown(timeline, { key: 'ArrowRight' });
        expect(selectRecord).toHaveBeenCalledTimes(1);
        expect(selectRecord).toHaveBeenNthCalledWith(1, expect.objectContaining({ activity: 'unknown' }));
        await fireEvent.keyDown(timeline, { key: 'Escape' });
        expect(clearRecord).toHaveBeenCalledTimes(1);

        const styleGroup = screen.getByRole('group', { name: 'Chart style' });
        const lanesButton = within(styleGroup).getByRole('button', { name: 'Activity lanes' });
        const bandButton = within(styleGroup).getByRole('button', { name: 'Day profile' });
        expect(lanesButton.getAttribute('aria-pressed')).toBe('true');
        expect(bandButton.getAttribute('aria-pressed')).toBe('false');
        expect(rendered.container.querySelector('.chart-legend')).toBeNull();
        await fireEvent.click(bandButton);
        expect(lanesButton.getAttribute('aria-pressed')).toBe('false');
        expect(bandButton.getAttribute('aria-pressed')).toBe('true');
        const legend = rendered.container.querySelector('.chart-legend');
        if (!(legend instanceof HTMLElement)) {
            throw new TypeError('The day-profile legend must be rendered in band mode.');
        }
        expect(within(legend).getAllByRole('listitem')).toHaveLength(5);
        await fireEvent.click(lanesButton);
        expect(lanesButton.getAttribute('aria-pressed')).toBe('true');

        const table = screen.getByRole('table', {
            name: 'Chronological activity records for the selected UTC day',
        });
        expect(within(table).getAllByRole('row')).toHaveLength(3);
        await fireEvent.click(
            within(table).getByRole('button', {
                name: 'Select activity record: Other work, 09:00–10:30',
            }),
        );
        expect(selectRecord).toHaveBeenCalledTimes(2);

        await fireEvent.click(
            within(table).getByRole('button', {
                name: 'Open in Raw Data: /activities/1',
            }),
        );
        expect(openSource).toHaveBeenCalledWith(source('/activities/1').path);

        await fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
        expect(dateControl.value).toBe('Jul 26, 2026');
        expect(screen.getByRole('button', { name: 'Open in Raw Data: /activities/0' })).toBeTruthy();
        const previousButton = screen.getByRole('button', { name: 'Previous day' });
        if (!(previousButton instanceof HTMLButtonElement)) {
            throw new TypeError('The previous-day control must be a button.');
        }
        expect(previousButton.disabled).toBe(true);
    });

    it('lists all decoded days and jumps to the chosen day view', async () => {
        renderActivitiesScreen();

        const allDaysTab = screen.getByRole('tab', { name: 'All days' });
        expect(screen.getByRole('tab', { name: 'Day view' }).getAttribute('aria-selected')).toBe('true');
        await fireEvent.click(allDaysTab);
        expect(allDaysTab.getAttribute('aria-selected')).toBe('true');

        const table = screen.getByRole('table', {
            name: 'Viewer-calculated activity totals for every decoded UTC day',
        });
        expect(within(table).getAllByRole('row')).toHaveLength(3);
        expect(within(table).getByText('July 26, 2026')).toBeTruthy();
        expect(within(table).getByText('1 hr, 30 min')).toBeTruthy();

        await fireEvent.click(within(table).getByRole('button', { name: 'Show day: July 26, 2026' }));
        expect(screen.getByRole('tab', { name: 'Day view' }).getAttribute('aria-selected')).toBe('true');
        const dateControl = screen.getByLabelText('Activity date');
        if (!(dateControl instanceof HTMLInputElement)) {
            throw new TypeError('The activity date control must be an input.');
        }
        expect(dateControl.value).toBe('Jul 26, 2026');
        expect(document.activeElement).toBe(dateControl);
    });

    it('renders the calendar grid with totals, legend, and a month-scoped table', async () => {
        renderActivitiesScreen();

        await fireEvent.click(screen.getByRole('tab', { name: 'Calendar' }));

        const grid = screen.getByRole('grid', { name: 'Activity calendar for July 2026' });
        expect(within(grid).getAllByRole('columnheader')).toHaveLength(7);
        expect(within(grid).getByText('Mon')).toBeTruthy();
        expect(within(grid).getByText('Sun')).toBeTruthy();
        expect(within(grid).getByRole('button', { name: 'Jul 26, 2026: Driving 1 hr' })).toBeTruthy();
        const monday = within(grid).getByRole('button', {
            name: 'Jul 27, 2026: Other work 1 hr, 30 min, Unknown 30 min',
        });
        expect(monday.getAttribute('tabindex')).toBe('0');
        expect(within(grid).getByRole('button', { name: 'Jul 1, 2026' })).toBeTruthy();

        const legend = screen.getByRole('list', { name: 'Activity key' });
        expect(within(legend).getAllByRole('listitem')).toHaveLength(5);
        expect(within(legend).getByText('Driving')).toBeTruthy();
        expect(within(legend).getByText('Unknown')).toBeTruthy();

        const weekGroup = screen.getByText('Selected week').closest('.calendar-totals-group');
        if (!(weekGroup instanceof HTMLElement)) {
            throw new TypeError('The week totals group must be rendered.');
        }
        expect(within(weekGroup).getByText('1 hr, 30 min')).toBeTruthy();
        expect(within(weekGroup).getByText('30 min')).toBeTruthy();

        const monthGroup = screen.getByText('Visible month').closest('.calendar-totals-group');
        if (!(monthGroup instanceof HTMLElement)) {
            throw new TypeError('The month totals group must be rendered.');
        }
        expect(within(monthGroup).getByText('1 hr')).toBeTruthy();
        expect(within(monthGroup).getByText('1 hr, 30 min')).toBeTruthy();

        const rangeGroup = screen.getByText('Selected range').closest('.calendar-totals-group');
        if (!(rangeGroup instanceof HTMLElement)) {
            throw new TypeError('The range totals group must be rendered.');
        }
        expect(within(rangeGroup).getByText('1 hr')).toBeTruthy();

        expect(screen.getByRole('heading', { name: 'Daily totals for July 2026' })).toBeTruthy();
        const monthTable = screen.getByRole('table', {
            name: 'Viewer-calculated activity totals for the decoded days in the visible month',
        });
        expect(within(monthTable).getAllByRole('row')).toHaveLength(3);
        expect(within(monthTable).getByText('July 26, 2026')).toBeTruthy();
    });

    it('navigates the calendar with the keyboard and opens the selected day', async () => {
        renderActivitiesScreen();

        await fireEvent.click(screen.getByRole('tab', { name: 'Calendar' }));
        const grid = screen.getByRole('grid', { name: 'Activity calendar for July 2026' });

        const monday = within(grid).getByRole('button', {
            name: 'Jul 27, 2026: Other work 1 hr, 30 min, Unknown 30 min',
        });
        expect(monday.getAttribute('tabindex')).toBe('0');
        await fireEvent.keyDown(monday, { key: 'ArrowRight' });
        const tuesday = within(grid).getByRole('button', { name: 'Jul 28, 2026' });
        expect(tuesday.getAttribute('tabindex')).toBe('0');
        expect(document.activeElement).toBe(tuesday);

        await fireEvent.keyDown(tuesday, { key: 'PageDown' });
        expect(screen.getByRole('grid', { name: 'Activity calendar for August 2026' })).toBeTruthy();
        const augustFriday = within(screen.getByRole('grid', { name: 'Activity calendar for August 2026' })).getByRole('button', {
            name: 'Aug 28, 2026',
        });
        expect(augustFriday.getAttribute('tabindex')).toBe('0');
        expect(document.activeElement).toBe(augustFriday);

        await fireEvent.keyDown(augustFriday, { key: 'Home' });
        const augustGrid = screen.getByRole('grid', { name: 'Activity calendar for August 2026' });
        const mondayButton = within(augustGrid).getByRole('button', { name: 'Aug 24, 2026' });
        expect(document.activeElement).toBe(mondayButton);
        await fireEvent.keyDown(mondayButton, { key: 'End' });
        const sundayButton = within(augustGrid).getByRole('button', { name: 'Aug 30, 2026' });
        expect(document.activeElement).toBe(sundayButton);

        await fireEvent.keyDown(sundayButton, { key: 'PageUp' });
        const julyGrid = screen.getByRole('grid', { name: 'Activity calendar for July 2026' });
        expect(within(julyGrid).getByRole('button', { name: 'Jul 30, 2026' }).getAttribute('tabindex')).toBe('0');

        await fireEvent.click(within(julyGrid).getByRole('button', { name: 'Jul 26, 2026: Driving 1 hr' }));
        expect(screen.getByRole('tab', { name: 'Day view' }).getAttribute('aria-selected')).toBe('true');
        const dateControl = screen.getByLabelText('Activity date');
        if (!(dateControl instanceof HTMLInputElement)) {
            throw new TypeError('The activity date control must be an input.');
        }
        expect(dateControl.value).toBe('Jul 26, 2026');
    });

    it('reports unavailable dates and updates range totals from the date inputs', async () => {
        renderActivitiesScreen();

        await fireEvent.click(screen.getByRole('tab', { name: 'Calendar' }));
        await fireEvent.click(screen.getByRole('button', { name: 'Jul 1, 2026' }));
        expect(screen.getAllByText('No decoded activity day exists for that date.').length).toBeGreaterThanOrEqual(1);

        const rangeFrom = screen.getByLabelText('Range start');
        const rangeTo = screen.getByLabelText('Range end');
        if (!(rangeFrom instanceof HTMLInputElement) || !(rangeTo instanceof HTMLInputElement)) {
            throw new TypeError('The calendar range controls must be date inputs.');
        }
        expect(rangeFrom.value).toBe('Jul 1, 2026');
        expect(rangeTo.value).toBe('Jul 31, 2026');

        await fireEvent.input(rangeFrom, { target: { value: '2026-07-27' } });
        await fireEvent.blur(rangeFrom);
        await fireEvent.input(rangeTo, { target: { value: '2026-07-27' } });
        await fireEvent.blur(rangeTo);
        const rangeGroup = screen.getByText('Selected range').closest('.calendar-totals-group');
        if (!(rangeGroup instanceof HTMLElement)) {
            throw new TypeError('The range totals group must be rendered.');
        }
        expect(within(rangeGroup).getAllByText('0 ms')).toHaveLength(3);
        expect(within(rangeGroup).getByText('1 hr, 30 min')).toBeTruthy();

        await fireEvent.input(rangeFrom, { target: { value: '2026-07-28' } });
        await fireEvent.blur(rangeFrom);
        expect(screen.getByText('The range start is after the range end.')).toBeTruthy();
    });

    it('renders the yearly presence heatmap with year totals and a year-scoped table', async () => {
        renderActivitiesScreen();

        await fireEvent.click(screen.getByRole('tab', { name: 'Calendar' }));
        await fireEvent.click(screen.getByRole('button', { name: 'Year' }));

        const heatmap = screen.getByRole('grid', { name: 'Activity presence for 2026' });
        expect(within(heatmap).getAllByRole('columnheader')).toHaveLength(13);
        expect(within(heatmap).getAllByRole('rowheader')).toHaveLength(31);
        expect(within(heatmap).getByText('Jan')).toBeTruthy();
        expect(within(heatmap).getByText('Dec')).toBeTruthy();
        expect(within(heatmap).getByRole('gridcell', { name: 'Jul 26, 2026: Recorded activity 1 hr' })).toBeTruthy();

        expect(screen.getByText('2 of 2 decoded days in this year contain recorded activity.')).toBeTruthy();

        const yearGroup = screen.getByText('Visible year').closest('.calendar-totals-group');
        if (!(yearGroup instanceof HTMLElement)) {
            throw new TypeError('The year totals group must be rendered.');
        }
        expect(within(yearGroup).getByText('1 hr')).toBeTruthy();
        expect(within(yearGroup).getByText('1 hr, 30 min')).toBeTruthy();

        const rangeFrom = screen.getByLabelText('Range start');
        const rangeTo = screen.getByLabelText('Range end');
        if (!(rangeFrom instanceof HTMLInputElement) || !(rangeTo instanceof HTMLInputElement)) {
            throw new TypeError('The calendar range controls must be date inputs.');
        }
        expect(rangeFrom.value).toBe('Jan 1, 2026');
        expect(rangeTo.value).toBe('Dec 31, 2026');

        expect(screen.getByRole('heading', { name: 'Daily totals for 2026' })).toBeTruthy();
        const yearTable = screen.getByRole('table', {
            name: 'Viewer-calculated activity totals for the decoded days in the visible year',
        });
        expect(within(yearTable).getAllByRole('row')).toHaveLength(3);
        expect(within(yearTable).getByText('July 26, 2026')).toBeTruthy();

        await fireEvent.click(screen.getByRole('button', { name: 'Previous year' }));
        expect(screen.getByRole('grid', { name: 'Activity presence for 2025' })).toBeTruthy();
        expect(screen.getByText('0 of 0 decoded days in this year contain recorded activity.')).toBeTruthy();
        expect(screen.getByText('No decoded activity days are present in the visible year.')).toBeTruthy();
    });

    it('mirrors month-view behavior by allowing date activation and reporting unavailable days in year view', async () => {
        renderActivitiesScreen();

        await fireEvent.click(screen.getByRole('tab', { name: 'Calendar' }));
        await fireEvent.click(screen.getByRole('button', { name: 'Year' }));

        const heatmap = screen.getByRole('grid', { name: 'Activity presence for 2026' });

        const emptyDay = within(heatmap).getByRole('button', { name: 'Jan 10, 2026' });
        await fireEvent.click(emptyDay);
        expect(screen.getAllByText('No decoded activity day exists for that date.').length).toBeGreaterThanOrEqual(1);

        const recordedDay = within(heatmap).getByRole('button', { name: 'Jul 26, 2026: Recorded activity 1 hr' });
        await fireEvent.click(recordedDay);
        expect(screen.getByRole('tab', { name: 'Day view' }).getAttribute('aria-selected')).toBe('true');
        const dateControl = screen.getByLabelText('Activity date');
        if (!(dateControl instanceof HTMLInputElement)) {
            throw new TypeError('The activity date control must be an input.');
        }
        expect(dateControl.value).toBe('Jul 26, 2026');
    });

    it('renders explicit empty and projection-error states', async () => {
        const commonProps = {
            allDaysFilterText: createDocumentScopedValue(''),
            calendarFilterText: createDocumentScopedValue(''),
            dayFilterText: createDocumentScopedValue(''),
            onchartfailure: vi.fn(),
            onclearrecord: vi.fn(),
            onopenlinked: vi.fn(),
            onselectrecord: vi.fn(),
            onopensource: vi.fn(),
            selectedRecord: null,
        };
        const rendered = render(
            ActivitiesScreen,
            {
                props: {
                    ...commonProps,
                    viewModel: {
                        days: [],
                        locale: 'en',
                        timeZone: 'UTC',
                    },
                },
            },
            createViewerTestRenderOptions(),
        );
        expect(screen.getByText('No activity days were decoded from this file.')).toBeTruthy();

        await rendered.rerender({
            ...commonProps,
            viewModel: null,
        });
        expect(screen.getByRole('heading', { name: 'Activities unavailable' })).toBeTruthy();
        expect(screen.getByText('The decoded activity records could not be mapped to a safe presentation model.')).toBeTruthy();
    });

    it('emits the selected day for each linked-records action', async () => {
        const openLinked = vi.fn();
        renderActivitiesScreen({ onopenlinked: openLinked });

        const heading = screen.getByRole('heading', {
            level: 2,
            name: 'Linked records for the selected day',
        });
        expect(heading).toBeTruthy();
        const group = screen.getByRole('group', {
            name: 'Linked records for the selected day',
        });
        const secondMidnight = timestamp(Date.UTC(2026, 6, 27));

        await fireEvent.click(within(group).getByRole('button', { name: 'Show vehicles & drivers' }));
        expect(openLinked).toHaveBeenNthCalledWith(1, 'associations', expect.objectContaining({ midnightUtc: secondMidnight }));

        await fireEvent.click(within(group).getByRole('button', { name: 'Show places' }));
        expect(openLinked).toHaveBeenNthCalledWith(2, 'places', expect.objectContaining({ midnightUtc: secondMidnight }));

        await fireEvent.click(within(group).getByRole('button', { name: 'Show events & faults' }));
        expect(openLinked).toHaveBeenNthCalledWith(
            3,
            'eventsAndFaults',
            expect.objectContaining({ midnightUtc: secondMidnight }),
        );
    });

    it('renders timeline infringement pins and selects the infringement on click', async () => {
        const selectInfringement = vi.fn();
        const baseModel = viewModel();
        const firstDay = baseModel.days[0];
        if (firstDay === undefined) {
            throw new TypeError('Expected first day in view model');
        }

        const drivingRecord = firstDay.records[0];
        if (drivingRecord === undefined) {
            throw new TypeError('Expected first record in view model');
        }

        const infringementPin: IActivityInfringementPinViewModel = {
            allowedValueMinutes: 270,
            article: 'Art. 7',
            category: 'break',
            description: 'Continuous driving without break',
            excessOrDeficitMinutes: 15,
            formattedTime: '09:30',
            id: 'break-infringement-1',
            matchedRecordId: drivingRecord.id,
            measuredValueMinutes: 285,
            percentage: 39.58,
            recordedAt: timestamp(1_700_000_000_000),
            regulation: 'Regulation (EC) No 561/2006',
            ruleId: 'BREAK_CONTINUOUS_DRIVING',
            severity: 'serious',
            source: source('/cardActivityDailyRecord/0/activityChangeInfo/15'),
            timeOffsetMs: duration(9 * 60 * 60 * 1000 + 30 * 60 * 1000),
            title: 'Break Requirement Exceeded',
        };

        const dayWithInfringements: IActivityDayViewModel = {
            ...firstDay,
            infringements: [infringementPin],
        };

        const testModel: IActivitySectionViewModel = {
            ...baseModel,
            days: [dayWithInfringements],
        };

        renderActivitiesScreen({ onselectinfringement: selectInfringement, viewModel: testModel });

        const pinRegion = screen.getByRole('region', {
            name: 'Timeline infringement markers',
        });
        expect(pinRegion).toBeTruthy();

        const pinButton = within(pinRegion).getByRole('button', {
            name: /Continuous driving without required 45-minute break at 09:30 \(Serious\)/i,
        });
        expect(pinButton).toBeTruthy();
        expect(pinButton.getAttribute('data-severity')).toBe('serious');

        await fireEvent.click(pinButton);
        expect(selectInfringement).toHaveBeenCalledTimes(1);
        expect(selectInfringement).toHaveBeenCalledWith(infringementPin);
    });
    it('explains a failed multi-manning condition on the duty shift and shows the deciding driving', async () => {
        const selectRecord = vi.fn();
        const baseModel = viewModel();
        const firstDay = baseModel.days[0];
        const drivingRecord = firstDay?.records[0];
        if (firstDay === undefined || drivingRecord === undefined) {
            throw new TypeError('Expected the first day and its driving record');
        }
        const shift: IDutyShiftViewModel = {
            crew: {
                failedAt: formatted(drivingRecord.start.value, '08:00'),
                failedRecordId: drivingRecord.id,
                restWindowEnd: formatted(timestamp(drivingRecord.start.value + MILLISECONDS_PER_DAY), '08:00'),
                restWindowEndDayOffset: 1,
                restWindowHours: 24,
                restWindowStart: formatted(drivingRecord.start.value, '08:00'),
                status: 'crewFailed',
            },
            dayUtc: firstDay.midnightUtc,
            drivingDuration: formatted(duration(MILLISECONDS_PER_HOUR), '1 hr'),
            formattedSpan: '08:00 – 09:00',
            id: 'shift-1',
            records: [drivingRecord],
            restDuration: formatted(duration(0), '0 min'),
            shiftEnd: drivingRecord.end,
            shiftStart: drivingRecord.start,
            totalDutyDuration: formatted(duration(MILLISECONDS_PER_HOUR), '1 hr'),
            workDuration: formatted(duration(0), '0 min'),
        };

        renderActivitiesScreen({
            onselectrecord: selectRecord,
            viewModel: { ...baseModel, days: [{ ...firstDay, dutyShifts: [shift] }] },
        });
        await fireEvent.click(screen.getByRole('button', { name: 'Duty Shift' }));

        expect(screen.getByText('Multi-manning condition not met · 24-hour rule')).toBeTruthy();
        expect(screen.getByText('08:00 → 08:00 +1 d (24 h)')).toBeTruthy();
        const notice = screen.getByRole('note');
        expect(notice.textContent).toContain('driving with only one driver card after the first hour, at 08:00');

        await fireEvent.click(within(notice).getByRole('button', { name: 'Show on timeline' }));
        expect(selectRecord).toHaveBeenCalledWith(drivingRecord.record);
    });
});
