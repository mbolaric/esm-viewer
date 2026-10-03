import { err, ok, type Result } from './result.js';
import { isFileDisplayName, type FileDisplayName } from './file-metadata.js';
import { arrayOf, hasExactKeys, isUnknownRecord } from './unknown-value.js';

export const MAXIMUM_OPEN_FILE_BYTES = 50 * 1024 * 1024;
// Upper bound for generated binaries, including larger host-provided exports.
export const MAXIMUM_GENERATED_BINARY_BYTES = 1024 * 1024 * 1024;
export const MAXIMUM_RECENT_FILES = 8;
// Bounds preventing unbounded growth of table preferences.
export const MAXIMUM_COLUMN_PREFERENCE_TABLES = 64;
export const MAXIMUM_PINNED_COLUMNS_PER_TABLE = 32;
export const MAXIMUM_PAGE_SIZE_PREFERENCE_TABLES = 64;

declare const sourceTokenBrand: unique symbol;
declare const reopenTokenBrand: unique symbol;

export type SourceToken = string & {
    readonly [sourceTokenBrand]: 'SourceToken';
};

export type ReopenToken = string & {
    readonly [reopenTokenBrand]: 'ReopenToken';
};

export type DesktopOperationFailureCode =
    | 'destinationExists'
    | 'fileNotFound'
    | 'invalidPreferences'
    | 'invalidRequest'
    | 'invalidResponse'
    | 'ioFailure'
    | 'sourceConflict'
    | 'tooLarge'
    | 'unsupportedContent';

export interface IOpenedTachographFile {
    readonly bytes: Uint8Array;
    readonly displayName: FileDisplayName;
    readonly reopenToken: ReopenToken | null;
    readonly sourceToken: SourceToken;
}

export type OpenTachographFileResult =
    | { readonly status: 'cancelled' }
    | { readonly code: DesktopOperationFailureCode; readonly status: 'failed' }
    | { readonly file: IOpenedTachographFile; readonly status: 'opened' };

// Why the native backend could not read a tachograph file. The bytes of a successful read arrive as a raw binary IPC
// response instead (see `decodeBinaryPayload`).
export interface IReadTachographFileFailure {
    readonly code: 'notFound' | null;
    readonly error: string;
}

export interface IOpenTachographPathRequest {
    readonly reopenToken: ReopenToken;
}

export interface ISaveExportRequest {
    readonly bytes: Uint8Array;
    readonly sourceToken: SourceToken;
    readonly suggestedName: string;
}

// Sends one command to the native host and resolves with its undecoded response.
export type NativeCommandInvoker = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

export type GeneratedBinaryDocumentResult =
    | { readonly bytes: Uint8Array; readonly status: 'converted' }
    | { readonly code: DesktopOperationFailureCode; readonly status: 'failed' };

export type ConvertHtmlToPdfResult = GeneratedBinaryDocumentResult | { readonly status: 'printed' };

export type SaveExportResult =
    | { readonly status: 'cancelled' }
    | { readonly code: DesktopOperationFailureCode; readonly status: 'failed' }
    | { readonly status: 'saved' };

export type RegisterExportSourceResult =
    | { readonly code: DesktopOperationFailureCode; readonly status: 'failed' }
    | { readonly sourceToken: SourceToken; readonly status: 'registered' };

export interface IReleaseSourceRequest {
    readonly sourceToken: SourceToken;
}

export type ReleaseSourceResult =
    { readonly code: DesktopOperationFailureCode; readonly status: 'failed' } | { readonly status: 'released' };

export type ThemePreference = 'dark' | 'light' | 'system';
export type DensityPreference = 'comfortable' | 'compact';
export type TablePageSize = 25 | 50 | 100;

// Reopenable recent file entry with path-free display name.
export interface IRecentFileEntry {
    readonly displayName: FileDisplayName;
    readonly openedAtEpochMs: number;
    readonly reopenToken: ReopenToken;
}

export interface IViewerPreferences {
    readonly density: DensityPreference;
    readonly displayDateFormat: string;
    readonly displayTimeFormat: string;
    readonly displayTimeZone: string;
    readonly locale: string;
    // IANA time zone for Directive 2002/15/EC night-work calculation.
    readonly nightWorkEndHour: number;
    readonly nightWorkStartHour: number;
    readonly nightWorkTimeZone: string;
    // Pinned table column IDs keyed by table preferenceKey.
    readonly pinnedTableColumnIds: Readonly<Record<string, readonly string[]>>;
    // Selected row count per table preferenceKey.
    readonly tablePageSizes: Readonly<Record<string, TablePageSize>>;
    // Most-recently-opened files capped at MAXIMUM_RECENT_FILES.
    readonly recentFiles: readonly IRecentFileEntry[];
    readonly recentFilesEnabled: boolean;
    readonly recentFilePathsEnabled: boolean;
    readonly theme: ThemePreference;
    readonly verificationAutoRun: boolean;
    readonly version: 1;
}

export const DEFAULT_VIEWER_PREFERENCES: IViewerPreferences = {
    density: 'compact',
    displayDateFormat: 'auto',
    displayTimeFormat: 'auto',
    displayTimeZone: 'UTC',
    locale: 'en',
    nightWorkEndHour: 4,
    nightWorkStartHour: 0,
    nightWorkTimeZone: 'UTC',
    pinnedTableColumnIds: {},
    recentFiles: [],
    recentFilesEnabled: false,
    recentFilePathsEnabled: false,
    theme: 'system',
    tablePageSizes: {},
    verificationAutoRun: false,
    version: 1,
};

export type LoadPreferencesResult =
    | { readonly code: DesktopOperationFailureCode; readonly status: 'failed' }
    | { readonly preferences: IViewerPreferences; readonly status: 'loaded' };

export type SavePreferencesResult =
    { readonly code: DesktopOperationFailureCode; readonly status: 'failed' } | { readonly status: 'saved' };

export type CopyTextToClipboardResult =
    { readonly code: DesktopOperationFailureCode; readonly status: 'failed' } | { readonly status: 'copied' };

export interface IRuntimeVersions {
    readonly application: string;
    readonly architecture: string;
    readonly parserCommit: string;
    readonly parserVersion: string;
    readonly platform: string;
    readonly runtime: string;
}

export type RuntimeVersionsResult =
    | { readonly code: DesktopOperationFailureCode; readonly status: 'failed' }
    | { readonly status: 'loaded'; readonly versions: IRuntimeVersions };

export const APPLICATION_COMMANDS = [
    'application.about',
    'application.exportLogs',
    'application.preferences',
    'application.userGuide',
    'file.close',
    'file.export',
    'file.open',
    'view.commandPalette',
] as const;

export type ApplicationCommand = (typeof APPLICATION_COMMANDS)[number];
export type ApplicationCommandState = Readonly<Record<ApplicationCommand, boolean>>;

export const DISABLED_APPLICATION_COMMAND_STATE: ApplicationCommandState = {
    'application.about': false,
    'application.exportLogs': false,
    'application.preferences': false,
    'application.userGuide': false,
    'file.close': false,
    'file.export': false,
    'file.open': false,
    'view.commandPalette': false,
};

type DesktopApiDecodeError = 'invalidPreferences' | 'invalidReadTachographFileFailure' | 'invalidRuntimeVersionsResult';

const failureCodes: ReadonlySet<string> = new Set([
    'destinationExists',
    'fileNotFound',
    'invalidPreferences',
    'invalidRequest',
    'invalidResponse',
    'ioFailure',
    'sourceConflict',
    'tooLarge',
    'unsupportedContent',
]);
function isBoundedIdentifier(value: unknown, maximumLength: number): value is string {
    if (
        typeof value !== 'string' ||
        value.length === 0 ||
        value.length > maximumLength ||
        !/^[A-Za-z0-9._+-]+(?:\/[A-Za-z0-9._+-]+)*$/u.test(value)
    ) {
        return false;
    }

    return value.split('/').every((segment) => segment !== '.' && segment !== '..');
}

function isLocaleIdentifier(value: unknown): value is string {
    return typeof value === 'string' && value.length <= 35 && /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u.test(value);
}

function isDesktopOperationFailureCode(value: unknown): value is DesktopOperationFailureCode {
    return typeof value === 'string' && failureCodes.has(value);
}

function isByte(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255;
}

function isFailureResult(value: unknown): value is { readonly code: DesktopOperationFailureCode; readonly status: 'failed' } {
    return (
        isUnknownRecord(value) &&
        hasExactKeys(value, ['code', 'status']) &&
        value['status'] === 'failed' &&
        isDesktopOperationFailureCode(value['code'])
    );
}

// Source and reopen tokens share one wire format and differ only in their brand.
function isOpaqueToken(value: unknown): value is SourceToken & ReopenToken {
    return typeof value === 'string' && value.length > 0 && !value.includes('\0');
}

export function isSourceToken(value: unknown): value is SourceToken {
    return isOpaqueToken(value);
}

export function isReopenToken(value: unknown): value is ReopenToken {
    return isOpaqueToken(value);
}

export function decodeReadTachographFileFailure(value: unknown): Result<IReadTachographFileFailure, DesktopApiDecodeError> {
    if (
        !isUnknownRecord(value) ||
        !hasExactKeys(value, ['code', 'error']) ||
        (value['code'] !== null && value['code'] !== 'notFound') ||
        typeof value['error'] !== 'string' ||
        value['error'].length === 0 ||
        value['error'].length > 1024
    ) {
        return err('invalidReadTachographFileFailure');
    }
    return ok({ code: value['code'], error: value['error'] });
}

// Decodes a raw binary IPC response. The native side returns an ArrayBuffer; a validated byte array is also accepted
// because the IPC falls back to JSON serialization when its binary channel is unavailable. Returns null for anything
// else, or for more than `maximumBytes` bytes.
export function decodeBinaryPayload(value: unknown, maximumBytes: number): Uint8Array | null {
    if (value instanceof ArrayBuffer) {
        return value.byteLength <= maximumBytes ? new Uint8Array(value) : null;
    }
    if (value instanceof Uint8Array) {
        return value.byteLength <= maximumBytes ? value : null;
    }
    if (arrayOf(isByte, maximumBytes)(value)) {
        return Uint8Array.from(value);
    }
    return null;
}

// Directive 2002/15/EC Art. 3(h): night time is a period of at least four hours, as defined by national law, between
// 00:00 and 07:00. Whole local hours bound the window.
export const NIGHT_WORK_WINDOW_LATEST_END_HOUR = 7;
export const NIGHT_WORK_WINDOW_MINIMUM_HOURS = 4;

function isWholeHour(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value);
}

export function isNightWorkWindow(startHour: number, endHour: number): boolean {
    return (
        isWholeHour(startHour) &&
        isWholeHour(endHour) &&
        startHour >= 0 &&
        endHour <= NIGHT_WORK_WINDOW_LATEST_END_HOUR &&
        endHour - startHour >= NIGHT_WORK_WINDOW_MINIMUM_HOURS
    );
}

function isRecentFileEntry(value: unknown): value is IRecentFileEntry {
    return (
        isUnknownRecord(value) &&
        hasExactKeys(value, ['displayName', 'openedAtEpochMs', 'reopenToken']) &&
        isFileDisplayName(value['displayName']) &&
        typeof value['openedAtEpochMs'] === 'number' &&
        Number.isSafeInteger(value['openedAtEpochMs']) &&
        value['openedAtEpochMs'] >= 0 &&
        isReopenToken(value['reopenToken'])
    );
}

function isRecentFileList(value: unknown): value is readonly IRecentFileEntry[] {
    return Array.isArray(value) && value.length <= MAXIMUM_RECENT_FILES && value.every(isRecentFileEntry);
}

function isPinnedTableColumnIds(value: unknown): value is Readonly<Record<string, readonly string[]>> {
    if (!isUnknownRecord(value)) {
        return false;
    }
    const entries = Object.entries(value);
    return (
        entries.length <= MAXIMUM_COLUMN_PREFERENCE_TABLES &&
        entries.every(
            ([tableId, columnIds]) =>
                isBoundedIdentifier(tableId, 128) &&
                Array.isArray(columnIds) &&
                columnIds.length <= MAXIMUM_PINNED_COLUMNS_PER_TABLE &&
                columnIds.every((columnId) => isBoundedIdentifier(columnId, 64)),
        )
    );
}

function isTablePageSizes(value: unknown): value is Readonly<Record<string, TablePageSize>> {
    if (!isUnknownRecord(value)) {
        return false;
    }
    const entries = Object.entries(value);
    return (
        entries.length <= MAXIMUM_PAGE_SIZE_PREFERENCE_TABLES &&
        entries.every(
            ([tableId, pageSize]) =>
                isBoundedIdentifier(tableId, 128) && (pageSize === 25 || pageSize === 50 || pageSize === 100),
        )
    );
}

// Keys required by the baseline preferences schema.
const REQUIRED_PREFERENCE_KEYS = [
    'density',
    'displayDateFormat',
    'displayTimeFormat',
    'displayTimeZone',
    'locale',
    'nightWorkEndHour',
    'nightWorkStartHour',
    'nightWorkTimeZone',
    'recentFiles',
    'recentFilePathsEnabled',
    'theme',
    'verificationAutoRun',
    'version',
] as const;

export function decodeViewerPreferences(value: unknown): Result<IViewerPreferences, DesktopApiDecodeError> {
    if (!isUnknownRecord(value)) {
        return err('invalidPreferences');
    }

    const knownKeys: readonly string[] = [
        ...REQUIRED_PREFERENCE_KEYS,
        'pinnedTableColumnIds',
        'recentFilesEnabled',
        'tablePageSizes',
    ];
    const actualKeys = Object.keys(value);
    const pinnedTableColumnIds = Object.hasOwn(value, 'pinnedTableColumnIds') ? value['pinnedTableColumnIds'] : {};
    const recentFilesEnabled = Object.hasOwn(value, 'recentFilesEnabled')
        ? value['recentFilesEnabled']
        : value['recentFilePathsEnabled'];
    const tablePageSizes = Object.hasOwn(value, 'tablePageSizes') ? value['tablePageSizes'] : {};

    if (
        !REQUIRED_PREFERENCE_KEYS.every((key) => Object.hasOwn(value, key)) ||
        !actualKeys.every((key) => knownKeys.includes(key)) ||
        (value['density'] !== 'comfortable' && value['density'] !== 'compact') ||
        !isBoundedIdentifier(value['displayDateFormat'], 64) ||
        !isBoundedIdentifier(value['displayTimeFormat'], 64) ||
        !isBoundedIdentifier(value['displayTimeZone'], 128) ||
        !isLocaleIdentifier(value['locale']) ||
        !isWholeHour(value['nightWorkEndHour']) ||
        !isWholeHour(value['nightWorkStartHour']) ||
        !isNightWorkWindow(value['nightWorkStartHour'], value['nightWorkEndHour']) ||
        !isBoundedIdentifier(value['nightWorkTimeZone'], 128) ||
        !isPinnedTableColumnIds(pinnedTableColumnIds) ||
        !isTablePageSizes(tablePageSizes) ||
        !isRecentFileList(value['recentFiles']) ||
        typeof recentFilesEnabled !== 'boolean' ||
        typeof value['recentFilePathsEnabled'] !== 'boolean' ||
        (value['theme'] !== 'dark' && value['theme'] !== 'light' && value['theme'] !== 'system') ||
        typeof value['verificationAutoRun'] !== 'boolean' ||
        value['version'] !== 1
    ) {
        return err('invalidPreferences');
    }

    return ok({
        density: value['density'],
        displayDateFormat: value['displayDateFormat'],
        displayTimeFormat: value['displayTimeFormat'],
        displayTimeZone: value['displayTimeZone'],
        locale: value['locale'],
        nightWorkEndHour: value['nightWorkEndHour'],
        nightWorkStartHour: value['nightWorkStartHour'],
        nightWorkTimeZone: value['nightWorkTimeZone'],
        pinnedTableColumnIds,
        recentFiles: value['recentFiles'],
        recentFilesEnabled,
        recentFilePathsEnabled: value['recentFilePathsEnabled'],
        theme: value['theme'],
        tablePageSizes,
        verificationAutoRun: value['verificationAutoRun'],
        version: 1,
    });
}

function isBoundedVersion(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= 128;
}

export function decodeRuntimeVersionsResult(value: unknown): Result<RuntimeVersionsResult, DesktopApiDecodeError> {
    if (isFailureResult(value)) {
        return ok(value);
    }

    if (!isUnknownRecord(value) || !hasExactKeys(value, ['status', 'versions']) || value['status'] !== 'loaded') {
        return err('invalidRuntimeVersionsResult');
    }

    const versions = value['versions'];
    if (
        !isUnknownRecord(versions) ||
        !hasExactKeys(versions, ['application', 'architecture', 'parserCommit', 'parserVersion', 'platform', 'runtime']) ||
        !isBoundedVersion(versions['application']) ||
        !isBoundedVersion(versions['architecture']) ||
        typeof versions['parserCommit'] !== 'string' ||
        !(/^[0-9a-f]{40}$/u.test(versions['parserCommit']) || versions['parserCommit'] === 'unknown') ||
        !isBoundedVersion(versions['parserVersion']) ||
        !isBoundedVersion(versions['platform']) ||
        !isBoundedVersion(versions['runtime'])
    ) {
        return err('invalidRuntimeVersionsResult');
    }

    return ok({
        status: 'loaded',
        versions: {
            application: versions['application'],
            architecture: versions['architecture'],
            parserCommit: versions['parserCommit'],
            parserVersion: versions['parserVersion'],
            platform: versions['platform'],
            runtime: versions['runtime'],
        },
    });
}
