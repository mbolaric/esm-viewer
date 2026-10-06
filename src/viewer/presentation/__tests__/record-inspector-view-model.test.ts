import {
    createAccumulatedDrivingPosition,
    createCardChipTechnicalData,
    createCardUse,
    createDailyWorkPeriodPlace,
    createDetailedSpeedSample,
    createGnssPositionEvidence,
    getUtcDuration,
    createRecordedActivityInterval,
    createSourceReference,
    createTachographEvent,
    createVehicleUnitUse,
    createVehicleUse,
    isCardNumber,
    isGnssAccuracyIndicator,
    isJsonPointer,
    isLatitude,
    isLongitude,
    isSpeedKilometresPerHour,
    isTechnicalHexIdentifier,
    isUtcTimestamp,
    isVehicleRegistrationNumber,
    type ActivityInterval,
    type CardNumber,
    type DurationMilliseconds,
    type GnssAccuracyIndicator,
    type IDetailedSpeedSample,
    type IDriverIdentity,
    type ISourceReference,
    type IVehicleIdentity,
    type Latitude,
    type Longitude,
    type TachographAssociation,
    type TachographEventFault,
    type TachographLocationRecord,
    type TachographTechnicalRecord,
    type TechnicalHexIdentifier,
    type UtcTimestamp,
    type VehicleRegistrationNumber,
} from '#viewer-domain';
import { describe, expect, it } from 'vitest';

import {
    createActivityInfringementInspectorViewModel,
    createRecordInspectorViewModel,
    type IActivityInfringementPinViewModel,
    type IRecordInspectorSources,
} from '../index.js';
import type {
    AssociationRecordViewModel,
    IActivityRecordViewModel,
    IEventFaultRecordViewModel,
    IFormattedValue,
    IdentityViewModel,
    LocationRecordViewModel,
} from '../view-models/document-view-model.js';
import type { ISpeedSampleViewModel } from '../view-models/speed-view-model.js';
import type { ITechnicalRecordViewModel } from '../view-models/technical-view-model.js';
import { fixtureSingleDriverCrew } from '#testing';

function source<TDocumentKind extends 'driverCard' | 'vehicleUnit'>(
    documentKind: TDocumentKind,
    path: string,
): ISourceReference<'g2v2', TDocumentKind> {
    if (!isJsonPointer(path)) {
        throw new TypeError('The inspector fixture source path must be valid.');
    }
    return createSourceReference(documentKind, 'g2v2', path);
}

function timestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The inspector fixture timestamp must be valid.');
    }
    return value;
}

function duration(start: UtcTimestamp, end: UtcTimestamp): DurationMilliseconds {
    const value = getUtcDuration(start, end);
    if (value === null) {
        throw new TypeError('The inspector fixture duration must be valid.');
    }
    return value;
}

function formatted<TValue>(value: TValue, display: string): IFormattedValue<TValue> {
    return {
        display,
        value,
    };
}

function cardNumber(value: string): CardNumber {
    if (!isCardNumber(value)) {
        throw new TypeError('The inspector fixture card number must be valid.');
    }
    return value;
}

function registrationNumber(value: string): VehicleRegistrationNumber {
    if (!isVehicleRegistrationNumber(value)) {
        throw new TypeError('The inspector fixture registration number must be valid.');
    }
    return value;
}

function hexIdentifier(value: string): TechnicalHexIdentifier {
    if (!isTechnicalHexIdentifier(value, 4)) {
        throw new TypeError('The inspector fixture hex identifier must be valid.');
    }
    return value;
}

function accuracy(value: number): GnssAccuracyIndicator {
    if (!isGnssAccuracyIndicator(value)) {
        throw new TypeError('The inspector fixture GNSS accuracy must be valid.');
    }
    return value;
}

function latitude(value: number): Latitude {
    if (!isLatitude(value)) {
        throw new TypeError('The inspector fixture latitude must be valid.');
    }
    return value;
}

function longitude(value: number): Longitude {
    if (!isLongitude(value)) {
        throw new TypeError('The inspector fixture longitude must be valid.');
    }
    return value;
}

function speedSampleAt(path: string, recordedAtMs: number): IDetailedSpeedSample {
    const speedKilometresPerHour = 84;
    if (!isSpeedKilometresPerHour(speedKilometresPerHour)) {
        throw new TypeError('The inspector fixture speed must be valid.');
    }
    return createDetailedSpeedSample({
        recordedAt: timestamp(recordedAtMs),
        source: source('vehicleUnit', path),
        speedKilometresPerHour,
    });
}

function speedSample(): IDetailedSpeedSample {
    return speedSampleAt('/vuDetailedSpeedBlocks/0/samples/0', Date.UTC(2026, 5, 18, 10));
}

function recordedActivity(): ActivityInterval {
    const interval = createRecordedActivityInterval(
        'driving',
        timestamp(Date.UTC(2026, 5, 18, 8, 42)),
        timestamp(Date.UTC(2026, 5, 18, 10, 16)),
        source('driverCard', '/cardActivities/0'),
        fixtureSingleDriverCrew,
    );
    if (interval === null) {
        throw new TypeError('The inspector fixture activity must be valid.');
    }
    return interval;
}

function activityRow(record: ActivityInterval): IActivityRecordViewModel {
    const recorded = record.origin === 'recorded';
    return {
        activity: record.activity,
        duration: formatted(duration(record.start, record.end), '1 hr 34 min'),
        end: formatted(record.end, '10:16'),
        generation: recorded ? record.source.generation : 'g2v2',
        id: 'activity:0',
        origin: record.origin,
        record,
        searchValues: [],
        source: recorded ? record.source : null,
        start: formatted(record.start, '08:42'),
        timelineEnd: duration(record.start, record.end),
        timelineStart: duration(record.start, record.start),
    };
}

function eventRecord(): TachographEventFault {
    const record = createTachographEvent({
        code: 'overSpeeding',
        end: timestamp(Date.UTC(2026, 5, 18, 10, 30)),
        recordKind: 'event',
        recordPurpose: 'active',
        registrationMemberState: null,
        registrationNumber: null,
        similarOccurrences: 2,
        source: source('vehicleUnit', '/vuCardIWRecords/0/events/0'),
        start: timestamp(Date.UTC(2026, 5, 18, 10)),
    });
    if (record === null) {
        throw new TypeError('The inspector fixture event must be valid.');
    }
    return record;
}

function eventRow(record: TachographEventFault): IEventFaultRecordViewModel {
    return {
        code: record.code,
        duration: formatted(duration(record.start, record.end ?? record.start), '30 min'),
        end: formatted(record.end ?? record.start, '10:30'),
        generation: record.source.generation,
        record,
        recordKind: record.recordKind,
        recordPurpose: record.recordPurpose,
        registrationMemberState: record.registrationMemberState,
        registrationNumber: record.registrationNumber,
        searchValues: [],
        securityCategory: 'operationalNotice',
        similarOccurrences: formatted(2, '2'),
        source: record.source,
        start: formatted(record.start, '10:00'),
    };
}

function cardUse(): Extract<TachographAssociation, { readonly kind: 'cardUse' }> {
    const record = createCardUse({
        cardExpiryDate: null,
        cardNumber: null,
        cardType: 'driverCard',
        firstNames: null,
        insertion: timestamp(Date.UTC(2026, 5, 18, 6)),
        issuingMemberState: null,
        odometerAtInsertion: null,
        odometerAtWithdrawal: null,
        slot: 'Driver',
        source: source('vehicleUnit', '/vuCardIWRecords/0'),
        surname: null,
        withdrawal: null,
    });
    if (record === null) {
        throw new TypeError('The inspector fixture card use must be valid.');
    }
    return record;
}

function cardUseRow(record: Extract<TachographAssociation, { readonly kind: 'cardUse' }>): AssociationRecordViewModel {
    return {
        cardExpiryDate: null,
        cardIdentityDisplay: null,
        cardNumber: null,
        cardType: record.cardType,
        duration: null,
        endTimestamp: null,
        firstNames: null,
        generation: record.source.generation,
        insertion: formatted(record.insertion, '08:00'),
        issuingMemberState: null,
        kind: 'cardUse',
        odometerAtInsertion: null,
        odometerAtWithdrawal: null,
        record,
        slot: record.slot,
        source: record.source,
        startTimestamp: formatted(record.insertion, '08:00'),
        surname: null,
        withdrawal: null,
    };
}

function vehicleUse(): Extract<TachographAssociation, { readonly kind: 'vehicleUse' }> {
    const record = createVehicleUse({
        firstUse: timestamp(Date.UTC(2026, 5, 18, 6)),
        lastUse: timestamp(Date.UTC(2026, 5, 18, 10)),
        odometerBegin: null,
        odometerEnd: null,
        registrationMemberState: null,
        registrationNumber: registrationNumber('ABC-123'),
        source: source('driverCard', '/cardVehicleRecords/0'),
        vehicleIdentificationNumber: null,
    });
    if (record === null) {
        throw new TypeError('The inspector fixture vehicle use must be valid.');
    }
    return record;
}

function vehicleUseRow(record: Extract<TachographAssociation, { readonly kind: 'vehicleUse' }>): AssociationRecordViewModel {
    if (record.lastUse === null) {
        throw new TypeError('The inspector fixture vehicle use row must have a closed session.');
    }
    const lastUse = record.lastUse;
    return {
        distance: null,
        duration: formatted(duration(record.firstUse, lastUse), '4 hr'),
        endTimestamp: formatted(lastUse, '12:00'),
        firstUse: formatted(record.firstUse, '08:00'),
        generation: record.source.generation,
        kind: 'vehicleUse',
        lastUse: formatted(lastUse, '12:00'),
        odometerBegin: null,
        odometerEnd: null,
        record,
        registrationMemberState: null,
        registrationNumber: record.registrationNumber,
        source: record.source,
        startTimestamp: formatted(record.firstUse, '08:00'),
        vehicleIdentificationNumber: null,
    };
}

function vehicleUnitUse(): Extract<TachographAssociation, { readonly kind: 'vehicleUnitUse' }> {
    return createVehicleUnitUse({
        deviceID: 123_456,
        manufacturerCode: 2,
        source: source('driverCard', '/cardVehicleUnitRecords/0'),
        usedAt: timestamp(Date.UTC(2026, 5, 18, 6)),
        vuSoftwareVersion: '0001',
    });
}

function vehicleUnitUseRow(
    record: Extract<TachographAssociation, { readonly kind: 'vehicleUnitUse' }>,
): AssociationRecordViewModel {
    return {
        deviceID: record.deviceID,
        endTimestamp: formatted(record.usedAt, '08:00'),
        generation: record.source.generation,
        kind: 'vehicleUnitUse',
        manufacturerCode: formatted(record.manufacturerCode, '2'),
        record,
        source: record.source,
        startTimestamp: formatted(record.usedAt, '08:00'),
        usedAt: formatted(record.usedAt, '08:00'),
        vuSoftwareVersion: record.vuSoftwareVersion,
    };
}

function placeRecord(): Extract<TachographLocationRecord, { readonly kind: 'dailyWorkPeriodPlace' }> {
    return createDailyWorkPeriodPlace({
        card: null,
        country: null,
        entryAt: timestamp(Date.UTC(2026, 5, 18, 8)),
        entryType: 'endCardWithdrawal',
        odometer: null,
        position: null,
        region: null,
        source: source('driverCard', '/cardPlaces/0'),
    });
}

function placeRow(record: Extract<TachographLocationRecord, { readonly kind: 'dailyWorkPeriodPlace' }>): LocationRecordViewModel {
    return {
        card: record.card,
        country: record.country,
        entryAt: formatted(record.entryAt, '10:00'),
        entryType: record.entryType,
        generation: record.source.generation,
        kind: 'dailyWorkPeriodPlace',
        odometer: null,
        position: null,
        record,
        region: record.region,
        source: record.source,
        timestamp: formatted(record.entryAt, '10:00'),
    };
}

function positionRecord(): Extract<TachographLocationRecord, { readonly kind: 'accumulatedDrivingPosition' }> {
    const position = createGnssPositionEvidence({
        accuracy: accuracy(10),
        authenticationStatus: null,
        coordinates: {
            latitude: latitude(45.1),
            longitude: longitude(13.2),
        },
        determinedAt: timestamp(Date.UTC(2026, 5, 18, 8)),
    });
    return createAccumulatedDrivingPosition({
        coDriverCard: null,
        driverCard: null,
        odometer: null,
        position,
        recordedAt: timestamp(Date.UTC(2026, 5, 18, 8)),
        source: source('driverCard', '/cardPlaces/1'),
    });
}

function positionRow(
    record: Extract<TachographLocationRecord, { readonly kind: 'accumulatedDrivingPosition' }>,
): LocationRecordViewModel {
    const position = record.position;
    if (position === null) {
        throw new TypeError('The inspector accumulated-position fixture needs a recorded position.');
    }
    return {
        coDriverCard: record.coDriverCard,
        driverCard: record.driverCard,
        generation: record.source.generation,
        kind: 'accumulatedDrivingPosition',
        odometer: null,
        position: {
            accuracy: formatted(position.accuracy, '10'),
            authenticationStatus: null,
            coordinateCopyValue: '45.100000, 13.200000',
            coordinateDisplayValue: '45.100000, 13.200000',
            determinedAt: formatted(position.determinedAt, '10:00'),
            latitude: formatted(position.coordinates.latitude, '45.100000'),
            longitude: formatted(position.coordinates.longitude, '13.200000'),
        },
        record,
        recordedAt: formatted(record.recordedAt, '10:00'),
        source: record.source,
        timestamp: formatted(record.recordedAt, '10:00'),
    };
}

function driverIdentity(): IDriverIdentity {
    return {
        cardExpiryDate: null,
        cardHolderBirthDate: null,
        cardIssueDate: null,
        cardValidityBegin: null,
        cardIssuingAuthorityName: null,
        cardNumber: cardNumber('0000000000000000'),
        firstNames: null,
        issuingMemberState: null,
        kind: 'driver',
        source: source('driverCard', '/cardIdentification'),
        surname: null,
    };
}

function driverIdentityRow(identity: IDriverIdentity): IdentityViewModel {
    return {
        cardExpiryDate: null,
        cardHolderBirthDate: null,
        cardIssueDate: null,
        cardIssuingAuthorityName: null,
        cardValidityBegin: null,
        identity,
        kind: 'driver',
        licenceIssuingAuthority: null,
        licenceIssuingMemberState: null,
        licenceNumber: null,
    };
}

function vehicleIdentity(): IVehicleIdentity {
    return {
        kind: 'vehicle',
        registrationMemberState: null,
        registrationNumber: registrationNumber('ABC-123'),
        source: source('vehicleUnit', '/vuIdentification'),
        vehicleIdentificationNumber: null,
    };
}

function vehicleIdentityRow(identity: IVehicleIdentity): IdentityViewModel {
    return {
        identity,
        kind: 'vehicle',
        registrationMemberState: null,
        registrationNumber: identity.registrationNumber,
        vehicleIdentificationNumber: null,
    };
}

function technicalRecord(): TachographTechnicalRecord {
    return createCardChipTechnicalData({
        manufacturingReference: hexIdentifier('12345678'),
        serialNumber: hexIdentifier('DEADBEEF'),
        source: source('driverCard', '/cardChipIdentification'),
    });
}

function technicalRow(record: TachographTechnicalRecord): ITechnicalRecordViewModel {
    return {
        category: 'identification',
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
        ],
        generation: record.generation,
        kind: 'chip',
        record,
        recordedAt: null,
        recordedAtTimestamp: null,
        source: record.source,
    };
}

function speedRow(record: IDetailedSpeedSample): ISpeedSampleViewModel {
    return {
        generation: record.source.generation,
        id: `speed:${record.source.path}`,
        record,
        recordedAt: formatted(record.recordedAt, '12:00'),
        source: record.source,
        speed: formatted(record.speedKilometresPerHour, '84'),
    };
}

function emptySources(): IRecordInspectorSources {
    return {
        activityRows: [],
        associationRows: [],
        eventFaultRows: [],
        identityRows: [],
        locationRows: [],
        speedRows: [],
        technicalRows: [],
    };
}

describe('createRecordInspectorViewModel', () => {
    it('maps a recorded activity to friendly rows and a canonical source', () => {
        const record = recordedActivity();
        const viewModel = createRecordInspectorViewModel(record, 'activities', 'driverCard', {
            ...emptySources(),
            activityRows: [activityRow(record)],
        });

        expect(viewModel.heading.emphasis).toEqual({ kind: 'activity', value: 'driving' });
        expect(viewModel.heading.detail).toBe('08:42–10:16');
        expect(viewModel.sourcePath).toBe('/cardActivities/0');
        expect(viewModel.generation).toBe('g2v2');
        expect(viewModel.rows.map((row) => row.labelKey)).toEqual(['activity', 'start', 'end', 'duration', 'origin']);
    });

    it('keeps the source absent for a viewer-inferred activity gap', () => {
        const record = recordedActivity();
        const inferred: ActivityInterval = {
            activity: 'unknown',
            crewPresence: 'unknown',
            end: record.end,
            origin: 'inferredGap',
            slot: 'Unknown',
            source: null,
            start: record.start,
        };
        const viewModel = createRecordInspectorViewModel(inferred, 'activities', 'driverCard', {
            ...emptySources(),
            activityRows: [activityRow(inferred)],
        });

        expect(viewModel.sourcePath).toBeNull();
        expect(viewModel.generation).toBe('g2v2');
        expect(viewModel.rows[0]?.value).toEqual({ kind: 'activity', value: 'unknown' });
    });

    it('maps a speed sample', () => {
        const record = speedSample();
        const viewModel = createRecordInspectorViewModel(record, 'speed', 'vehicleUnit', {
            ...emptySources(),
            speedRows: [speedRow(record)],
        });

        expect(viewModel.sourcePath).toBe('/vuDetailedSpeedBlocks/0/samples/0');
        expect(viewModel.rows.map((row) => row.labelKey)).toEqual(['recordedTime', 'speed']);
    });

    it('maps an event with purpose and occurrence rows', () => {
        const record = eventRecord();
        const viewModel = createRecordInspectorViewModel(record, 'eventsAndFaults', 'vehicleUnit', {
            ...emptySources(),
            eventFaultRows: [eventRow(record)],
        });

        expect(viewModel.heading.emphasis).toEqual({
            kind: 'eventFaultCode',
            value: 'overSpeeding',
        });
        expect(viewModel.rows.map((row) => row.labelKey)).toContain('purpose');
        expect(viewModel.rows.map((row) => row.labelKey)).toContain('similarOccurrences');
        expect(viewModel.sourcePath).toBe('/vuCardIWRecords/0/events/0');
    });

    it('maps card-use and vehicle-use associations', () => {
        const cardRecord = cardUse();
        const cardViewModel = createRecordInspectorViewModel(cardRecord, 'associations', 'vehicleUnit', {
            ...emptySources(),
            associationRows: [cardUseRow(cardRecord)],
        });
        expect(cardViewModel.heading.emphasis).toEqual({ kind: 'cardType', value: 'driverCard' });
        expect(cardViewModel.rows.map((row) => row.labelKey)).toContain('slot');

        const vehicleRecord = vehicleUse();
        const vehicleViewModel = createRecordInspectorViewModel(vehicleRecord, 'associations', 'driverCard', {
            ...emptySources(),
            associationRows: [vehicleUseRow(vehicleRecord)],
        });
        expect(vehicleViewModel.heading.emphasis).toEqual({
            display: 'ABC-123',
            kind: 'display',
        });
        expect(vehicleViewModel.rows.map((row) => row.labelKey)).toContain('distance');
    });

    it('maps vehicle-unit-use associations with device evidence', () => {
        const record = vehicleUnitUse();
        const viewModel = createRecordInspectorViewModel(record, 'associations', 'driverCard', {
            ...emptySources(),
            associationRows: [vehicleUnitUseRow(record)],
        });

        expect(viewModel.heading).toEqual({
            detail: '08:00',
            emphasis: {
                display: '0001',
                kind: 'display',
            },
        });
        expect(viewModel.rows.map((row) => row.labelKey)).toEqual(['usedAt', 'manufacturerCode', 'deviceId', 'softwareVersion']);
        expect(viewModel.sourcePath).toBe('/cardVehicleUnitRecords/0');
    });

    it('maps daily-work-period places and accumulated positions', () => {
        const place = placeRecord();
        const placeViewModel = createRecordInspectorViewModel(place, 'places', 'driverCard', {
            ...emptySources(),
            locationRows: [placeRow(place)],
        });
        expect(placeViewModel.heading.emphasis).toEqual({
            kind: 'entryType',
            value: 'endCardWithdrawal',
        });
        expect(placeViewModel.rows.map((row) => row.labelKey)).toContain('position');

        const position = positionRecord();
        const positionViewModel = createRecordInspectorViewModel(position, 'places', 'driverCard', {
            ...emptySources(),
            locationRows: [positionRow(position)],
        });
        expect(positionViewModel.rows.map((row) => row.labelKey)).toContain('driverCard');
        expect(positionViewModel.rows.map((row) => row.labelKey)).toContain('latitude');
    });

    it('maps driver and vehicle identities', () => {
        const driver = driverIdentity();
        const driverViewModel = createRecordInspectorViewModel(driver, 'overview', 'driverCard', {
            ...emptySources(),
            identityRows: [driverIdentityRow(driver)],
        });
        expect(driverViewModel.heading.emphasis).toEqual({
            display: '0000000000000000',
            kind: 'display',
        });
        expect(driverViewModel.rows.map((row) => row.labelKey)).toContain('cardIssuingAuthorityName');
        expect(driverViewModel.rows.map((row) => row.labelKey)).toContain('cardHolderBirthDate');

        const vehicle = vehicleIdentity();
        const vehicleViewModel = createRecordInspectorViewModel(vehicle, 'overview', 'vehicleUnit', {
            ...emptySources(),
            identityRows: [vehicleIdentityRow(vehicle)],
        });
        expect(vehicleViewModel.heading.emphasis).toEqual({
            display: 'ABC-123',
            kind: 'display',
        });
        expect(vehicleViewModel.sourcePath).toBe('/vuIdentification');
    });

    it('passes technical fields through with the record kind', () => {
        const record = technicalRecord();
        const viewModel = createRecordInspectorViewModel(record, 'technical', 'driverCard', {
            ...emptySources(),
            technicalRows: [technicalRow(record)],
        });

        expect(viewModel.heading.emphasis).toEqual({ kind: 'technicalKind', value: 'chip' });
        expect(viewModel.rows[0]?.labelKey).toBe('type');
        expect(viewModel.rows[1]).toEqual({
            labelKey: 'chipSerialNumber',
            value: {
                code: true,
                copyValue: 'DEADBEEF',
                display: 'DEADBEEF',
                kind: 'display',
            },
        });
    });

    it('finds a selected speed sample that sits on another table page', () => {
        const firstPage = speedSampleAt('/vuDetailedSpeedBlocks/0/samples/0', Date.UTC(2026, 5, 18, 10));
        const laterPage = speedSampleAt('/vuDetailedSpeedBlocks/0/samples/1', Date.UTC(2026, 5, 18, 11));
        // The table filters and pages over the whole range, so the inspector receives every sample, not one page.
        const viewModel = createRecordInspectorViewModel(laterPage, 'speed', 'vehicleUnit', {
            ...emptySources(),
            speedRows: [speedRow(firstPage), speedRow(laterPage)],
        });

        expect(viewModel.sourcePath).toBe('/vuDetailedSpeedBlocks/0/samples/1');
        expect(viewModel.rows).not.toHaveLength(0);
    });

    it('returns an empty fallback when the record is not part of the sources', () => {
        const record = speedSample();
        const viewModel = createRecordInspectorViewModel(record, 'speed', 'vehicleUnit', {
            ...emptySources(),
        });

        expect(viewModel.sourcePath).toBeNull();
        expect(viewModel.rows).toEqual([]);
        expect(viewModel.heading.emphasis).toEqual({ display: null, kind: 'display' });
    });

    it('creates an inspector view model for an activity infringement pin', () => {
        const pin: IActivityInfringementPinViewModel = {
            allowedValueMinutes: 270,
            article: 'Art. 7',
            category: 'break',
            description: 'Continuous driving without break',
            excessOrDeficitMinutes: 15,
            formattedTime: '09:30',
            id: 'break-infringement-1',
            matchedRecordId: 'rec-1',
            measuredValueMinutes: 285,
            percentage: 39.58,
            recordedAt: timestamp(1_700_000_000_000),
            regulation: 'Regulation (EC) No 561/2006',
            ruleId: 'BREAK_CONTINUOUS_DRIVING',
            severity: 'serious',
            source: source('driverCard', '/cardActivityDailyRecord/0/activityChangeInfo/15'),
            timeOffsetMs: duration(timestamp(0), timestamp(34_200_000)),
            title: 'Break Requirement Exceeded',
        };

        const viewModel = createActivityInfringementInspectorViewModel(pin, 'driverCard');

        expect(viewModel.section).toBe('activities');
        expect(viewModel.documentKind).toBe('driverCard');
        expect(viewModel.generation).toBe('g2v2');
        expect(viewModel.sourcePath).toBe('/cardActivityDailyRecord/0/activityChangeInfo/15');
        expect(viewModel.heading).toEqual({
            detail: '09:30',
            emphasis: { kind: 'infringementRule', value: 'BREAK_CONTINUOUS_DRIVING' },
        });

        const labelKeys = viewModel.rows.map((row) => row.labelKey);
        expect(labelKeys).toEqual([
            'severity',
            'regulation',
            'article',
            'description',
            'recordedTime',
            'measuredValue',
            'allowedValue',
            'excessOrDeficit',
        ]);
        expect(viewModel.rows[0]?.value).toEqual({
            kind: 'infringementSeverity',
            value: 'serious',
        });
        expect(viewModel.rows[1]?.value).toEqual({
            display: 'Regulation (EC) No 561/2006',
            kind: 'display',
        });
        expect(viewModel.rows[2]?.value).toEqual({
            display: 'Art. 7',
            kind: 'display',
        });
        expect(viewModel.rows[3]?.value).toEqual({
            kind: 'infringementRule',
            value: 'BREAK_CONTINUOUS_DRIVING',
        });
        expect(viewModel.rows[4]?.value).toEqual({
            display: '09:30',
            kind: 'display',
        });
        expect(viewModel.rows[5]?.value).toEqual({
            display: '285 min',
            kind: 'display',
        });
        expect(viewModel.rows[6]?.value).toEqual({
            display: '270 min',
            kind: 'display',
        });
        expect(viewModel.rows[7]?.value).toEqual({
            display: '+15 min',
            kind: 'display',
        });
    });

    it('creates an inspector view model for an anomaly alert without excess durations', () => {
        const pin: IActivityInfringementPinViewModel = {
            allowedValueMinutes: 0,
            article: 'Art. 32(1)',
            category: 'anomaly',
            description: 'Motion sensor data integrity fault detected by the recording equipment',
            excessOrDeficitMinutes: 0,
            formattedTime: '14:20',
            id: 'anomaly-1',
            matchedRecordId: null,
            measuredValueMinutes: 0,
            percentage: 59.72,
            recordedAt: timestamp(1_700_000_000_000),
            regulation: 'Regulation (EU) No 165/2014',
            ruleId: 'ANOMALY_MOTION_DATA_ERROR',
            severity: 'verySerious',
            source: source('driverCard', '/eventsData/sensorFaults/0'),
            timeOffsetMs: duration(timestamp(0), timestamp(51_600_000)),
            title: 'Motion Data Error',
        };

        const viewModel = createActivityInfringementInspectorViewModel(pin, 'driverCard');

        expect(viewModel.heading).toEqual({
            detail: '14:20',
            emphasis: { kind: 'infringementRule', value: 'ANOMALY_MOTION_DATA_ERROR' },
        });

        const labelKeys = viewModel.rows.map((row) => row.labelKey);
        expect(labelKeys).toEqual(['severity', 'regulation', 'article', 'description', 'recordedTime']);
        expect(viewModel.rows[0]?.value).toEqual({
            kind: 'infringementSeverity',
            value: 'verySerious',
        });
        expect(viewModel.rows[3]?.value).toEqual({
            kind: 'infringementRule',
            value: 'ANOMALY_MOTION_DATA_ERROR',
        });
    });
});
