import { ERROR_CODES } from '#contracts';
import { logBoundaryError } from '#error-reporting';

import type { IViewerContext } from './viewer-context.js';

export function reportViewerRenderFailure(context: IViewerContext, error: unknown, scope: string): void {
    logBoundaryError(scope, error);
    void context.errorService.report({ code: ERROR_CODES.chartRenderFailed, severity: 'error', source: 'viewer' }, error);
}

export function disposeViewerContext(context: IViewerContext): void {
    context.preferencesController.dispose();
    void context.documentController.dispose();
}
