export interface IDocumentScopedValue<TValue> {
    readonly value: TValue;
    set(value: TValue): void;
    syncDocumentKey(documentKey: string): void;
}

// Mutable value that resets to initial whenever the active document changes.
export function createDocumentScopedValue<TValue>(initial: TValue): IDocumentScopedValue<TValue> {
    let value = $state(initial);
    let documentKey = $state('');

    return {
        get value(): TValue {
            return value;
        },
        set(next: TValue): void {
            value = next;
        },
        syncDocumentKey(nextDocumentKey: string): void {
            if (nextDocumentKey === documentKey) {
                return;
            }
            documentKey = nextDocumentKey;
            value = initial;
        },
    };
}
