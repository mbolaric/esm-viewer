import type { IJsonRecord } from '#contracts';

export function serializeRawJson(raw: IJsonRecord): string {
    return JSON.stringify(raw, null, 2);
}

export type ExportFileExtension = '.html' | '.json' | '.pdf';

export function exportFileName(displayName: string, extension: ExportFileExtension): string {
    const maximumBaseLength = 256 - extension.length;
    const base = displayName.length > maximumBaseLength ? displayName.slice(0, maximumBaseLength) : displayName;
    return `${base}${extension}`;
}
