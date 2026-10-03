import { describe, expect, it, vi } from 'vitest';

import { LatestRequest } from '../async/latest-request.svelte.js';

interface IDeferred<T> {
    readonly promise: Promise<T>;
    readonly reject: (error: unknown) => void;
    readonly resolve: (value: T) => void;
}

function deferred<T>(): IDeferred<T> {
    let resolve: (value: T) => void = () => undefined;
    let reject: (error: unknown) => void = () => undefined;
    const promise = new Promise<T>((onResolve, onReject) => {
        resolve = onResolve;
        reject = onReject;
    });
    return { promise, reject, resolve };
}

function createRequest(onError?: (error: unknown) => Promise<void>): LatestRequest<readonly string[], 'failed'> {
    return new LatestRequest<readonly string[], 'failed'>({
        classifyError: () => 'failed',
        initialData: [],
        onError,
    });
}

describe('LatestRequest', () => {
    it('shows loading, then applies the loaded data', async () => {
        const request = createRequest();
        const response = deferred<readonly string[]>();

        const run = request.run(() => response.promise);
        expect(request.isLoading).toBe(true);

        response.resolve(['a']);
        await run;

        expect(request.isLoading).toBe(false);
        expect(request.data).toEqual(['a']);
        expect(request.error).toBeNull();
    });

    it('clears the previous result when a new load starts', async () => {
        const request = createRequest();
        await request.run(() => Promise.resolve(['old']));

        const response = deferred<readonly string[]>();
        const run = request.run(() => response.promise);

        expect(request.data).toEqual([]);
        response.resolve(['new']);
        await run;
    });

    it('ignores a slower earlier response once a newer request has started', async () => {
        const request = createRequest();
        const first = deferred<readonly string[]>();
        const second = deferred<readonly string[]>();

        const firstRun = request.run(() => first.promise);
        const secondRun = request.run(() => second.promise);
        second.resolve(['second']);
        await secondRun;
        first.resolve(['first']);
        await firstRun;

        expect(request.data).toEqual(['second']);
        expect(request.isLoading).toBe(false);
    });

    it('classifies and reports only failures of the current request', async () => {
        const onError = vi.fn<(error: unknown) => Promise<void>>().mockResolvedValue(undefined);
        const request = createRequest(onError);
        const stale = deferred<readonly string[]>();

        const staleRun = request.run(() => stale.promise);
        await request.run(() => Promise.reject(new Error('current failed')));
        stale.reject(new Error('stale failed'));
        await staleRun;

        expect(request.error).toBe('failed');
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(new Error('current failed'));
    });

    it('lets multi-step loads detect that they were superseded', async () => {
        const request = createRequest();
        const step = deferred<undefined>();
        let sawSuperseded = false;

        const run = request.run(async (isCurrent) => {
            await step.promise;
            sawSuperseded = !isCurrent();
            return ['stale'];
        });
        request.cancel();
        step.resolve(undefined);
        await run;

        expect(sawSuperseded).toBe(true);
        expect(request.data).toEqual([]);
    });

    it('cancel stops loading and drops the in-flight result', async () => {
        const request = createRequest();
        await request.run(() => Promise.resolve(['kept']));
        const pending = deferred<readonly string[]>();

        const run = request.run(() => pending.promise);
        request.cancel();
        pending.resolve(['late']);
        await run;

        expect(request.isLoading).toBe(false);
        expect(request.data).toEqual([]);
    });

    it('reset returns to the initial state and drops the in-flight result', async () => {
        const request = createRequest();
        await request.run(() => Promise.reject(new Error('failed')));
        const pending = deferred<readonly string[]>();

        const run = request.run(() => pending.promise);
        request.reset();
        pending.resolve(['late']);
        await run;

        expect(request.data).toEqual([]);
        expect(request.error).toBeNull();
        expect(request.isLoading).toBe(false);
    });

    it('retains previous data during reload when retainDataOnRun is true', async () => {
        const request = new LatestRequest<readonly string[], 'failed'>({
            classifyError: () => 'failed',
            initialData: [],
            retainDataOnRun: true,
        });

        await request.run(() => Promise.resolve(['first']));
        expect(request.data).toEqual(['first']);

        const secondResponse = deferred<readonly string[]>();
        const secondRun = request.run(() => secondResponse.promise);

        expect(request.isLoading).toBe(true);
        expect(request.data).toEqual(['first']);

        secondResponse.resolve(['second']);
        await secondRun;

        expect(request.isLoading).toBe(false);
        expect(request.data).toEqual(['second']);
    });
});
