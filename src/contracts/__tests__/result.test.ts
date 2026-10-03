import { describe, expect, it } from 'vitest';

import { err, ok, type Result } from '../result.js';

describe('Result', () => {
    function readResult(result: Result<string, 'failed'>): string {
        return result.ok ? result.value : result.error;
    }

    it('keeps success and failure values discriminated', () => {
        expect(readResult({ ok: true, value: 'ready' })).toBe('ready');
        expect(readResult({ error: 'failed', ok: false })).toBe('failed');
    });

    it('builds the same shapes through ok and err', () => {
        expect(ok('ready')).toEqual({ ok: true, value: 'ready' });
        expect(err('failed')).toEqual({ error: 'failed', ok: false });
        expect(readResult(ok('ready'))).toBe('ready');
        expect(readResult(err('failed'))).toBe('failed');
    });
});
