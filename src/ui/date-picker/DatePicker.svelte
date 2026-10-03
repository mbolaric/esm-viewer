<script lang="ts">
    import { tick } from 'svelte';

    import { utcDateInputValue } from './date-picker-math.js';
    import {
        DatePickerPresenter,
        type IDatePickerDayCell,
        type IDatePickerLabels,
        type IDatePickerLocalisation,
    } from './date-picker-presenter.svelte.js';

    interface IProps {
        // Whether manually-typed date must respect minimum/maximum bounds on blur.
        enforceBoundsOnBlur?: boolean;
        id: string;
        labels: IDatePickerLabels;
        localise: IDatePickerLocalisation;
        maximum: number | null;
        minimum: number | null;
        onchange: (value: number) => void;
        onclear?: () => void;
        placeholder?: string;
        value: number | null;
    }

    let {
        enforceBoundsOnBlur = false,
        id,
        labels,
        localise,
        maximum,
        minimum,
        onchange,
        onclear,
        placeholder = '',
        value,
    }: IProps = $props();

    const initialLocalise: IDatePickerLocalisation = {
        formatDayLabel: () => '',
        formatMonthLabel: () => '',
        formatValue: () => '',
        parseValue: () => null,
        weekdayLabels: [],
    };

    const presenter = new DatePickerPresenter({
        localise: initialLocalise,
        maximum: null,
        minimum: null,
        value: null,
    });
    let containerElement = $state<HTMLDivElement | undefined>();
    let focusedCellKey = $state<string | null>(null);
    let gridElement = $state<HTMLDivElement | undefined>();
    let inputElement = $state<HTMLInputElement | undefined>();
    const monthHeadingId = $derived(`${id}-month`);

    $effect.pre(() => {
        presenter.setLocalise(localise);
        presenter.setBoundaries(minimum, maximum);
        presenter.setEnforceBoundsOnBlur(enforceBoundsOnBlur);
        if (value !== presenter.value) {
            presenter.setValue(value);
        }
    });

    function openPicker(): void {
        presenter.toggle();
        if (!presenter.isOpen) {
            return;
        }
        focusFocusedCell();
    }

    function chooseDay(cell: IDatePickerDayCell): void {
        if (cell.disabled) {
            return;
        }
        presenter.selectDay(cell);
        onchange(cell.value);
        inputElement?.focus();
    }

    function commitInput(): void {
        const committed = presenter.handleBlur();
        if (committed !== null) {
            onchange(committed);
        }
    }

    function handleInputKeydown(event: KeyboardEvent): void {
        if (event.key === 'Enter') {
            event.preventDefault();
            inputElement?.blur();
        }
    }

    function clearValue(): void {
        presenter.clear();
        onclear?.();
        inputElement?.focus();
    }

    function moveFocus(days: number): void {
        presenter.focusShift(days);
        focusFocusedCell();
    }

    function focusFocusedCell(): void {
        const key = utcDateInputValue(presenter.focusedValue);
        focusedCellKey = key;
        void tick().then(() => {
            gridElement?.querySelector<HTMLButtonElement>(`[data-date="${key}"]`)?.focus();
        });
    }

    function handleGridKeydown(event: KeyboardEvent): void {
        switch (event.key) {
            case 'ArrowLeft':
                moveFocus(-1);
                break;
            case 'ArrowRight':
                moveFocus(1);
                break;
            case 'ArrowUp':
                moveFocus(-7);
                break;
            case 'ArrowDown':
                moveFocus(7);
                break;
            case 'PageUp':
                presenter.focusMonthShift(-1);
                focusFocusedCell();
                break;
            case 'PageDown':
                presenter.focusMonthShift(1);
                focusFocusedCell();
                break;
            case 'Home':
                presenter.focusWeekStart();
                focusFocusedCell();
                break;
            case 'End':
                presenter.focusWeekEnd();
                focusFocusedCell();
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                {
                    const cell = presenter.calendarDays.find((candidate) => candidate.value === presenter.focusedValue);
                    if (cell !== undefined) {
                        chooseDay(cell);
                    }
                }
                break;
            default:
                return;
        }
        event.preventDefault();
    }

    function handleDocumentKeydown(event: KeyboardEvent): void {
        if (event.key === 'Escape' && presenter.isOpen) {
            presenter.close();
            inputElement?.focus();
        }
    }

    function handleDocumentPointerdown(event: PointerEvent): void {
        if (!presenter.isOpen) {
            return;
        }
        const target = event.target;
        if (target instanceof Node && !containerElement?.contains(target)) {
            presenter.close();
        }
    }
</script>

<svelte:window onkeydown={handleDocumentKeydown} onpointerdown={handleDocumentPointerdown} />

<div bind:this={containerElement} class="date-picker">
    <div class="date-picker-input-row">
        <input
            bind:this={inputElement}
            class="viewer-input date-picker-input"
            {id}
            onblur={commitInput}
            oninput={(event) => presenter.handleInput(event.currentTarget.value)}
            onkeydown={handleInputKeydown}
            {placeholder}
            type="text"
            value={presenter.inputValue}
        />
        <button
            aria-label={labels.toggle}
            aria-pressed={presenter.isOpen}
            class="date-picker-toggle"
            onclick={openPicker}
            title={labels.toggle}
            type="button"
        >
            <svg
                aria-hidden="true"
                fill="none"
                height="var(--size-icon)"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                viewBox="0 0 24 24"
                width="var(--size-icon)"
                xmlns="http://www.w3.org/2000/svg"
            >
                <rect height="18" rx="2" ry="2" width="18" x="3" y="4" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
        </button>
    </div>

    {#if presenter.isOpen}
        <div class="date-picker-popup popover-surface" role="dialog" aria-label={labels.popup}>
            <div class="date-picker-header">
                <button
                    aria-label={labels.prevMonth}
                    class="date-picker-nav"
                    onclick={() => {
                        presenter.focusMonthShift(-1);
                    }}
                    title={labels.prevMonth}
                    type="button"
                >
                    <svg
                        aria-hidden="true"
                        fill="none"
                        height="var(--size-icon-small)"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        viewBox="0 0 24 24"
                        width="var(--size-icon-small)"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path d="m15 18-6-6 6-6" />
                    </svg>
                </button>
                <h3 class="date-picker-month" id={monthHeadingId}>
                    {presenter.monthLabel}
                </h3>
                <button
                    aria-label={labels.nextMonth}
                    class="date-picker-nav"
                    onclick={() => {
                        presenter.focusMonthShift(1);
                    }}
                    title={labels.nextMonth}
                    type="button"
                >
                    <svg
                        aria-hidden="true"
                        fill="none"
                        height="var(--size-icon-small)"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        viewBox="0 0 24 24"
                        width="var(--size-icon-small)"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path d="m9 18 6-6-6-6" />
                    </svg>
                </button>
            </div>
            <div
                aria-labelledby={monthHeadingId}
                bind:this={gridElement}
                class="date-picker-grid"
                onkeydown={handleGridKeydown}
                role="grid"
                tabindex="-1"
            >
                <div class="date-picker-grid-row" role="row">
                    {#each localise.weekdayLabels as weekday (weekday)}
                        <div class="date-picker-weekday" role="columnheader">
                            {weekday}
                        </div>
                    {/each}
                </div>
                {#each presenter.weekRows as week (week[0]?.key)}
                    <div class="date-picker-grid-row" role="row">
                        {#each week as cell (cell.key)}
                            <div class="date-picker-cell" role="gridcell">
                                <button
                                    aria-label={localise.formatDayLabel(cell.value)}
                                    class="date-picker-day"
                                    class:current-month={cell.isCurrentMonth}
                                    class:selected={cell.isSelected}
                                    class:today={cell.isToday}
                                    data-date={cell.key}
                                    disabled={cell.disabled}
                                    onclick={() => chooseDay(cell)}
                                    tabindex={cell.key === focusedCellKey ? 0 : -1}
                                    type="button"
                                >
                                    {cell.dayOfMonth}
                                </button>
                            </div>
                        {/each}
                    </div>
                {/each}
            </div>
            {#if onclear !== undefined}
                <div class="date-picker-footer">
                    <button class="date-picker-clear" onclick={clearValue} type="button">
                        {labels.clear}
                    </button>
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .date-picker {
        position: relative;
        display: inline-block;
        inline-size: var(--size-full);
    }

    .date-picker-input-row {
        position: relative;
    }

    .date-picker-input {
        inline-size: var(--size-full);
        padding-inline-end: var(--size-control);
    }

    .date-picker-toggle {
        position: absolute;
        inset-block-start: var(--size-half);
        inset-inline-end: var(--space-none);
        transform: translateY(-50%);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: var(--size-control-compact);
        block-size: var(--size-control-compact);
        background: var(--color-transparent);
        border: none;
        border-radius: var(--radius-control);
        color: var(--color-text-muted);
        cursor: pointer;
    }

    .date-picker-toggle:hover {
        background: var(--color-surface-hover);
        color: var(--color-text);
    }

    .date-picker-toggle:focus-visible,
    .date-picker-nav:focus-visible,
    .date-picker-day:focus-visible {
        outline: var(--border-focus);
        outline-offset: var(--space-focus-offset);
    }

    .date-picker-popup {
        inset-inline-end: var(--space-none);
        inline-size: var(--size-date-picker-popup);
        max-inline-size: var(--size-date-picker-popup-max);
    }

    .date-picker-header {
        display: flex;
        align-items: center;
        gap: var(--space-compact);
    }

    .date-picker-nav {
        min-block-size: var(--size-control-compact);
        min-inline-size: var(--size-control-compact);
        background: var(--color-transparent);
        border: none;
        border-radius: var(--radius-control);
        color: var(--color-text-muted);
        cursor: pointer;
        font: inherit;
    }

    .date-picker-nav:hover {
        background: var(--color-surface-hover);
        color: var(--color-text);
    }

    .date-picker-footer {
        display: flex;
        justify-content: flex-end;
        padding-block-start: var(--space-compact);
    }

    .date-picker-clear {
        background: var(--color-transparent);
        border: none;
        border-radius: var(--radius-control);
        color: var(--color-text-muted);
        cursor: pointer;
        font: inherit;
        padding: var(--space-compact);
    }

    .date-picker-clear:hover {
        background: var(--color-surface-hover);
        color: var(--color-text);
    }

    .date-picker-clear:focus-visible {
        outline: var(--border-focus);
        outline-offset: var(--space-focus-offset);
    }

    .date-picker-month {
        flex: var(--layout-date-picker-fill-flex);
        color: var(--color-text);
        text-align: center;
    }

    .date-picker-grid {
        display: grid;
        grid-template-columns: var(--layout-date-picker-grid-columns);
        gap: var(--space-compact);
    }

    .date-picker-grid-row {
        display: contents;
    }

    .date-picker-cell {
        display: grid;
        place-items: center;
    }

    .date-picker-weekday {
        padding-block: var(--space-compact);
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
        text-align: center;
    }

    .date-picker-day {
        min-block-size: var(--size-control-compact);
        background: var(--color-transparent);
        border: none;
        border-radius: var(--radius-control);
        color: var(--color-text);
        cursor: pointer;
        font: inherit;
        text-align: center;
    }

    .date-picker-day:hover {
        background: var(--color-surface-hover);
    }

    .date-picker-day.today {
        border: var(--border-control);
    }

    .date-picker-day.selected {
        background: var(--color-accent);
        color: var(--color-on-accent);
        font-weight: var(--font-weight-action);
    }

    .date-picker-day.current-month {
        color: var(--color-text);
    }

    .date-picker-day:not(.current-month) {
        color: var(--color-text-muted);
    }

    .date-picker-day:disabled {
        color: var(--color-text-muted);
        cursor: default;
        opacity: var(--opacity-disabled);
    }
</style>
