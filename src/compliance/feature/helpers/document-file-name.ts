import { fileNameSegment } from '#contracts';

// Suggested export file name from a translated document stem and the driver's name; the fallback (also translated)
// stands in when no driver name was recorded.
export function suggestedDocumentFileName(
    stem: string,
    personName: string,
    fallbackName: string,
    extension: '.html' | '.pdf',
): string {
    const name = personName.trim().length > 0 ? personName : fallbackName;
    return `${fileNameSegment(stem)}_${fileNameSegment(name)}${extension}`;
}
