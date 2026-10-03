import { describe, expect, it } from 'vitest';

import {
    arrayOf,
    boundedString,
    exactRecord,
    hasExactKeys,
    isBoundaryRecord,
    isJsonValue,
    isNonNegativeSafeInteger,
    isString,
    isUnknownRecord,
    literal,
    nullable,
} from '../index.js';

describe('unknown value guards', () => {
    it('accepts bounded plain JSON records', () => {
        const nullPrototypeRecord = { answer: 42 };
        Object.setPrototypeOf(nullPrototypeRecord, null);

        expect(isBoundaryRecord({ items: [true, null, 'value', 42] })).toBe(true);
        expect(isBoundaryRecord(nullPrototypeRecord)).toBe(true);
        expect(hasExactKeys({ first: 1, second: 2 }, ['first', 'second'])).toBe(true);
    });

    it.each<[unknown]>([
        [new Date()],
        [new Map()],
        [new Set()],
        [Number.NaN],
        [Number.POSITIVE_INFINITY],
        [{ value: undefined }],
        [{ value: 1n }],
        [{ value: Symbol('not-json') }],
    ])('rejects non-JSON or non-plain values', (value: unknown) => {
        expect(isJsonValue(value)).toBe(false);
        expect(isBoundaryRecord(value)).toBe(false);
    });

    it('rejects accessors, symbols, and non-enumerable properties', () => {
        const accessorRecord = Object.defineProperty({}, 'value', {
            enumerable: true,
            get: () => 42,
        });
        const symbolRecord = { [Symbol('private')]: 'value' };
        const hiddenRecord = Object.defineProperty({}, 'hidden', {
            enumerable: false,
            value: 'value',
        });

        expect(isUnknownRecord(accessorRecord)).toBe(false);
        expect(isUnknownRecord(symbolRecord)).toBe(false);
        expect(isUnknownRecord(hiddenRecord)).toBe(false);
    });

    it('rejects sparse arrays and arrays with non-JSON properties', () => {
        const sparseArray = new Array<unknown>(1);
        const extraArray: unknown[] = [true];
        Object.defineProperty(extraArray, 'hidden', {
            enumerable: false,
            value: true,
        });

        expect(isJsonValue(sparseArray)).toBe(false);
        expect(isJsonValue(extraArray)).toBe(false);
    });

    it('validates accessor-backed array entries by their value', () => {
        const accessorArray: unknown[] = [];
        Object.defineProperty(accessorArray, '0', {
            enumerable: true,
            get: () => 42,
        });

        expect(isJsonValue(accessorArray)).toBe(true);
    });

    it('fails closed for revoked proxies instead of throwing', () => {
        const revocable = Proxy.revocable({}, {});
        revocable.revoke();

        expect(() => isUnknownRecord(revocable.proxy)).not.toThrow();
        expect(isUnknownRecord(revocable.proxy)).toBe(false);
        expect(isJsonValue(revocable.proxy)).toBe(false);
    });

    it('enforces nesting, string, and record-entry bounds', () => {
        const oversizedRecord = Object.fromEntries(
            Array.from({ length: 10_001 }, (_, index) => [`field${String(index)}`, index]),
        );

        expect(isJsonValue({ nested: { value: 1 } }, 2)).toBe(false);
        expect(isJsonValue({ nested: 1 }, 2)).toBe(true);
        expect(isJsonValue('x'.repeat(1_048_577))).toBe(false);
        expect(isJsonValue({ ['k'.repeat(257)]: true })).toBe(false);
        expect(isUnknownRecord(oversizedRecord)).toBe(false);
    });

    it('rejects unexpected exact keys', () => {
        expect(hasExactKeys({ expected: true, unexpected: true }, ['expected'])).toBe(false);
        expect(hasExactKeys({ expected: true }, ['expected', 'missing'])).toBe(false);
    });
});

describe('guard combinators', () => {
    it('bounds strings and integers', () => {
        const shortText = boundedString(3);

        expect(shortText('abc')).toBe(true);
        expect(shortText('abcd')).toBe(false);
        expect(shortText(3)).toBe(false);
        expect(isNonNegativeSafeInteger(0)).toBe(true);
        expect(isNonNegativeSafeInteger(-1)).toBe(false);
        expect(isNonNegativeSafeInteger(1.5)).toBe(false);
        expect(isNonNegativeSafeInteger(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
    });

    it('matches literals, nullable values and bounded arrays', () => {
        const orientation = literal('landscape', 'portrait');

        expect(orientation('portrait')).toBe(true);
        expect(orientation('square')).toBe(false);
        expect(nullable(isString)(null)).toBe(true);
        expect(nullable(isString)(undefined)).toBe(false);
        expect(arrayOf(isString, 2)(['a', 'b'])).toBe(true);
        expect(arrayOf(isString, 2)(['a', 'b', 'c'])).toBe(false);
        expect(arrayOf(isString, 2)(['a', 1])).toBe(false);
    });

    it('rejects sparse arrays even though their holes are skipped by Array.every', () => {
        const sparse: unknown[] = ['a'];
        sparse[2] = 'c';

        expect(arrayOf(isString, 3)(sparse)).toBe(false);
    });

    it('accepts a record only with exactly the shaped keys, each passing its guard', () => {
        const isPoint = exactRecord<{ readonly label: string; readonly x: number }>({
            label: isString,
            x: isNonNegativeSafeInteger,
        });

        expect(isPoint({ label: 'a', x: 1 })).toBe(true);
        expect(isPoint({ label: 'a' })).toBe(false);
        expect(isPoint({ label: 'a', x: 1, y: 2 })).toBe(false);
        expect(isPoint({ label: 'a', x: -1 })).toBe(false);
        expect(isPoint([1])).toBe(false);
    });
});
