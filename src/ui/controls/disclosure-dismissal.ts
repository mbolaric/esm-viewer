export function dismissDisclosureOnEscape(event: KeyboardEvent, element: HTMLDetailsElement | undefined): void {
    if (event.key === 'Escape' && element?.open === true) {
        element.open = false;
    }
}

export function dismissDisclosureOnOutsidePointer(event: PointerEvent, element: HTMLDetailsElement | undefined): void {
    if (element?.open !== true) {
        return;
    }
    const target = event.target;
    if (target instanceof Node && !element.contains(target)) {
        element.open = false;
    }
}
