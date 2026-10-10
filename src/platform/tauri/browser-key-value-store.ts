import { err, ok, type IKeyValueStore, type KeyValueReadResult } from '#contracts';

// Web storage can be missing or throw (quota, disabled storage), so every access is contained here once.
export function createBrowserKeyValueStore(storage: () => Storage = () => globalThis.localStorage): IKeyValueStore {
    const readItem = (key: string): KeyValueReadResult => {
        try {
            return ok(storage().getItem(key));
        } catch {
            return err('ioFailure');
        }
    };

    return {
        getItem: (key) => {
            const result = readItem(key);
            return result.ok ? result.value : null;
        },
        readItem,
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
