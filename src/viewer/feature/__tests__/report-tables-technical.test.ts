import { describe, expect, it } from 'vitest';

import {
    createSourceReference,
    createSpecificConditionTechnicalRecord,
    isJsonPointer,
    isUtcTimestamp,
    type ISourceReference,
} from '#viewer-domain';
import type { ITechnicalRecordViewModel } from '#viewer-presentation';

import { technicalReportRecords } from '../helpers/report-tables.js';
import { createViewerDocumentHarness } from './viewer-document-harness.js';
import { openDocumentFixture } from './report-view-model-fixture.js';

function source(path: string): ISourceReference<'g2v2', 'driverCard'> {
    if (!isJsonPointer(path)) {
        throw new TypeError('The technical report fixture source must be valid.');
    }
    return createSourceReference('driverCard', 'g2v2', path);
}

function conditionRecord(fields: ITechnicalRecordViewModel['fields']): ITechnicalRecordViewModel {
    const enteredAt = Date.UTC(2026, 5, 18, 10);
    if (!isUtcTimestamp(enteredAt)) {
        throw new TypeError('The technical report fixture timestamp must be valid.');
    }
    const path = '/specificConditions/specificConditionRecords/0';
    return {
        category: 'operational',
        fields,
        generation: 'g2v2',
        kind: 'specificCondition',
        record: createSpecificConditionTechnicalRecord({ conditionType: 'outOfScopeBegin', enteredAt, source: source(path) }),
        recordedAt: '18 Jun 2026, 10:00',
        source: source(path),
    };
}

describe('technicalReportRecords', () => {
    it('translates labels and enumerated values once for every report format', async () => {
        const { context } = await openDocumentFixture(createViewerDocumentHarness());
        const t = context.translationService;

        const [record] = technicalReportRecords(
            [
                conditionRecord([
                    { key: 'specificConditionType', value: { kind: 'specificConditionType', value: 'outOfScopeBegin' } },
                    {
                        key: 'vehicleRegistrationNumber',
                        value: { code: true, copyValue: 'TEST-123', display: 'TEST-123', kind: 'display' },
                    },
                    {
                        key: 'vehicleRegistrationNumber',
                        value: { code: true, copyValue: null, display: null, kind: 'display' },
                    },
                ]),
            ],
            t,
        );

        expect(record?.kindLabel).toBe(t.translate('technical.recordKind.specificCondition'));
        expect(record?.recordedAt).toBe('18 Jun 2026, 10:00');
        expect(record?.sourcePath).toBe('/specificConditions/specificConditionRecords/0');
        expect(record?.fields.map((field) => field.isCode)).toEqual([false, true, false]);
        expect(record?.fields[1]?.value).toBe('TEST-123');
        // A missing identifier prints as plain "missing" text, not as a code value.
        expect(record?.fields[2]?.value).toBe(t.translate('overview.identity.missing'));
        expect(record?.fields[0]?.value).not.toBe('outOfScopeBegin');
    });
});
