import { describe, expect, it } from 'vitest';

import { DatePickerPresenter, type IDatePickerLocalisation } from '../date-picker-presenter.svelte.js';

const julyTwentySeventh = Date.UTC(2026, 6, 27);
const julyFirst = Date.UTC(2026, 6, 1);

const localise: IDatePickerLocalisation = {
    formatDayLabel: (value: number) => new Date(value).toISOString().slice(0, 10),
    formatMonthLabel: (year: number, month: number) => `${String(year)}-${String(month + 1)}`,
    formatValue: (value: number) => new Date(value).toISOString().slice(0, 10),
    parseValue: (text: string) => {
        const parsed = Date.parse(`${text}T00:00:00Z`);
        return Number.isNaN(parsed) ? null : parsed;
    },
    weekdayLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};

function createPresenter(overrides: Partial<ConstructorParameters<typeof DatePickerPresenter>[0]> = {}): DatePickerPresenter {
    return new DatePickerPresenter({
        localise,
        maximum: null,
        minimum: null,
        todayValue: julyTwentySeventh,
        value: julyTwentySeventh,
        ...overrides,
    });
}

describe('DatePickerPresenter', () => {
    it('formats the initial value and focuses the selected day', () => {
        const presenter = createPresenter();
        expect(presenter.inputValue).toBe('2026-07-27');
        expect(presenter.focusedValue).toBe(julyTwentySeventh);
        expect(presenter.isOpen).toBe(false);
    });

    it('builds a Monday-first 42-cell grid with selected and today markers', () => {
        const presenter = createPresenter();
        const cells = presenter.calendarDays;
        expect(cells).toHaveLength(42);
        expect(cells[0]?.dayOfMonth).toBe(29);
        expect(cells[0]?.isCurrentMonth).toBe(false);
        expect(cells[2]?.dayOfMonth).toBe(1);
        expect(cells[2]?.value).toBe(julyFirst);
        expect(cells.find((cell) => cell.key === '2026-07-27')?.isSelected).toBe(true);
        expect(cells.find((cell) => cell.key === '2026-07-27')?.isToday).toBe(true);
    });

    it('disables cells outside the minimum and maximum boundaries', () => {
        const presenter = createPresenter({
            maximum: Date.UTC(2026, 6, 27),
            minimum: Date.UTC(2026, 6, 1),
        });
        const cells = presenter.calendarDays;
        expect(cells.find((cell) => cell.key === '2026-06-30')?.disabled).toBe(true);
        expect(cells.find((cell) => cell.key === '2026-07-01')?.disabled).toBe(false);
        expect(cells.find((cell) => cell.key === '2026-07-27')?.disabled).toBe(false);
        expect(cells.find((cell) => cell.key === '2026-07-28')?.disabled).toBe(true);
    });

    it('lets typed input outside the minimum/maximum boundaries commit by default (enforceBoundsOnBlur off)', () => {
        const presenter = createPresenter({
            maximum: Date.UTC(2026, 6, 27),
            minimum: Date.UTC(2026, 6, 1),
        });
        presenter.handleInput('2026-08-02');
        expect(presenter.handleBlur()).toBe(Date.UTC(2026, 7, 2));
    });

    it('rejects typed input outside the minimum and maximum boundaries on blur when enforceBoundsOnBlur is on', () => {
        const presenter = createPresenter({
            enforceBoundsOnBlur: true,
            maximum: Date.UTC(2026, 6, 27),
            minimum: Date.UTC(2026, 6, 1),
        });
        presenter.handleInput('2026-08-02');
        expect(presenter.handleBlur()).toBeNull();
        expect(presenter.value).toBe(julyTwentySeventh);
        expect(presenter.inputValue).toBe('2026-07-27');

        presenter.handleInput('2026-06-30');
        expect(presenter.handleBlur()).toBeNull();
        expect(presenter.value).toBe(julyTwentySeventh);

        presenter.handleInput('2026-07-15');
        expect(presenter.handleBlur()).toBe(Date.UTC(2026, 6, 15));
    });

    it('navigates months and years around the focused date', () => {
        const presenter = createPresenter();
        presenter.focusMonthShift(1);
        expect(presenter.monthLabel).toBe('2026-8');
        presenter.focusMonthShift(-13);
        expect(presenter.monthLabel).toBe('2025-7');
    });

    it('shifts focus by days and to week edges', () => {
        const presenter = createPresenter();
        presenter.focusShift(1);
        expect(presenter.focusedValue).toBe(Date.UTC(2026, 6, 28));
        presenter.focusShift(-7);
        expect(presenter.focusedValue).toBe(Date.UTC(2026, 6, 21));
        presenter.focusWeekStart();
        expect(presenter.focusedValue).toBe(Date.UTC(2026, 6, 20));
        presenter.focusWeekEnd();
        expect(presenter.focusedValue).toBe(Date.UTC(2026, 6, 26));
    });

    it('selects an enabled day and ignores disabled days', () => {
        const presenter = createPresenter({
            maximum: Date.UTC(2026, 6, 27),
            minimum: Date.UTC(2026, 6, 1),
        });
        const cells = presenter.calendarDays;
        const enabled = cells.find((cell) => cell.key === '2026-07-15');
        const disabled = cells.find((cell) => cell.key === '2026-07-28');
        if (enabled === undefined || disabled === undefined) {
            throw new TypeError('The fixture grid must contain the expected days.');
        }
        presenter.selectDay(enabled);
        expect(presenter.value).toBe(Date.UTC(2026, 6, 15));
        expect(presenter.inputValue).toBe('2026-07-15');
        expect(presenter.isOpen).toBe(false);
        presenter.open();
        presenter.selectDay(disabled);
        expect(presenter.value).toBe(Date.UTC(2026, 6, 15));
    });

    it('commits parsed input on blur and reverts invalid input', () => {
        const presenter = createPresenter();
        presenter.handleInput('2026-08-02');
        expect(presenter.handleBlur()).toBe(Date.UTC(2026, 7, 2));
        expect(presenter.inputValue).toBe('2026-08-02');
        presenter.handleInput('not a date');
        expect(presenter.handleBlur()).toBeNull();
        expect(presenter.inputValue).toBe('2026-08-02');
        presenter.handleInput('');
        expect(presenter.handleBlur()).toBeNull();
        expect(presenter.inputValue).toBe('2026-08-02');
    });

    it('commits typed input on blur when there was no prior value to use as a reference', () => {
        const presenter = createPresenter({ value: null });
        expect(presenter.inputValue).toBe('');
        presenter.handleInput('2026-08-02');
        expect(presenter.handleBlur()).toBe(Date.UTC(2026, 7, 2));
        expect(presenter.value).toBe(Date.UTC(2026, 7, 2));
        expect(presenter.inputValue).toBe('2026-08-02');
    });

    it('re-formats the input when the localisation changes', () => {
        const presenter = createPresenter();
        presenter.setLocalise({
            ...localise,
            formatValue: () => '27.07.2026',
        });
        expect(presenter.inputValue).toBe('27.07.2026');
    });
});
