import { handleChronologicalChartKeyboard } from './chart-keyboard.js';

export interface IChartSelectionItem {
    readonly description: string;
    readonly id: string;
}

export interface IChartPointerActivation {
    readonly blockOffset: number;
    readonly inlineOffset: number;
}

export interface IChartPointerTooltip {
    readonly blockOffset: number;
    readonly description: string;
    readonly inlineOffset: number;
}

export interface IChartSelectionOptions<TItem extends IChartSelectionItem, TActivation extends IChartPointerActivation> {
    // Identifies the item a runtime pointer activation refers to.
    readonly activatedItemId: (activation: TActivation) => string;
    // The items in the order keyboard navigation walks them.
    readonly chronologicalItems: () => readonly TItem[];
    readonly items: () => readonly TItem[];
    readonly onselect: (id: string | null) => void;
    readonly selectedId: () => string | null;
}

// Selection, pointer activation and keyboard navigation shared by the chronological charts. The options are read
// lazily so the controller follows changing component props.
export class ChartSelectionController<TItem extends IChartSelectionItem, TActivation extends IChartPointerActivation> {
    readonly #_options: IChartSelectionOptions<TItem, TActivation>;
    #_activeId = $state<string | null>(null);
    #_pointerActivation = $state.raw<TActivation | null>(null);

    public constructor(options: IChartSelectionOptions<TItem, TActivation>) {
        this.#_options = options;
    }

    public get activeItem(): TItem | null {
        const activeId = this.#_activeId ?? this.#_options.selectedId();
        return this.#_options.items().find((item) => item.id === activeId) ?? null;
    }

    public get pointerTooltip(): IChartPointerTooltip | null {
        const activation = this.#_pointerActivation;
        if (activation === null) {
            return null;
        }
        const activatedId = this.#_options.activatedItemId(activation);
        const item = this.#_options.items().find((candidate) => candidate.id === activatedId);
        return item === undefined
            ? null
            : { blockOffset: activation.blockOffset, description: item.description, inlineOffset: activation.inlineOffset };
    }

    public get selectedItemId(): string | null {
        return this.#_activeId ?? this.#_options.selectedId();
    }

    // Runtime callback: the pointer moved over an item, or left every item.
    public readonly activate = (activation: TActivation | null): void => {
        this.#_pointerActivation = activation;
        this.#_activeId = activation === null ? null : this.#_options.activatedItemId(activation);
    };

    // Runtime callback and keyboard action: the item was chosen, or the selection was cleared.
    public readonly select = (id: string | null): void => {
        this.#_activeId = id;
        this.#_options.onselect(id);
    };

    public readonly handleFocus = (): void => {
        const items = this.#_options.chronologicalItems();
        if (this.#_activeId !== null || items.length === 0) {
            return;
        }
        this.#_activeId = this.#_options.selectedId() ?? items[0]?.id ?? null;
    };

    public readonly handleKeyboard = (event: KeyboardEvent): void => {
        const items = this.#_options.chronologicalItems();
        const currentId = this.#_activeId ?? this.#_options.selectedId();
        handleChronologicalChartKeyboard(
            event,
            items.findIndex((item) => item.id === currentId),
            items.length,
            {
                clear: () => {
                    this.select(null);
                },
                select: (index) => {
                    const item = items[index];
                    if (item !== undefined) {
                        this.select(item.id);
                    }
                },
            },
        );
    };
}
