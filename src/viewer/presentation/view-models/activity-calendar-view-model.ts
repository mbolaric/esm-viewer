import {
    ACTIVITY_KINDS,
    isUtcTimestamp,
    sumActivityTotals,
    type ActivityKind,
    type DurationMilliseconds,
    type UtcTimestamp,
} from '#viewer-domain';
import { DAYS_PER_WEEK, MILLISECONDS_PER_DAY, MILLISECONDS_PER_MINUTE, parseIsoUtcDay } from '#time';
import {
    formatUtcDateInputValue,
    type IActivityDayViewModel,
    type IActivityTotalsViewModel,
    type IFormattedValue,
} from './document-view-model.js';
import type { CrewQualificationStatus } from '#compliance';
import type { ViewerLocalisationService } from '../helpers/view-model-formatting.js';

export interface ICalendarMonthInput {
    readonly month: number;
    readonly year: number;
}

export interface ICalendarDayStripViewModel {
    readonly activity: ActivityKind;
    readonly display: string;
    readonly inlinePercent: number;
    readonly minutes: number;
}

export interface ICalendarDayViewModel {
    // Null for a date without recorded activity.
    readonly crewStatus: CrewQualificationStatus | null;
    readonly dateDisplay: string;
    readonly dateInputValue: string;
    readonly dayOfMonth: number;
    readonly drivingDisplay: string | null;
    readonly indexInDays: number | null;
    readonly isInCurrentMonth: boolean;
    readonly strip: readonly ICalendarDayStripViewModel[];
}

export interface ICalendarMonthDayViewModel {
    readonly day: IActivityDayViewModel;
    readonly index: number;
}

export interface IActivityCalendarViewModel {
    readonly monthDays: readonly ICalendarMonthDayViewModel[];
    readonly monthEnd: string;
    readonly monthLabel: string;
    readonly monthStart: string;
    readonly monthTotals: IActivityTotalsViewModel;
    readonly selectedDayIndex: number;
    readonly weekTotals: IActivityTotalsViewModel;
    readonly weekdayLabels: readonly string[];
    readonly weeks: readonly (readonly ICalendarDayViewModel[])[];
}

export interface IActivityCalendarInput {
    readonly focusedDate: string;
    readonly month: ICalendarMonthInput;
    readonly selectedDayIndex: number;
}

function minutesOf(value: DurationMilliseconds): number {
    return Math.round(value / MILLISECONDS_PER_MINUTE);
}

function mondayBasedWeekday(value: number): number {
    return (new Date(value).getUTCDay() + 6) % 7;
}

function formattedDuration(
    value: DurationMilliseconds,
    localisation: ViewerLocalisationService,
): IFormattedValue<DurationMilliseconds> {
    return { display: localisation.formatDuration(value), value };
}

function createStrip(totals: IActivityTotalsViewModel): ICalendarDayStripViewModel[] {
    const segments: ICalendarDayStripViewModel[] = [];
    let totalMinutes = 0;
    for (const activity of ACTIVITY_KINDS) {
        totalMinutes += minutesOf(totals[activity].value);
    }
    for (const activity of ACTIVITY_KINDS) {
        const minutes = minutesOf(totals[activity].value);
        if (minutes === 0) {
            continue;
        }
        segments.push({
            activity,
            display: totals[activity].display,
            inlinePercent: Math.round((minutes / totalMinutes) * 10_000) / 100,
            minutes,
        });
    }
    return segments;
}

function createDayCells(
    year: number,
    month: number,
    daysByDate: ReadonlyMap<string, number>,
    days: readonly IActivityDayViewModel[],
    localisation: ViewerLocalisationService,
): ICalendarDayViewModel[] {
    const firstDay = Date.UTC(year, month, 1);
    if (!isUtcTimestamp(firstDay)) {
        throw new TypeError('The calendar month start is outside the supported date range.');
    }
    const leadingCells = mondayBasedWeekday(firstDay);
    const monthLength = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const trailingCells = (DAYS_PER_WEEK - ((leadingCells + monthLength) % DAYS_PER_WEEK)) % DAYS_PER_WEEK;

    const cells: ICalendarDayViewModel[] = [];
    for (let position = 0; position < leadingCells + monthLength + trailingCells; position += 1) {
        const dayOfMonth = position - leadingCells + 1;
        const timestampValue = Date.UTC(year, month, dayOfMonth);
        if (!isUtcTimestamp(timestampValue)) {
            throw new TypeError('The calendar cell date is outside the supported date range.');
        }
        const dateInputValue = formatUtcDateInputValue(timestampValue);
        const indexInDays = daysByDate.get(dateInputValue) ?? null;
        const day = indexInDays === null ? null : (days[indexInDays] ?? null);
        cells.push({
            crewStatus: day === null ? null : day.crewStatus,
            dateDisplay: localisation.formatUtcDate(timestampValue),
            dateInputValue,
            dayOfMonth,
            drivingDisplay: day === null ? null : day.totals.driving.display,
            indexInDays,
            isInCurrentMonth: dayOfMonth >= 1 && dayOfMonth <= monthLength,
            strip: day === null ? [] : createStrip(day.totals),
        });
    }
    return cells;
}

export function formatViewerActivityTotals(
    days: readonly IActivityDayViewModel[],
    localisation: ViewerLocalisationService,
): IActivityTotalsViewModel {
    const result = sumActivityTotals(
        days.map((day) => ({
            availability: day.totals.availability.value,
            breakOrRest: day.totals.breakOrRest.value,
            driving: day.totals.driving.value,
            unknown: day.totals.unknown.value,
            work: day.totals.work.value,
        })),
    );
    if (result.status === 'durationOverflow') {
        throw new TypeError(`The summed ${result.activity} duration exceeds the supported bounds.`);
    }

    return {
        availability: formattedDuration(result.totals.availability, localisation),
        breakOrRest: formattedDuration(result.totals.breakOrRest, localisation),
        driving: formattedDuration(result.totals.driving, localisation),
        unknown: formattedDuration(result.totals.unknown, localisation),
        work: formattedDuration(result.totals.work, localisation),
    };
}

function monthDaysFor(days: readonly IActivityDayViewModel[], month: ICalendarMonthInput): readonly ICalendarMonthDayViewModel[] {
    const result: ICalendarMonthDayViewModel[] = [];
    for (let index = 0; index < days.length; index += 1) {
        const day = days[index];
        if (day === undefined) {
            continue;
        }
        const date = new Date(day.midnightUtc);
        if (date.getUTCFullYear() === month.year && date.getUTCMonth() === month.month) {
            result.push({ day, index });
        }
    }
    return result;
}

function weekDaysFor(days: readonly IActivityDayViewModel[], focusedDate: string): readonly IActivityDayViewModel[] {
    const focusedTimestamp = parseCalendarDateInput(focusedDate);
    if (focusedTimestamp === null) {
        return [];
    }
    const monday = focusedTimestamp - mondayBasedWeekday(focusedTimestamp) * MILLISECONDS_PER_DAY;
    const sunday = monday + 6 * MILLISECONDS_PER_DAY;
    return days.filter((day) => day.midnightUtc >= monday && day.midnightUtc <= sunday);
}

export function createActivityCalendarViewModel(
    days: readonly IActivityDayViewModel[],
    input: IActivityCalendarInput,
    localisation: ViewerLocalisationService,
): IActivityCalendarViewModel {
    const daysByDate = new Map<string, number>();
    for (let index = 0; index < days.length; index += 1) {
        const day = days[index];
        if (day !== undefined) {
            daysByDate.set(day.dateInputValue, index);
        }
    }

    const cells = createDayCells(input.month.year, input.month.month, daysByDate, days, localisation);
    const weeks: ICalendarDayViewModel[][] = [];
    for (let position = 0; position < cells.length; position += DAYS_PER_WEEK) {
        weeks.push(cells.slice(position, position + DAYS_PER_WEEK));
    }

    const monthStart = Date.UTC(input.month.year, input.month.month, 1);
    if (!isUtcTimestamp(monthStart)) {
        throw new TypeError('The calendar month start is outside the supported date range.');
    }
    const monthEnd = Date.UTC(input.month.year, input.month.month + 1, 0);
    if (!isUtcTimestamp(monthEnd)) {
        throw new TypeError('The calendar month end is outside the supported date range.');
    }
    const monthDays = monthDaysFor(days, input.month);

    return {
        monthDays,
        monthEnd: formatUtcDateInputValue(monthEnd),
        monthLabel: localisation.formatMonthLabel(monthStart),
        monthStart: formatUtcDateInputValue(monthStart),
        monthTotals: formatViewerActivityTotals(
            monthDays.map((entry) => entry.day),
            localisation,
        ),
        selectedDayIndex: input.selectedDayIndex,
        weekTotals: formatViewerActivityTotals(weekDaysFor(days, input.focusedDate), localisation),
        weekdayLabels: localisation.formatWeekdayLabels(),
        weeks,
    };
}

export function parseCalendarDateInput(value: string): UtcTimestamp | null {
    const timestampValue = parseIsoUtcDay(value);
    return isUtcTimestamp(timestampValue) ? timestampValue : null;
}

export function calendarMonthOf(value: string): ICalendarMonthInput | null {
    const timestampValue = parseCalendarDateInput(value);
    if (timestampValue === null) {
        return null;
    }
    const date = new Date(timestampValue);
    return { month: date.getUTCMonth(), year: date.getUTCFullYear() };
}

export function shiftCalendarDate(value: string, days: number): string | null {
    const timestampValue = parseCalendarDateInput(value);
    if (timestampValue === null || !Number.isSafeInteger(days)) {
        return null;
    }
    const shifted = timestampValue + days * MILLISECONDS_PER_DAY;
    return isUtcTimestamp(shifted) ? formatUtcDateInputValue(shifted) : null;
}

export function shiftCalendarMonth(value: string, months: number): string | null {
    const timestampValue = parseCalendarDateInput(value);
    if (timestampValue === null || !Number.isSafeInteger(months)) {
        return null;
    }
    const date = new Date(timestampValue);
    const month = date.getUTCMonth() + months;
    const targetYear = date.getUTCFullYear() + Math.floor(month / 12);
    const targetMonth = ((month % 12) + 12) % 12;
    const dayOfMonth = Math.min(date.getUTCDate(), new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate());
    const shifted = Date.UTC(targetYear, targetMonth, dayOfMonth);
    return isUtcTimestamp(shifted) ? formatUtcDateInputValue(shifted) : null;
}

export function calendarWeekBounds(value: string): Readonly<{ end: string; start: string }> | null {
    const timestampValue = parseCalendarDateInput(value);
    if (timestampValue === null) {
        return null;
    }
    const monday = timestampValue - mondayBasedWeekday(timestampValue) * MILLISECONDS_PER_DAY;
    const sunday = monday + 6 * MILLISECONDS_PER_DAY;
    if (!isUtcTimestamp(monday) || !isUtcTimestamp(sunday)) {
        return null;
    }
    return {
        end: formatUtcDateInputValue(sunday),
        start: formatUtcDateInputValue(monday),
    };
}

export function createActivityRangeTotalsViewModel(
    days: readonly IActivityDayViewModel[],
    from: string,
    to: string,
    localisation: ViewerLocalisationService,
): IActivityTotalsViewModel | null {
    const fromTimestamp = parseCalendarDateInput(from);
    const toTimestamp = parseCalendarDateInput(to);
    if (fromTimestamp === null || toTimestamp === null || fromTimestamp > toTimestamp) {
        return null;
    }
    return formatViewerActivityTotals(
        days.filter((day) => day.midnightUtc >= fromTimestamp && day.midnightUtc <= toTimestamp),
        localisation,
    );
}
