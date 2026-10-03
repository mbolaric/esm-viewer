import type { IKeyValueStore } from '#contracts';

// Web storage can be missing or throw (quota, disabled storage), so every access is contained here once.
export function createBrowserKeyValueStore(storage: () => Storage = () => globalThis.localStorage): IKeyValueStore {
    return {
        getItem: (key) => {
            try {
                return storage().getItem(key);
            } catch {
                return null;
            }
        },
        removeItem: (key) => {
            try {
                storage().removeItem(key);
            } catch {
                // Best-effort persistence; a stale value is overwritten or ignored on the next read.
            }
        },
        setItem: (key, value) => {
            try {
                storage().setItem(key, value);
                return true;
            } catch {
                return false;
            }
        },
    };
}
