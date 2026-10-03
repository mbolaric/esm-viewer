import { describe, expect, it } from 'vitest';
import type { ITranslationService } from '#localization';
import { createOpenedDocumentComparisonRecord, type IOpenedDocumentComparisonSnapshot } from '#viewer-application';
import {
    createCardUse,
    createSourceReference,
    createTachographEvent,
    isJsonPointer,
    isOdometerKilometres,
    isUtcTimestamp,
} from '#viewer-domain';
import {
    createLocalisationServiceFake,
    fixtureIssuingMemberState,
    fixtureVehicleIdentificationNumber,
    fixtureVehicleIdentity,
    fixtureVehicleRegistrationNumber,
} from '#testing';
import { createDocumentComparisonViewModel } from '../view-models/document-comparison-view-model.js';
import { createComparisonReportPdfRequest, type ComparisonPdfTranslationKey } from '../view-models/comparison-pdf-request.js';
import { createVehicleUnitDocumentFixture } from './vehicle-unit-document-fixture.js';

const comparisonVehicleIdentity = fixtureVehicleIdentity({
    registrationMemberState: fixtureIssuingMemberState('HR'),
    registrationNumber: fixtureVehicleRegistrationNumber('HR1234AB'),
    vehicleIdentificationNumber: fixtureVehicleIdentificationNumber('WVWZZZ1JZXW000000'),
});

const fakeTranslationService: ITranslationService<ComparisonPdfTranslationKey> = {
    translate: (key: string, params?: unknown): string => {
        if (params !== undefined) {
            return key;
        }
        return key;
    },
};

describe('createComparisonReportPdfRequest', () => {
    it('constructs a valid factual report request from comparison view model', () => {
        const openedAt = Date.UTC(2026, 6, 27);
        if (!isUtcTimestamp(openedAt)) {
            throw new TypeError('Invalid timestamp');
        }
        const doc = createVehicleUnitDocumentFixture({
            identity: comparisonVehicleIdentity,
            openedAt,
        });
        const record = createOpenedDocumentComparisonRecord(doc);
        const snapshot: IOpenedDocumentComparisonSnapshot = { records: [record] };
        const loc = createLocalisationServiceFake();
        const viewModel = createDocumentComparisonViewModel(snapshot, loc);

        const pdfReq = createComparisonReportPdfRequest(viewModel, fakeTranslationService, loc, openedAt);

        expect(pdfReq.kind).toBe('factualReport');
        expect(pdfReq.orientation).toBe('landscape');
        expect(pdfReq.title).toBe('comparison.pdf.title');
        expect(pdfReq.subtitle).toBe('comparison.pdf.subtitle');
        expect(pdfReq.headerFields[0]?.value).toBe('1');
        expect(pdfReq.headerFields[1]?.value).toBe('0');
        expect(pdfReq.summaryItems).toHaveLength(2);
        expect(pdfReq.summaryItems[0]?.value).toBe('1');
        expect(pdfReq.summaryItems[1]?.value).toBe('0');
        expect(pdfReq.sections).toHaveLength(4);
        expect(pdfReq.sections[0]?.rows).toHaveLength(1);
        expect(pdfReq.sections[0]?.rows[0]?.cells[0]).toBe(doc.source.displayName);
        expect(pdfReq.sections[1]?.rows).toHaveLength(1);
        expect(pdfReq.sections[2]?.title).toBe('comparison.pdf.tableActivityTitle');
        expect(pdfReq.sections[2]?.rows[0]?.cells).toEqual([
            doc.source.displayName,
            'overview.identity.missing',
            'overview.identity.missing',
            'overview.identity.missing',
            'overview.identity.missing',
            'overview.identity.missing',
            'overview.identity.missing',
        ]);
        expect(pdfReq.sections[3]?.title).toBe('comparison.pdf.tableSecurityTitle');
        expect(pdfReq.sections[3]?.rows[0]?.cells).toEqual([doc.source.displayName, '0', '0', '0', '0']);
    });

    it('carries real odometer and security evidence into the new PDF sections', () => {
        const openedAt = Date.UTC(2026, 6, 27);
        const path = '/cardUses/0';
        if (!isUtcTimestamp(openedAt) || !isJsonPointer(path)) {
            throw new TypeError('Invalid fixture input.');
        }
        const odometerAtInsertion = 5_000;
        const odometerAtWithdrawal = 5_050;
        if (!isOdometerKilometres(odometerAtInsertion) || !isOdometerKilometres(odometerAtWithdrawal)) {
            throw new TypeError('Invalid odometer fixture input.');
        }
        const cardUse = createCardUse({
            cardExpiryDate: null,
            cardNumber: null,
            cardType: 'driverCard',
            firstNames: null,
            insertion: openedAt,
            issuingMemberState: null,
            odometerAtInsertion,
            odometerAtWithdrawal,
            slot: 'Driver',
            source: createSourceReference('vehicleUnit', 'g2', path),
            surname: null,
            withdrawal: openedAt,
        });
        const event = createTachographEvent({
            code: 'powerSupplyInterruption',
            end: null,
            recordKind: 'event',
            recordPurpose: null,
            registrationMemberState: null,
            registrationNumber: null,
            similarOccurrences: null,
            source: createSourceReference('vehicleUnit', 'g2', path),
            start: openedAt,
        });
        if (cardUse === null || event === null) {
            throw new TypeError('Invalid VU evidence fixture.');
        }
        const doc = createVehicleUnitDocumentFixture({
            cardUses: [cardUse],
            events: [event],
            identity: comparisonVehicleIdentity,
            openedAt,
        });
        const record = createOpenedDocumentComparisonRecord(doc);
        const snapshot: IOpenedDocumentComparisonSnapshot = { records: [record] };
        const loc = createLocalisationServiceFake();
        const viewModel = createDocumentComparisonViewModel(snapshot, loc);

        const pdfReq = createComparisonReportPdfRequest(viewModel, fakeTranslationService, loc, openedAt);

        const activityCells = pdfReq.sections[2]?.rows[0]?.cells;
        expect(activityCells?.[5]).toBe(loc.formatNumber(odometerAtInsertion));
        expect(activityCells?.[6]).toBe(loc.formatNumber(odometerAtWithdrawal));
        expect(pdfReq.sections[3]?.rows[0]?.cells).toEqual([doc.source.displayName, '1', '0', '0', '0']);
    });
});
