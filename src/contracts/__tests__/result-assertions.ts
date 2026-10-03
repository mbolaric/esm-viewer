import { expect } from 'vitest';
import type { Result } from '../index.js';

// Asserts a Result failed with expected error.
export function expectInvalid<TError>(result: Result<unknown, TError>, error: TError): void {
    expect(result).toEqual({ error, ok: false });
}

// Asserts a Result succeeded with expected value.
export function expectOk(result: Result<unknown, unknown>, value: unknown): void {
    expect(result).toEqual({ ok: true, value });
}
