import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

import DatePicker from '../DatePicker.svelte';
import type { IDatePickerLocalisation } from '../date-picker-presenter.svelte.js';

afterEach(() => {
    cleanup();
});

const julyTwentySeventh = Date.UTC(2026, 6, 27);

const localise: IDatePickerLocalisation = {
    formatDayLabel: (value: number) => new Date(value).toISOString().slice(0, 10),
    formatMonthLabel: (year: number, month: number) => `${String(year)}-${String(month + 1).padStart(2, '0')}`,
    formatValue: (value: number) => new Date(value).toISOString().slice(0, 10),
    parseValue: (text: string) => {
        const parsed = Date.parse(`${text}T00:00:00Z`);
        return Number.isNaN(parsed) ? null : parsed;
    },
    weekdayLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};

const dotSeparatedLocalise: IDatePickerLocalisation = {
    formatDayLabel: (value: number) => new Date(value).toISOString().slice(0, 10),
    formatMonthLabel: (year: number, month: number) => `${String(year)}-${String(month + 1).padStart(2, '0')}`,
    formatValue: (value: number) => {
        const date = new Date(value);
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        return `${day}.${month}.${String(date.getUTCFullYear())}`;
    },
    parseValue: (text: string) => {
        const match = /^(\d{2})\.(\d{2})\.(\d{4})$/u.exec(text);
        if (match === null) {
            return null;
        }
        return Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    },
    weekdayLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};

const labels = {
    clear: 'Clear',
    nextMonth: 'Next month',
    popup: 'Choose a date',
    prevMonth: 'Previous month',
    toggle: 'Open calendar',
};

interface IProps {
    readonly localise?: IDatePickerLocalisation;
    readonly maximum?: number | null;
    readonly minimum?: number | null;
    readonly onchange?: Mock<(value: number) => void>;
    readonly onclear?: Mock<() => void>;
    readonly placeholder?: string;
    readonly value?: number | null;
}

interface IRenderPickerResult {
    readonly onchange: Mock<(value: number) => void>;
    readonly onclear: Mock<() => void> | undefined;
    readonly rerender: (value: number | null) => Promise<void>;
}

function renderPicker(options: IProps = {}): IRenderPickerResult {
    const onchange = options.onchange ?? vi.fn();
    const onclear = options.onclear;
    const rendered = render(DatePicker, {
        props: {
            id: 'test-date',
            labels,
            localise: options.localise ?? localise,
            maximum: options.maximum ?? null,
            minimum: options.minimum ?? null,
            onchange,
            placeholder: options.placeholder ?? 'yyyy-mm-dd',
            value: options.value ?? julyTwentySeventh,
            ...(onclear !== undefined ? { onclear } : {}),
        },
    });
    return {
        onchange,
        onclear,
        rerender: async (value: number | null): Promise<void> => {
            await rendered.rerender({ value });
        },
    };
}

function pickerInput(): HTMLInputElement {
    const input = screen.getByRole('textbox');
    if (!(input instanceof HTMLInputElement)) {
        throw new TypeError('The date picker must render a text input.');
    }
    return input;
}

async function openPicker(): Promise<HTMLElement> {
    await fireEvent.click(screen.getByRole('button', { name: 'Open calendar' }));
    return screen.getByRole('dialog', { name: 'Choose a date' });
}

describe('DatePicker', () => {
    it('renders the formatted value in the labelled text input', () => {
        renderPicker();

        const input = pickerInput();
        expect(input.id).toBe('test-date');
        expect(input).toHaveProperty('value', '2026-07-27');
        expect(screen.getByRole('button', { name: 'Open calendar' })).toBeTruthy();
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('follows the provided date format for display, placeholder, and parsing', async () => {
        const { onchange } = renderPicker({
            localise: dotSeparatedLocalise,
            placeholder: 'dd.MM.yyyy',
        });

        const input = pickerInput();
        expect(input).toHaveProperty('value', '27.07.2026');
        expect(input).toHaveProperty('placeholder', 'dd.MM.yyyy');

        await fireEvent.input(input, { target: { value: '02.08.2026' } });
        await fireEvent.blur(input);
        expect(onchange).toHaveBeenCalledWith(Date.UTC(2026, 7, 2));
    });

    it('clears the value when a clear action is provided', async () => {
        const { onclear, rerender } = renderPicker({ onclear: vi.fn() });
        await openPicker();

        await fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
        expect(onclear).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).toBeNull();
        await rerender(null);
        expect(pickerInput()).toHaveProperty('value', '');
    });

    it('opens a Monday-first month grid with weekday headers and labelled days', async () => {
        renderPicker();

        const popup = await openPicker();
        const grid = within(popup).getByRole('grid', { name: '2026-07' });
        expect(
            within(grid)
                .getAllByRole('columnheader')
                .map((cell) => cell.textContent),
        ).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
        expect(within(grid).getByRole('button', { name: '2026-07-27' })).toBeTruthy();
        expect(within(grid).getByRole('button', { name: '2026-07-01' })).toBeTruthy();
        expect(within(grid).getAllByRole('gridcell')).toHaveLength(42);
    });

    it('emits the selected day and closes the popup', async () => {
        const { onchange, rerender } = renderPicker();
        const popup = await openPicker();

        const fifteenth = within(popup).getByRole('button', { name: '2026-07-15' });
        await fireEvent.click(fifteenth);
        expect(onchange).toHaveBeenCalledWith(Date.UTC(2026, 6, 15));
        await rerender(Date.UTC(2026, 6, 15));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(pickerInput()).toHaveProperty('value', '2026-07-15');
    });

    it('disables days outside the minimum and maximum boundaries', async () => {
        renderPicker({
            maximum: Date.UTC(2026, 6, 27),
            minimum: Date.UTC(2026, 6, 1),
        });
        const popup = await openPicker();

        const before = within(popup).getByRole('button', { name: '2026-06-30' });
        const after = within(popup).getByRole('button', { name: '2026-07-28' });
        const inside = within(popup).getByRole('button', { name: '2026-07-15' });
        expect(before).toHaveProperty('disabled', true);
        expect(after).toHaveProperty('disabled', true);
        expect(inside).toHaveProperty('disabled', false);
    });

    it('commits typed input on blur and reverts invalid input', async () => {
        const { onchange, rerender } = renderPicker();
        const input = pickerInput();

        await fireEvent.input(input, { target: { value: '2026-08-02' } });
        await fireEvent.blur(input);
        expect(onchange).toHaveBeenCalledWith(Date.UTC(2026, 7, 2));
        await rerender(Date.UTC(2026, 7, 2));
        expect(input).toHaveProperty('value', '2026-08-02');

        await fireEvent.input(input, { target: { value: 'not a date' } });
        await fireEvent.blur(input);
        expect(onchange).toHaveBeenCalledTimes(1);
        expect(input).toHaveProperty('value', '2026-08-02');
    });

    it('commits typed input with Enter in the provided format', async () => {
        const { onchange, rerender } = renderPicker();
        const input = pickerInput();

        input.focus();
        expect(document.activeElement).toBe(input);
        await fireEvent.input(input, { target: { value: '2026-08-02' } });
        await fireEvent.keyDown(input, { key: 'Enter' });
        expect(onchange).toHaveBeenCalledWith(Date.UTC(2026, 7, 2));
        await rerender(Date.UTC(2026, 7, 2));
        expect(input).toHaveProperty('value', '2026-08-02');
    });

    it('navigates the grid with the keyboard and selects with Enter', async () => {
        const { onchange } = renderPicker();
        await openPicker();
        const grid = screen.getByRole('grid', { name: '2026-07' });

        await waitFor(() => {
            expect(document.activeElement).toBe(within(grid).getByRole('button', { name: '2026-07-27' }));
        });
        await fireEvent.keyDown(grid, { key: 'ArrowRight' });
        await waitFor(() => {
            expect(document.activeElement).toBe(within(grid).getByRole('button', { name: '2026-07-28' }));
        });
        await fireEvent.keyDown(grid, { key: 'Enter' });
        expect(onchange).toHaveBeenCalledWith(Date.UTC(2026, 6, 28));
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('closes on Escape and on an outside pointer', async () => {
        renderPicker();
        await openPicker();

        await fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();

        await openPicker();
        await fireEvent.pointerDown(document.body);
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
