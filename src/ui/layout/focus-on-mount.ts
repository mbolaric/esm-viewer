// Moves focus to the element once it is mounted, so a newly shown screen or panel announces its heading.
export function focusOnMount(node: HTMLElement): void {
    node.focus();
}
