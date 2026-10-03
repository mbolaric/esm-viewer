import {
    projectDocumentLocationRecords,
    type LocationRecordTypeFilter,
    type OpenedTachographDocument,
} from '#viewer-application';
import {
    type IAccumulatedDrivingPosition,
    type IBorderCrossing,
    type IDailyWorkPeriodPlace,
    type IGnssPositionEvidence,
    type ILoadTypeEntry,
    type ILoadUnloadOperation,
    type Latitude,
    type Longitude,
    type OdometerKilometres,
    type TachographGeneration,
    type TachographLocationRecord,
    type UtcTimestamp,
} from '#viewer-domain';

import {
    type DocumentViewModelResult,
    formatDateTime,
    formatNumber,
    formatOdometer,
    formattedValue,
    formatUtcDate,
    type IFormattedValue,
    utcMidnightOfDay,
    type ViewerLocalisationService,
} from '../helpers/view-model-formatting.js';
import { ok } from '#contracts';

export interface IGnssPositionEvidenceViewModel {
    readonly accuracy: IFormattedValue<number>;
    readonly authenticationStatus: IFormattedValue<number> | null;
    readonly coordinateCopyValue: string;
    readonly coordinateDisplayValue: string;
    readonly determinedAt: IFormattedValue<UtcTimestamp>;
    readonly latitude: IFormattedValue<Latitude>;
    readonly longitude: IFormattedValue<Longitude>;
}

export interface IDailyWorkPeriodPlaceViewModel {
    readonly card: IDailyWorkPeriodPlace['card'];
    readonly country: IDailyWorkPeriodPlace['country'];
    readonly entryAt: IFormattedValue<UtcTimestamp>;
    readonly entryType: IDailyWorkPeriodPlace['entryType'];
    readonly generation: TachographGeneration;
    readonly kind: 'dailyWorkPeriodPlace';
    readonly odometer: IFormattedValue<OdometerKilometres> | null;
    readonly position: IGnssPositionEvidenceViewModel | null;
    readonly record: IDailyWorkPeriodPlace;
    readonly region: IDailyWorkPeriodPlace['region'];
    readonly source: IDailyWorkPeriodPlace['source'];
    readonly timestamp: IFormattedValue<UtcTimestamp>;
}

export interface IAccumulatedDrivingPositionViewModel {
    readonly coDriverCard: IAccumulatedDrivingPosition['coDriverCard'];
    readonly driverCard: IAccumulatedDrivingPosition['driverCard'];
    readonly generation: TachographGeneration;
    readonly kind: 'accumulatedDrivingPosition';
    readonly odometer: IFormattedValue<OdometerKilometres> | null;
    readonly position: IGnssPositionEvidenceViewModel;
    readonly record: IAccumulatedDrivingPosition;
    readonly recordedAt: IFormattedValue<UtcTimestamp>;
    readonly source: IAccumulatedDrivingPosition['source'];
    readonly timestamp: IFormattedValue<UtcTimestamp>;
}

export interface IBorderCrossingViewModel {
    readonly countryEntered: IBorderCrossing['countryEntered'];
    readonly countryLeft: IBorderCrossing['countryLeft'];
    readonly crossedAt: IFormattedValue<UtcTimestamp>;
    readonly generation: TachographGeneration;
    readonly kind: 'borderCrossing';
    readonly odometer: IFormattedValue<OdometerKilometres> | null;
    readonly position: IGnssPositionEvidenceViewModel;
    readonly record: IBorderCrossing;
    readonly source: IBorderCrossing['source'];
    readonly timestamp: IFormattedValue<UtcTimestamp>;
}

export interface ILoadUnloadOperationViewModel {
    readonly country: ILoadUnloadOperation['country'];
    readonly generation: TachographGeneration;
    readonly kind: 'loadUnloadOperation';
    readonly odometer: IFormattedValue<OdometerKilometres> | null;
    readonly operationAt: IFormattedValue<UtcTimestamp>;
    readonly operationType: ILoadUnloadOperation['operationType'];
    readonly position: IGnssPositionEvidenceViewModel;
    readonly record: ILoadUnloadOperation;
    readonly region: ILoadUnloadOperation['region'];
    readonly source: ILoadUnloadOperation['source'];
    readonly timestamp: IFormattedValue<UtcTimestamp>;
}

export interface ILoadTypeEntryViewModel {
    readonly enteredAt: IFormattedValue<UtcTimestamp>;
    readonly generation: TachographGeneration;
    readonly kind: 'loadTypeEntry';
    readonly loadType: ILoadTypeEntry['loadType'];
    readonly record: ILoadTypeEntry;
    readonly source: ILoadTypeEntry['source'];
    readonly timestamp: IFormattedValue<UtcTimestamp>;
}

export type LocationRecordViewModel =
    | IAccumulatedDrivingPositionViewModel
    | IBorderCrossingViewModel
    | IDailyWorkPeriodPlaceViewModel
    | ILoadTypeEntryViewModel
    | ILoadUnloadOperationViewModel;

export interface IJourneyLegCoordinates {
    readonly latitude: Latitude;
    readonly longitude: Longitude;
}

export interface IJourneyLegViewModel {
    readonly coordinates: IJourneyLegCoordinates | null;
    readonly country: string;
    readonly icon: 'circleCheck' | 'circleGauge' | 'mapPin' | 'truck';
    readonly id: string;
    readonly odometer: IFormattedValue<OdometerKilometres> | null;
    readonly position: IGnssPositionEvidenceViewModel | null;
    readonly sourcePath: string;
    readonly timestamp: IFormattedValue<UtcTimestamp>;
    readonly type: 'border' | 'end' | 'gnss' | 'loadUnload' | 'start';
}

export interface IJourneySummaryViewModel {
    readonly hasCoordinates: boolean;
    readonly hasOdometerDiscrepancy: boolean;
    readonly legs: readonly IJourneyLegViewModel[];
    readonly totalShiftKilometres: IFormattedValue<number> | null;
}

export interface IJourneyShiftSummary {
    readonly dateLabel: string;
    readonly dayUtc: UtcTimestamp;
    readonly formattedSpan: string;
    readonly id: string;
    readonly stopCount: number;
    readonly summary: IJourneySummaryViewModel;
    readonly totalKilometres: IFormattedValue<number> | null;
}

export function journeyShiftBelongsToUtcDay(shift: IJourneyShiftSummary, midnightUtc: UtcTimestamp): boolean {
    return shift.dayUtc === midnightUtc;
}

export interface ILocationSectionViewModel {
    readonly allCount: IFormattedValue<number>;
    readonly borderCrossingCount: IFormattedValue<number>;
    readonly documentKind: OpenedTachographDocument['content']['documentKind'];
    readonly filter: LocationRecordTypeFilter;
    readonly gen2v2OperationCount: IFormattedValue<number>;
    readonly hasGen2v2ParserLimitation: boolean;
    readonly loadTypeEntryCount: IFormattedValue<number>;
    readonly loadUnloadOperationCount: IFormattedValue<number>;
    readonly locale: string;
    readonly placeCount: IFormattedValue<number>;
    readonly positionCount: IFormattedValue<number>;
    readonly records: readonly LocationRecordViewModel[];
    readonly shifts: readonly IJourneyShiftSummary[];
    readonly timeZone: string;
    readonly totalCount: IFormattedValue<number>;
}

function formatCoordinate<TCoordinate extends Latitude | Longitude>(
    value: TCoordinate,
    localisation: ViewerLocalisationService,
): IFormattedValue<TCoordinate> {
    return formattedValue(
        value,
        localisation.formatNumber(value, {
            maximumFractionDigits: 6,
            minimumFractionDigits: 6,
            useGrouping: false,
        }),
    );
}

function createGnssPositionEvidenceViewModel(
    position: IGnssPositionEvidence,
    localisation: ViewerLocalisationService,
): IGnssPositionEvidenceViewModel {
    const latitude = formatCoordinate(position.coordinates.latitude, localisation);
    const longitude = formatCoordinate(position.coordinates.longitude, localisation);

    return {
        accuracy: formatNumber(position.accuracy, localisation),
        authenticationStatus:
            position.authenticationStatus === null ? null : formatNumber(position.authenticationStatus, localisation),
        coordinateCopyValue: `${String(position.coordinates.latitude)}, ${String(position.coordinates.longitude)}`,
        coordinateDisplayValue: `${latitude.display}, ${longitude.display}`,
        determinedAt: formatDateTime(position.determinedAt, localisation),
        latitude,
        longitude,
    };
}

function createLocationRecordViewModel(
    record: TachographLocationRecord,
    localisation: ViewerLocalisationService,
): LocationRecordViewModel {
    if (record.kind === 'dailyWorkPeriodPlace') {
        const entryAt = formatDateTime(record.entryAt, localisation);
        return {
            card: record.card,
            country: record.country,
            entryAt,
            entryType: record.entryType,
            generation: record.source.generation,
            kind: 'dailyWorkPeriodPlace',
            odometer: formatOdometer(record.odometer, localisation),
            position: record.position === null ? null : createGnssPositionEvidenceViewModel(record.position, localisation),
            record,
            region: record.region,
            source: record.source,
            timestamp: entryAt,
        };
    }
    if (record.kind === 'accumulatedDrivingPosition') {
        const recordedAt = formatDateTime(record.recordedAt, localisation);
        return {
            coDriverCard: record.coDriverCard,
            driverCard: record.driverCard,
            generation: record.source.generation,
            kind: 'accumulatedDrivingPosition',
            odometer: formatOdometer(record.odometer, localisation),
            position: createGnssPositionEvidenceViewModel(record.position, localisation),
            record,
            recordedAt,
            source: record.source,
            timestamp: recordedAt,
        };
    }
    if (record.kind === 'borderCrossing') {
        const crossedAt = formatDateTime(record.crossedAt, localisation);
        return {
            countryEntered: record.countryEntered,
            countryLeft: record.countryLeft,
            crossedAt,
            generation: record.source.generation,
            kind: 'borderCrossing',
            odometer: formatOdometer(record.odometer, localisation),
            position: createGnssPositionEvidenceViewModel(record.position, localisation),
            record,
            source: record.source,
            timestamp: crossedAt,
        };
    }
    if (record.kind === 'loadUnloadOperation') {
        const operationAt = formatDateTime(record.operationAt, localisation);
        return {
            country: record.country,
            generation: record.source.generation,
            kind: 'loadUnloadOperation',
            odometer: formatOdometer(record.odometer, localisation),
            operationAt,
            operationType: record.operationType,
            position: createGnssPositionEvidenceViewModel(record.position, localisation),
            record,
            region: record.region,
            source: record.source,
            timestamp: operationAt,
        };
    }
    const enteredAt = formatDateTime(record.enteredAt, localisation);
    return {
        enteredAt,
        generation: record.source.generation,
        kind: 'loadTypeEntry',
        loadType: record.loadType,
        record,
        source: record.source,
        timestamp: enteredAt,
    };
}

function hasGen2v2LocationLimitation(): boolean {
    return false;
}

const MAX_PLAUSIBLE_SINGLE_LEG_KM = 1500;

const journeyGenerationRank: Readonly<Record<TachographGeneration, number>> = {
    g1: 0,
    g2: 1,
    g2v2: 2,
};

// Canonicalizes mirrored Gen1/Gen2 daily work periods to highest generation (Gen2v2 > Gen2 > Gen1).
function canonicalizeJourneyDailyWorkPeriods(records: readonly LocationRecordViewModel[]): readonly LocationRecordViewModel[] {
    const canonicalByKey = new Map<string, LocationRecordViewModel>();
    for (const record of records) {
        if (record.kind !== 'dailyWorkPeriodPlace') {
            continue;
        }
        const key = `${record.entryType}:${String(record.timestamp.value)}`;
        const current = canonicalByKey.get(key);
        if (current === undefined || journeyGenerationRank[record.generation] > journeyGenerationRank[current.generation]) {
            canonicalByKey.set(key, record);
        }
    }

    return records.filter(
        (record) =>
            record.kind !== 'dailyWorkPeriodPlace' ||
            canonicalByKey.get(`${record.entryType}:${String(record.timestamp.value)}`) === record,
    );
}

export function buildJourneySummary(
    allRecords: readonly LocationRecordViewModel[],
    localisation: ViewerLocalisationService,
): IJourneySummaryViewModel | null {
    if (allRecords.length === 0) {
        return null;
    }

    const sorted = [...allRecords].sort((left, right) => left.timestamp.value - right.timestamp.value);

    const legs: IJourneyLegViewModel[] = [];
    for (const rec of sorted) {
        if (rec.kind === 'dailyWorkPeriodPlace') {
            const isStart = rec.entryType.startsWith('begin');
            // Only genuine GNSS fixes are plotted; country-only records keep coordinates null.
            const coords: IJourneyLegCoordinates | null =
                rec.position !== null
                    ? {
                          latitude: rec.position.latitude.value,
                          longitude: rec.position.longitude.value,
                      }
                    : null;
            legs.push({
                coordinates: coords,
                country: rec.country ?? '—',
                icon: isStart ? 'mapPin' : 'circleCheck',
                id: `${rec.kind}-${rec.source.path}`,
                odometer: rec.odometer,
                position: rec.position,
                sourcePath: rec.source.path,
                timestamp: rec.timestamp,
                type: isStart ? 'start' : 'end',
            });
        } else if (rec.kind === 'borderCrossing') {
            legs.push({
                coordinates: {
                    latitude: rec.position.latitude.value,
                    longitude: rec.position.longitude.value,
                },
                country: `${String(rec.countryLeft ?? '?')} ➔ ${String(rec.countryEntered)}`,
                icon: 'truck',
                id: `${rec.kind}-${rec.source.path}`,
                odometer: rec.odometer,
                position: rec.position,
                sourcePath: rec.source.path,
                timestamp: rec.timestamp,
                type: 'border',
            });
        } else if (rec.kind === 'accumulatedDrivingPosition') {
            legs.push({
                coordinates: {
                    latitude: rec.position.latitude.value,
                    longitude: rec.position.longitude.value,
                },
                country: 'GNSS',
                icon: 'circleGauge',
                id: `${rec.kind}-${rec.source.path}`,
                odometer: rec.odometer,
                position: rec.position,
                sourcePath: rec.source.path,
                timestamp: rec.timestamp,
                type: 'gnss',
            });
        } else if (rec.kind === 'loadUnloadOperation') {
            legs.push({
                coordinates: {
                    latitude: rec.position.latitude.value,
                    longitude: rec.position.longitude.value,
                },
                country: rec.country ?? '—',
                icon: 'truck',
                id: `${rec.kind}-${rec.source.path}`,
                odometer: rec.odometer,
                position: rec.position,
                sourcePath: rec.source.path,
                timestamp: rec.timestamp,
                type: 'loadUnload',
            });
        }
    }

    if (legs.length === 0) {
        return null;
    }

    const hasCoordinates = legs.some((leg) => leg.coordinates !== null);

    // Segmented positive-delta distance calculation; flags odometer discrepancies (backward jump or >1500km).
    const odoPoints: number[] = [];
    for (const leg of legs) {
        if (leg.odometer !== null && leg.odometer.value > 0) {
            odoPoints.push(leg.odometer.value);
        }
    }

    let totalShiftKm: IFormattedValue<number> | null = null;
    let hasOdometerDiscrepancy = false;
    if (odoPoints.length >= 2) {
        let accumulatedKm = 0;
        let hasValidDelta = false;
        for (let i = 0; i < odoPoints.length - 1; i++) {
            const currentOdo = odoPoints[i];
            const nextOdo = odoPoints[i + 1];
            if (currentOdo === undefined || nextOdo === undefined) {
                continue;
            }
            const deltaKm = nextOdo - currentOdo;
            if (deltaKm >= 0 && deltaKm <= MAX_PLAUSIBLE_SINGLE_LEG_KM) {
                accumulatedKm += deltaKm;
                hasValidDelta = true;
            } else {
                hasOdometerDiscrepancy = true;
            }
        }
        if (hasValidDelta) {
            totalShiftKm = formatNumber(accumulatedKm, localisation);
        }
    }

    return {
        hasCoordinates,
        hasOdometerDiscrepancy,
        legs,
        totalShiftKilometres: totalShiftKm,
    };
}

type JourneyMapMarkerType = 'accent' | 'approximate' | 'end' | 'info' | 'primary' | 'start' | 'warning';

export interface IJourneyApproximatePositionOptions {
    readonly badge: string;
    readonly notice: string;
    readonly resolveCountryPosition: (leg: IJourneyLegViewModel) => IJourneyLegCoordinates | null;
}

// Maps journey legs to map waypoints with localized labels; marks country-only positions as approximate.
export function mapJourneyLegsToMapRoute(
    legs: readonly IJourneyLegViewModel[],
    resolveLegLabel: (type: IJourneyLegViewModel['type']) => string,
    approximate?: IJourneyApproximatePositionOptions,
): {
    readonly waypoints: readonly {
        readonly id: string;
        readonly label: string;
        readonly latitude: number;
        readonly longitude: number;
        readonly markerType: JourneyMapMarkerType;
        readonly subtitle: string;
        readonly tooltip?: string | undefined;
    }[];
} {
    const waypoints: {
        id: string;
        label: string;
        latitude: number;
        longitude: number;
        markerType: JourneyMapMarkerType;
        subtitle: string;
        tooltip?: string | undefined;
    }[] = [];
    for (const leg of legs) {
        if (leg.coordinates !== null) {
            let markerType: JourneyMapMarkerType = 'primary';
            switch (leg.type) {
                case 'start':
                    markerType = 'start';
                    break;
                case 'end':
                    markerType = 'end';
                    break;
                case 'gnss':
                    markerType = 'info';
                    break;
                case 'border':
                    markerType = 'warning';
                    break;
                case 'loadUnload':
                    markerType = 'accent';
                    break;
            }

            waypoints.push({
                id: leg.id,
                label: resolveLegLabel(leg.type),
                latitude: leg.coordinates.latitude,
                longitude: leg.coordinates.longitude,
                markerType,
                subtitle: `${leg.country} • ${leg.timestamp.display}`,
                tooltip: leg.odometer !== null ? `${leg.odometer.display} km` : undefined,
            });
        } else if (approximate !== undefined && leg.country !== '—') {
            const position = approximate.resolveCountryPosition(leg);
            if (position !== null) {
                waypoints.push({
                    id: `approximate-${leg.id}`,
                    label: resolveLegLabel(leg.type),
                    latitude: position.latitude,
                    longitude: position.longitude,
                    markerType: 'approximate',
                    subtitle: `${leg.country} • ${leg.timestamp.display} • ${approximate.badge}`,
                    tooltip: approximate.notice,
                });
            }
        }
    }

    return {
        waypoints,
    };
}

export function buildJourneyShifts(
    allRecords: readonly LocationRecordViewModel[],
    localisation: ViewerLocalisationService,
): readonly IJourneyShiftSummary[] {
    if (allRecords.length === 0) {
        return [];
    }

    const sorted = [...allRecords].sort((left, right) => left.timestamp.value - right.timestamp.value);
    const canonical = canonicalizeJourneyDailyWorkPeriods(sorted);

    if (canonical.some((record) => record.kind === 'dailyWorkPeriodPlace')) {
        return buildPairedJourneyShifts(canonical, localisation);
    }

    // Gen2/VU documents record no daily work periods; group journey legs per UTC calendar day.
    return buildUtcDayJourneyShifts(canonical, localisation);
}

function buildPairedJourneyShifts(
    sorted: readonly LocationRecordViewModel[],
    localisation: ViewerLocalisationService,
): readonly IJourneyShiftSummary[] {
    const groups: LocationRecordViewModel[][] = [];
    let openGroup: LocationRecordViewModel[] | null = null;

    for (const record of sorted) {
        if (record.kind === 'dailyWorkPeriodPlace') {
            if (record.entryType.startsWith('begin')) {
                if (openGroup !== null && openGroup.length > 0) {
                    groups.push(openGroup);
                }
                openGroup = [record];
            } else {
                openGroup ??= [];
                openGroup.push(record);
                groups.push(openGroup);
                openGroup = null;
            }
        } else if (openGroup !== null) {
            openGroup.push(record);
        }
        // Records outside open shifts remain in Places table but are excluded from journey cards.
    }

    if (openGroup !== null && openGroup.length > 0) {
        groups.push(openGroup);
    }

    const shifts: IJourneyShiftSummary[] = [];
    for (const group of groups) {
        const boundary =
            group.find((record) => record.kind === 'dailyWorkPeriodPlace' && record.entryType.startsWith('begin')) ??
            group.find((record) => record.kind === 'dailyWorkPeriodPlace');
        if (boundary === undefined) {
            continue;
        }
        const shift = buildJourneyShiftSummary(group, boundary, localisation);
        if (shift !== null) {
            shifts.push(shift);
        }
    }
    return shifts;
}

function buildUtcDayJourneyShifts(
    sorted: readonly LocationRecordViewModel[],
    localisation: ViewerLocalisationService,
): readonly IJourneyShiftSummary[] {
    const groupedByDay = new Map<UtcTimestamp, LocationRecordViewModel[]>();
    for (const record of sorted) {
        const midnight = utcMidnightOfDay(record.timestamp.value);
        if (midnight === null) {
            continue;
        }
        const group = groupedByDay.get(midnight);
        if (group === undefined) {
            groupedByDay.set(midnight, [record]);
        } else {
            group.push(record);
        }
    }

    const shifts: IJourneyShiftSummary[] = [];
    for (const dayRecords of groupedByDay.values()) {
        const first = dayRecords[0];
        if (first === undefined) {
            continue;
        }
        const shift = buildJourneyShiftSummary(dayRecords, first, localisation);
        if (shift !== null) {
            shifts.push(shift);
        }
    }
    return shifts;
}

function buildJourneyShiftSummary(
    group: readonly LocationRecordViewModel[],
    boundary: LocationRecordViewModel,
    localisation: ViewerLocalisationService,
): IJourneyShiftSummary | null {
    const summary = buildJourneySummary(group, localisation);
    if (summary === null || summary.legs.length === 0) {
        return null;
    }

    const dayUtc = utcMidnightOfDay(boundary.timestamp.value);
    if (dayUtc === null) {
        return null;
    }

    const firstLeg = summary.legs[0];
    const lastLeg = summary.legs.at(-1);
    const formattedSpan =
        firstLeg !== undefined && lastLeg !== undefined ? `${firstLeg.timestamp.display} – ${lastLeg.timestamp.display}` : '';

    return {
        dateLabel: formatUtcDate(dayUtc, localisation).display,
        dayUtc,
        formattedSpan,
        id: `shift-${boundary.source.path}`,
        stopCount: summary.legs.filter((leg) => leg.type !== 'gnss').length,
        summary,
        totalKilometres: summary.totalShiftKilometres,
    };
}

export function createLocationSectionViewModel(
    document: OpenedTachographDocument,
    localisation: ViewerLocalisationService,
    filter: LocationRecordTypeFilter = 'all',
): DocumentViewModelResult<ILocationSectionViewModel> {
    const allSourceRecords = projectDocumentLocationRecords(document);
    const allViewModels = allSourceRecords.map((record) => createLocationRecordViewModel(record, localisation));
    const sourceRecords = projectDocumentLocationRecords(document, filter);
    const records = sourceRecords.map((record) => createLocationRecordViewModel(record, localisation));

    return ok({
        allCount: formatNumber(allSourceRecords.length, localisation),
        borderCrossingCount: formatNumber(
            allSourceRecords.filter((record) => record.kind === 'borderCrossing').length,
            localisation,
        ),
        documentKind: document.content.documentKind,
        filter,
        gen2v2OperationCount: formatNumber(
            allSourceRecords.filter(
                (record) =>
                    record.kind === 'borderCrossing' || record.kind === 'loadUnloadOperation' || record.kind === 'loadTypeEntry',
            ).length,
            localisation,
        ),
        hasGen2v2ParserLimitation: hasGen2v2LocationLimitation(),
        loadTypeEntryCount: formatNumber(
            allSourceRecords.filter((record) => record.kind === 'loadTypeEntry').length,
            localisation,
        ),
        loadUnloadOperationCount: formatNumber(
            allSourceRecords.filter((record) => record.kind === 'loadUnloadOperation').length,
            localisation,
        ),
        locale: localisation.locale,
        placeCount: formatNumber(
            allSourceRecords.filter((record) => record.kind === 'dailyWorkPeriodPlace').length,
            localisation,
        ),
        positionCount: formatNumber(
            allSourceRecords.filter((record) => record.kind === 'accumulatedDrivingPosition').length,
            localisation,
        ),
        records,
        shifts: buildJourneyShifts(allViewModels, localisation),
        timeZone: localisation.timeZone,
        totalCount: formatNumber(records.length, localisation),
    });
}
