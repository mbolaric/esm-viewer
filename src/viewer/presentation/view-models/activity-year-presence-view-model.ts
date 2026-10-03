import { ACTIVITY_KINDS, isDurationMilliseconds, isUtcTimestamp } from '#viewer-domain';
import { MILLISECONDS_PER_MINUTE } from '#time';
import {
    formatUtcDateInputValue,
    type IActivityDayViewModel,
    type IActivityTotalsViewModel,
    type IFormattedValue,
} from './document-view-model.js';
import { formatViewerActivityTotals, type ICalendarMonthDayViewModel } from './activity-calendar-view-model.js';
import type { ViewerLocalisationService } from '../helpers/view-model-formatting.js';

const minutesPerDay = 24 * 60;

export interface IYearPresenceDayViewModel {
    readonly dateDisplay: string;
    readonly dateInputValue: string;
    readonly dayOfMonth: number;
    readonly hasActivities: boolean;
    readonly indexInDays: number | null;
    readonly intensity: number;
    readonly isInMonth: boolean;
    readonly minutes: number;
    readonly minutesDisplay: string;
}

export interface IActivityYearPresenceViewModel {
    readonly days: readonly (readonly IYearPresenceDayViewModel[])[];
    readonly monthLabels: readonly string[];
    readonly presentDayCount: IFormattedValue<number>;
    readonly totalDayCount: IFormattedValue<number>;
    readonly year: number;
    readonly yearDays: readonly ICalendarMonthDayViewModel[];
    readonly yearEnd: string;
    readonly yearLabel: string;
    readonly yearStart: string;
    readonly yearTotals: IActivityTotalsViewModel;
}

function totalMinutesOf(day: IActivityDayViewModel): number {
    let total = 0;
    for (const activity of ACTIVITY_KINDS) {
        total += day.totals[activity].value;
    }
    return Math.round(total / MILLISECONDS_PER_MINUTE);
}

function formattedCount(value: number, localisation: ViewerLocalisationService): IFormattedValue<number> {
    return { display: localisation.formatNumber(value), value };
}

function emptyCell(dayOfMonth: number): IYearPresenceDayViewModel {
    return {
        dateDisplay: '',
        dateInputValue: '',
        dayOfMonth,
        hasActivities: false,
        indexInDays: null,
        intensity: 0,
        isInMonth: false,
        minutes: 0,
        minutesDisplay: '',
    };
}

export function createActivityYearPresenceViewModel(
    days: readonly IActivityDayViewModel[],
    year: number,
    localisation: ViewerLocalisationService,
): IActivityYearPresenceViewModel {
    const daysByDate = new Map<string, number>();
    for (let index = 0; index < days.length; index += 1) {
        const day = days[index];
        if (day !== undefined) {
            daysByDate.set(day.dateInputValue, index);
        }
    }

    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const monthLengths = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    const grid: IYearPresenceDayViewModel[][] = [];
    for (let dayOfMonth = 1; dayOfMonth <= 31; dayOfMonth += 1) {
        const row: IYearPresenceDayViewModel[] = [];
        for (let month = 0; month < 12; month += 1) {
            const monthLength = monthLengths[month] ?? 31;
            if (dayOfMonth > monthLength) {
                row.push(emptyCell(dayOfMonth));
                continue;
            }
            const timestampValue = Date.UTC(year, month, dayOfMonth);
            if (!isUtcTimestamp(timestampValue)) {
                throw new TypeError('The heatmap day is outside the supported date range.');
            }
            const dateInputValue = formatUtcDateInputValue(timestampValue);
            const indexInDays = daysByDate.get(dateInputValue);
            const day = indexInDays === undefined ? undefined : (days[indexInDays] ?? undefined);
            const minutes = day === undefined ? 0 : totalMinutesOf(day);
            const minutesDuration = minutes * MILLISECONDS_PER_MINUTE;
            const minutesDisplay = isDurationMilliseconds(minutesDuration) ? localisation.formatDuration(minutesDuration) : '';
            row.push({
                dateDisplay: localisation.formatUtcDate(timestampValue),
                dateInputValue,
                dayOfMonth,
                hasActivities: day !== undefined && minutes > 0,
                indexInDays: indexInDays ?? null,
                intensity: Math.round(Math.min(minutes / minutesPerDay, 1) * 100) / 100,
                isInMonth: true,
                minutes,
                minutesDisplay,
            });
        }
        grid.push(row);
    }

    const monthLabels: string[] = [];
    for (let month = 0; month < 12; month += 1) {
        const monthStart = Date.UTC(year, month, 1);
        if (!isUtcTimestamp(monthStart)) {
            throw new TypeError('The heatmap month start is outside the supported date range.');
        }
        monthLabels.push(localisation.formatMonthShortLabel(monthStart));
    }

    const yearDays: ICalendarMonthDayViewModel[] = [];
    let presentDays = 0;
    for (let index = 0; index < days.length; index += 1) {
        const day = days[index];
        if (day === undefined) {
            continue;
        }
        const date = new Date(day.midnightUtc);
        if (date.getUTCFullYear() !== year) {
            continue;
        }
        yearDays.push({ day, index });
        if (totalMinutesOf(day) > 0) {
            presentDays += 1;
        }
    }

    const yearStart = Date.UTC(year, 0, 1);
    const yearEnd = Date.UTC(year, 11, 31);
    if (!isUtcTimestamp(yearStart) || !isUtcTimestamp(yearEnd)) {
        throw new TypeError('The heatmap year is outside the supported date range.');
    }

    return {
        days: grid,
        monthLabels,
        presentDayCount: formattedCount(presentDays, localisation),
        totalDayCount: formattedCount(yearDays.length, localisation),
        year,
        yearDays,
        yearEnd: formatUtcDateInputValue(yearEnd),
        yearLabel: localisation.formatNumber(year, { useGrouping: false }),
        yearStart: formatUtcDateInputValue(yearStart),
        yearTotals: formatViewerActivityTotals(
            yearDays.map((entry) => entry.day),
            localisation,
        ),
    };
}
