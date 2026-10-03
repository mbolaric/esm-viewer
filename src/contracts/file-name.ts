// Makes text safe as part of a saved file name on every desktop platform. Letters in any script are kept, so translated
// names and driver names like "Müller" or "Šimić" stay readable; separators and reserved characters become "_".
export function fileNameSegment(text: string): string {
    return text.replace(/[^\p{L}\p{N}_-]/gu, '_');
}
