import { err, ok, type Result } from './result.js';
import { hasExactKeys, isUnknownRecord } from './unknown-value.js';

export const ERROR_CODES = {
    chartRenderFailed: 'viewer.chart-render-failed',
    dragDropListenerFailed: 'desktop.drag-drop-listener-failed',
    exportSaveFailed: 'desktop.export-save-failed',
    invalidErrorReport: 'desktop.invalid-error-report',
    menuBuildFailed: 'desktop.menu-build-failed',
    nativeThemeSyncFailed: 'desktop.native-theme-sync-failed',
    nativeWindowCommandFailed: 'desktop.native-window-command-failed',
    pdfGenerationFailed: 'desktop.pdf-generation-failed',
    signatureVerificationFailed: 'viewer.signature-verification-failed',
    translationMissingKey: 'translation.missing-key',
    workspaceRenderFailed: 'viewer.workspace-render-failed',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
export type ErrorSeverity = 'error' | 'warning';
export type ErrorSource = 'desktop' | 'translation' | 'viewer';

export interface ITranslationMissingKeyContext {
    readonly key: string;
}

type SimpleErrorCode = Exclude<ErrorCode, typeof ERROR_CODES.translationMissingKey>;

// The one valid event per code that carries no context: its severity and source are fixed by the code.
const SIMPLE_EVENTS = {
    [ERROR_CODES.chartRenderFailed]: { code: ERROR_CODES.chartRenderFailed, severity: 'error', source: 'viewer' },
    [ERROR_CODES.dragDropListenerFailed]: { code: ERROR_CODES.dragDropListenerFailed, severity: 'error', source: 'desktop' },
    [ERROR_CODES.exportSaveFailed]: { code: ERROR_CODES.exportSaveFailed, severity: 'error', source: 'desktop' },
    [ERROR_CODES.invalidErrorReport]: { code: ERROR_CODES.invalidErrorReport, severity: 'warning', source: 'desktop' },
    [ERROR_CODES.menuBuildFailed]: { code: ERROR_CODES.menuBuildFailed, severity: 'error', source: 'desktop' },
    [ERROR_CODES.nativeThemeSyncFailed]: { code: ERROR_CODES.nativeThemeSyncFailed, severity: 'warning', source: 'desktop' },
    [ERROR_CODES.nativeWindowCommandFailed]: {
        code: ERROR_CODES.nativeWindowCommandFailed,
        severity: 'error',
        source: 'desktop',
    },
    [ERROR_CODES.pdfGenerationFailed]: { code: ERROR_CODES.pdfGenerationFailed, severity: 'error', source: 'desktop' },
    [ERROR_CODES.signatureVerificationFailed]: {
        code: ERROR_CODES.signatureVerificationFailed,
        severity: 'error',
        source: 'viewer',
    },
    [ERROR_CODES.workspaceRenderFailed]: { code: ERROR_CODES.workspaceRenderFailed, severity: 'error', source: 'viewer' },
} as const satisfies {
    readonly [TCode in SimpleErrorCode]: { readonly code: TCode; readonly severity: ErrorSeverity; readonly source: ErrorSource };
};

export interface ITranslationMissingKeyErrorEvent {
    readonly code: typeof ERROR_CODES.translationMissingKey;
    readonly context: ITranslationMissingKeyContext;
    readonly severity: 'error';
    readonly source: 'translation';
}

export type IErrorEvent = (typeof SIMPLE_EVENTS)[SimpleErrorCode] | ITranslationMissingKeyErrorEvent;
export type ErrorEventDecodeError = 'invalidErrorEvent';

const maximumContextStringLength = 256;

function isSimpleErrorCode(code: string): code is SimpleErrorCode {
    return Object.hasOwn(SIMPLE_EVENTS, code);
}

function decodeTranslationMissingKeyContext(value: unknown): ITranslationMissingKeyContext | null {
    if (!isUnknownRecord(value) || !hasExactKeys(value, ['key'])) {
        return null;
    }

    const key = value['key'];

    if (typeof key !== 'string' || key.length === 0 || key.length > maximumContextStringLength) {
        return null;
    }

    return { key };
}

export function decodeErrorEvent(value: unknown): Result<IErrorEvent, ErrorEventDecodeError> {
    if (!isUnknownRecord(value)) {
        return err('invalidErrorEvent');
    }

    const code = value['code'];

    if (typeof code === 'string' && isSimpleErrorCode(code)) {
        const event = SIMPLE_EVENTS[code];
        const matches =
            hasExactKeys(value, ['code', 'severity', 'source']) &&
            value['severity'] === event.severity &&
            value['source'] === event.source;
        return matches ? ok(event) : err('invalidErrorEvent');
    }

    if (
        code === ERROR_CODES.translationMissingKey &&
        hasExactKeys(value, ['code', 'context', 'severity', 'source']) &&
        value['severity'] === 'error' &&
        value['source'] === 'translation'
    ) {
        const context = decodeTranslationMissingKeyContext(value['context']);
        return context === null ? err('invalidErrorEvent') : ok({ code, context, severity: 'error', source: 'translation' });
    }

    return err('invalidErrorEvent');
}
