export const datePickerMillisecondsPerDay = 24 * 60 * 60 * 1_000;

export function utcDayStart(value: number): number {
    const date = new Date(value);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export interface IUtcDateParts {
    readonly dayOfMonth: number;
    readonly month: number;
    readonly year: number;
}

export function utcDateParts(value: number): IUtcDateParts {
    const date = new Date(value);
    return {
        dayOfMonth: date.getUTCDate(),
        month: date.getUTCMonth(),
        year: date.getUTCFullYear(),
    };
}

export function daysInUtcMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function mondayBasedUtcWeekday(value: number): number {
    return (new Date(value).getUTCDay() + 6) % 7;
}

export function addUtcMonths(value: number, months: number): number {
    const date = new Date(value);
    const month = date.getUTCMonth() + months;
    const targetYear = date.getUTCFullYear() + Math.floor(month / 12);
    const targetMonth = ((month % 12) + 12) % 12;
    const dayOfMonth = Math.min(date.getUTCDate(), daysInUtcMonth(targetYear, targetMonth));
    return Date.UTC(targetYear, targetMonth, dayOfMonth);
}

export function addUtcDays(value: number, days: number): number {
    return utcDayStart(value + days * datePickerMillisecondsPerDay);
}

export function isSameUtcDay(first: number, second: number): boolean {
    const firstDate = new Date(first);
    const secondDate = new Date(second);
    return (
        firstDate.getUTCFullYear() === secondDate.getUTCFullYear() &&
        firstDate.getUTCMonth() === secondDate.getUTCMonth() &&
        firstDate.getUTCDate() === secondDate.getUTCDate()
    );
}

export function utcDateInputValue(value: number): string {
    return new Date(value).toISOString().slice(0, 10);
}

export function utcMidnightOfToday(): number {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}
