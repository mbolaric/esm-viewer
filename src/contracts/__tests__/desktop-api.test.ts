import { describe, expect, it } from 'vitest';

import { expectInvalid, expectOk } from './result-assertions.js';
import {
    decodeBinaryPayload,
    decodeReadTachographFileFailure,
    decodeErrorEvent,
    decodeRuntimeVersionsResult,
    decodeViewerPreferences,
    DEFAULT_VIEWER_PREFERENCES,
    ERROR_CODES,
    MAXIMUM_OPEN_FILE_BYTES,
    type IErrorEvent,
} from '../index.js';

describe('desktop API decoders', () => {
    it('decodes a typed read-file failure and rejects anything else', () => {
        const notFound = { code: 'notFound', error: 'File does not exist' };
        const readFailure = { code: null, error: 'File could not be read' };

        expectOk(decodeReadTachographFileFailure(notFound), notFound);
        expectOk(decodeReadTachographFileFailure(readFailure), readFailure);
        expectInvalid(
            decodeReadTachographFileFailure({ ...notFound, code: 'arbitraryFailure' }),
            'invalidReadTachographFileFailure',
        );
        expectInvalid(decodeReadTachographFileFailure({ ...notFound, unexpected: true }), 'invalidReadTachographFileFailure');
        expectInvalid(decodeReadTachographFileFailure({ ...notFound, error: '' }), 'invalidReadTachographFileFailure');
        expectInvalid(decodeReadTachographFileFailure('File does not exist'), 'invalidReadTachographFileFailure');
    });

    it('decodes a bounded raw binary payload from an ArrayBuffer, a Uint8Array, or a validated byte-array fallback', () => {
        const bytes = new Uint8Array([0, 127, 255]);

        expect(decodeBinaryPayload(bytes.buffer, 3)).toEqual(bytes);
        expect(decodeBinaryPayload(bytes, 3)).toBe(bytes);
        expect(decodeBinaryPayload([0, 127, 255], 3)).toEqual(bytes);
        expect(decodeBinaryPayload(new ArrayBuffer(4), 3)).toBeNull();
        expect(decodeBinaryPayload([0, 256], 3)).toBeNull();
        expect(decodeBinaryPayload([0, 1.5], 3)).toBeNull();
        // A sparse array's holes are not bytes.
        expect(decodeBinaryPayload(new Array<number>(2), 3)).toBeNull();
        expect(decodeBinaryPayload('bytes', MAXIMUM_OPEN_FILE_BYTES)).toBeNull();
    });

    it('decodes versioned preferences, including a valid night-work window override', () => {
        expectOk(decodeViewerPreferences(DEFAULT_VIEWER_PREFERENCES), DEFAULT_VIEWER_PREFERENCES);
        expectOk(
            decodeViewerPreferences({
                ...DEFAULT_VIEWER_PREFERENCES,
                nightWorkEndHour: 5,
                nightWorkStartHour: 1,
                nightWorkTimeZone: 'Europe/Berlin',
            }),
            {
                ...DEFAULT_VIEWER_PREFERENCES,
                nightWorkEndHour: 5,
                nightWorkStartHour: 1,
                nightWorkTimeZone: 'Europe/Berlin',
            },
        );
    });

    it.each<[string, unknown]>([
        ['a private source path', { ...DEFAULT_VIEWER_PREFERENCES, sourcePath: '/private/source.ddd' }],
        ['a path-like displayTimeZone', { ...DEFAULT_VIEWER_PREFERENCES, displayTimeZone: '../private' }],
        ['a path-like displayDateFormat', { ...DEFAULT_VIEWER_PREFERENCES, displayDateFormat: '../private' }],
        ['an unsupported schema version', { ...DEFAULT_VIEWER_PREFERENCES, version: 3 }],
        [
            'a value missing required fields',
            {
                density: 'compact',
                displayTimeZone: 'UTC',
                locale: 'en',
                recentFilePathsEnabled: false,
                theme: 'system',
                verificationAutoRun: false,
                version: 1,
            },
        ],
        ['nightWorkEndHour out of range', { ...DEFAULT_VIEWER_PREFERENCES, nightWorkEndHour: 24 }],
        ['nightWorkStartHour out of range', { ...DEFAULT_VIEWER_PREFERENCES, nightWorkStartHour: -1 }],
        [
            'nightWorkEndHour equal to nightWorkStartHour',
            { ...DEFAULT_VIEWER_PREFERENCES, nightWorkEndHour: 4, nightWorkStartHour: 4 },
        ],
        [
            'nightWorkEndHour before nightWorkStartHour',
            { ...DEFAULT_VIEWER_PREFERENCES, nightWorkEndHour: 20, nightWorkStartHour: 22 },
        ],
        ['a night window shorter than four hours', { ...DEFAULT_VIEWER_PREFERENCES, nightWorkEndHour: 4, nightWorkStartHour: 1 }],
        ['a night window ending after 07:00', { ...DEFAULT_VIEWER_PREFERENCES, nightWorkEndHour: 8, nightWorkStartHour: 2 }],
        ['a fractional night window hour', { ...DEFAULT_VIEWER_PREFERENCES, nightWorkEndHour: 4.5 }],
        ['a path-like nightWorkTimeZone', { ...DEFAULT_VIEWER_PREFERENCES, nightWorkTimeZone: '../private' }],
    ])('rejects preferences with %s', (_label, input) => {
        expectInvalid(decodeViewerPreferences(input), 'invalidPreferences');
    });

    it('defaults a missing pinnedTableColumnIds to {} (a file saved before it existed) and validates it when present', () => {
        const withoutPinnedColumns: Record<string, unknown> = { ...DEFAULT_VIEWER_PREFERENCES };
        delete withoutPinnedColumns['pinnedTableColumnIds'];

        expectOk(decodeViewerPreferences(withoutPinnedColumns), DEFAULT_VIEWER_PREFERENCES);
        expectOk(
            decodeViewerPreferences({
                ...DEFAULT_VIEWER_PREFERENCES,
                pinnedTableColumnIds: { 'compliance.infringements': ['category', 'legal'] },
            }),
            {
                ...DEFAULT_VIEWER_PREFERENCES,
                pinnedTableColumnIds: { 'compliance.infringements': ['category', 'legal'] },
            },
        );
        expectInvalid(
            decodeViewerPreferences({
                ...DEFAULT_VIEWER_PREFERENCES,
                pinnedTableColumnIds: { 'compliance.infringements': ['not a valid id'] },
            }),
            'invalidPreferences',
        );
        expectInvalid(
            decodeViewerPreferences({
                ...DEFAULT_VIEWER_PREFERENCES,
                pinnedTableColumnIds: 'not-a-record',
            }),
            'invalidPreferences',
        );
    });

    it('decodes bounded per-table page sizes and rejects unsupported values', () => {
        const withoutPageSizes: Record<string, unknown> = { ...DEFAULT_VIEWER_PREFERENCES };
        delete withoutPageSizes['tablePageSizes'];
        expectOk(decodeViewerPreferences(withoutPageSizes), DEFAULT_VIEWER_PREFERENCES);
        expectOk(
            decodeViewerPreferences({
                ...DEFAULT_VIEWER_PREFERENCES,
                tablePageSizes: {
                    'viewer.events': 25,
                    'viewer.activity': 100,
                },
            }),
            {
                ...DEFAULT_VIEWER_PREFERENCES,
                tablePageSizes: {
                    'viewer.events': 25,
                    'viewer.activity': 100,
                },
            },
        );
        expectInvalid(
            decodeViewerPreferences({
                ...DEFAULT_VIEWER_PREFERENCES,
                tablePageSizes: { 'viewer.documents': 75 },
            }),
            'invalidPreferences',
        );
        expectInvalid(
            decodeViewerPreferences({
                ...DEFAULT_VIEWER_PREFERENCES,
                tablePageSizes: { '../private': 50 },
            }),
            'invalidPreferences',
        );
    });

    it('decodes a bounded recent-files list and rejects a path-carrying or oversized one', () => {
        const entry = {
            displayName: 'card.ddd',
            openedAtEpochMs: 1_700_000_000_000,
            reopenToken: '/private/tachograph/card.ddd',
        };

        expectOk(
            decodeViewerPreferences({
                ...DEFAULT_VIEWER_PREFERENCES,
                recentFiles: [entry],
            }),
            { ...DEFAULT_VIEWER_PREFERENCES, recentFiles: [entry] },
        );
        expectInvalid(
            decodeViewerPreferences({
                ...DEFAULT_VIEWER_PREFERENCES,
                recentFiles: [{ ...entry, displayName: '/private/tachograph/card.ddd' }],
            }),
            'invalidPreferences',
        );
        expectInvalid(
            decodeViewerPreferences({
                ...DEFAULT_VIEWER_PREFERENCES,
                recentFiles: [{ ...entry, extra: 'unexpected' }],
            }),
            'invalidPreferences',
        );
        expectInvalid(
            decodeViewerPreferences({
                ...DEFAULT_VIEWER_PREFERENCES,
                recentFiles: Array.from({ length: 9 }, () => entry),
            }),
            'invalidPreferences',
        );
        expectInvalid(
            decodeViewerPreferences({
                ...DEFAULT_VIEWER_PREFERENCES,
                recentFiles: 'not-an-array',
            }),
            'invalidPreferences',
        );
    });

    it('migrates the former combined recent-folder preference to recent-file history', () => {
        const legacyPreferences: Record<string, unknown> = {
            ...DEFAULT_VIEWER_PREFERENCES,
            recentFilePathsEnabled: true,
        };
        delete legacyPreferences['recentFilesEnabled'];

        expectOk(decodeViewerPreferences(legacyPreferences), {
            ...DEFAULT_VIEWER_PREFERENCES,
            recentFilePathsEnabled: true,
            recentFilesEnabled: true,
        });

        expectInvalid(
            decodeViewerPreferences({
                ...DEFAULT_VIEWER_PREFERENCES,
                recentFilesEnabled: 'yes',
            }),
            'invalidPreferences',
        );
    });

    it('decodes privacy-safe runtime versions without paths or arbitrary metadata', () => {
        const value = {
            status: 'loaded',
            versions: {
                application: '0.0.0',
                architecture: 'arm64',
                parserCommit: 'ec6c28ef98202387135ca2600cd5bf567499eff6',
                parserVersion: '0.2.0',
                platform: 'darwin',
                runtime: '43.2.0',
            },
        };

        expectOk(decodeRuntimeVersionsResult(value), value);
        expectInvalid(
            decodeRuntimeVersionsResult({
                ...value,
                versions: {
                    ...value.versions,
                    logsPath: '/private/logs',
                },
            }),
            'invalidRuntimeVersionsResult',
        );
    });

    it('accepts the "unknown" parser commit fallback but rejects a truncated hash', () => {
        const value = {
            status: 'loaded',
            versions: {
                application: '0.0.0',
                architecture: 'x86_64',
                parserCommit: 'unknown',
                parserVersion: '0.2.0',
                platform: 'linux',
                runtime: 'Tauri 2.11.5',
            },
        };

        expectOk(decodeRuntimeVersionsResult(value), value);
        expectInvalid(
            decodeRuntimeVersionsResult({
                ...value,
                versions: { ...value.versions, parserCommit: 'abc123' },
            }),
            'invalidRuntimeVersionsResult',
        );
    });

    it.each<IErrorEvent>([
        { code: ERROR_CODES.chartRenderFailed, severity: 'error', source: 'viewer' },
        { code: ERROR_CODES.workspaceRenderFailed, severity: 'error', source: 'viewer' },
        { code: ERROR_CODES.invalidErrorReport, severity: 'warning', source: 'desktop' },
        { code: ERROR_CODES.menuBuildFailed, severity: 'error', source: 'desktop' },
        { code: ERROR_CODES.nativeThemeSyncFailed, severity: 'warning', source: 'desktop' },
        { code: ERROR_CODES.signatureVerificationFailed, severity: 'error', source: 'viewer' },
        { code: ERROR_CODES.dragDropListenerFailed, severity: 'error', source: 'desktop' },
        {
            code: ERROR_CODES.translationMissingKey,
            context: { key: 'valid.key' },
            severity: 'error',
            source: 'translation',
        },
    ])('decodes a valid $code error event unchanged', (event) => {
        expectOk(decodeErrorEvent(event), event);
    });

    it.each<[string, unknown]>([
        ['null', null],
        ['an empty object', {}],
        ['an unrecognised code', { code: 'unknown.error', severity: 'error', source: 'viewer' }],
        [
            'an empty translation-missing-key context',
            {
                code: ERROR_CODES.translationMissingKey,
                context: { key: '' },
                severity: 'error',
                source: 'translation',
            },
        ],
    ])('rejects an invalid error event payload (%s)', (_label, payload) => {
        expectInvalid(decodeErrorEvent(payload), 'invalidErrorEvent');
    });
});
