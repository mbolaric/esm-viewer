// Synchronous, best-effort persistence for small per-user settings. Implementations never throw: a read from an
// unavailable store returns null and a write to it is dropped, so a settings failure can never break a workflow.
// `setItem` returns false for a dropped write so callers that promise persistence can report the failure.
export interface IKeyValueStore {
    getItem(key: string): string | null;
    removeItem(key: string): void;
    setItem(key: string, value: string): boolean;
}

export interface IStoredValueCodec<TValue> {
    // Returns null for missing, malformed, or outdated data so callers fall back to their default.
    decode(raw: string): TValue | null;
    encode(value: TValue): string;
}

export interface IStoredValue<TValue> {
    clear(): void;
    load(): TValue | null;
    save(value: TValue): void;
}

export function createStoredValue<TValue>(
    store: IKeyValueStore,
    key: string,
    codec: IStoredValueCodec<TValue>,
): IStoredValue<TValue> {
    return {
        clear: () => {
            store.removeItem(key);
        },
        load: () => {
            const raw = store.getItem(key);
            return raw === null ? null : codec.decode(raw);
        },
        save: (value) => {
            store.setItem(key, codec.encode(value));
        },
    };
}

// JSON codec that accepts stored data only when the caller's guard recognises it.
export function jsonStoredValueCodec<TValue>(isValue: (value: unknown) => value is TValue): IStoredValueCodec<TValue> {
    return {
        decode: (raw) => {
            try {
                const parsed: unknown = JSON.parse(raw);
                return isValue(parsed) ? parsed : null;
            } catch {
                return null;
            }
        },
        encode: (value) => JSON.stringify(value),
    };
}

export const stringStoredValueCodec: IStoredValueCodec<string> = {
    decode: (raw) => raw,
    encode: (value) => value,
};

// Process-lifetime store for tests and for hosts without persistent storage.
export function createMemoryKeyValueStore(): IKeyValueStore {
    const values = new Map<string, string>();
    return {
        getItem: (key) => values.get(key) ?? null,
        removeItem: (key) => {
            values.delete(key);
        },
        setItem: (key, value) => {
            values.set(key, value);
            return true;
        },
    };
}
