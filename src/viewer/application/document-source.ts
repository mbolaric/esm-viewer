import type { IFileMetadata, ReopenToken, SourceToken } from '#contracts';
import type { UtcTimestamp } from '#viewer-domain';

export interface IDocumentSource extends IFileMetadata {
    readonly openedAt: UtcTimestamp;
    readonly reopenToken: ReopenToken | null;
    readonly sourceToken: SourceToken | null;
}

export function createDocumentSource(
    metadata: IFileMetadata,
    openedAt: UtcTimestamp,
    sourceToken: SourceToken | null = null,
    reopenToken: ReopenToken | null = null,
): IDocumentSource {
    return {
        ...metadata,
        openedAt,
        reopenToken,
        sourceToken,
    };
}
