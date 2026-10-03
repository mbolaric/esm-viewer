import { describe, expect, it } from 'vitest';

import { createBrowserKeyValueStore } from '../browser-key-value-store.js';

class MemoryStorage implements Storage {
    readonly #_values = new Map<string, string>();

    public get length(): number {
        return this.#_values.size;
    }

    public clear(): void {
        this.#_values.clear();
    }

    public getItem(key: string): string | null {
        return this.#_values.get(key) ?? null;
    }

    public key(index: number): string | null {
        return [...this.#_values.keys()][index] ?? null;
    }

    public removeItem(key: string): void {
        this.#_values.delete(key);
    }

    public setItem(key: string, value: string): void {
        this.#_values.set(key, value);
    }
}

function throwingStorage(): Storage {
    throw new Error('storage blocked');
}

describe('createBrowserKeyValueStore', () => {
    it('reads and writes through the given web storage', () => {
        const storage = new MemoryStorage();
        const store = createBrowserKeyValueStore(() => storage);

        expect(store.setItem('key', 'value')).toBe(true);
        expect(storage.getItem('key')).toBe('value');
        expect(store.getItem('key')).toBe('value');
        store.removeItem('key');
        expect(store.getItem('key')).toBeNull();
    });

    it('never throws when storage is unavailable', () => {
        const store = createBrowserKeyValueStore(throwingStorage);

        expect(store.getItem('key')).toBeNull();
        expect(store.setItem('key', 'value')).toBe(false);
        expect(() => {
            store.removeItem('key');
        }).not.toThrow();
    });
});
