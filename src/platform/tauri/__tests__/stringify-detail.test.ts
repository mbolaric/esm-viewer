import { describe, expect, it } from 'vitest';

import { stringifyDetail } from '../stringify-detail.js';

describe('stringifyDetail', () => {
    it('returns a V8-style stack unchanged, since it already carries the name/message header', () => {
        const error = new Error('platform IPC rejected');
        error.stack = 'Error: platform IPC rejected\n    at foo (file.js:1:1)';

        expect(stringifyDetail(error)).toBe(error.stack);
    });

    it('prepends the name/message header to a WebKit-style stack missing it', () => {
        const error = new TypeError('invoke is not a function');
        error.stack = 'onTick@http://localhost:1420/composition.ts:567:15\nstart@.../service.ts:88:27';

        expect(stringifyDetail(error)).toBe(`TypeError: invoke is not a function\n${error.stack}`);
    });

    it('falls back to just the header when the error has no stack at all', () => {
        const error = new Error('no stack here');
        delete error.stack;

        expect(stringifyDetail(error)).toBe('Error: no stack here');
    });

    it('returns a plain string detail verbatim', () => {
        expect(stringifyDetail('invoke: notification plugin not registered')).toBe('invoke: notification plugin not registered');
    });

    it('JSON-stringifies a non-Error, non-string detail', () => {
        expect(stringifyDetail({ reason: 'ioFailure', retryable: false })).toBe('{"reason":"ioFailure","retryable":false}');
    });

    it('falls back to String() when the detail cannot be JSON-stringified', () => {
        const circular: { self?: unknown } = {};
        circular.self = circular;

        expect(stringifyDetail(circular)).toBe('[object Object]');
    });
});
