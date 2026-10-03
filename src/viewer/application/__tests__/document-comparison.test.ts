import { decodeFileMetadata } from '#contracts';
import {
    createCardUse,
    createRecordedActivityInterval,
    createSourceReference,
    createTachographEvent,
    createVehicleUse,
    isJsonPointer,
    isOdometerKilometres,
    isUtcTimestamp,
    normalizeActivityDay,
    type IActivityCrewContext,
    type JsonPointer,
    type OdometerKilometres,
    type UtcTimestamp,
} from '#viewer-domain';
import { describe, expect, it } from 'vitest';

import {
    createDocumentSource,
    createOpenedTachographDocument,
    DocumentComparisonController,
    documentComparisonKey,
    type IDocumentSource,
    type IParsedDriverCardDocument,
    type IParsedVehicleUnitDocument,
    type OpenedTachographDocument,
} from '../index.js';

const singleDriverCrew: IActivityCrewContext = { crewPresence: 'single', slot: 'Driver' };

function documentSource(
    displayName: string,
    sha256: string,
    byteLength: number,
    openedAt: number = Date.UTC(2026, 6, 27),
): IDocumentSource {
    const metadata = decodeFileMetadata({
        byteLength,
        displayName,
        sha256,
    });
    if (!metadata.ok || !isUtcTimestamp(openedAt)) {
        throw new TypeError('The comparison fixture must be valid.');
    }

    return createDocumentSource(metadata.value, openedAt);
}

function driverCardDocument(displayName: string, sha256: string): OpenedTachographDocument {
    return createOpenedTachographDocument(documentSource(displayName, sha256, 512), driverCardContent());
}

function driverCardContent(): IParsedDriverCardDocument {
    const content: IParsedDriverCardDocument = {
        applications: [],
        cardType: 'driverCard',
        documentKind: 'driverCard',
        generation: 'g1',
        parserVariant: 'cardGen1',
        rawTree: {},
        sections: [],
    };

    return content;
}

function vehicleUnitDocument(displayName: string, sha256: string): OpenedTachographDocument {
    const emptyRecords = [] as const;
    const rootPath = '';
    if (!isJsonPointer(rootPath)) {
        throw new TypeError('The Vehicle Unit root fixture must be valid.');
    }
    const content: IParsedVehicleUnitDocument = {
        cardUses: emptyRecords,
        detailedSpeedSamples: emptyRecords,
        documentKind: 'vehicleUnit',
        companyLocks: emptyRecords,
        events: emptyRecords,
        faults: emptyRecords,
        generation: 'g2',
        identity: null,
        locations: emptyRecords,
        overspeedControl: null,
        overspeedRecords: emptyRecords,
        parserVariant: 'vuGen2',
        verification: null,
        rawTree: {},
        rootSource: createSourceReference('vehicleUnit', 'g2', rootPath),
        sections: [],
        technicalRecords: emptyRecords,
        warnings: emptyRecords,
    };

    return createOpenedTachographDocument(documentSource(displayName, sha256, 1024), content);
}

function timestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The comparison evidence timestamp fixture must be valid.');
    }
    return value;
}

function path(value: string): JsonPointer {
    if (!isJsonPointer(value)) {
        throw new TypeError('The comparison evidence source path fixture must be valid.');
    }
    return value;
}

function odometer(value: number): OdometerKilometres {
    if (!isOdometerKilometres(value)) {
        throw new TypeError('The comparison evidence odometer fixture must be valid.');
    }
    return value;
}

const evidenceDayMidnight = Date.UTC(2026, 6, 20);
const evidenceDrivingStart = evidenceDayMidnight + 8 * 60 * 60 * 1000;
const evidenceDrivingEnd = evidenceDayMidnight + 10 * 60 * 60 * 1000;

function driverCardDocumentWithEvidence(displayName: string, sha256: string): OpenedTachographDocument {
    const source = createSourceReference('driverCard', 'g1', path('/activityDayRecords/0'));
    const drivingInterval = createRecordedActivityInterval(
        'driving',
        timestamp(evidenceDrivingStart),
        timestamp(evidenceDrivingEnd),
        source,
        singleDriverCrew,
    );
    const normalized = drivingInterval === null ? null : normalizeActivityDay([drivingInterval], timestamp(evidenceDayMidnight));
    const vehicleUse = createVehicleUse({
        firstUse: timestamp(evidenceDrivingStart),
        lastUse: timestamp(evidenceDrivingEnd),
        odometerBegin: odometer(10_000),
        odometerEnd: odometer(10_120),
        registrationMemberState: null,
        registrationNumber: null,
        source: createSourceReference('driverCard', 'g1', path('/vehicles/0')),
        vehicleIdentificationNumber: null,
    });

    if (drivingInterval === null || normalized?.status !== 'normalized' || vehicleUse === null) {
        throw new TypeError('The comparison driver-card evidence fixture must be valid.');
    }

    const content: IParsedDriverCardDocument = {
        applications: [
            {
                activityDays: [normalized.day],
                cardNotes: null,
                events: [],
                faults: [],
                generation: 'g1',
                identity: null,
                locations: [],
                source: createSourceReference('driverCard', 'g1', path('/cardDataResponses')),
                technicalRecords: [],
                verification: {
                    dataFiles: {},
                    dataFileSourcePaths: {},
                    generation: 'g1',
                },
                vehicleUnitUses: [],
                vehicleUses: [vehicleUse],
                warnings: [],
            },
        ],
        cardType: 'driverCard',
        documentKind: 'driverCard',
        generation: 'g1',
        parserVariant: 'cardGen1',
        rawTree: {},
        sections: [],
    };

    return createOpenedTachographDocument(documentSource(displayName, sha256, 512), content);
}

function vehicleUnitDocumentWithEvidence(displayName: string, sha256: string): OpenedTachographDocument {
    const rootPath = '';
    if (!isJsonPointer(rootPath)) {
        throw new TypeError('The comparison VU evidence root fixture must be valid.');
    }
    const cardUse = createCardUse({
        cardExpiryDate: null,
        cardNumber: null,
        cardType: 'driverCard',
        firstNames: null,
        insertion: timestamp(evidenceDrivingStart),
        issuingMemberState: null,
        odometerAtInsertion: odometer(5_000),
        odometerAtWithdrawal: odometer(5_050),
        slot: 'Driver',
        source: createSourceReference('vehicleUnit', 'g2', path('/cardUses/0')),
        surname: null,
        withdrawal: timestamp(evidenceDrivingEnd),
    });
    const eventRecord = createTachographEvent({
        code: 'powerSupplyInterruption',
        end: null,
        recordKind: 'event',
        recordPurpose: null,
        registrationMemberState: null,
        registrationNumber: null,
        similarOccurrences: null,
        source: createSourceReference('vehicleUnit', 'g2', path('/events/0')),
        start: timestamp(evidenceDrivingStart),
    });

    if (cardUse === null || eventRecord === null) {
        throw new TypeError('The comparison VU evidence fixture must be valid.');
    }

    const emptyRecords = [] as const;
    const content: IParsedVehicleUnitDocument = {
        cardUses: [cardUse],
        detailedSpeedSamples: emptyRecords,
        documentKind: 'vehicleUnit',
        companyLocks: emptyRecords,
        events: [eventRecord],
        faults: emptyRecords,
        generation: 'g2',
        identity: null,
        locations: emptyRecords,
        overspeedControl: null,
        overspeedRecords: emptyRecords,
        parserVariant: 'vuGen2',
        verification: null,
        rawTree: {},
        rootSource: createSourceReference('vehicleUnit', 'g2', rootPath),
        sections: [],
        technicalRecords: emptyRecords,
        warnings: emptyRecords,
    };

    return createOpenedTachographDocument(documentSource(displayName, sha256, 1024), content);
}

describe('DocumentComparisonController', () => {
    it('records every opened document with overview facts', () => {
        const controller = new DocumentComparisonController();
        const card = driverCardDocument('card.ddd', 'a'.repeat(64));
        const vu = vehicleUnitDocument('vu.ddd', 'b'.repeat(64));

        expect(controller.add(card)).toBe(true);
        expect(controller.add(vu)).toBe(true);

        expect(controller.snapshot.records).toHaveLength(2);
        const first = controller.snapshot.records[0];
        expect(first).toMatchObject({
            displayName: 'vu.ddd',
            documentKind: 'vehicleUnit',
            byteLength: 1024,
            sha256: 'b'.repeat(64),
        });
        expect(first?.coverage).toBeNull();
        expect(first?.counts.activityDays).toBe(0);
        expect(first?.integrity.status).toBe('notChecked');
        expect(first?.activityTotals).toBeNull();
        expect(first?.odometerRange).toBeNull();
        expect(first?.associationSessions).toEqual([]);
        expect(first?.eventFaults).toEqual([]);
    });

    it('derives activity totals, odometer range, and association sessions for a driver card', () => {
        const controller = new DocumentComparisonController();
        controller.add(driverCardDocumentWithEvidence('card-evidence.ddd', 'c'.repeat(64)));

        const record = controller.snapshot.records[0];
        expect(record?.activityTotals?.driving).toBe(2 * 60 * 60 * 1000);
        expect(record?.odometerRange).toEqual({ max: 10_120, min: 10_000 });
        expect(record?.associationSessions).toEqual([{ end: evidenceDrivingEnd, start: evidenceDrivingStart }]);
    });

    it('derives odometer range, association sessions, and event/fault evidence for a VU document', () => {
        const controller = new DocumentComparisonController();
        controller.add(vehicleUnitDocumentWithEvidence('vu-evidence.ddd', 'd'.repeat(64)));

        const record = controller.snapshot.records[0];
        expect(record?.activityTotals).toBeNull();
        expect(record?.odometerRange).toEqual({ max: 5_050, min: 5_000 });
        expect(record?.associationSessions).toEqual([{ end: evidenceDrivingEnd, start: evidenceDrivingStart }]);
        expect(record?.eventFaults).toHaveLength(1);
        expect(record?.eventFaults[0]?.code).toBe('powerSupplyInterruption');
    });

    it('replaces the record for the same file opened again', () => {
        const controller = new DocumentComparisonController();
        const reopenedAt = Date.UTC(2026, 6, 28);
        const first = createOpenedTachographDocument(documentSource('card.ddd', 'a'.repeat(64), 512), driverCardContent());
        const second = createOpenedTachographDocument(
            documentSource('card.ddd', 'a'.repeat(64), 512, reopenedAt),
            driverCardContent(),
        );

        controller.add(first);
        controller.add(second);
        expect(controller.snapshot.records).toHaveLength(1);
        expect(controller.snapshot.records[0]?.openedAt).toBe(reopenedAt);
    });

    it('removes one record and clears the collection', () => {
        const controller = new DocumentComparisonController();
        const card = driverCardDocument('card.ddd', 'a'.repeat(64));
        const vu = vehicleUnitDocument('vu.ddd', 'b'.repeat(64));
        controller.add(card);
        controller.add(vu);

        expect(controller.remove('missing')).toBe(false);
        expect(controller.remove(documentComparisonKey(card))).toBe(true);
        expect(controller.snapshot.records.map((record) => record.displayName)).toEqual(['vu.ddd']);

        expect(controller.clear()).toBe(true);
        expect(controller.snapshot.records).toEqual([]);
        expect(controller.clear()).toBe(false);
    });

    it('keeps newest documents first', () => {
        const controller = new DocumentComparisonController();
        const card = driverCardDocument('card.ddd', 'a'.repeat(64));
        const vu = vehicleUnitDocument('vu.ddd', 'b'.repeat(64));
        controller.add(card);
        controller.add(vu);

        expect(controller.snapshot.records.map((record) => record.displayName)).toEqual(['vu.ddd', 'card.ddd']);
    });
});
