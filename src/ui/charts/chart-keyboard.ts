export interface IChronologicalChartKeyboardActions {
    clear(): void;
    select(index: number): void;
}

export function handleChronologicalChartKeyboard(
    event: KeyboardEvent,
    currentIndex: number,
    itemCount: number,
    actions: IChronologicalChartKeyboardActions,
): void {
    if (itemCount === 0) {
        return;
    }

    switch (event.key) {
        case 'ArrowLeft':
            event.preventDefault();
            actions.select(Math.max(currentIndex - 1, 0));
            break;
        case 'ArrowRight':
            event.preventDefault();
            actions.select(Math.min(currentIndex < 0 ? 0 : currentIndex + 1, itemCount - 1));
            break;
        case 'End':
            event.preventDefault();
            actions.select(itemCount - 1);
            break;
        case 'Enter':
            if (currentIndex >= 0) {
                event.preventDefault();
                actions.select(currentIndex);
            }
            break;
        case 'Escape':
            event.preventDefault();
            actions.clear();
            break;
        case 'Home':
            event.preventDefault();
            actions.select(0);
            break;
    }
}
