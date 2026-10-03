export type UnknownRecord = Readonly<Record<string, unknown>>;

export interface IJsonRecord {
    readonly [key: string]: JsonValue;
}

export type JsonValue = boolean | null | number | string | readonly JsonValue[] | IJsonRecord;

const maximumJsonArrayEntries = 1_000_000;
const maximumJsonKeyLength = 256;
const maximumJsonStringLength = 1_048_576;
const maximumJsonTotalStringLength = 128 * 1024 * 1024;
const maximumJsonValues = 1_000_000;
const maximumRecordEntries = 10_000;

interface IJsonValidationBudget {
    remainingStringLength: number;
    remainingValues: number;
}

function isPlainRecord(value: object): boolean {
    const prototype: unknown = Object.getPrototypeOf(value);

    return prototype === null || prototype === Object.prototype;
}

function consumeJsonValue(budget: IJsonValidationBudget): boolean {
    if (budget.remainingValues <= 0) {
        return false;
    }

    budget.remainingValues -= 1;
    return true;
}

function consumeJsonString(value: string, budget: IJsonValidationBudget): boolean {
    if (value.length > maximumJsonStringLength || value.length > budget.remainingStringLength) {
        return false;
    }

    budget.remainingStringLength -= value.length;
    return true;
}

function isJsonRecord(value: unknown, depth: number, budget: IJsonValidationBudget): value is IJsonRecord {
    if (!isUnknownRecord(value)) {
        return false;
    }

    if (depth <= 0) {
        return false;
    }

    return Object.entries(value).every(
        ([key, entry]) =>
            key.length <= maximumJsonKeyLength &&
            consumeJsonString(key, budget) &&
            isJsonValueWithinBudget(entry, depth - 1, budget),
    );
}

function isJsonArray(value: unknown, depth: number, budget: IJsonValidationBudget): value is readonly JsonValue[] {
    if (!Array.isArray(value) || value.length > maximumJsonArrayEntries) {
        return false;
    }

    if (depth <= 0) {
        return false;
    }

    const keys = Object.keys(value);

    if (
        Reflect.ownKeys(value).length !== value.length + 1 ||
        keys.length !== value.length ||
        !keys.every((key, index) => key === String(index))
    ) {
        return false;
    }

    return value.every((entry) => isJsonValueWithinBudget(entry, depth - 1, budget));
}

function isJsonScalar(value: unknown, budget: IJsonValidationBudget): value is boolean | null | number | string {
    if (typeof value === 'string') {
        return consumeJsonString(value, budget);
    }

    return value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
}

function isJsonValueWithinBudget(value: unknown, depth: number, budget: IJsonValidationBudget): value is JsonValue {
    if (depth <= 0 || !consumeJsonValue(budget)) {
        return false;
    }

    if (isJsonScalar(value, budget)) {
        return true;
    }

    if (isJsonArray(value, depth, budget)) {
        return true;
    }

    return isJsonRecord(value, depth, budget);
}

export function isJsonValue(value: unknown, maxDepth = 32): value is JsonValue {
    try {
        return isJsonValueWithinBudget(value, maxDepth, {
            remainingStringLength: maximumJsonTotalStringLength,
            remainingValues: maximumJsonValues,
        });
    } catch {
        return false;
    }
}

export function isUnknownRecord(value: unknown): value is UnknownRecord {
    try {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            return false;
        }

        const keys = Reflect.ownKeys(value);

        return (
            isPlainRecord(value) &&
            keys.length <= maximumRecordEntries &&
            keys.every((key) => {
                if (typeof key !== 'string') {
                    return false;
                }

                const descriptor = Object.getOwnPropertyDescriptor(value, key);

                if (descriptor?.enumerable !== true) {
                    return false;
                }

                return Object.hasOwn(descriptor, 'value');
            })
        );
    } catch {
        return false;
    }
}

export function hasExactKeys(value: UnknownRecord, expectedKeys: readonly string[]): boolean {
    try {
        const actualKeys = Object.keys(value);

        return (
            actualKeys.length === expectedKeys.length && expectedKeys.every((expectedKey) => Object.hasOwn(value, expectedKey))
        );
    } catch {
        return false;
    }
}

export function isBoundaryRecord(value: unknown, maxDepth = 32): value is IJsonRecord {
    if (!isUnknownRecord(value)) {
        return false;
    }

    return isJsonValue(value, maxDepth);
}

export type Guard<T> = (value: unknown) => value is T;

// One guard per property: every property must be present and no other key is allowed.
export type ExactRecordShape<T> = { readonly [K in keyof T]-?: Guard<T[K]> };

export function isString(value: unknown): value is string {
    return typeof value === 'string';
}

export function boundedString(maxLength: number): Guard<string> {
    return (value): value is string => typeof value === 'string' && value.length <= maxLength;
}

export function isNonNegativeSafeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function literal<const TValues extends readonly (boolean | number | string | null)[]>(
    ...values: TValues
): Guard<TValues[number]> {
    return (value): value is TValues[number] => values.some((candidate) => candidate === value);
}

export function nullable<T>(guard: Guard<T>): Guard<T | null> {
    return (value): value is T | null => value === null || guard(value);
}

export function arrayOf<T>(guard: Guard<T>, maxEntries: number): Guard<readonly T[]> {
    return (value): value is readonly T[] => {
        if (!Array.isArray(value) || value.length > maxEntries) {
            return false;
        }
        // Array.every skips empty slots, so a sparse array would pass without its holes being checked.
        for (let index = 0; index < value.length; index += 1) {
            if (!Object.hasOwn(value, index) || !guard(value[index])) {
                return false;
            }
        }
        return true;
    };
}

// Guard for a plain record holding exactly the keys of `shape`, each accepted by its guard.
export function exactRecord<T>(shape: ExactRecordShape<T>): Guard<T>;
export function exactRecord(shape: Readonly<Record<string, Guard<unknown>>>): Guard<unknown> {
    const entries = Object.entries(shape);
    const keys = entries.map(([key]) => key);

    return (value): value is unknown =>
        isUnknownRecord(value) && hasExactKeys(value, keys) && entries.every(([key, guard]) => guard(value[key]));
}
