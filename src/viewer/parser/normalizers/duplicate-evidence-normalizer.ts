import { createTachographWarning, type ITachographWarning, type TachographEventFault } from '#viewer-domain';

function eventFaultEvidenceKey(record: TachographEventFault): string {
    return [record.source.generation, record.recordKind, record.code, String(record.start)].join(':');
}

export function appendSameGenerationDuplicateEventFaultWarnings(
    records: readonly TachographEventFault[],
    warnings: ITachographWarning[],
): void {
    const seenEvidence = new Set<string>();

    for (const record of records) {
        const key = eventFaultEvidenceKey(record);
        if (seenEvidence.has(key)) {
            warnings.push(createTachographWarning('duplicateEvidence', record.source));
        } else {
            seenEvidence.add(key);
        }
    }
}
