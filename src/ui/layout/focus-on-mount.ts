import { tick } from 'svelte';

// Focus alone can retain the previous screen's offset before the layout update finishes.
export function focusOnMount(node: HTMLElement): void {
    node.focus();
    void tick().then(() => {
        const main = node.isConnected ? node.closest('main') : null;
        if (main !== null) {
            main.scrollTop = 0;
            main.scrollLeft = 0;
        }
    });
}
