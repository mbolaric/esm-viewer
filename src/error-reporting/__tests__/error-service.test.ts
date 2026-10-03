import { describe, expect, it } from 'vitest';

import { ERROR_CODES, type IErrorEvent } from '#contracts';

import { ErrorService, type IErrorProvider, type IErrorRecord } from '../error-service.js';

const error: IErrorEvent = {
    code: ERROR_CODES.translationMissingKey,
    context: { key: 'missing.message' },
    severity: 'error',
    source: 'translation',
};

describe('ErrorService', () => {
    it('reports one timestamped, trace-id-stamped record to every provider', async () => {
        const records: IErrorRecord[] = [];
        const provider: IErrorProvider = {
            report(record) {
                records.push(record);
            },
        };
        const service = new ErrorService(
            [provider, provider],
            () => '2026-07-26T10:00:00.000Z',
            () => 'trace-1',
        );

        await service.report(error);

        expect(records).toEqual([
            { ...error, occurredAt: '2026-07-26T10:00:00.000Z', traceId: 'trace-1' },
            { ...error, occurredAt: '2026-07-26T10:00:00.000Z', traceId: 'trace-1' },
        ]);
        expect(records.every((record) => record.code === ERROR_CODES.translationMissingKey)).toBe(true);
    });

    it('defaults to generating a 32-character lowercase-hex trace id per report', async () => {
        const records: IErrorRecord[] = [];
        const provider: IErrorProvider = {
            report(record) {
                records.push(record);
            },
        };
        const service = new ErrorService([provider]);

        await service.report(error);
        await service.report(error);

        expect(records).toHaveLength(2);
        for (const record of records) {
            expect(record.traceId).toMatch(/^[0-9a-f]{32}$/);
        }
        expect(records[0]?.traceId).not.toBe(records[1]?.traceId);
    });

    it('passes the optional raw detail through to every provider without altering the record', async () => {
        const seen: { readonly detail: unknown; readonly record: IErrorRecord }[] = [];
        const provider: IErrorProvider = {
            report(record, detail) {
                seen.push({ detail, record });
            },
        };
        const service = new ErrorService(
            [provider],
            () => '2026-07-26T10:00:00.000Z',
            () => 'trace-1',
        );
        const rawError = new Error('platform IPC rejected');

        await service.report(error, rawError);

        expect(seen).toHaveLength(1);
        expect(seen[0]?.detail).toBe(rawError);
        expect(seen[0]?.record).toEqual({ ...error, occurredAt: '2026-07-26T10:00:00.000Z', traceId: 'trace-1' });
    });

    it('omits detail from the provider call when the caller gives none', async () => {
        const seenDetails: unknown[] = [];
        const provider: IErrorProvider = {
            report(_record, detail) {
                seenDetails.push(detail);
            },
        };
        const service = new ErrorService([provider]);

        await service.report(error);

        expect(seenDetails).toEqual([undefined]);
    });

    it('contains provider failures so error reporting never rejects its caller', async () => {
        const records: IErrorRecord[] = [];
        const failingProvider: IErrorProvider = {
            report() {
                throw new Error('provider failed');
            },
        };
        const workingProvider: IErrorProvider = {
            report(record) {
                records.push(record);
            },
        };
        const service = new ErrorService([failingProvider, workingProvider]);

        await expect(service.report(error)).resolves.toBeUndefined();
        expect(records).toHaveLength(1);
    });

    it('reports events across all supported error codes', async () => {
        const records: IErrorRecord[] = [];
        const provider: IErrorProvider = {
            report(record) {
                records.push(record);
            },
        };
        const service = new ErrorService(
            [provider],
            () => '2026-08-16T12:00:00.000Z',
            () => 'trace-1',
        );

        await service.report({
            code: ERROR_CODES.chartRenderFailed,
            severity: 'error',
            source: 'viewer',
        });
        await service.report({
            code: ERROR_CODES.invalidErrorReport,
            severity: 'warning',
            source: 'desktop',
        });
        await service.report({
            code: ERROR_CODES.menuBuildFailed,
            severity: 'error',
            source: 'desktop',
        });
        await service.report({
            code: ERROR_CODES.signatureVerificationFailed,
            severity: 'error',
            source: 'viewer',
        });
        await service.report({
            code: ERROR_CODES.workspaceRenderFailed,
            severity: 'error',
            source: 'viewer',
        });

        expect(records).toEqual([
            {
                code: ERROR_CODES.chartRenderFailed,
                occurredAt: '2026-08-16T12:00:00.000Z',
                severity: 'error',
                source: 'viewer',
                traceId: 'trace-1',
            },
            {
                code: ERROR_CODES.invalidErrorReport,
                occurredAt: '2026-08-16T12:00:00.000Z',
                severity: 'warning',
                source: 'desktop',
                traceId: 'trace-1',
            },
            {
                code: ERROR_CODES.menuBuildFailed,
                occurredAt: '2026-08-16T12:00:00.000Z',
                severity: 'error',
                source: 'desktop',
                traceId: 'trace-1',
            },
            {
                code: ERROR_CODES.signatureVerificationFailed,
                occurredAt: '2026-08-16T12:00:00.000Z',
                severity: 'error',
                source: 'viewer',
                traceId: 'trace-1',
            },
            {
                code: ERROR_CODES.workspaceRenderFailed,
                occurredAt: '2026-08-16T12:00:00.000Z',
                severity: 'error',
                source: 'viewer',
                traceId: 'trace-1',
            },
        ]);
    });
});
