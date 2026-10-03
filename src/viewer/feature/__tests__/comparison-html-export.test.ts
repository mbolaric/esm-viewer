import { describe, expect, it } from 'vitest';
import type { ITranslationService } from '#localization';
import { createOpenedDocumentComparisonRecord, type IOpenedDocumentComparisonSnapshot } from '#viewer-application';
import {
    createComparisonReportSections,
    createDocumentComparisonViewModel,
    type ComparisonPdfTranslationKey,
} from '#viewer-presentation';
import { isUtcTimestamp, type UtcTimestamp } from '#viewer-domain';
import { createLocalisationServiceFake } from '#testing';

import { serializeComparisonHtmlReport } from '../helpers/report-html.js';
import { vehicleUnitDocumentFixture as vehicleUnitDocument } from './vehicle-unit-document-fixture.js';

const fakeTranslationService: ITranslationService<ComparisonPdfTranslationKey> = {
    translate: (key: string, params?: unknown): string => {
        if (params !== undefined) {
            return key;
        }
        return key;
    },
};

function timestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The comparison HTML export fixture timestamp must be valid.');
    }
    return value;
}

describe('serializeComparisonHtmlReport', () => {
    it('produces a standalone HTML document containing every comparison section', () => {
        const openedAt = timestamp(Date.UTC(2026, 6, 27));
        const document = vehicleUnitDocument('vu.ddd', 'a'.repeat(64), openedAt);
        const record = createOpenedDocumentComparisonRecord(document);
        const snapshot: IOpenedDocumentComparisonSnapshot = { records: [record] };
        const loc = createLocalisationServiceFake();
        const viewModel = createDocumentComparisonViewModel(snapshot, loc);

        const html = serializeComparisonHtmlReport(viewModel, fakeTranslationService, loc, openedAt);

        expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
        expect(html).toContain('<html lang="en">');
        expect(html).toContain('@page { size: A4 landscape; }');

        const expectedSections = createComparisonReportSections(viewModel, fakeTranslationService);
        for (const sectionDto of expectedSections) {
            expect(html).toContain(`<h2>${sectionDto.title}</h2>`);
            for (const header of sectionDto.headers) {
                expect(html).toContain(`<th scope="col">${header}</th>`);
            }
        }
    });

    it('HTML-escapes untrusted document display names to prevent injection', () => {
        const openedAt = timestamp(Date.UTC(2026, 6, 27));
        const document = vehicleUnitDocument('<img src=x onerror=alert(1)>.ddd', 'e'.repeat(64), openedAt);
        const record = createOpenedDocumentComparisonRecord(document);
        const snapshot: IOpenedDocumentComparisonSnapshot = { records: [record] };
        const loc = createLocalisationServiceFake();
        const viewModel = createDocumentComparisonViewModel(snapshot, loc);

        const html = serializeComparisonHtmlReport(viewModel, fakeTranslationService, loc, openedAt);

        expect(html).not.toContain('<img src=x onerror=alert(1)>');
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;.ddd');
    });
});
