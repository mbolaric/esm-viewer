import { describe, expect, it } from 'vitest';

import {
    calendarMonthOf,
    calendarWeekBounds,
    createActivityCalendarViewModel,
    createActivityRangeTotalsViewModel,
    shiftCalendarDate,
    shiftCalendarMonth,
    type IActivityCalendarInput,
} from '../view-models/activity-calendar-view-model.js';
import type { IActivityDayViewModel } from '../view-models/document-view-model.js';

import { day, duration, formatted, localisation, timestamp, totals } from './activity-view-model-fixture.js';

function july2026Days(): readonly IActivityDayViewModel[] {
    const firstMidnight = timestamp(Date.UTC(2026, 6, 26));
    const secondMidnight = timestamp(Date.UTC(2026, 6, 27));
    const augustMidnight = timestamp(Date.UTC(2026, 7, 2));
    return [
        day(firstMidnight, '2026-07-26', totals({ driving: formatted(duration(60 * 60 * 1_000), '1 hr') })),
        day(
            secondMidnight,
            '2026-07-27',
            totals({
                unknown: formatted(duration(30 * 60 * 1_000), '30 min'),
                work: formatted(duration(90 * 60 * 1_000), '1 hr, 30 min'),
            }),
        ),
        day(augustMidnight, '2026-08-02', totals({ breakOrRest: formatted(duration(45 * 60 * 1_000), '45 min') })),
    ];
}

function calendarInput(overrides: Partial<IActivityCalendarInput> = {}): IActivityCalendarInput {
    return {
        focusedDate: overrides.focusedDate ?? '2026-07-27',
        month: overrides.month ?? { month: 6, year: 2026 },
        selectedDayIndex: overrides.selectedDayIndex ?? 1,
    };
}

describe('createActivityCalendarViewModel', () => {
    it('lays out a Monday-start month grid with localized weekday labels', () => {
        const viewModel = createActivityCalendarViewModel(july2026Days(), calendarInput(), localisation());

        expect(viewModel.monthLabel).toBe('month:2026-07');
        expect(viewModel.monthStart).toBe('2026-07-01');
        expect(viewModel.monthEnd).toBe('2026-07-31');
        expect(viewModel.weekdayLabels).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
        expect(viewModel.weeks).toHaveLength(5);
        expect(viewModel.weeks[0]?.map((cell) => cell.dateInputValue)).toEqual([
            '2026-06-29',
            '2026-06-30',
            '2026-07-01',
            '2026-07-02',
            '2026-07-03',
            '2026-07-04',
            '2026-07-05',
        ]);
        expect(viewModel.weeks[4]?.map((cell) => cell.dateInputValue)).toEqual([
            '2026-07-27',
            '2026-07-28',
            '2026-07-29',
            '2026-07-30',
            '2026-07-31',
            '2026-08-01',
            '2026-08-02',
        ]);
        expect(viewModel.weeks[0]?.[0]?.isInCurrentMonth).toBe(false);
        expect(viewModel.weeks[0]?.[2]?.isInCurrentMonth).toBe(true);
    });

    it('exposes populated days with driving totals and compact strips', () => {
        const viewModel = createActivityCalendarViewModel(july2026Days(), calendarInput(), localisation());

        const sunday = viewModel.weeks[3]?.[6];
        if (sunday === undefined) {
            throw new TypeError('The populated Sunday cell must map to a decoded day.');
        }
        if (sunday.indexInDays === null) {
            throw new TypeError('The populated Sunday cell must map to a decoded day.');
        }
        expect(sunday.dateDisplay).toBe('utc-date:2026-07-26');
        expect(sunday.dayOfMonth).toBe(26);
        expect(sunday.drivingDisplay).toBe('1 hr');
        expect(sunday.indexInDays).toBe(0);
        expect(sunday.strip).toEqual([
            {
                activity: 'driving',
                display: '1 hr',
                inlinePercent: 100,
                minutes: 60,
            },
        ]);

        const monday = viewModel.weeks[4]?.[0];
        if (monday === undefined) {
            throw new TypeError('The populated Monday cell must map to a decoded day.');
        }
        if (monday.indexInDays === null) {
            throw new TypeError('The populated Monday cell must map to a decoded day.');
        }
        expect(monday.drivingDisplay).toBe('0 min');
        expect(monday.strip).toEqual([
            {
                activity: 'work',
                display: '1 hr, 30 min',
                inlinePercent: 75,
                minutes: 90,
            },
            {
                activity: 'unknown',
                display: '30 min',
                inlinePercent: 25,
                minutes: 30,
            },
        ]);
    });

    it('keeps adjacent-month decoded days selectable and empty cells inert', () => {
        const viewModel = createActivityCalendarViewModel(july2026Days(), calendarInput(), localisation());

        const augustSecond = viewModel.weeks[4]?.[6];
        if (augustSecond === undefined) {
            throw new TypeError('The adjacent-month cell must exist in the July grid.');
        }
        expect(augustSecond.isInCurrentMonth).toBe(false);
        expect(augustSecond.indexInDays).toBe(2);
        expect(augustSecond.strip[0]?.activity).toBe('breakOrRest');

        const julyFirst = viewModel.weeks[0]?.[2];
        if (julyFirst === undefined) {
            throw new TypeError('The July 1 cell must exist.');
        }
        expect(julyFirst.indexInDays).toBeNull();
        expect(julyFirst.drivingDisplay).toBeNull();
        expect(julyFirst.strip).toEqual([]);
    });

    it('sums viewer-calculated totals for the visible month and the focused week', () => {
        const viewModel = createActivityCalendarViewModel(july2026Days(), calendarInput(), localisation());

        expect(viewModel.monthTotals.work.value).toBe(duration(90 * 60 * 1_000));
        expect(viewModel.monthTotals.unknown.value).toBe(duration(30 * 60 * 1_000));
        expect(viewModel.monthTotals.driving.value).toBe(duration(60 * 60 * 1_000));
        expect(viewModel.monthTotals.breakOrRest.value).toBe(duration(0));
        expect(viewModel.monthTotals.driving.display).toBe('duration:3600000');

        expect(viewModel.selectedDayIndex).toBe(1);
        expect(viewModel.weekTotals.work.value).toBe(duration(90 * 60 * 1_000));
        expect(viewModel.weekTotals.unknown.value).toBe(duration(30 * 60 * 1_000));
        expect(viewModel.weekTotals.driving.value).toBe(duration(0));
    });

    it('computes a Monday-start week around the focused date', () => {
        const viewModel = createActivityCalendarViewModel(
            july2026Days(),
            calendarInput({ focusedDate: '2026-07-26' }),
            localisation(),
        );

        expect(viewModel.weekTotals.driving.value).toBe(duration(60 * 60 * 1_000));
        expect(viewModel.weekTotals.work.value).toBe(duration(0));
    });

    it('lists only the decoded days of the visible month with stable indexes', () => {
        const viewModel = createActivityCalendarViewModel(july2026Days(), calendarInput(), localisation());

        expect(viewModel.monthDays.map((entry) => entry.day.dateInputValue)).toEqual(['2026-07-26', '2026-07-27']);
        expect(viewModel.monthDays.map((entry) => entry.index)).toEqual([0, 1]);
    });

    it('formats an empty day collection as an inert grid with zero totals', () => {
        const viewModel = createActivityCalendarViewModel(
            [],
            calendarInput({ selectedDayIndex: -1, focusedDate: '2026-07-01' }),
            localisation(),
        );

        expect(viewModel.weeks.flat().every((cell) => cell.indexInDays === null)).toBe(true);
        expect(viewModel.weekTotals.driving.value).toBe(duration(0));
        expect(viewModel.monthTotals.driving.value).toBe(duration(0));
        expect(viewModel.monthDays).toEqual([]);
    });
});

describe('calendar date navigation helpers', () => {
    it('shifts by whole days across month boundaries', () => {
        expect(shiftCalendarDate('2026-07-01', -1)).toBe('2026-06-30');
        expect(shiftCalendarDate('2026-07-31', 1)).toBe('2026-08-01');
        expect(shiftCalendarDate('2026-07-26', 7)).toBe('2026-08-02');
        expect(shiftCalendarDate('not-a-date', 1)).toBeNull();
    });

    it('shifts by month while clamping the day of month', () => {
        expect(shiftCalendarMonth('2026-07-26', -1)).toBe('2026-06-26');
        expect(shiftCalendarMonth('2026-07-31', 1)).toBe('2026-08-31');
        expect(shiftCalendarMonth('2026-03-31', -1)).toBe('2026-02-28');
        expect(shiftCalendarMonth('2026-12-15', 1)).toBe('2027-01-15');
        expect(shiftCalendarMonth('not-a-date', 1)).toBeNull();
    });

    it('resolves the Monday-start week bounds of a date', () => {
        expect(calendarWeekBounds('2026-07-26')).toEqual({
            end: '2026-07-26',
            start: '2026-07-20',
        });
        expect(calendarWeekBounds('2026-07-22')).toEqual({
            end: '2026-07-26',
            start: '2026-07-20',
        });
        expect(calendarWeekBounds('not-a-date')).toBeNull();
    });

    it('resolves the UTC month of a date', () => {
        expect(calendarMonthOf('2026-07-26')).toEqual({ month: 6, year: 2026 });
        expect(calendarMonthOf('2026-01-05')).toEqual({ month: 0, year: 2026 });
        expect(calendarMonthOf('not-a-date')).toBeNull();
        expect(calendarMonthOf('2026-02-31')).toBeNull();
        expect(shiftCalendarDate('2026-02-31', 1)).toBeNull();
    });
});

describe('createActivityRangeTotalsViewModel', () => {
    it('sums the inclusive selected range', () => {
        const result = createActivityRangeTotalsViewModel(july2026Days(), '2026-07-26', '2026-07-27', localisation());

        expect(result).not.toBeNull();
        expect(result?.driving.value).toBe(duration(60 * 60 * 1_000));
        expect(result?.work.value).toBe(duration(90 * 60 * 1_000));
        expect(result?.unknown.value).toBe(duration(30 * 60 * 1_000));
    });

    it('returns null when the range is reversed or malformed', () => {
        expect(createActivityRangeTotalsViewModel(july2026Days(), '2026-07-27', '2026-07-26', localisation())).toBeNull();
        expect(createActivityRangeTotalsViewModel(july2026Days(), 'not-a-date', '2026-07-27', localisation())).toBeNull();
    });

    it('returns zero totals when no decoded day falls inside the range', () => {
        const result = createActivityRangeTotalsViewModel(july2026Days(), '2026-07-01', '2026-07-25', localisation());

        expect(result).not.toBeNull();
        expect(result?.driving.value).toBe(duration(0));
        expect(result?.work.value).toBe(duration(0));
    });
});
