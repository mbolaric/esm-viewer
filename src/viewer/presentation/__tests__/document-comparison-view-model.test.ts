import { createOpenedDocumentComparisonRecord, type IOpenedDocumentComparisonSnapshot } from '#viewer-application';
import {
    createCardUse,
    isJsonPointer,
    isOdometerKilometres,
    isUtcTimestamp,
    createSourceReference,
    createTachographEvent,
    type ICardUse,
    type ITachographEvent,
    type OdometerKilometres,
    type UtcTimestamp,
} from '#viewer-domain';
import { describe, expect, it } from 'vitest';

import { createDocumentComparisonViewModel } from '../view-models/document-comparison-view-model.js';
import {
    createLocalisationServiceFake,
    fixtureIssuingMemberState,
    fixtureVehicleIdentificationNumber,
    fixtureVehicleIdentity,
    fixtureVehicleRegistrationNumber,
} from '#testing';
import { createVehicleUnitDocumentFixture } from './vehicle-unit-document-fixture.js';

const comparisonVehicleIdentity = fixtureVehicleIdentity({
    registrationMemberState: fixtureIssuingMemberState('HR'),
    registrationNumber: fixtureVehicleRegistrationNumber('HR1234AB'),
    vehicleIdentificationNumber: fixtureVehicleIdentificationNumber('WVWZZZ1JZXW000000'),
});

function vuTimestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The comparison view-model evidence timestamp fixture must be valid.');
    }
    return value;
}

function vuOdometer(value: number): OdometerKilometres {
    if (!isOdometerKilometres(value)) {
        throw new TypeError('The comparison view-model evidence odometer fixture must be valid.');
    }
    return value;
}

function vuCardUse(
    path: string,
    insertion: number,
    withdrawal: number,
    odometerAtInsertion: number,
    odometerAtWithdrawal: number,
): ICardUse {
    if (!isJsonPointer(path)) {
        throw new TypeError('The comparison view-model card-use source fixture must be valid.');
    }
    const cardUse = createCardUse({
        cardExpiryDate: null,
        cardNumber: null,
        cardType: 'driverCard',
        firstNames: null,
        insertion: vuTimestamp(insertion),
        issuingMemberState: null,
        odometerAtInsertion: vuOdometer(odometerAtInsertion),
        odometerAtWithdrawal: vuOdometer(odometerAtWithdrawal),
        slot: 'Driver',
        source: createSourceReference('vehicleUnit', 'g2', path),
        surname: null,
        withdrawal: vuTimestamp(withdrawal),
    });
    if (cardUse === null) {
        throw new TypeError('The comparison view-model card-use fixture must be valid.');
    }
    return cardUse;
}

function vuEvent(code: ITachographEvent['code'], path: string, start: number): ITachographEvent {
    if (!isJsonPointer(path)) {
        throw new TypeError('The comparison view-model event source fixture must be valid.');
    }
    const event = createTachographEvent({
        code,
        end: null,
        recordKind: 'event',
        recordPurpose: null,
        registrationMemberState: null,
        registrationNumber: null,
        similarOccurrences: null,
        source: createSourceReference('vehicleUnit', 'g2', path),
        start: vuTimestamp(start),
    });
    if (event === null) {
        throw new TypeError('The comparison view-model event fixture must be valid.');
    }
    return event;
}

describe('createDocumentComparisonViewModel', () => {
    it('formats comparison records with file, integrity, and identity facts', () => {
        const openedAt = Date.UTC(2026, 6, 27);
        if (!isUtcTimestamp(openedAt)) {
            throw new TypeError('The comparison view-model fixture must be valid.');
        }
        const document = createVehicleUnitDocumentFixture({
            identity: comparisonVehicleIdentity,
            openedAt,
        });
        const record = createOpenedDocumentComparisonRecord(document);
        const snapshot: IOpenedDocumentComparisonSnapshot = { records: [record] };

        const viewModel = createDocumentComparisonViewModel(snapshot, createLocalisationServiceFake());

        expect(viewModel.locale).toBe('en');
        expect(viewModel.records).toHaveLength(1);
        const row = viewModel.records[0];
        expect(row?.displayName).toBe(document.source.displayName);
        expect(row?.documentKind).toBe('vehicleUnit');
        expect(row?.generations).toEqual(['g2']);
        expect(row?.identitySummary).toBe('HR1234AB');
        expect(row?.integrity.status).toBe('notChecked');
        expect(row?.reopenable).toBe(false);
        expect(row?.totals.activityDays.value).toBeGreaterThanOrEqual(0);
        expect(row?.coverage).toBeNull();
        expect(viewModel.differingColumns).toEqual([]);
    });

    it('shows null coverage and identity summary for an empty record set', () => {
        const snapshot: IOpenedDocumentComparisonSnapshot = { records: [] };
        const viewModel = createDocumentComparisonViewModel(snapshot, createLocalisationServiceFake());

        expect(viewModel.records).toEqual([]);
        expect(viewModel.differingColumns).toEqual([]);
    });

    it('reports the columns whose stable values differ across records', () => {
        const firstOpenedAt = Date.UTC(2026, 6, 27);
        const secondOpenedAt = Date.UTC(2026, 6, 28);
        if (!isUtcTimestamp(firstOpenedAt) || !isUtcTimestamp(secondOpenedAt)) {
            throw new TypeError('The comparison diff fixture must be valid.');
        }
        const first = createVehicleUnitDocumentFixture({
            identity: comparisonVehicleIdentity,
            openedAt: firstOpenedAt,
        });
        const second = createVehicleUnitDocumentFixture({
            identity: null,
            openedAt: secondOpenedAt,
        });
        const snapshot: IOpenedDocumentComparisonSnapshot = {
            records: [createOpenedDocumentComparisonRecord(first), createOpenedDocumentComparisonRecord(second)],
        };

        const viewModel = createDocumentComparisonViewModel(snapshot, createLocalisationServiceFake());

        expect(viewModel.differingColumns).toEqual(['identity']);
    });

    it('formats odometer range and security counts for a VU document', () => {
        const document = createVehicleUnitDocumentFixture({
            cardUses: [vuCardUse('/cardUses/0', 1_000, 2_000, 5_000, 5_050)],
            events: [vuEvent('powerSupplyInterruption', '/events/0', 1_200), vuEvent('gnssNoPositionData', '/events/1', 1_300)],
            openedAt: vuTimestamp(Date.UTC(2026, 6, 27)),
        });
        const snapshot: IOpenedDocumentComparisonSnapshot = {
            records: [createOpenedDocumentComparisonRecord(document)],
        };

        const row = createDocumentComparisonViewModel(snapshot, createLocalisationServiceFake()).records[0];

        expect(row?.activityTotals).toBeNull();
        expect(row?.odometerRange).toEqual({
            max: { display: 'number:5050', value: 5_050 },
            min: { display: 'number:5000', value: 5_000 },
        });
        expect(row?.securityCounts).toEqual({
            operationalNotice: 1,
            securityCritical: 1,
            sensorDiagnostic: 0,
        });
        expect(row?.overlappingSessionCount).toBe(0);
    });

    it('flags overlapping association sessions and the differing columns they create', () => {
        const overlapping = createVehicleUnitDocumentFixture({
            cardUses: [vuCardUse('/cardUses/0', 1_000, 3_000, 5_000, 5_050)],
            openedAt: vuTimestamp(Date.UTC(2026, 6, 27)),
            sha256: 'c'.repeat(64),
        });
        const nonOverlapping = createVehicleUnitDocumentFixture({
            cardUses: [vuCardUse('/cardUses/0', 2_000, 4_000, 6_000, 6_050)],
            openedAt: vuTimestamp(Date.UTC(2026, 6, 28)),
            sha256: 'd'.repeat(64),
        });
        const snapshot: IOpenedDocumentComparisonSnapshot = {
            records: [createOpenedDocumentComparisonRecord(overlapping), createOpenedDocumentComparisonRecord(nonOverlapping)],
        };

        const viewModel = createDocumentComparisonViewModel(snapshot, createLocalisationServiceFake());

        expect(viewModel.records[0]?.overlappingSessionCount).toBe(1);
        expect(viewModel.records[1]?.overlappingSessionCount).toBe(1);
        expect(viewModel.differingColumns).toContain('odometerRange');
        expect(viewModel.differingColumns).not.toContain('overlappingSessions');
    });

    it('does not count sessions that only touch at one instant as overlapping', () => {
        const first = createVehicleUnitDocumentFixture({
            cardUses: [vuCardUse('/cardUses/0', 1_000, 3_000, 5_000, 5_050)],
            openedAt: vuTimestamp(Date.UTC(2026, 6, 27)),
            sha256: 'c'.repeat(64),
        });
        const startsWhenFirstEnds = createVehicleUnitDocumentFixture({
            cardUses: [vuCardUse('/cardUses/0', 3_000, 4_000, 5_050, 5_100)],
            openedAt: vuTimestamp(Date.UTC(2026, 6, 28)),
            sha256: 'd'.repeat(64),
        });
        const snapshot: IOpenedDocumentComparisonSnapshot = {
            records: [createOpenedDocumentComparisonRecord(first), createOpenedDocumentComparisonRecord(startsWhenFirstEnds)],
        };

        const viewModel = createDocumentComparisonViewModel(snapshot, createLocalisationServiceFake());

        expect(viewModel.records[0]?.overlappingSessionCount).toBe(0);
        expect(viewModel.records[1]?.overlappingSessionCount).toBe(0);
    });
});
