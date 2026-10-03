import { describe, expect, it, vi } from 'vitest';

import { ChartSelectionController } from '../charts/chart-selection.svelte.js';

interface IItem {
    readonly description: string;
    readonly id: string;
}

interface IActivation {
    readonly blockOffset: number;
    readonly inlineOffset: number;
    readonly itemId: string;
}

const items: readonly IItem[] = [
    { description: 'first sample', id: 'a' },
    { description: 'second sample', id: 'b' },
    { description: 'third sample', id: 'c' },
];

function controllerFor(selectedId: string | null = null): {
    readonly controller: ChartSelectionController<IItem, IActivation>;
    readonly onselect: ReturnType<typeof vi.fn<(id: string | null) => void>>;
} {
    const onselect = vi.fn<(id: string | null) => void>();
    const controller = new ChartSelectionController<IItem, IActivation>({
        activatedItemId: (activation) => activation.itemId,
        chronologicalItems: () => items,
        items: () => items,
        onselect,
        selectedId: () => selectedId,
    });
    return { controller, onselect };
}

function key(name: string): KeyboardEvent {
    return new KeyboardEvent('keydown', { cancelable: true, key: name });
}

describe('ChartSelectionController', () => {
    it('reports the externally selected item until the user interacts', () => {
        const { controller } = controllerFor('b');

        expect(controller.selectedItemId).toBe('b');
        expect(controller.activeItem?.description).toBe('second sample');
    });

    it('selects an item, remembers it and notifies the owner, including a cleared selection', () => {
        const { controller, onselect } = controllerFor();

        controller.select('c');
        expect(controller.selectedItemId).toBe('c');
        expect(onselect).toHaveBeenLastCalledWith('c');

        controller.select(null);
        expect(controller.selectedItemId).toBeNull();
        expect(onselect).toHaveBeenLastCalledWith(null);
    });

    it('follows pointer activation and exposes a tooltip only while an item is activated', () => {
        const { controller } = controllerFor();

        controller.activate({ blockOffset: 4, inlineOffset: 9, itemId: 'b' });
        expect(controller.selectedItemId).toBe('b');
        expect(controller.pointerTooltip).toEqual({ blockOffset: 4, description: 'second sample', inlineOffset: 9 });

        controller.activate(null);
        expect(controller.pointerTooltip).toBeNull();
        expect(controller.selectedItemId).toBeNull();
    });

    it('shows no tooltip for an activation that names an unknown item', () => {
        const { controller } = controllerFor();

        controller.activate({ blockOffset: 0, inlineOffset: 0, itemId: 'missing' });

        expect(controller.pointerTooltip).toBeNull();
    });

    it('moves the selection from the keyboard in chronological order and clears it on Escape', () => {
        const { controller, onselect } = controllerFor();

        controller.handleFocus();
        expect(controller.selectedItemId).toBe('a');

        const right = key('ArrowRight');
        controller.handleKeyboard(right);
        expect(right.defaultPrevented).toBe(true);
        expect(onselect).toHaveBeenLastCalledWith('b');

        controller.handleKeyboard(key('End'));
        expect(onselect).toHaveBeenLastCalledWith('c');

        controller.handleKeyboard(key('ArrowLeft'));
        expect(onselect).toHaveBeenLastCalledWith('b');

        controller.handleKeyboard(key('Home'));
        expect(onselect).toHaveBeenLastCalledWith('a');

        controller.handleKeyboard(key('Escape'));
        expect(onselect).toHaveBeenLastCalledWith(null);
        expect(controller.selectedItemId).toBeNull();
    });

    it('focuses the externally selected item first and ignores focus once one is active', () => {
        const { controller } = controllerFor('c');

        controller.handleFocus();
        expect(controller.selectedItemId).toBe('c');

        controller.select('a');
        controller.handleFocus();
        expect(controller.selectedItemId).toBe('a');
    });
});
