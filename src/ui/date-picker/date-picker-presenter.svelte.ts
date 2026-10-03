import {
    addUtcDays,
    addUtcMonths,
    datePickerMillisecondsPerDay,
    daysInUtcMonth,
    isSameUtcDay,
    mondayBasedUtcWeekday,
    utcDateInputValue,
    utcDateParts,
    utcDayStart,
    utcMidnightOfToday,
} from './date-picker-math.js';

export interface IDatePickerDayCell {
    readonly dayOfMonth: number;
    readonly disabled: boolean;
    readonly isCurrentMonth: boolean;
    readonly isSelected: boolean;
    readonly isToday: boolean;
    readonly key: string;
    readonly value: number;
}

export interface IDatePickerLocalisation {
    readonly formatDayLabel: (value: number) => string;
    readonly formatMonthLabel: (year: number, month: number) => string;
    readonly formatValue: (value: number) => string;
    readonly parseValue: (text: string, referenceValue: number) => number | null;
    readonly weekdayLabels: readonly string[];
}

export interface IDatePickerLabels {
    readonly clear?: string;
    readonly nextMonth: string;
    readonly popup: string;
    readonly prevMonth: string;
    readonly toggle: string;
}

export interface IDatePickerPresenterOptions {
    readonly enforceBoundsOnBlur?: boolean;
    readonly localise: IDatePickerLocalisation;
    readonly maximum: number | null;
    readonly minimum: number | null;
    readonly todayValue?: number;
    readonly value: number | null;
}

const gridCellCount = 42;

export class DatePickerPresenter {
    #_enforceBoundsOnBlur: boolean;
    #_focusedValue: number;
    #_inputValue: string;
    #_isOpen: boolean;
    #_localise: IDatePickerLocalisation;
    #_maximum: number | null;
    #_minimum: number | null;
    #_todayValue: number;
    #_value: number | null;

    public constructor(options: IDatePickerPresenterOptions) {
        this.#_enforceBoundsOnBlur = $state(options.enforceBoundsOnBlur ?? false);
        this.#_localise = options.localise;
        this.#_maximum = $state(options.maximum);
        this.#_minimum = $state(options.minimum);
        this.#_todayValue = $state(options.todayValue ?? utcMidnightOfToday());
        this.#_value = $state(options.value);
        this.#_focusedValue = $state(options.value ?? this.#_todayValue);
        this.#_inputValue = $state(this.#formattedValue(options.value));
        this.#_isOpen = $state(false);
    }

    public get calendarDays(): readonly IDatePickerDayCell[] {
        const { month, year } = utcDateParts(this.#_focusedValue);
        const monthStart = Date.UTC(year, month, 1);
        const leadingCells = mondayBasedUtcWeekday(monthStart);
        const monthLength = daysInUtcMonth(year, month);
        const today = this.#_todayValue;
        const selected = this.#_value;

        const cells: IDatePickerDayCell[] = [];
        for (let position = 0; position < gridCellCount; position += 1) {
            const dayOfMonth = position - leadingCells + 1;
            const value = Date.UTC(year, month, dayOfMonth);
            const displayedDay = utcDateParts(value).dayOfMonth;
            const isCurrentMonth = dayOfMonth >= 1 && dayOfMonth <= monthLength;
            const disabled =
                (this.#_minimum !== null && value < this.#_minimum) || (this.#_maximum !== null && value > this.#_maximum);
            cells.push({
                dayOfMonth: displayedDay,
                disabled,
                isCurrentMonth,
                isSelected: selected !== null && isSameUtcDay(value, selected),
                isToday: isSameUtcDay(value, today),
                key: utcDateInputValue(value),
                value,
            });
        }
        return cells;
    }

    public get focusedValue(): number {
        return this.#_focusedValue;
    }

    public get inputValue(): string {
        return this.#_inputValue;
    }

    public get isOpen(): boolean {
        return this.#_isOpen;
    }

    public get monthLabel(): string {
        const { month, year } = utcDateParts(this.#_focusedValue);
        return this.#_localise.formatMonthLabel(year, month);
    }

    public get value(): number | null {
        return this.#_value;
    }

    public get weekRows(): readonly (readonly IDatePickerDayCell[])[] {
        const days = this.calendarDays;
        const weeks: IDatePickerDayCell[][] = [];
        for (let index = 0; index < days.length; index += 7) {
            weeks.push(days.slice(index, index + 7));
        }
        return weeks;
    }

    public close(): void {
        this.#_isOpen = false;
    }

    public clear(): void {
        this.#_value = null;
        this.#_inputValue = '';
        this.#_isOpen = false;
    }

    public focusMonthShift(months: number): void {
        this.#_focusedValue = addUtcMonths(this.#_focusedValue, months);
    }

    public focusShift(days: number): void {
        this.#_focusedValue = addUtcDays(this.#_focusedValue, days);
    }

    public focusWeekEnd(): void {
        this.#_focusedValue =
            this.#_focusedValue + (6 - mondayBasedUtcWeekday(this.#_focusedValue)) * datePickerMillisecondsPerDay;
    }

    public focusWeekStart(): void {
        this.#_focusedValue = this.#_focusedValue - mondayBasedUtcWeekday(this.#_focusedValue) * datePickerMillisecondsPerDay;
    }

    public handleBlur(): number | null {
        const text = this.#_inputValue.trim();
        if (text.length === 0) {
            this.#_inputValue = this.#formattedValue(this.#_value);
            return null;
        }
        // Falls back to today when no committed value exists to resolve partial date input against.
        const referenceValue = this.#_value ?? this.#_todayValue;
        const parsed = this.#_localise.parseValue(text, referenceValue);
        // Bounds enforcement on blur is opt-in (enforceBoundsOnBlur); other callers handle out-of-range dates downstream.
        if (parsed === null || (this.#_enforceBoundsOnBlur && this.#isOutOfBounds(parsed))) {
            this.#_inputValue = this.#formattedValue(this.#_value);
            return null;
        }
        this.#_value = parsed;
        this.#_inputValue = this.#formattedValue(parsed);
        this.#_focusedValue = utcDayStart(parsed);
        return parsed;
    }

    #isOutOfBounds(value: number): boolean {
        return (this.#_minimum !== null && value < this.#_minimum) || (this.#_maximum !== null && value > this.#_maximum);
    }

    public handleInput(text: string): void {
        this.#_inputValue = text;
    }

    public open(): void {
        this.#_isOpen = true;
        this.#_focusedValue = this.#_value ?? this.#_todayValue;
    }

    public selectDay(cell: IDatePickerDayCell): void {
        if (cell.disabled) {
            return;
        }
        this.#_value = cell.value;
        this.#_inputValue = this.#formattedValue(cell.value);
        this.#_focusedValue = cell.value;
        this.#_isOpen = false;
    }

    public setBoundaries(minimum: number | null, maximum: number | null): void {
        if (minimum === this.#_minimum && maximum === this.#_maximum) {
            return;
        }
        this.#_minimum = minimum;
        this.#_maximum = maximum;
    }

    public setEnforceBoundsOnBlur(enforceBoundsOnBlur: boolean): void {
        this.#_enforceBoundsOnBlur = enforceBoundsOnBlur;
    }

    public setLocalise(localise: IDatePickerLocalisation): void {
        if (localise === this.#_localise) {
            return;
        }
        this.#_localise = localise;
        this.#_inputValue = this.#formattedValue(this.#_value);
    }

    public setValue(value: number | null): void {
        if (value === this.#_value) {
            return;
        }
        this.#_value = value;
        this.#_inputValue = this.#formattedValue(value);
        if (value !== null) {
            this.#_focusedValue = utcDayStart(value);
        }
    }

    public toggle(): void {
        if (this.#_isOpen) {
            this.#_isOpen = false;
            return;
        }
        this.open();
    }

    #formattedValue(value: number | null): string {
        return value === null ? '' : this.#_localise.formatValue(value);
    }
}
