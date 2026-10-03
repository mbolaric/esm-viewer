export interface IAvailableOverflowOptions {
    readonly enabled?: boolean;
    readonly onoverflowchange?: (isOverflowing: boolean) => void;
    readonly overflowClass?: string;
}

export interface IAvailableOverflowAction {
    readonly destroy: () => void;
    readonly update: (newOptions?: IAvailableOverflowOptions) => void;
}

export function observeAvailableOverflow(node: HTMLElement, options: IAvailableOverflowOptions = {}): IAvailableOverflowAction {
    let currentOptions = options;
    let observer: ResizeObserver | null = null;

    const checkOverflow = (): void => {
        const targetClass = currentOptions.overflowClass ?? 'is-overflowing';
        if (currentOptions.enabled === false) {
            node.classList.remove(targetClass);
            currentOptions.onoverflowchange?.(false);
            return;
        }
        const parent = node.parentElement;
        if (parent === null) {
            return;
        }
        const parentStyle = globalThis.getComputedStyle(parent);
        const paddingTop = Number.parseFloat(parentStyle.paddingTop) || 0;
        const paddingBottom = Number.parseFloat(parentStyle.paddingBottom) || 0;
        const availableBlock = parent.clientHeight - paddingTop - paddingBottom;

        const nodeStyle = globalThis.getComputedStyle(node);
        const currentPadding = Number.parseFloat(nodeStyle.paddingBottom) || 0;
        const contentBlock = node.offsetHeight - currentPadding;

        const isOverflowing = contentBlock - availableBlock > 1;
        node.classList.toggle(targetClass, isOverflowing);
        currentOptions.onoverflowchange?.(isOverflowing);
    };

    const attach = (): void => {
        if (typeof ResizeObserver === 'undefined') {
            return;
        }
        const parent = node.parentElement;
        if (parent === null) {
            return;
        }
        observer = new ResizeObserver(checkOverflow);
        observer.observe(node);
        observer.observe(parent);
        checkOverflow();
    };

    if (currentOptions.enabled !== false) {
        attach();
    } else {
        checkOverflow();
    }

    return {
        destroy(): void {
            observer?.disconnect();
            observer = null;
        },
        update(newOptions: IAvailableOverflowOptions = {}): void {
            currentOptions = newOptions;
            if (observer === null && currentOptions.enabled !== false) {
                attach();
            } else {
                checkOverflow();
            }
        },
    };
}
