import {
    createDocumentSource,
    createOpenedTachographDocument,
    DocumentSelectionController,
    type IDriverCardApplication,
    type IParsedDriverCardDocument,
    type OpenedTachographDocument,
} from '#viewer-application';
import { decodeFileMetadata } from '#contracts';
import type { ILocalisationService } from '#localization';
import {
    createAccumulatedDrivingPosition,
    createBorderCrossing,
    createCardNotes,
    createDriverIdentity,
    createCardChipTechnicalData,
    createCardControlActivityTechnicalRecord,
    createCardDownloadTechnicalRecord,
    createDailyWorkPeriodPlace,
    createGnssPositionEvidence,
    createRecordedActivityInterval,
    createSourceReference,
    createTachographEvent,
    createTachographFault,
    createVehicleUnitCardSlotStatusTechnicalRecord,
    createVehicleUnitControlActivityTechnicalRecord,
    createVehicleUnitDownloadPeriodTechnicalRecord,
    createVehicleUnitEmbeddedCardTechnicalRecord,
    createVehicleUnitGnssCoupledTechnicalRecord,
    createVehicleUnitItsConsentTechnicalRecord,
    createVehicleUnitPowerSupplyInterruptionTechnicalRecord,
    createVehicleUnitSensorPairedTechnicalRecord,
    createVehicleUnitSpecificConditionTechnicalRecord,
    createVehicleUnitTimeAdjustmentTechnicalRecord,
    createVehicleUnitUse,
    createVehicleUse,
    isJsonPointer,
    isCardNumber,
    isCardNotesText,
    isGnssAccuracyIndicator,
    isGnssAuthenticationStatus,
    isIssuingMemberState,
    isLatitude,
    isLongitude,
    isUtcTimestamp,
    isOdometerKilometres,
    isTechnicalHexIdentifier,
    isVehicleRegistrationNumber,
    normalizeActivityDay,
    type DurationMilliseconds,
    type DriverCardTechnicalRecord,
    type IRecordedActivityInterval,
    type ICardNotes,
    type IDailyWorkPeriodPlace,
    type IGnssPositionEvidence,
    type ISourceReference,
    type ITachographEvent,
    type ITachographFault,
    type IVehicleUnitUse,
    type IVehicleUse,
    type GnssAccuracyIndicator,
    type GnssAuthenticationStatus,
    type Latitude,
    type Longitude,
    type OdometerKilometres,
    type RecordedIssuingMemberState,
    type UtcTimestamp,
} from '#viewer-domain';
import { describe, expect, it, vi } from 'vitest';

import { EU_561_2006_STANDARD } from '#compliance';

import { createLocalisationServiceFake, fixtureSingleDriverCrew } from '#testing';

import {
    buildJourneyShifts,
    buildJourneySummary,
    calculateDutyShifts,
    createActivitySectionViewModel,
    createAssociationSectionViewModel,
    createDocumentOverviewViewModel,
    createEventFaultSectionViewModel,
    createIntegrityDetailViewModel,
    createLocationSectionViewModel,
    createRawDataExplorerViewModel,
    createTechnicalSectionViewModel,
    journeyShiftBelongsToUtcDay,
    mapJourneyLegsToMapRoute,
    type IGnssPositionEvidenceViewModel,
    type IJourneyLegViewModel,
    type LocationRecordViewModel,
} from '../index.js';
import { createVehicleUnitDocumentFixture } from './vehicle-unit-document-fixture.js';
import { NO_COMPLIANCE_EVALUATION } from './activity-view-model-fixture.js';

interface IDocumentHarness {
    readonly cardNotes: ICardNotes | null;
    readonly document: OpenedTachographDocument;
    readonly event: ITachographEvent;
    readonly fault: ITachographFault;
    readonly interval: IRecordedActivityInterval;
    readonly location: IDailyWorkPeriodPlace;
    readonly midnightUtc: UtcTimestamp;
    readonly vehicleUnitUses: readonly IVehicleUnitUse[];
    readonly vehicleUse: IVehicleUse;
}

function utc(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The view-model timestamp fixture must be valid.');
    }
    return value;
}

function odo(value: number): OdometerKilometres {
    if (!isOdometerKilometres(value)) {
        throw new TypeError('The view-model odometer fixture must be valid.');
    }
    return value;
}

function cardSource(path: string): ISourceReference<'g1', 'driverCard'> {
    if (!isJsonPointer(path)) {
        throw new TypeError('The view-model source fixture must be valid.');
    }
    return createSourceReference('driverCard', 'g1', path);
}

function vehicleUnitSource(path: string): ISourceReference<'g2', 'vehicleUnit'> {
    if (!isJsonPointer(path)) {
        throw new TypeError('The Vehicle Unit view-model source fixture must be valid.');
    }
    return createSourceReference('vehicleUnit', 'g2', path);
}

function driverCardContent(application: IDriverCardApplication): IParsedDriverCardDocument {
    return {
        applications: [application],
        cardType: 'driverCard',
        documentKind: 'driverCard',
        generation: 'g1',
        parserVariant: 'cardGen1',
        rawTree: {
            identity: {
                cardNumber: application.identity?.cardNumber ?? null,
            },
        },
        sections: [],
    };
}

function createHarness(
    technicalRecords: readonly DriverCardTechnicalRecord[] = [],
    cardNotes: ICardNotes | null = null,
    vehicleUnitUses: readonly IVehicleUnitUse[] = [],
): IDocumentHarness {
    const midnightUtc = utc(Date.UTC(2026, 6, 27));
    const cardNumber = '1234567890123456';
    if (!isCardNumber(cardNumber)) {
        throw new TypeError('The view-model card-number fixture must be valid.');
    }
    const interval = createRecordedActivityInterval(
        'driving',
        utc(midnightUtc + 1_000),
        utc(midnightUtc + 2_000),
        cardSource('/activities/0'),
        fixtureSingleDriverCrew,
    );
    const event = createTachographEvent({
        code: 'cardConflict',
        end: utc(midnightUtc + 5_000),
        recordKind: 'event',
        recordPurpose: null,
        registrationMemberState: null,
        registrationNumber: null,
        similarOccurrences: null,
        source: cardSource('/events/0'),
        start: utc(midnightUtc + 4_000),
    });
    const fault = createTachographFault({
        code: 'powerSupplyInterruption',
        end: null,
        recordKind: 'fault',
        recordPurpose: null,
        registrationMemberState: null,
        registrationNumber: null,
        similarOccurrences: null,
        source: cardSource('/faults/0'),
        start: utc(midnightUtc + 3_000),
    });
    const registrationNumber = 'TEST-123';
    const odometerBegin = 12_340;
    const odometerEnd = 12_620;
    if (
        !isVehicleRegistrationNumber(registrationNumber) ||
        !isOdometerKilometres(odometerBegin) ||
        !isOdometerKilometres(odometerEnd)
    ) {
        throw new TypeError('The view-model vehicle-use primitives must be valid.');
    }
    const vehicleUse = createVehicleUse({
        firstUse: utc(midnightUtc + 1_500),
        lastUse: utc(midnightUtc + 1_750),
        odometerBegin,
        odometerEnd,
        registrationMemberState: null,
        registrationNumber,
        source: cardSource('/vehicles/0'),
        vehicleIdentificationNumber: null,
    });
    if (interval === null || event === null || fault === null || vehicleUse === null) {
        throw new TypeError('The view-model records fixture must be valid.');
    }
    const location = createDailyWorkPeriodPlace({
        card: null,
        country: null,
        entryAt: utc(midnightUtc + 2_500),
        entryType: 'beginManual',
        odometer: null,
        position: null,
        region: 'Madrid',
        source: cardSource('/places/0'),
    });

    const activityDay = normalizeActivityDay([interval], midnightUtc);
    const metadata = decodeFileMetadata({
        byteLength: 3,
        displayName: 'view-model.ddd',
        sha256: 'b'.repeat(64),
    });
    if (activityDay.status !== 'normalized' || !metadata.ok) {
        throw new TypeError('The view-model document fixture must be valid.');
    }

    const application: IDriverCardApplication = {
        activityDays: [activityDay.day],
        cardNotes,
        events: [event],
        faults: [fault],
        generation: 'g1',
        identity: createDriverIdentity({
            cardExpiryDate: utc(Date.UTC(2030, 6, 27)),
            cardHolderBirthDate: utc(Date.UTC(1990, 0, 1)),
            cardIssueDate: midnightUtc,
            cardValidityBegin: null,
            cardIssuingAuthorityName: null,
            cardNumber,
            firstNames: null,
            issuingMemberState: null,
            source: cardSource('/identity'),
            surname: null,
        }),
        locations: [location],
        source: cardSource('/cardDataResponses'),
        technicalRecords: [...technicalRecords],
        verification: {
            dataFiles: {},
            dataFileSourcePaths: {},
            generation: 'g1',
        },
        vehicleUses: [vehicleUse],
        vehicleUnitUses: [...vehicleUnitUses],
        warnings: [],
    };
    return {
        cardNotes,
        document: createOpenedTachographDocument(
            createDocumentSource(metadata.value, utc(midnightUtc + 10_000)),
            driverCardContent(application),
        ),
        event,
        fault,
        interval,
        location,
        midnightUtc,
        vehicleUnitUses,
        vehicleUse,
    };
}

function localisation(locale = 'en', timeZone = 'UTC'): ILocalisationService<UtcTimestamp, DurationMilliseconds> {
    return createLocalisationServiceFake({ locale, timeZone });
}

function journeyPlaceRecord(
    entryType: 'beginManual' | 'endManual',
    timestampValue: UtcTimestamp,
    odometerKm: number,
    sourcePath: string,
    record: IDailyWorkPeriodPlace,
    generation: 'g1' | 'g2' = 'g1',
): LocationRecordViewModel {
    return {
        card: null,
        country: null,
        entryAt: { display: 'time', value: timestampValue },
        entryType,
        generation,
        kind: 'dailyWorkPeriodPlace',
        odometer: { display: `number:${String(odometerKm)}`, value: odo(odometerKm) },
        position: null,
        record,
        region: 'BE',
        source: cardSource(sourcePath),
        timestamp: { display: 'time', value: timestampValue },
    };
}

// Creates test daily-work-period place record with odometer reading.
function odometerPlaceRecord(
    harness: IDocumentHarness,
    entryType: 'beginManual' | 'endManual',
    display: string,
    offsetMs: number,
    odometerKm: number,
    sourcePath: string,
): LocationRecordViewModel {
    const value = utc(harness.midnightUtc + offsetMs);
    return {
        card: null,
        country: null,
        entryAt: { display, value },
        entryType,
        generation: 'g1' as const,
        kind: 'dailyWorkPeriodPlace' as const,
        odometer: { display: `number:${String(odometerKm)}`, value: odo(odometerKm) },
        position: null,
        record: harness.location,
        region: 'BE',
        source: cardSource(sourcePath),
        timestamp: { display, value },
    };
}

// Creates formatted GNSS position view model at given coordinates for map-route tests.
function gnssPositionEvidenceViewModel(
    lat: Latitude,
    lon: Longitude,
    display: string,
    value: UtcTimestamp,
): IGnssPositionEvidenceViewModel {
    return {
        accuracy: { display: '2', value: 2 },
        authenticationStatus: null,
        coordinateCopyValue: `${String(lat)}, ${String(lon)}`,
        coordinateDisplayValue: `${String(lat)}, ${String(lon)}`,
        determinedAt: { display, value },
        latitude: { display: String(lat), value: lat },
        longitude: { display: String(lon), value: lon },
    };
}

// Distinct test label per leg type to verify resolver reaches waypoint without hardcoded fallbacks.
function testLegLabel(type: IJourneyLegViewModel['type']): string {
    return `LABEL:${type}`;
}

// Helper creating a begin/end place pair sharing one journey shift for map tests.
function journeyPlaceLegPair(
    harness: IDocumentHarness,
    positions: {
        readonly position1: IGnssPositionEvidenceViewModel | null;
        readonly position2: IGnssPositionEvidenceViewModel | null;
        readonly recordPosition1: IGnssPositionEvidence | null;
        readonly recordPosition2: IGnssPositionEvidence | null;
    },
): { rec1: LocationRecordViewModel; rec2: LocationRecordViewModel } {
    const countryD = memberState('D');
    const countryB = memberState('B');
    const odo1 = odo(100_000);
    const odo2 = odo(100_500);
    const time1 = utc(harness.midnightUtc + 8 * 3_600_000);
    const time2 = utc(harness.midnightUtc + 17 * 3_600_000);

    const startPlace = createDailyWorkPeriodPlace({
        card: null,
        country: countryD,
        entryAt: time1,
        entryType: 'beginManual',
        odometer: odo1,
        position: positions.recordPosition1,
        region: null,
        source: cardSource('/places/0'),
    });
    const endPlace = createDailyWorkPeriodPlace({
        card: null,
        country: countryB,
        entryAt: time2,
        entryType: 'endManual',
        odometer: odo2,
        position: positions.recordPosition2,
        region: null,
        source: cardSource('/places/1'),
    });

    const rec1: LocationRecordViewModel = {
        card: null,
        country: countryD,
        entryAt: { display: '08:00', value: time1 },
        entryType: 'beginManual',
        generation: 'g2',
        kind: 'dailyWorkPeriodPlace',
        odometer: { display: '100,000', value: odo1 },
        position: positions.position1,
        record: startPlace,
        region: null,
        source: cardSource('/places/0'),
        timestamp: { display: '08:00', value: time1 },
    };
    const rec2: LocationRecordViewModel = {
        card: null,
        country: countryB,
        entryAt: { display: '17:00', value: time2 },
        entryType: 'endManual',
        generation: 'g2',
        kind: 'dailyWorkPeriodPlace',
        odometer: { display: '100,500', value: odo2 },
        position: positions.position2,
        record: endPlace,
        region: null,
        source: cardSource('/places/1'),
        timestamp: { display: '17:00', value: time2 },
    };

    return { rec1, rec2 };
}

function journeyGnssRecord(timestampValue: UtcTimestamp, odometerKm: number, sourcePath: string): LocationRecordViewModel {
    const position = createGnssPositionEvidence({
        accuracy: gnssAccuracy(2),
        authenticationStatus: gnssAuthenticationStatus(1),
        coordinates: { latitude: latitude(52.52), longitude: longitude(13.405) },
        determinedAt: timestampValue,
    });
    return {
        coDriverCard: null,
        driverCard: null,
        generation: 'g1',
        kind: 'accumulatedDrivingPosition',
        odometer: { display: `number:${String(odometerKm)}`, value: odo(odometerKm) },
        position: {
            accuracy: { display: '2', value: 2 },
            authenticationStatus: { display: '1', value: 1 },
            coordinateCopyValue: '52.52, 13.405',
            coordinateDisplayValue: '52.520000, 13.405000',
            determinedAt: { display: 'time', value: timestampValue },
            latitude: { display: '52.520000', value: latitude(52.52) },
            longitude: { display: '13.405000', value: longitude(13.405) },
        },
        record: createAccumulatedDrivingPosition({
            coDriverCard: null,
            driverCard: null,
            odometer: odo(odometerKm),
            position,
            recordedAt: timestampValue,
            source: cardSource(sourcePath),
        }),
        recordedAt: { display: 'time', value: timestampValue },
        source: cardSource(sourcePath),
        timestamp: { display: 'time', value: timestampValue },
    };
}

function journeyBorderRecord(crossedAt: UtcTimestamp, odometerKm: number, sourcePath: string): LocationRecordViewModel {
    const position = createGnssPositionEvidence({
        accuracy: gnssAccuracy(2),
        authenticationStatus: gnssAuthenticationStatus(1),
        coordinates: { latitude: latitude(52.52), longitude: longitude(13.405) },
        determinedAt: crossedAt,
    });
    const countryLeft = memberState('DE');
    const countryEntered = memberState('NL');
    return {
        countryEntered,
        countryLeft,
        crossedAt: { display: 'time', value: crossedAt },
        generation: 'g1',
        kind: 'borderCrossing',
        odometer: { display: `number:${String(odometerKm)}`, value: odo(odometerKm) },
        position: {
            accuracy: { display: '2', value: 2 },
            authenticationStatus: { display: '1', value: 1 },
            coordinateCopyValue: '52.52, 13.405',
            coordinateDisplayValue: '52.520000, 13.405000',
            determinedAt: { display: 'time', value: crossedAt },
            latitude: { display: '52.520000', value: latitude(52.52) },
            longitude: { display: '13.405000', value: longitude(13.405) },
        },
        record: createBorderCrossing({
            countryEntered,
            countryLeft,
            crossedAt,
            odometer: odo(odometerKm),
            position,
            source: cardSource(sourcePath),
        }),
        source: cardSource(sourcePath),
        timestamp: { display: 'time', value: crossedAt },
    };
}

function memberState(value: string): RecordedIssuingMemberState {
    if (!isIssuingMemberState(value)) {
        throw new TypeError('The view-model member-state fixture must be valid.');
    }
    return value;
}

function latitude(value: number): Latitude {
    if (!isLatitude(value)) {
        throw new TypeError('The view-model latitude fixture must be valid.');
    }
    return value;
}

function longitude(value: number): Longitude {
    if (!isLongitude(value)) {
        throw new TypeError('The view-model longitude fixture must be valid.');
    }
    return value;
}

function gnssAccuracy(value: number): GnssAccuracyIndicator {
    if (!isGnssAccuracyIndicator(value)) {
        throw new TypeError('The view-model GNSS accuracy fixture must be valid.');
    }
    return value;
}

function gnssAuthenticationStatus(value: number): GnssAuthenticationStatus {
    if (!isGnssAuthenticationStatus(value)) {
        throw new TypeError('The view-model GNSS authentication-status fixture must be valid.');
    }
    return value;
}

describe('document view models', () => {
    it('formats technical identifiers and operational evidence without losing source values', () => {
        const chipSerialNumber = 'DEADBEEF';
        const manufacturingReference = '12345678';
        if (!isTechnicalHexIdentifier(chipSerialNumber, 4) || !isTechnicalHexIdentifier(manufacturingReference, 4)) {
            throw new TypeError('The technical identifier fixture must be valid.');
        }
        const controlledAt = utc(Date.UTC(2026, 6, 27, 10));
        const control = createCardControlActivityTechnicalRecord({
            controlCard: null,
            controlledAt,
            controlType: 'cardDownloaded',
            downloadPeriodBegin: null,
            downloadPeriodEnd: null,
            registrationMemberState: null,
            registrationNumber: null,
            source: cardSource('/controlActivityData'),
        });
        if (control === null) {
            throw new TypeError('The control fixture must be valid.');
        }
        const harness = createHarness([
            createCardChipTechnicalData({
                manufacturingReference,
                serialNumber: chipSerialNumber,
                source: cardSource('/cardChipIdentification'),
            }),
            createCardDownloadTechnicalRecord({
                downloadedAt: null,
                source: cardSource('/cardDownload'),
            }),
            control,
        ]);

        const viewModel = createTechnicalSectionViewModel(harness.document, localisation('en', 'Europe/Berlin'));

        expect(viewModel.identificationRecords).toMatchObject([
            {
                fields: [
                    {
                        key: 'chipSerialNumber',
                        value: {
                            code: true,
                            copyValue: 'DEADBEEF',
                            display: 'DEADBEEF',
                            kind: 'display',
                        },
                    },
                    {
                        key: 'chipManufacturingReference',
                        value: {
                            copyValue: '12345678',
                        },
                    },
                ],
                kind: 'chip',
                source: {
                    path: '/cardChipIdentification',
                },
            },
        ]);
        const downloadViewModel = viewModel.operationalRecords.find((record) => record.kind === 'download');
        const controlViewModel = viewModel.operationalRecords.find((record) => record.kind === 'controlActivity');
        const controlType = controlViewModel?.fields.find((field) => field.key === 'controlType');
        expect(downloadViewModel).toMatchObject({
            recordedAt: null,
        });
        expect(controlViewModel).toMatchObject({
            recordedAt: `date-time:Europe/Berlin:${String(controlledAt)}`,
        });
        expect(controlType).toEqual({
            key: 'controlType',
            value: {
                kind: 'controlType',
                value: 'cardDownloaded',
            },
        });
        expect(viewModel.totalCount).toEqual({
            display: 'number:3',
            value: 3,
        });
    });

    it('projects Vehicle Unit technical records through the shared presentation model', () => {
        const periodBegin = utc(Date.UTC(2026, 5, 1));
        const periodEnd = utc(Date.UTC(2026, 5, 18));
        const record = createVehicleUnitDownloadPeriodTechnicalRecord({
            periodBegin,
            periodEnd,
            source: vehicleUnitSource('/transferResParams/0/data/Control/vuDownloadablePeriodRecordArray/records/0'),
        });
        if (record === null) {
            throw new TypeError('The Vehicle Unit technical fixture must be valid.');
        }
        const document = createVehicleUnitDocumentFixture({
            openedAt: utc(Date.UTC(2026, 5, 19)),
            technicalRecords: [record],
        });

        const viewModel = createTechnicalSectionViewModel(document, localisation('en', 'Europe/Berlin'));

        expect(viewModel).toMatchObject({
            documentKind: 'vehicleUnit',
            identificationRecords: [],
            operationalRecords: [
                {
                    kind: 'vehicleUnitDownloadPeriod',
                    recordedAt: `date-time:Europe/Berlin:${String(periodEnd)}`,
                    fields: [
                        {
                            key: 'downloadPeriodBegin',
                            value: {
                                display: `date-time:Europe/Berlin:${String(periodBegin)}`,
                            },
                        },
                        {
                            key: 'downloadPeriodEnd',
                            value: {
                                display: `date-time:Europe/Berlin:${String(periodEnd)}`,
                            },
                        },
                    ],
                },
            ],
        });
    });

    it('projects Vehicle Unit sensor-paired records through the shared presentation model', () => {
        const pairedAt = utc(Date.UTC(2026, 5, 1, 6));
        const record = createVehicleUnitSensorPairedTechnicalRecord({
            pairedAt,
            sensorApprovalNumber: 'SENSOR-G2',
            sensorSerialNumber: {
                manufacturerCode: 33,
                monthYear: '0426',
                serialNumber: 987_654,
                type: 3,
            },
            source: vehicleUnitSource('/transferResParams/0/data/Calibration/vuSensorPairedRecordArray/records/0'),
        });
        const document = createVehicleUnitDocumentFixture({
            openedAt: utc(Date.UTC(2026, 5, 19)),
            technicalRecords: [record],
        });

        const viewModel = createTechnicalSectionViewModel(document, localisation('en', 'Europe/Berlin'));

        expect(viewModel).toMatchObject({
            documentKind: 'vehicleUnit',
            identificationRecords: [],
            operationalRecords: [
                {
                    kind: 'vehicleUnitSensorPaired',
                    recordedAt: `date-time:Europe/Berlin:${String(pairedAt)}`,
                    fields: [
                        {
                            key: 'extendedSerialNumber',
                            value: {
                                copyValue: '987654',
                                display: '987654',
                            },
                        },
                        {
                            key: 'monthYear',
                            value: {
                                copyValue: null,
                                display: '0426',
                            },
                        },
                        {
                            key: 'serialType',
                            value: {
                                display: 'number:3',
                            },
                        },
                        {
                            key: 'manufacturerCode',
                            value: {
                                display: 'number:33',
                            },
                        },
                        {
                            key: 'sensorApprovalNumber',
                            value: {
                                copyValue: 'SENSOR-G2',
                                display: 'SENSOR-G2',
                            },
                        },
                        {
                            key: 'sensorPairingDate',
                            value: {
                                display: `date-time:Europe/Berlin:${String(pairedAt)}`,
                            },
                        },
                    ],
                },
            ],
        });
    });

    it('projects Vehicle Unit external GNSS coupling records through the shared presentation model', () => {
        const coupledAt = utc(Date.UTC(2026, 6, 2, 8));
        const record = createVehicleUnitGnssCoupledTechnicalRecord({
            coupledAt,
            sensorApprovalNumber: 'GNSS-APPROVAL',
            sensorSerialNumber: {
                manufacturerCode: 34,
                monthYear: '0626',
                serialNumber: 555_555,
                type: 4,
            },
            source: vehicleUnitSource('/transferResParams/0/data/Calibration/vuSensorExternalGnssCoupledRecordArray/records/0'),
        });
        const document = createVehicleUnitDocumentFixture({
            openedAt: utc(Date.UTC(2026, 5, 19)),
            technicalRecords: [record],
        });

        const viewModel = createTechnicalSectionViewModel(document, localisation('en', 'Europe/Berlin'));

        expect(viewModel).toMatchObject({
            documentKind: 'vehicleUnit',
            identificationRecords: [],
            operationalRecords: [
                {
                    kind: 'vehicleUnitGnssCoupled',
                    recordedAt: `date-time:Europe/Berlin:${String(coupledAt)}`,
                    fields: [
                        {
                            key: 'extendedSerialNumber',
                            value: {
                                copyValue: '555555',
                                display: '555555',
                            },
                        },
                        {
                            key: 'monthYear',
                            value: {
                                copyValue: null,
                                display: '0626',
                            },
                        },
                        {
                            key: 'serialType',
                            value: {
                                display: 'number:4',
                            },
                        },
                        {
                            key: 'manufacturerCode',
                            value: {
                                display: 'number:34',
                            },
                        },
                        {
                            key: 'sensorApprovalNumber',
                            value: {
                                copyValue: 'GNSS-APPROVAL',
                                display: 'GNSS-APPROVAL',
                            },
                        },
                        {
                            key: 'sensorCouplingDate',
                            value: {
                                display: `date-time:Europe/Berlin:${String(coupledAt)}`,
                            },
                        },
                    ],
                },
            ],
        });
    });

    it('projects Vehicle Unit embedded-card identity records through the shared presentation model', () => {
        const cardNumber = 'SYNTHETIC0000006';
        if (!isCardNumber(cardNumber)) {
            throw new TypeError('The view-model embedded-card fixture must be valid.');
        }
        const issuingMemberState = 'D';
        if (!isIssuingMemberState(issuingMemberState)) {
            throw new TypeError('The view-model embedded-card fixture must be valid.');
        }
        const record = createVehicleUnitEmbeddedCardTechnicalRecord({
            card: {
                cardNumber,
                cardType: 'driverCard',
                issuingMemberState,
            },
            cardStructureVersion: 2,
            dataElementUseVersion: 1,
            extendedSerialNumber: {
                manufacturerCode: 34,
                monthYear: '0526',
                serialNumber: 654_323,
                type: 4,
            },
            source: vehicleUnitSource('/transferResParams/0/data/Calibration/vuCardRecordArray/records/0'),
        });
        const document = createVehicleUnitDocumentFixture({
            openedAt: utc(Date.UTC(2026, 5, 19)),
            technicalRecords: [record],
        });

        const viewModel = createTechnicalSectionViewModel(document, localisation('en', 'Europe/Berlin'));

        expect(viewModel).toMatchObject({
            documentKind: 'vehicleUnit',
            identificationRecords: [
                {
                    kind: 'vehicleUnitEmbeddedCard',
                    recordedAt: null,
                    fields: [
                        {
                            key: 'embeddedCardNumber',
                            value: {
                                copyValue: 'SYNTHETIC0000006',
                                display: 'SYNTHETIC0000006',
                            },
                        },
                        {
                            key: 'embeddedCardType',
                            value: {
                                kind: 'cardType',
                                value: 'driverCard',
                            },
                        },
                        {
                            key: 'embeddedCardIssuingMemberState',
                            value: {
                                copyValue: null,
                                display: 'D',
                            },
                        },
                        {
                            key: 'extendedSerialNumber',
                            value: {
                                copyValue: '654323',
                                display: '654323',
                            },
                        },
                        {
                            key: 'monthYear',
                            value: {
                                copyValue: null,
                                display: '0526',
                            },
                        },
                        {
                            key: 'serialType',
                            value: {
                                display: 'number:4',
                            },
                        },
                        {
                            key: 'manufacturerCode',
                            value: {
                                display: 'number:34',
                            },
                        },
                        {
                            key: 'structureVersion',
                            value: {
                                display: 'number:2',
                            },
                        },
                        {
                            key: 'dataElementUseVersion',
                            value: {
                                display: 'number:1',
                            },
                        },
                    ],
                },
            ],
            operationalRecords: [],
        });
    });

    it('projects Vehicle Unit ITS consent records through the shared presentation model', () => {
        const cardNumber = 'SYNTHETIC0000007';
        if (!isCardNumber(cardNumber)) {
            throw new TypeError('The view-model ITS consent fixture must be valid.');
        }
        const issuingMemberState = 'D';
        if (!isIssuingMemberState(issuingMemberState)) {
            throw new TypeError('The view-model ITS consent fixture must be valid.');
        }
        const record = createVehicleUnitItsConsentTechnicalRecord({
            card: {
                cardNumber,
                cardType: 'driverCard',
                issuingMemberState,
            },
            consent: true,
            source: vehicleUnitSource('/transferResParams/0/data/Calibration/vuItsConsentRecordArray/records/0'),
        });
        const document = createVehicleUnitDocumentFixture({
            openedAt: utc(Date.UTC(2026, 5, 19)),
            technicalRecords: [record],
        });

        const viewModel = createTechnicalSectionViewModel(document, localisation('en', 'Europe/Berlin'));

        expect(viewModel).toMatchObject({
            documentKind: 'vehicleUnit',
            identificationRecords: [],
            operationalRecords: [
                {
                    kind: 'vehicleUnitItsConsent',
                    recordedAt: null,
                    fields: [
                        {
                            key: 'itsConsent',
                            value: {
                                kind: 'consent',
                                value: true,
                            },
                        },
                        {
                            key: 'itsConsentCardNumber',
                            value: {
                                copyValue: 'SYNTHETIC0000007',
                                display: 'SYNTHETIC0000007',
                            },
                        },
                        {
                            key: 'itsConsentCardType',
                            value: {
                                kind: 'cardType',
                                value: 'driverCard',
                            },
                        },
                        {
                            key: 'itsConsentCardIssuingMemberState',
                            value: {
                                copyValue: null,
                                display: 'D',
                            },
                        },
                    ],
                },
            ],
        });
    });

    it('projects Vehicle Unit card-slot status records through the shared presentation model', () => {
        const record = createVehicleUnitCardSlotStatusTechnicalRecord({
            coDriverSlot: 'companyCard',
            driverSlot: 'driverCard',
            source: vehicleUnitSource('/transferResParams/0/data/Control/cardSlotsStatusRecordArray/records/0'),
        });
        const document = createVehicleUnitDocumentFixture({
            openedAt: utc(Date.UTC(2026, 5, 19)),
            technicalRecords: [record],
        });

        const viewModel = createTechnicalSectionViewModel(document, localisation('en', 'Europe/Berlin'));

        expect(viewModel).toMatchObject({
            documentKind: 'vehicleUnit',
            identificationRecords: [],
            operationalRecords: [
                {
                    kind: 'vehicleUnitCardSlotStatus',
                    recordedAt: null,
                    fields: [
                        {
                            key: 'driverSlot',
                            value: {
                                kind: 'cardType',
                                value: 'driverCard',
                            },
                        },
                        {
                            key: 'coDriverSlot',
                            value: {
                                kind: 'cardType',
                                value: 'companyCard',
                            },
                        },
                    ],
                },
            ],
        });
    });

    it('projects Vehicle Unit power-supply interruption records through the shared presentation model', () => {
        const begin = utc(Date.UTC(2026, 5, 16, 10));
        const record = createVehicleUnitPowerSupplyInterruptionTechnicalRecord({
            begin,
            end: utc(Date.UTC(2026, 5, 16, 11)),
            similarEvents: 2,
            source: vehicleUnitSource('/transferResParams/0/data/Calibration/vuPowerSupplyInterruptionRecordArray/records/0'),
        });
        const document = createVehicleUnitDocumentFixture({
            openedAt: utc(Date.UTC(2026, 5, 19)),
            technicalRecords: [record],
        });

        const viewModel = createTechnicalSectionViewModel(document, localisation('en', 'Europe/Berlin'));

        expect(viewModel).toMatchObject({
            documentKind: 'vehicleUnit',
            identificationRecords: [],
            operationalRecords: [
                {
                    kind: 'vehicleUnitPowerSupplyInterruption',
                    recordedAt: `date-time:Europe/Berlin:${String(begin)}`,
                    fields: [
                        {
                            key: 'powerSupplyInterruptionBegin',
                            value: {
                                display: `date-time:Europe/Berlin:${String(begin)}`,
                            },
                        },
                        {
                            key: 'powerSupplyInterruptionEnd',
                            value: {
                                display: `date-time:Europe/Berlin:${String(Date.UTC(2026, 5, 16, 11))}`,
                            },
                        },
                        {
                            key: 'similarEvents',
                            value: {
                                display: 'number:2',
                            },
                        },
                    ],
                },
            ],
        });
    });

    it('projects Vehicle Unit time-adjustment records through the shared presentation model', () => {
        const oldTime = utc(Date.UTC(2026, 5, 1, 6));
        const newTime = utc(Date.UTC(2026, 5, 1, 7));
        const cardNumber = 'SYNTHETIC0000001';
        if (!isCardNumber(cardNumber)) {
            throw new TypeError('The view-model workshop-card fixture must be valid.');
        }
        const issuingMemberState = 'D';
        if (!isIssuingMemberState(issuingMemberState)) {
            throw new TypeError('The view-model workshop-card fixture must be valid.');
        }
        const record = createVehicleUnitTimeAdjustmentTechnicalRecord({
            newTime,
            oldTime,
            source: vehicleUnitSource('/transferResParams/0/data/Events/vuTimeAdjustmentRecordArray/records/0'),
            workshopAddress: 'Synthetic street 5',
            workshopCard: {
                cardNumber,
                cardType: 'workshopCard',
                issuingMemberState,
            },
            workshopName: 'Synthetic Gen2 workshop',
        });
        const document = createVehicleUnitDocumentFixture({
            openedAt: utc(Date.UTC(2026, 5, 19)),
            technicalRecords: [record],
        });

        const viewModel = createTechnicalSectionViewModel(document, localisation('en', 'Europe/Berlin'));

        expect(viewModel).toMatchObject({
            documentKind: 'vehicleUnit',
            identificationRecords: [],
            operationalRecords: [
                {
                    kind: 'vehicleUnitTimeAdjustment',
                    recordedAt: `date-time:Europe/Berlin:${String(newTime)}`,
                    fields: [
                        {
                            key: 'workshopName',
                            value: {
                                display: 'Synthetic Gen2 workshop',
                            },
                        },
                        {
                            key: 'workshopAddress',
                            value: {
                                display: 'Synthetic street 5',
                            },
                        },
                        {
                            key: 'timeAdjustmentOldTime',
                            value: {
                                display: `date-time:Europe/Berlin:${String(oldTime)}`,
                            },
                        },
                        {
                            key: 'timeAdjustmentNewTime',
                            value: {
                                display: `date-time:Europe/Berlin:${String(newTime)}`,
                            },
                        },
                        {
                            key: 'workshopCardNumber',
                            value: {
                                copyValue: 'SYNTHETIC0000001',
                                display: 'SYNTHETIC0000001',
                            },
                        },
                        {
                            key: 'workshopCardType',
                            value: {
                                kind: 'cardType',
                                value: 'workshopCard',
                            },
                        },
                        {
                            key: 'workshopCardIssuingMemberState',
                            value: {
                                copyValue: null,
                                display: 'D',
                            },
                        },
                    ],
                },
            ],
        });
    });
    it('projects Vehicle Unit control-activity records through the shared presentation model', () => {
        const controlledAt = utc(Date.UTC(2026, 5, 1, 7));
        const cardNumber = 'SYNTHETIC0000001';
        if (!isCardNumber(cardNumber)) {
            throw new TypeError('The view-model control-card fixture must be valid.');
        }
        const issuingMemberState = 'D';
        if (!isIssuingMemberState(issuingMemberState)) {
            throw new TypeError('The view-model control-card fixture must be valid.');
        }
        const record = createVehicleUnitControlActivityTechnicalRecord({
            controlCard: {
                cardNumber,
                cardType: 'controlCard',
                issuingMemberState,
            },
            controlledAt,
            controlType: 'cardDownloaded',
            downloadPeriodBegin: utc(Date.UTC(2026, 4, 15)),
            downloadPeriodEnd: utc(Date.UTC(2026, 4, 20)),
            source: vehicleUnitSource('/transferResParams/0/data/Control/vuControlActivityRecordArray/records/0'),
        });
        const document = createVehicleUnitDocumentFixture({
            openedAt: utc(Date.UTC(2026, 5, 19)),
            technicalRecords: [record],
        });

        const viewModel = createTechnicalSectionViewModel(document, localisation('en', 'Europe/Berlin'));

        expect(viewModel).toMatchObject({
            documentKind: 'vehicleUnit',
            identificationRecords: [],
            operationalRecords: [
                {
                    kind: 'vehicleUnitControlActivity',
                    recordedAt: `date-time:Europe/Berlin:${String(controlledAt)}`,
                    fields: [
                        {
                            key: 'controlType',
                            value: {
                                kind: 'controlType',
                                value: 'cardDownloaded',
                            },
                        },
                        {
                            key: 'downloadPeriodBegin',
                            value: {
                                display: `date-time:Europe/Berlin:${String(utc(Date.UTC(2026, 4, 15)))}`,
                            },
                        },
                        {
                            key: 'downloadPeriodEnd',
                            value: {
                                display: `date-time:Europe/Berlin:${String(utc(Date.UTC(2026, 4, 20)))}`,
                            },
                        },
                        {
                            key: 'controlCardNumber',
                            value: {
                                copyValue: 'SYNTHETIC0000001',
                                display: 'SYNTHETIC0000001',
                            },
                        },
                        {
                            key: 'controlCardType',
                            value: {
                                kind: 'cardType',
                                value: 'controlCard',
                            },
                        },
                        {
                            key: 'controlCardIssuingMemberState',
                            value: {
                                copyValue: null,
                                display: 'D',
                            },
                        },
                    ],
                },
            ],
        });
    });

    it('projects Vehicle Unit specific-condition records through the shared presentation model', () => {
        const enteredAt = utc(Date.UTC(2026, 5, 1, 7));
        const record = createVehicleUnitSpecificConditionTechnicalRecord({
            conditionType: 'ferryTrainCrossing',
            enteredAt,
            source: vehicleUnitSource('/transferResParams/0/data/Activity/vuSpecificConditionRecordArray/records/0'),
        });
        const document = createVehicleUnitDocumentFixture({
            openedAt: utc(Date.UTC(2026, 5, 19)),
            technicalRecords: [record],
        });

        const viewModel = createTechnicalSectionViewModel(document, localisation('en', 'Europe/Berlin'));

        expect(viewModel).toMatchObject({
            documentKind: 'vehicleUnit',
            identificationRecords: [],
            operationalRecords: [
                {
                    kind: 'vehicleUnitSpecificCondition',
                    recordedAt: `date-time:Europe/Berlin:${String(enteredAt)}`,
                    fields: [
                        {
                            key: 'specificConditionType',
                            value: {
                                kind: 'specificConditionType',
                                value: 'ferryTrainCrossing',
                            },
                        },
                    ],
                },
            ],
        });
    });

    it('formats overview values while retaining exact UTC and source evidence', () => {
        const harness = createHarness();
        const viewModel = createDocumentOverviewViewModel(harness.document, localisation('en', 'Europe/Berlin'));

        expect(viewModel).toMatchObject({
            byteLength: {
                display: 'number:3',
                value: 3,
            },
            counts: {
                activityDays: { value: 1 },
                events: { value: 1 },
                faults: { value: 1 },
                inferredActivityGaps: { value: 2 },
                recordedActivityIntervals: { value: 1 },
            },
            coverage: {
                end: {
                    value: harness.midnightUtc + 5_000,
                },
                start: {
                    value: harness.midnightUtc + 1_000,
                },
            },
            integrity: {
                checkedItems: {
                    display: 'number:0',
                    value: 0,
                },
                invalidItems: {
                    display: 'number:0',
                    value: 0,
                },
                status: 'notChecked',
                validItems: {
                    display: 'number:0',
                    value: 0,
                },
            },
            locale: 'en',
            openedAt: {
                display: `date-time:Europe/Berlin:${String(harness.midnightUtc + 10_000)}`,
                value: harness.midnightUtc + 10_000,
            },
            timeZone: 'Europe/Berlin',
        });
        expect(viewModel.sha256).toBe(harness.document.source.sha256);
        expect(viewModel.identities[0]).toMatchObject({
            cardExpiryDate: {
                display: `utc-date:${String(Date.UTC(2030, 6, 27))}`,
            },
            cardHolderBirthDate: {
                display: `utc-date:${String(Date.UTC(1990, 0, 1))}`,
            },
            cardIssueDate: {
                display: `utc-date:${String(harness.midnightUtc)}`,
            },
            kind: 'driver',
        });

        const rawData = createRawDataExplorerViewModel(harness.document, localisation('en', 'Europe/Berlin'));
        const lineage = rawData.getLineage(cardSource('/identity/cardNumber').path);
        expect(lineage.ok).toBe(true);
        if (lineage.ok) {
            expect(lineage.value.at(-1)).toMatchObject({
                displayValue: '"1234567890123456"',
                key: 'cardNumber',
                kind: 'string',
                path: '/identity/cardNumber',
                searchValues: ['cardNumber', '/identity/cardNumber', '"1234567890123456"', 'string'],
            });
        }
    });

    it('exposes decoded card notes with generation and canonical source in the overview', () => {
        const notesText = 'Card holder changed surname.';
        if (!isCardNotesText(notesText)) {
            throw new TypeError('The card-notes fixture must be normalized.');
        }
        const cardNotes = createCardNotes({
            source: cardSource('/cardNotes'),
            text: notesText,
        });
        const harness = createHarness([], cardNotes);
        const viewModel = createDocumentOverviewViewModel(harness.document, localisation('en', 'Europe/Berlin'));

        expect(viewModel.cardNotes).toEqual([
            {
                generation: 'g1',
                source: cardSource('/cardNotes'),
                text: 'Card holder changed surname.',
            },
        ]);
    });

    it('keeps card notes absent from the overview when no notes were decoded', () => {
        const viewModel = createDocumentOverviewViewModel(createHarness().document, localisation('en', 'Europe/Berlin'));

        expect(viewModel.cardNotes).toEqual([]);
    });

    it('formats integrity totals while preserving exact record and source evidence', () => {
        const harness = createHarness();
        const verifiedDocument: OpenedTachographDocument = {
            ...harness.document,
            integrity: {
                items: [
                    {
                        generation: 'g1',
                        recordId: 'EventsData',
                        source: cardSource('/events/0'),
                        status: 'valid',
                    },
                    {
                        generation: 'g1',
                        recordId: 'FaultsData',
                        source: cardSource('/faults/0'),
                        status: 'invalid',
                    },
                ],
                status: 'partiallyValid',
            },
        };

        const viewModel = createIntegrityDetailViewModel(verifiedDocument, localisation('en', 'Europe/Berlin'));

        expect(viewModel).toMatchObject({
            assessment: {
                status: 'partiallyValid',
            },
            checkedItems: {
                display: 'number:2',
                value: 2,
            },
            invalidItems: {
                display: 'number:1',
                value: 1,
            },
            items: [
                {
                    recordId: 'EventsData',
                    source: {
                        path: '/events/0',
                    },
                    status: 'valid',
                },
                {
                    recordId: 'FaultsData',
                    source: {
                        path: '/faults/0',
                    },
                    status: 'invalid',
                },
            ],
            scopes: [
                {
                    applicationGeneration: 'g1',
                    assessment: {
                        status: 'partiallyValid',
                    },
                    checkedItems: {
                        display: 'number:2',
                        value: 2,
                    },
                    verificationGeneration: 'g1',
                },
            ],
            validItems: {
                display: 'number:1',
                value: 1,
            },
        });
    });

    it('maps activity totals and inferred gaps without losing the selected domain record', () => {
        const harness = createHarness();
        const result = createActivitySectionViewModel(
            harness.document,
            localisation('en', 'America/New_York'),
            EU_561_2006_STANDARD,
            NO_COMPLIANCE_EVALUATION,
        );
        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }

        const day = result.value.days[0];
        if (day === undefined) {
            throw new TypeError('The activity day view model must be present.');
        }
        const recorded = day.records.find((record) => record.record === harness.interval);
        if (recorded === undefined) {
            throw new TypeError('The recorded activity view model must be present.');
        }

        expect(day.records).toHaveLength(3);
        expect(result.value.timeZone).toBe('UTC');
        expect(day.date).toEqual({
            display: `utc-date:${String(harness.midnightUtc)}`,
            value: harness.midnightUtc,
        });
        expect(day.dateInputValue).toBe('2026-07-27');
        expect(day.timelineEnd).toBe(24 * 60 * 60 * 1_000);
        expect(day.timelineTicks).toEqual([
            {
                display: `utc-time:${String(harness.midnightUtc)}`,
                offset: 0,
            },
            {
                display: `utc-time:${String(harness.midnightUtc + 6 * 60 * 60 * 1_000)}`,
                offset: 6 * 60 * 60 * 1_000,
            },
            {
                display: `utc-time:${String(harness.midnightUtc + 12 * 60 * 60 * 1_000)}`,
                offset: 12 * 60 * 60 * 1_000,
            },
            {
                display: `utc-time:${String(harness.midnightUtc + 18 * 60 * 60 * 1_000)}`,
                offset: 18 * 60 * 60 * 1_000,
            },
            {
                display: '24:00',
                offset: 24 * 60 * 60 * 1_000,
            },
        ]);
        expect(day.totals.driving).toEqual({
            display: 'duration:1000',
            value: 1_000,
        });
        expect(recorded).toMatchObject({
            activity: 'driving',
            duration: {
                value: 1_000,
            },
            origin: 'recorded',
            source: harness.interval.source,
            timelineEnd: 2_000,
            timelineStart: 1_000,
        });
        expect(recorded.start.display).toBe(`utc-time:${String(harness.midnightUtc + 1_000)}`);
        expect(recorded.searchValues).toContain('/activities/0');
        expect(day.dutyShifts).toHaveLength(1);
        expect(day.dutyShifts[0]).toMatchObject({
            drivingDuration: { value: 1_000 },
            formattedSpan: `utc-time:${String(harness.midnightUtc + 1_000)} – utc-time:${String(harness.midnightUtc + 2_000)}`,
            totalDutyDuration: { value: 1_000 },
        });

        const selection = new DocumentSelectionController(harness.document);
        selection.selectSection('activities');
        expect(selection.selectRecord(recorded.record)).toMatchObject({ ok: true });
    });

    it('applies the event/fault type filter before formatting searchable rows', () => {
        const harness = createHarness();
        const result = createEventFaultSectionViewModel(harness.document, localisation(), 'event');
        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }

        expect(result.value).toMatchObject({
            allCount: { value: 2 },
            eventCount: { value: 1 },
            faultCount: { value: 1 },
            filter: 'event',
            totalCount: { value: 1 },
        });
        expect(result.value.records).toHaveLength(1);
        expect(result.value.records[0]).toMatchObject({
            code: harness.event.code,
            duration: {
                display: 'duration:1000',
                value: 1_000,
            },
            record: harness.event,
            recordKind: 'event',
        });
        expect(result.value.records[0]?.searchValues).toContain('/events/0');
        expect(result.value.records[0]?.searchValues).toContain(harness.event.code);
        expect(result.value.records[0]?.searchValues).toContain(harness.event.recordKind);
        expect(result.value.records).not.toContain(harness.fault);

        const eventRow = result.value.records[0];
        if (eventRow === undefined) {
            throw new TypeError('The event row view model must be present.');
        }

        const selection = new DocumentSelectionController(harness.document);
        selection.selectSection('eventsAndFaults');
        expect(selection.selectRecord(eventRow.record)).toMatchObject({ ok: true });
    });

    it('formats normalized vehicle associations and applies generation filters before mapping', () => {
        const harness = createHarness();
        const result = createAssociationSectionViewModel(harness.document, localisation('en', 'Europe/Berlin'), 'g1');
        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }

        expect(result.value).toMatchObject({
            allCount: { display: 'number:1', value: 1 },
            availableGenerations: ['g1'],
            documentKind: 'driverCard',
            filter: 'g1',
            generationCounts: {
                g1: { value: 1 },
                g2: { value: 0 },
                g2v2: { value: 0 },
            },
            timeZone: 'Europe/Berlin',
            totalCount: { value: 1 },
        });
        expect(result.value.records[0]).toMatchObject({
            distance: { display: 'number:280', value: 280 },
            duration: { display: 'duration:250', value: 250 },
            firstUse: {
                display: `date-time:Europe/Berlin:${String(harness.midnightUtc + 1_500)}`,
            },
            kind: 'vehicleUse',
            odometerBegin: { display: 'number:12340', value: 12_340 },
            record: harness.vehicleUse,
            registrationNumber: 'TEST-123',
        });
    });

    it('formats normalized locations after applying the record-type filter', () => {
        const harness = createHarness();
        const result = createLocationSectionViewModel(harness.document, localisation('en', 'Europe/Berlin'), 'place');
        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }

        expect(result.value).toMatchObject({
            allCount: { display: 'number:1', value: 1 },
            documentKind: 'driverCard',
            filter: 'place',
            hasGen2v2ParserLimitation: false,
            placeCount: { value: 1 },
            positionCount: { value: 0 },
            timeZone: 'Europe/Berlin',
            totalCount: { value: 1 },
        });
        expect(result.value.records[0]).toMatchObject({
            entryAt: {
                display: `date-time:Europe/Berlin:${String(harness.location.entryAt)}`,
            },
            entryType: 'beginManual',
            kind: 'dailyWorkPeriodPlace',
            record: harness.location,
            region: 'Madrid',
            source: {
                path: '/places/0',
            },
        });
    });

    it('maps vehicle-unit-use evidence into the association section with device facts', () => {
        const harness = createHarness();
        const usedAt = utc(harness.midnightUtc + 2_000);
        const vehicleUnitUse = createVehicleUnitUse({
            deviceID: 123_456,
            manufacturerCode: 2,
            source: cardSource('/vehicleUnits/0'),
            usedAt,
            vuSoftwareVersion: '0001',
        });
        const vehicleUnitHarness = createHarness([], null, [vehicleUnitUse]);
        const result = createAssociationSectionViewModel(vehicleUnitHarness.document, localisation('en', 'Europe/Berlin'), 'all');
        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }

        expect(result.value).toMatchObject({
            allCount: { display: 'number:2', value: 2 },
            availableGenerations: ['g1'],
            documentKind: 'driverCard',
            filter: 'all',
            generationCounts: {
                g1: { value: 2 },
                g2: { value: 0 },
                g2v2: { value: 0 },
            },
            totalCount: { value: 2 },
        });
        expect(result.value.records[1]).toMatchObject({
            deviceID: 123_456,
            kind: 'vehicleUnitUse',
            manufacturerCode: { display: 'number:2', value: 2 },
            record: vehicleUnitUse,
            usedAt: {
                display: `date-time:Europe/Berlin:${String(usedAt)}`,
            },
            vuSoftwareVersion: '0001',
        });
    });

    it('calculates duty shifts splitting on major rest periods and ignoring pure rest days', () => {
        const local = localisation('en', 'UTC');

        // Test 1: Empty or pure rest day
        expect(calculateDutyShifts([], local)).toEqual([]);

        // Test 2: Standard day with 1 shift (8h driving, 45m break, 2h driving)
        const harness = createHarness();
        const result = createActivitySectionViewModel(harness.document, local, EU_561_2006_STANDARD, NO_COMPLIANCE_EVALUATION);
        expect(result.ok).toBe(true);
        if (result.ok) {
            const day = result.value.days[0];
            if (day !== undefined) {
                const shifts = calculateDutyShifts(day.records, local);
                expect(shifts).toHaveLength(1);
                expect(shifts[0]?.drivingDuration.value).toBe(1_000);
            }
        }
    });

    it('calculates total shift distance using segmented positive deltas and vehicle swap guards', () => {
        const local = localisation('en', 'UTC');

        // Test 1: Empty records returns null
        expect(buildJourneySummary([], local)).toBeNull();

        // Test 2: Standard single-vehicle route (100,000 km to 100,350 km)
        const harness = createHarness();
        const locResult = createLocationSectionViewModel(harness.document, local, 'all');
        expect(locResult.ok).toBe(true);
        if (locResult.ok) {
            const summary = buildJourneySummary(locResult.value.records, local);
            expect(summary).not.toBeNull();
        }

        // Test 3: Multi-vehicle scenario with odometer rollback / swap
        // Truck A: 500,000 -> 500,200 (delta = 200 km)
        // Switch to Truck B: 120,000 -> 120,150 (delta = 150 km)
        // Expected total = 200 + 150 = 350 km, NOT 380,200 km
        const multiVehicleRecords = [
            odometerPlaceRecord(harness, 'beginManual', '08:00', 1_000, 500_000, '/places/0'),
            odometerPlaceRecord(harness, 'endManual', '11:00', 11_000, 500_200, '/places/1'),
            odometerPlaceRecord(harness, 'beginManual', '13:00', 18_000, 120_000, '/places/2'),
            odometerPlaceRecord(harness, 'endManual', '16:00', 28_000, 120_150, '/places/3'),
        ];

        const multiSummary = buildJourneySummary(multiVehicleRecords, local);
        expect(multiSummary).not.toBeNull();
        expect(multiSummary?.totalShiftKilometres?.value).toBe(350);
        // Backward jump between vehicles is excluded and flagged as an odometer discrepancy.
        expect(multiSummary?.hasOdometerDiscrepancy).toBe(true);
    });

    it('flags a discarded backward odometer jump instead of silently hiding it (VIEWER-05)', () => {
        const local = localisation('en', 'UTC');
        const harness = createHarness();

        // Backward jump (500,000 -> 100) is excluded and flagged as an odometer discrepancy.
        const records = [
            odometerPlaceRecord(harness, 'beginManual', '08:00', 1_000, 500_000, '/places/0'),
            odometerPlaceRecord(harness, 'endManual', '09:00', 2_000, 100, '/places/1'),
            odometerPlaceRecord(harness, 'endManual', '10:00', 3_000, 200, '/places/2'),
        ];

        const summary = buildJourneySummary(records, local);
        expect(summary).not.toBeNull();
        expect(summary?.totalShiftKilometres?.value).toBe(100);
        expect(summary?.hasOdometerDiscrepancy).toBe(true);
    });

    it('does not flag a discrepancy for a clean, continuous route', () => {
        const local = localisation('en', 'UTC');
        const harness = createHarness();

        const records = [
            odometerPlaceRecord(harness, 'beginManual', '08:00', 1_000, 100_000, '/places/0'),
            odometerPlaceRecord(harness, 'endManual', '17:00', 2_000, 100_350, '/places/1'),
        ];

        const summary = buildJourneySummary(records, local);
        expect(summary).not.toBeNull();
        expect(summary?.totalShiftKilometres?.value).toBe(350);
        expect(summary?.hasOdometerDiscrepancy).toBe(false);
    });

    it('groups location records into distinct shifts across multiple days', () => {
        const local = localisation('en', 'UTC');
        const harness = createHarness();

        // Empty returns empty array
        expect(buildJourneyShifts([], local)).toEqual([]);

        // Multi-day records spanning 2 distinct calendar days
        const day1Base = harness.midnightUtc;
        const day2Base = utc(harness.midnightUtc + 86_400_000);

        const multiDayRecords = [
            // Day 1 shift: 500,000 -> 500,200 km (200 km)
            {
                card: null,
                country: null,
                entryAt: { display: '08:00', value: utc(day1Base + 1_000) },
                entryType: 'beginManual' as const,
                generation: 'g1' as const,
                kind: 'dailyWorkPeriodPlace' as const,
                odometer: { display: 'number:500000', value: odo(500_000) },
                position: null,
                record: harness.location,
                region: 'BE',
                source: cardSource('/places/0'),
                timestamp: { display: '08:00', value: utc(day1Base + 1_000) },
            },
            {
                card: null,
                country: null,
                entryAt: { display: '17:00', value: utc(day1Base + 32_000) },
                entryType: 'endManual' as const,
                generation: 'g1' as const,
                kind: 'dailyWorkPeriodPlace' as const,
                odometer: { display: 'number:500200', value: odo(500_200) },
                position: null,
                record: harness.location,
                region: 'BE',
                source: cardSource('/places/1'),
                timestamp: { display: '17:00', value: utc(day1Base + 32_000) },
            },
            // Day 2 shift: 500,200 -> 500,600 km (400 km)
            {
                card: null,
                country: null,
                entryAt: { display: '08:00', value: utc(day2Base + 1_000) },
                entryType: 'beginManual' as const,
                generation: 'g1' as const,
                kind: 'dailyWorkPeriodPlace' as const,
                odometer: { display: 'number:500200', value: odo(500_200) },
                position: null,
                record: harness.location,
                region: 'NL',
                source: cardSource('/places/2'),
                timestamp: { display: '08:00', value: utc(day2Base + 1_000) },
            },
            {
                card: null,
                country: null,
                entryAt: { display: '16:30', value: utc(day2Base + 30_000) },
                entryType: 'endManual' as const,
                generation: 'g1' as const,
                kind: 'dailyWorkPeriodPlace' as const,
                odometer: { display: 'number:500600', value: odo(500_600) },
                position: null,
                record: harness.location,
                region: 'NL',
                source: cardSource('/places/3'),
                timestamp: { display: '16:30', value: utc(day2Base + 30_000) },
            },
        ];

        const shifts = buildJourneyShifts(multiDayRecords, local);
        expect(shifts).toHaveLength(2);

        const shift1 = shifts[0];
        const shift2 = shifts[1];
        expect(shift1).toBeDefined();
        expect(shift2).toBeDefined();

        if (shift1 !== undefined && shift2 !== undefined) {
            expect(shift1.dayUtc).toBe(day1Base);
            expect(shift1.stopCount).toBe(2);
            expect(shift1.totalKilometres?.value).toBe(200);

            expect(shift2.dayUtc).toBe(day2Base);
            expect(shift2.stopCount).toBe(2);
            expect(shift2.totalKilometres?.value).toBe(400);
        }
    });

    it('keeps a shift that crosses midnight in a single journey card', () => {
        const local = localisation('en', 'UTC');
        const harness = createHarness();
        const day1Base = harness.midnightUtc;
        const day2Base = utc(harness.midnightUtc + 86_400_000);

        const shifts = buildJourneyShifts(
            [
                journeyPlaceRecord('beginManual', utc(day1Base + 22 * 3_600_000), 500_000, '/places/0', harness.location),
                journeyPlaceRecord('endManual', utc(day2Base + 6 * 3_600_000), 500_300, '/places/1', harness.location),
            ],
            local,
        );

        expect(shifts).toHaveLength(1);
        const shift = shifts[0];
        expect(shift).toBeDefined();
        if (shift !== undefined) {
            expect(shift.dayUtc).toBe(day1Base);
            expect(shift.stopCount).toBe(2);
            expect(shift.totalKilometres?.value).toBe(300);
            expect(shift.summary.legs).toHaveLength(2);
            expect(journeyShiftBelongsToUtcDay(shift, day1Base)).toBe(true);
            expect(journeyShiftBelongsToUtcDay(shift, day2Base)).toBe(false);
        }
    });

    it('splits two distinct shifts recorded on the same calendar day', () => {
        const local = localisation('en', 'UTC');
        const harness = createHarness();
        const base = harness.midnightUtc;

        const shifts = buildJourneyShifts(
            [
                journeyPlaceRecord('beginManual', utc(base + 6 * 3_600_000), 100_000, '/places/0', harness.location),
                journeyPlaceRecord('endManual', utc(base + 12 * 3_600_000), 100_250, '/places/1', harness.location),
                journeyPlaceRecord('beginManual', utc(base + 14 * 3_600_000), 100_250, '/places/2', harness.location),
                journeyPlaceRecord('endManual', utc(base + 20 * 3_600_000), 100_600, '/places/3', harness.location),
            ],
            local,
        );

        expect(shifts).toHaveLength(2);
        const shift1 = shifts[0];
        const shift2 = shifts[1];
        expect(shift1).toBeDefined();
        expect(shift2).toBeDefined();
        if (shift1 !== undefined && shift2 !== undefined) {
            expect(shift1.dayUtc).toBe(base);
            expect(shift1.stopCount).toBe(2);
            expect(shift1.totalKilometres?.value).toBe(250);
            expect(shift2.dayUtc).toBe(base);
            expect(shift2.stopCount).toBe(2);
            expect(shift2.totalKilometres?.value).toBe(350);
        }
    });

    it('closes an open shift when a new begin record arrives before an end', () => {
        const local = localisation('en', 'UTC');
        const harness = createHarness();
        const base = harness.midnightUtc;

        const shifts = buildJourneyShifts(
            [
                journeyPlaceRecord('beginManual', utc(base + 8 * 3_600_000), 10_000, '/places/0', harness.location),
                journeyGnssRecord(utc(base + 9 * 3_600_000), 10_100, '/places/1'),
                journeyPlaceRecord('beginManual', utc(base + 10 * 3_600_000), 10_200, '/places/2', harness.location),
                journeyPlaceRecord('endManual', utc(base + 12 * 3_600_000), 10_400, '/places/3', harness.location),
            ],
            local,
        );

        expect(shifts).toHaveLength(2);
        const shift1 = shifts[0];
        const shift2 = shifts[1];
        expect(shift1).toBeDefined();
        expect(shift2).toBeDefined();
        if (shift1 !== undefined && shift2 !== undefined) {
            // The first shift closes at the new begin: begin + GNSS leg, no end.
            expect(shift1.stopCount).toBe(1);
            expect(shift1.summary.legs).toHaveLength(2);
            expect(shift1.totalKilometres?.value).toBe(100);
            expect(shift2.stopCount).toBe(2);
            expect(shift2.totalKilometres?.value).toBe(200);
        }
    });

    it('treats an end record without a preceding begin as its own shift', () => {
        const local = localisation('en', 'UTC');
        const harness = createHarness();
        const base = harness.midnightUtc;

        const shifts = buildJourneyShifts(
            [journeyPlaceRecord('endManual', utc(base + 6 * 3_600_000), 500_200, '/places/0', harness.location)],
            local,
        );

        expect(shifts).toHaveLength(1);
        const shift = shifts[0];
        expect(shift).toBeDefined();
        if (shift !== undefined) {
            expect(shift.dayUtc).toBe(base);
            expect(shift.stopCount).toBe(1);
            expect(shift.summary.legs).toHaveLength(1);
            expect(shift.totalKilometres).toBeNull();
        }
    });

    it('keeps a trailing begin without an end until the last record', () => {
        const local = localisation('en', 'UTC');
        const harness = createHarness();
        const base = harness.midnightUtc;

        const shifts = buildJourneyShifts(
            [
                journeyPlaceRecord('beginManual', utc(base + 22 * 3_600_000), 500_000, '/places/0', harness.location),
                journeyGnssRecord(utc(base + 23 * 3_600_000), 500_050, '/places/1'),
            ],
            local,
        );

        expect(shifts).toHaveLength(1);
        const shift = shifts[0];
        expect(shift).toBeDefined();
        if (shift !== undefined) {
            expect(shift.dayUtc).toBe(base);
            expect(shift.stopCount).toBe(1);
            expect(shift.summary.legs).toHaveLength(2);
            expect(shift.totalKilometres?.value).toBe(50);
        }
    });

    it('excludes records outside any begin/end boundaries from journeys', () => {
        const local = localisation('en', 'UTC');
        const harness = createHarness();
        const base = harness.midnightUtc;

        const shifts = buildJourneyShifts(
            [
                journeyPlaceRecord('beginManual', utc(base + 8 * 3_600_000), 200_000, '/places/0', harness.location),
                journeyPlaceRecord('endManual', utc(base + 12 * 3_600_000), 200_200, '/places/1', harness.location),
                journeyGnssRecord(utc(base + 14 * 3_600_000), 200_210, '/places/2'),
                journeyPlaceRecord('beginManual', utc(base + 15 * 3_600_000), 200_210, '/places/3', harness.location),
                journeyPlaceRecord('endManual', utc(base + 18 * 3_600_000), 200_300, '/places/4', harness.location),
            ],
            local,
        );

        expect(shifts).toHaveLength(2);
        const shift1 = shifts[0];
        const shift2 = shifts[1];
        expect(shift1).toBeDefined();
        expect(shift2).toBeDefined();
        if (shift1 !== undefined && shift2 !== undefined) {
            expect(shift1.summary.legs).toHaveLength(2);
            expect(shift1.totalKilometres?.value).toBe(200);
            expect(shift2.summary.legs).toHaveLength(2);
            expect(shift2.totalKilometres?.value).toBe(90);
        }
    });

    it('canonicalizes mirrored Gen1/Gen2 daily work periods into one shift per physical duty shift', () => {
        const local = localisation('en', 'UTC');
        const harness = createHarness();
        const base = harness.midnightUtc;
        const beginAt = utc(base + 8 * 3_600_000);
        const gnssAt = utc(base + 10 * 3_600_000);
        const endAt = utc(base + 12 * 3_600_000);

        // Combined cards repeat every daily-work-period event in the Gen1 and
        // Gen2 applications with identical timestamps.
        const shifts = buildJourneyShifts(
            [
                journeyPlaceRecord(
                    'beginManual',
                    beginAt,
                    500_000,
                    '/cardDataResponses/gen1/places/placeRecords/0',
                    harness.location,
                    'g1',
                ),
                journeyPlaceRecord(
                    'beginManual',
                    beginAt,
                    500_000,
                    '/cardDataResponses/gen2/places/placeRecords/0',
                    harness.location,
                    'g2',
                ),
                journeyGnssRecord(gnssAt, 500_100, '/cardDataResponses/gen2/gnssPlaces/positions/0'),
                journeyPlaceRecord(
                    'endManual',
                    endAt,
                    500_300,
                    '/cardDataResponses/gen1/places/placeRecords/1',
                    harness.location,
                    'g1',
                ),
                journeyPlaceRecord(
                    'endManual',
                    endAt,
                    500_300,
                    '/cardDataResponses/gen2/places/placeRecords/1',
                    harness.location,
                    'g2',
                ),
            ],
            local,
        );

        expect(shifts).toHaveLength(1);
        const shift = shifts[0];
        expect(shift).toBeDefined();
        if (shift !== undefined) {
            // One journey card with start, GNSS, and end legs from the Gen2
            // application; the Gen1 mirrors are not duplicated.
            expect(shift.summary.legs).toHaveLength(3);
            expect(shift.summary.legs[0]?.id).toBe('dailyWorkPeriodPlace-/cardDataResponses/gen2/places/placeRecords/0');
            expect(shift.summary.legs[2]?.id).toBe('dailyWorkPeriodPlace-/cardDataResponses/gen2/places/placeRecords/1');
            expect(shift.id).toBe('shift-/cardDataResponses/gen2/places/placeRecords/0');
            expect(shift.dayUtc).toBe(base);
            expect(shift.stopCount).toBe(2);
            expect(shift.totalKilometres?.value).toBe(300);
        }
    });

    it('keeps unique journey ids when mirrored records share identical timestamps', () => {
        const local = localisation('en', 'UTC');
        const harness = createHarness();
        const base = harness.midnightUtc;
        const beginAt = utc(base + 8 * 3_600_000);
        const endAt = utc(base + 12 * 3_600_000);

        const shifts = buildJourneyShifts(
            [
                journeyPlaceRecord(
                    'beginManual',
                    beginAt,
                    500_000,
                    '/cardDataResponses/gen1/places/placeRecords/0',
                    harness.location,
                    'g1',
                ),
                journeyPlaceRecord(
                    'beginManual',
                    beginAt,
                    500_000,
                    '/cardDataResponses/gen2/places/placeRecords/0',
                    harness.location,
                    'g2',
                ),
                journeyPlaceRecord(
                    'endManual',
                    endAt,
                    500_300,
                    '/cardDataResponses/gen1/places/placeRecords/1',
                    harness.location,
                    'g1',
                ),
                journeyPlaceRecord(
                    'endManual',
                    endAt,
                    500_300,
                    '/cardDataResponses/gen2/places/placeRecords/1',
                    harness.location,
                    'g2',
                ),
            ],
            local,
        );

        const shiftIds = shifts.map((s) => s.id);
        const legIds = shifts.flatMap((s) => s.summary.legs.map((l) => l.id));
        expect(new Set(shiftIds).size).toBe(shiftIds.length);
        expect(new Set(legIds).size).toBe(legIds.length);
    });

    it('falls back to UTC-day journeys when the document has no daily work periods', () => {
        const local = localisation('en', 'UTC');
        const harness = createHarness();
        const day1Base = harness.midnightUtc;
        const day2Base = utc(harness.midnightUtc + 86_400_000);

        const shifts = buildJourneyShifts(
            [
                journeyBorderRecord(utc(day1Base + 11 * 3_600_000), 500_000, '/places/0'),
                journeyBorderRecord(utc(day2Base + 11 * 3_600_000), 500_400, '/places/1'),
            ],
            local,
        );

        expect(shifts).toHaveLength(2);
        const shift1 = shifts[0];
        const shift2 = shifts[1];
        expect(shift1).toBeDefined();
        expect(shift2).toBeDefined();
        if (shift1 !== undefined && shift2 !== undefined) {
            expect(shift1.dayUtc).toBe(day1Base);
            expect(shift1.stopCount).toBe(1);
            expect(shift2.dayUtc).toBe(day2Base);
            expect(shift2.stopCount).toBe(1);
        }
    });

    it('maps journey legs with coordinates to map route waypoints', () => {
        const local = localisation('en', 'UTC');
        const harness = createHarness();
        const lat1 = 52.52;
        const lon1 = 13.405;
        const lat2 = 50.85;
        const lon2 = 4.35;
        if (!isLatitude(lat1) || !isLongitude(lon1) || !isLatitude(lat2) || !isLongitude(lon2)) {
            throw new TypeError('Invalid test coordinates');
        }

        const acc = 2;
        if (!isGnssAccuracyIndicator(acc)) {
            throw new TypeError('Invalid test parameters');
        }

        const gnss1 = createGnssPositionEvidence({
            accuracy: acc,
            authenticationStatus: null,
            coordinates: { latitude: lat1, longitude: lon1 },
            determinedAt: utc(harness.midnightUtc + 8 * 3_600_000),
        });
        const gnss2 = createGnssPositionEvidence({
            accuracy: acc,
            authenticationStatus: null,
            coordinates: { latitude: lat2, longitude: lon2 },
            determinedAt: utc(harness.midnightUtc + 17 * 3_600_000),
        });

        const { rec1, rec2 } = journeyPlaceLegPair(harness, {
            position1: gnssPositionEvidenceViewModel(lat1, lon1, '08:00', utc(harness.midnightUtc + 8 * 3_600_000)),
            position2: gnssPositionEvidenceViewModel(lat2, lon2, '17:00', utc(harness.midnightUtc + 17 * 3_600_000)),
            recordPosition1: gnss1,
            recordPosition2: gnss2,
        });

        const shifts = buildJourneyShifts([rec1, rec2], local);

        expect(shifts).toHaveLength(1);
        const shift = shifts[0];
        expect(shift).toBeDefined();
        if (shift !== undefined) {
            expect(shift.summary.hasCoordinates).toBe(true);
            expect(shift.summary.legs[0]?.coordinates?.latitude).toBe(lat1);
            expect(shift.summary.legs[0]?.coordinates?.longitude).toBe(lon1);

            const mapRoute = mapJourneyLegsToMapRoute(shift.summary.legs, testLegLabel);
            expect(mapRoute.waypoints).toHaveLength(2);
            expect(mapRoute.waypoints[0]?.markerType).toBe('start');
            expect(mapRoute.waypoints[0]?.latitude).toBe(lat1);
            expect(mapRoute.waypoints[0]?.longitude).toBe(lon1);
            expect(mapRoute.waypoints[0]?.label).toBe('LABEL:start');
            expect(mapRoute.waypoints[1]?.markerType).toBe('end');
            expect(mapRoute.waypoints[1]?.latitude).toBe(lat2);
            expect(mapRoute.waypoints[1]?.longitude).toBe(lon2);
            expect(mapRoute.waypoints[1]?.label).toBe('LABEL:end');
        }
    });

    it('does not invent a map position for a country-only record with no GNSS fix (VIEWER-04)', () => {
        const local = localisation('en', 'UTC');
        const harness = createHarness();

        const { rec1, rec2 } = journeyPlaceLegPair(harness, {
            position1: null,
            position2: null,
            recordPosition1: null,
            recordPosition2: null,
        });

        const shifts = buildJourneyShifts([rec1, rec2], local);

        expect(shifts).toHaveLength(1);
        const shift = shifts[0];
        expect(shift).toBeDefined();
        if (shift !== undefined) {
            // No recorded GNSS evidence anywhere in this shift - a country
            // code alone must not be plotted as if it were one.
            expect(shift.summary.hasCoordinates).toBe(false);
            expect(shift.summary.legs[0]?.coordinates).toBeNull();
            expect(shift.summary.legs[1]?.coordinates).toBeNull();
            // The country label itself is still carried as evidence.
            expect(shift.summary.legs[0]?.country).toBe('D');

            const mapRoute = mapJourneyLegsToMapRoute(shift.summary.legs, testLegLabel);
            expect(mapRoute.waypoints).toHaveLength(0);
        }
    });

    it('resolves an approximate marker for a country-only leg when a resolver is supplied (VIEWER-04 follow-up)', () => {
        const local = localisation('en', 'UTC');
        const harness = createHarness();

        const { rec1, rec2 } = journeyPlaceLegPair(harness, {
            position1: null,
            position2: null,
            recordPosition1: null,
            recordPosition2: null,
        });

        const shifts = buildJourneyShifts([rec1, rec2], local);
        const shift = shifts[0];
        expect(shift).toBeDefined();
        if (shift === undefined) {
            return;
        }

        const resolveCountryPosition = vi.fn((leg: IJourneyLegViewModel): { latitude: Latitude; longitude: Longitude } => ({
            latitude: latitude(leg.type === 'start' ? 50.0 : 51.0),
            longitude: longitude(leg.type === 'start' ? 8.0 : 9.0),
        }));

        const mapRoute = mapJourneyLegsToMapRoute(shift.summary.legs, testLegLabel, {
            badge: 'Approximate',
            notice: 'Approximate position - country recorded, no GPS fix available.',
            resolveCountryPosition,
        });

        expect(mapRoute.waypoints).toHaveLength(2);
        expect(mapRoute.waypoints[0]).toMatchObject({
            latitude: 50.0,
            longitude: 8.0,
            markerType: 'approximate',
        });
        expect(mapRoute.waypoints[1]).toMatchObject({
            latitude: 51.0,
            longitude: 9.0,
            markerType: 'approximate',
        });
        expect(mapRoute.waypoints[0]?.subtitle).toContain('Approximate');
        expect(mapRoute.waypoints[0]?.tooltip).toBe('Approximate position - country recorded, no GPS fix available.');
        // The resolver is only consulted for legs with no real coordinates.
        expect(resolveCountryPosition).toHaveBeenCalledTimes(2);
    });

    it('never marks a real GNSS leg as approximate, even when a resolver is supplied', () => {
        const local = localisation('en', 'UTC');
        const lat1 = 52.52;
        const lon1 = 13.405;
        if (!isLatitude(lat1) || !isLongitude(lon1)) {
            throw new TypeError('Invalid test coordinates');
        }
        const harness = createHarness();
        const gnss1 = createGnssPositionEvidence({
            accuracy: gnssAccuracy(2),
            authenticationStatus: null,
            coordinates: { latitude: lat1, longitude: lon1 },
            determinedAt: utc(harness.midnightUtc + 8 * 3_600_000),
        });

        const { rec1, rec2 } = journeyPlaceLegPair(harness, {
            position1: gnssPositionEvidenceViewModel(lat1, lon1, '08:00', utc(harness.midnightUtc + 8 * 3_600_000)),
            position2: null,
            recordPosition1: gnss1,
            recordPosition2: null,
        });

        const shifts = buildJourneyShifts([rec1, rec2], local);
        const shift = shifts[0];
        expect(shift).toBeDefined();
        if (shift === undefined) {
            return;
        }

        const mapRoute = mapJourneyLegsToMapRoute(shift.summary.legs, testLegLabel, {
            badge: 'Approximate',
            notice: 'notice',
            resolveCountryPosition: () => ({ latitude: latitude(50), longitude: longitude(8) }),
        });

        expect(mapRoute.waypoints).toHaveLength(2);
        const gnssWaypoint = mapRoute.waypoints.find((wp) => wp.latitude === lat1);
        expect(gnssWaypoint?.markerType).not.toBe('approximate');
        const approximateWaypoint = mapRoute.waypoints.find((wp) => wp.markerType === 'approximate');
        expect(approximateWaypoint).toBeDefined();
    });
});
