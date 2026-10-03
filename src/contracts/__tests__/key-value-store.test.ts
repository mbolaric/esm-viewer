import { describe, expect, it } from 'vitest';

import {
    createMemoryKeyValueStore,
    createStoredValue,
    jsonStoredValueCodec,
    stringStoredValueCodec,
} from '../key-value-store.js';

interface ISetting {
    readonly enabled: boolean;
}

function isSetting(value: unknown): value is ISetting {
    return typeof value === 'object' && value !== null && 'enabled' in value && typeof value.enabled === 'boolean';
}

describe('createStoredValue', () => {
    it('saves, loads, and clears one key', () => {
        const store = createMemoryKeyValueStore();
        const value = createStoredValue(store, 'marker', stringStoredValueCodec);

        expect(value.load()).toBeNull();
        value.save('0-4@UTC');
        expect(value.load()).toBe('0-4@UTC');
        expect(store.getItem('marker')).toBe('0-4@UTC');
        value.clear();
        expect(value.load()).toBeNull();
    });

    it('keeps different keys independent', () => {
        const store = createMemoryKeyValueStore();
        createStoredValue(store, 'a', stringStoredValueCodec).save('first');

        expect(createStoredValue(store, 'b', stringStoredValueCodec).load()).toBeNull();
    });
});

describe('jsonStoredValueCodec', () => {
    const codec = jsonStoredValueCodec(isSetting);

    it('round-trips values the guard accepts', () => {
        expect(codec.decode(codec.encode({ enabled: true }))).toEqual({ enabled: true });
    });

    it('returns null for malformed JSON or values the guard rejects', () => {
        expect(codec.decode('{broken')).toBeNull();
        expect(codec.decode(JSON.stringify({ enabled: 'yes' }))).toBeNull();
    });
});
