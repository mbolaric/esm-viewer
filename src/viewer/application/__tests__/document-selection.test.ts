import { classifyParseError, decodeFileMetadata } from '#contracts';
import {
    classifyIntegrityItems,
    createCardDownloadTechnicalRecord,
    createDailyWorkPeriodPlace,
    createRecordedActivityInterval,
    createSourceReference,
    createTachographEvent,
    createTachographFault,
    createVehicleUnitUse,
    createVehicleUse,
    isJsonPointer,
    isOdometerKilometres,
    isUtcTimestamp,
    isVehicleRegistrationNumber,
    normalizeActivityDay,
    type DriverCardTechnicalRecord,
    type IActivityCrewContext,
    type IActivityDay,
    type IDailyWorkPeriodPlace,
    type ISourceReference,
    type ITachographEvent,
    type ITachographFault,
    type IVehicleUnitUse,
    type IVehicleUse,
    type UtcTimestamp,
} from '#viewer-domain';
import { describe, expect, it } from 'vitest';

import {
    createDocumentSource,
    createDocumentOverviewProjection,
    createOpenedTachographDocument,
    DocumentSelectionController,
    projectDocumentEventFaultRecords,
    projectDocumentAssociations,
    projectDocumentTechnicalRecords,
    type IDriverCardApplication,
    type IParsedDriverCardDocument,
    type OpenedTachographDocument,
    projectDocumentLocationRecords,
} from '../index.js';

const singleDriverCrew: IActivityCrewContext = { crewPresence: 'single', slot: 'Driver' };

function timestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The selection timestamp fixture must be valid.');
    }
    return value;
}

function source(path: string): ISourceReference<'g1', 'driverCard'> {
    if (!isJsonPointer(path)) {
        throw new TypeError('The selection source fixture must be valid.');
    }
    return createSourceReference('driverCard', 'g1', path);
}

function event(start: number, path: string): ITachographEvent {
    const record = createTachographEvent({
        code: 'cardConflict',
        end: null,
        recordKind: 'event',
        recordPurpose: null,
        registrationMemberState: null,
        registrationNumber: null,
        similarOccurrences: null,
        source: source(path),
        start: timestamp(start),
    });
    if (record === null) {
        throw new TypeError('The selection event fixture must be valid.');
    }
    return record;
}

function fault(start: number, path: string): ITachographFault {
    const record = createTachographFault({
        code: 'powerSupplyInterruption',
        end: null,
        recordKind: 'fault',
        recordPurpose: null,
        registrationMemberState: null,
        registrationNumber: null,
        similarOccurrences: null,
        source: source(path),
        start: timestamp(start),
    });
    if (record === null) {
        throw new TypeError('The selection fault fixture must be valid.');
    }
    return record;
}

function openedDocument(
    events: readonly ITachographEvent[],
    faults: readonly ITachographFault[],
    activityDays: readonly IActivityDay[] = [],
    vehicleUses: readonly IVehicleUse[] = [],
    locations: readonly IDailyWorkPeriodPlace[] = [],
    technicalRecords: readonly DriverCardTechnicalRecord[] = [],
    vehicleUnitUses: readonly IVehicleUnitUse[] = [],
): OpenedTachographDocument {
    const metadata = decodeFileMetadata({
        byteLength: 3,
        displayName: 'selection.ddd',
        sha256: 'a'.repeat(64),
    });
    const openedAt = timestamp(Date.UTC(2026, 6, 27));
    if (!metadata.ok) {
        throw new TypeError('The selection metadata fixture must be valid.');
    }

    const application: IDriverCardApplication = {
        activityDays: [...activityDays],
        cardNotes: null,
        events: [...events],
        faults: [...faults],
        generation: 'g1',
        identity: null,
        locations: [...locations],
        source: source('/cardDataResponses'),
        technicalRecords: [...technicalRecords],
        verification: {
            dataFiles: {},
            dataFileSourcePaths: {},
            generation: 'g1',
        },
        vehicleUses: [...vehicleUses],
        vehicleUnitUses: [...vehicleUnitUses],
        warnings: [],
    };
    const content: IParsedDriverCardDocument = {
        applications: [application],
        cardType: 'driverCard',
        documentKind: 'driverCard',
        generation: 'g1',
        parserVariant: 'cardGen1',
        rawTree: {},
        sections: [],
    };

    return createOpenedTachographDocument(createDocumentSource(metadata.value, openedAt), content);
}

describe('DocumentSelectionController', () => {
    it('exposes capability-driven workspace sections in navigator order', () => {
        const controller = new DocumentSelectionController(openedDocument([], []));

        expect(controller.snapshot).toMatchObject({
            availableSections: [
                'overview',
                'activities',
                'compliance',
                'associations',
                'places',
                'eventsAndFaults',
                'technical',
                'comparison',
                'integrity',
                'rawData',
            ],
            projection: {
                records: [],
                section: 'overview',
            },
            selectedRecord: null,
        });
    });

    it('exposes normalized activity intervals as selectable section records', () => {
        const midnightUtc = timestamp(Date.UTC(2026, 6, 27));
        const interval = createRecordedActivityInterval(
            'driving',
            timestamp(midnightUtc + 1_000),
            timestamp(midnightUtc + 2_000),
            source('/activities/0'),
            singleDriverCrew,
        );
        if (interval === null) {
            throw new TypeError('The selection activity fixture must be valid.');
        }
        const normalizedDay = normalizeActivityDay([interval], midnightUtc);
        if (normalizedDay.status !== 'normalized') {
            throw new TypeError('The selection activity day fixture must be valid.');
        }
        const controller = new DocumentSelectionController(openedDocument([], [], [normalizedDay.day]));

        controller.selectSection('activities');

        expect(controller.snapshot.projection.records).toEqual(normalizedDay.day.intervals);
        expect(controller.selectRecord(interval)).toMatchObject({ ok: true });
        expect(controller.snapshot.selectedRecord).toBe(interval);
    });

    it('projects chronological records and clears section-owned selection on navigation', () => {
        const laterEvent = event(300, '/events/1');
        const earlierFault = fault(100, '/faults/0');
        const controller = new DocumentSelectionController(openedDocument([laterEvent], [earlierFault]));

        expect(controller.selectSection('eventsAndFaults')).toMatchObject({ ok: true });
        expect(controller.snapshot.projection.records).toEqual([earlierFault, laterEvent]);
        expect(controller.selectRecord(laterEvent)).toMatchObject({ ok: true });
        expect(controller.snapshot.selectedRecord).toBe(laterEvent);
        expect(controller.clearRecord().selectedRecord).toBeNull();
        expect(controller.selectRecord(laterEvent)).toMatchObject({ ok: true });

        expect(controller.selectSection('activities')).toMatchObject({ ok: true });
        expect(controller.snapshot).toMatchObject({
            projection: {
                records: [],
                section: 'activities',
            },
            selectedRecord: null,
        });
    });

    describe('document factual projections', () => {
        it('counts recorded and inferred activity separately and excludes inferred gaps from coverage', () => {
            const midnightUtc = timestamp(Date.UTC(2026, 6, 27));
            const interval = createRecordedActivityInterval(
                'driving',
                timestamp(midnightUtc + 1_000),
                timestamp(midnightUtc + 2_000),
                source('/activities/recorded'),
                singleDriverCrew,
            );
            if (interval === null) {
                throw new TypeError('The overview activity fixture must be valid.');
            }
            const normalizedDay = normalizeActivityDay([interval], midnightUtc);
            if (normalizedDay.status !== 'normalized') {
                throw new TypeError('The overview activity day fixture must be valid.');
            }
            const document = openedDocument(
                [event(midnightUtc + 500, '/events/0')],
                [fault(midnightUtc + 3_000, '/faults/0')],
                [normalizedDay.day],
            );

            expect(createDocumentOverviewProjection(document)).toMatchObject({
                applicationGenerations: ['g1'],
                counts: {
                    activityDays: 1,
                    events: 1,
                    faults: 1,
                    inferredActivityGaps: 2,
                    recordedActivityIntervals: 1,
                    warnings: 0,
                },
                coverage: {
                    end: midnightUtc + 3_000,
                    start: midnightUtc + 500,
                },
            });
        });

        it('filters the combined chronological event and fault projection by record type', () => {
            const laterEvent = event(300, '/events/1');
            const earlierFault = fault(100, '/faults/0');
            const document = openedDocument([laterEvent], [earlierFault]);

            expect(projectDocumentEventFaultRecords(document)).toEqual([earlierFault, laterEvent]);
            expect(projectDocumentEventFaultRecords(document, 'event')).toEqual([laterEvent]);
            expect(projectDocumentEventFaultRecords(document, 'fault')).toEqual([earlierFault]);
        });

        it('groups vehicle-use records by vehicle identity and preserves chronology', () => {
            const registrationNumber = 'TEST-123';
            const odometerBegin = 10_000;
            const odometerEnd = 10_100;
            if (
                !isVehicleRegistrationNumber(registrationNumber) ||
                !isOdometerKilometres(odometerBegin) ||
                !isOdometerKilometres(odometerEnd)
            ) {
                throw new TypeError('The association projection fixture must be valid.');
            }
            const later = createVehicleUse({
                firstUse: timestamp(300),
                lastUse: timestamp(400),
                odometerBegin,
                odometerEnd,
                registrationMemberState: null,
                registrationNumber,
                source: source('/vehicles/1'),
                vehicleIdentificationNumber: null,
            });
            const earlier = createVehicleUse({
                firstUse: timestamp(100),
                lastUse: timestamp(200),
                odometerBegin,
                odometerEnd,
                registrationMemberState: null,
                registrationNumber,
                source: source('/vehicles/0'),
                vehicleIdentificationNumber: null,
            });
            if (later === null || earlier === null) {
                throw new TypeError('The association projection records must be valid.');
            }
            const document = openedDocument([], [], [], [later, earlier]);

            expect(projectDocumentAssociations(document)).toEqual([earlier, later]);
            const controller = new DocumentSelectionController(document);
            expect(controller.selectSection('associations')).toMatchObject({ ok: true });
            expect(controller.snapshot.projection.records).toEqual([earlier, later]);
        });

        it('orders vehicle-unit-use evidence by used time inside the association projection', () => {
            const laterUnitUse = createVehicleUnitUse({
                deviceID: 123_456,
                manufacturerCode: 2,
                source: source('/vehicleUnits/1'),
                usedAt: timestamp(300),
                vuSoftwareVersion: '0001',
            });
            const earlierUnitUse = createVehicleUnitUse({
                deviceID: 123_456,
                manufacturerCode: 2,
                source: source('/vehicleUnits/0'),
                usedAt: timestamp(100),
                vuSoftwareVersion: '0001',
            });
            const document = openedDocument([], [], [], [], [], [], [laterUnitUse, earlierUnitUse]);

            expect(projectDocumentAssociations(document)).toEqual([earlierUnitUse, laterUnitUse]);
            expect(createDocumentOverviewProjection(document).coverage).toEqual({
                end: 300,
                start: 100,
            });
        });

        it('breaks ties between place records recorded at the same instant by their source path', () => {
            const place = (path: string): ReturnType<typeof createDailyWorkPeriodPlace> =>
                createDailyWorkPeriodPlace({
                    card: null,
                    country: null,
                    entryAt: timestamp(100),
                    entryType: 'beginCardInsertion',
                    odometer: null,
                    position: null,
                    region: null,
                    source: source(path),
                });
            const second = place('/places/2');
            const first = place('/places/1');

            expect(projectDocumentLocationRecords(openedDocument([], [], [], [], [second, first]))).toEqual([first, second]);
        });

        it('orders normalized place evidence chronologically and exposes it to selection', () => {
            const later = createDailyWorkPeriodPlace({
                card: null,
                country: null,
                entryAt: timestamp(300),
                entryType: 'endCardWithdrawal',
                odometer: null,
                position: null,
                region: null,
                source: source('/places/1'),
            });
            const earlier = createDailyWorkPeriodPlace({
                card: null,
                country: null,
                entryAt: timestamp(100),
                entryType: 'beginCardInsertion',
                odometer: null,
                position: null,
                region: null,
                source: source('/places/0'),
            });
            const document = openedDocument([], [], [], [], [later, earlier]);

            expect(projectDocumentLocationRecords(document)).toEqual([earlier, later]);
            expect(projectDocumentLocationRecords(document, 'place')).toEqual([earlier, later]);
            expect(projectDocumentLocationRecords(document, 'position')).toEqual([]);

            const controller = new DocumentSelectionController(document);
            expect(controller.selectSection('places')).toMatchObject({ ok: true });
            expect(controller.snapshot.projection.records).toEqual([earlier, later]);
            expect(controller.selectRecord(earlier)).toMatchObject({ ok: true });
        });

        it('exposes normalized technical evidence through the shared selection contract', () => {
            const record = createCardDownloadTechnicalRecord({
                downloadedAt: timestamp(200),
                source: source('/cardDownload'),
            });
            const document = openedDocument([], [], [], [], [], [record]);

            expect(projectDocumentTechnicalRecords(document)).toEqual([record]);

            const controller = new DocumentSelectionController(document);
            expect(controller.selectSection('technical')).toMatchObject({ ok: true });
            expect(controller.snapshot.projection.records).toEqual([record]);
            expect(controller.selectRecord(record)).toMatchObject({ ok: true });
        });

        it('counts valid and invalid verification evidence separately', () => {
            const document = openedDocument([], []);
            const integrity = classifyIntegrityItems([
                {
                    generation: 'g1',
                    recordId: 'ValidRecord',
                    source: source('/verification/valid'),
                    status: 'valid',
                },
                {
                    generation: 'g1',
                    recordId: 'InvalidRecord',
                    source: source('/verification/invalid'),
                    status: 'invalid',
                },
            ]);
            if (integrity === null) {
                throw new TypeError('The overview integrity fixture must be valid.');
            }
            const verifiedDocument: OpenedTachographDocument = {
                ...document,
                integrity,
            };

            expect(createDocumentOverviewProjection(verifiedDocument).integrityCounts).toEqual({
                checkedItems: 2,
                invalidItems: 1,
                validItems: 1,
            });
        });
    });

    it('rejects unsupported sections and records outside the current projection', () => {
        const currentEvent = event(100, '/events/current');
        const foreignEvent = event(200, '/events/foreign');
        const controller = new DocumentSelectionController(openedDocument([currentEvent], []));
        expect(controller.selectSection('speed')).toEqual({
            error: classifyParseError('invalidDocumentState'),
            ok: false,
        });

        controller.selectSection('eventsAndFaults');
        expect(controller.selectRecord(foreignEvent)).toEqual({
            error: classifyParseError('invalidDocumentState'),
            ok: false,
        });
        expect(controller.snapshot.selectedRecord).toBeNull();
    });
});
