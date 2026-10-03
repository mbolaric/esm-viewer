import type { IRecentFileEntry, ReopenToken } from '#contracts';
import { isUtcTimestamp, type UtcTimestamp } from '#viewer-domain';

import { formatDateTime, type IFormattedValue, type ViewerLocalisationService } from '../helpers/view-model-formatting.js';

export interface IRecentFileViewModel {
    readonly displayName: string;
    readonly openedAt: IFormattedValue<UtcTimestamp> | null;
    readonly reopenToken: ReopenToken;
}

export function createRecentFilesViewModel(
    recentFiles: readonly IRecentFileEntry[],
    localisation: ViewerLocalisationService,
): readonly IRecentFileViewModel[] {
    return recentFiles.map((entry) => ({
        displayName: entry.displayName,
        openedAt: isUtcTimestamp(entry.openedAtEpochMs) ? formatDateTime(entry.openedAtEpochMs, localisation) : null,
        reopenToken: entry.reopenToken,
    }));
}
