import { expect } from 'vitest';
import type { Result } from '#contracts';

// Asserts Result failed with the specified error.
export function expectInvalid<TError>(result: Result<unknown, TError>, error: TError): void {
    expect(result).toEqual({ error, ok: false });
}

// Asserts Result succeeded with the specified value.
export function expectOk(result: Result<unknown, unknown>, value: unknown): void {
    expect(result).toEqual({ ok: true, value });
}
