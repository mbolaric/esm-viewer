import {
    projectDocumentAssociations,
    type AssociationGenerationFilter,
    type OpenedTachographDocument,
} from '#viewer-application';
import { classifyParseError, err, ok } from '#contracts';
import {
    getOdometerDistance,
    getUtcDuration,
    type CardSlot,
    type DurationMilliseconds,
    type ICardUse,
    type InsertedCardType,
    type IVehicleUnitUse,
    type ISourceReference,
    type IVehicleUse,
    type OdometerKilometres,
    type TachographGeneration,
    type UtcTimestamp,
} from '#viewer-domain';

import {
    type DocumentViewModelResult,
    formatDateTime,
    formatDuration,
    formatNumber,
    formatOdometer,
    formatUtcDate,
    type IFormattedValue,
    type ViewerLocalisationService,
} from '../helpers/view-model-formatting.js';

export interface IVehicleUseViewModel {
    readonly distance: IFormattedValue<OdometerKilometres> | null;
    readonly duration: IFormattedValue<DurationMilliseconds> | null;
    readonly endTimestamp: IFormattedValue<UtcTimestamp> | null;
    readonly firstUse: IFormattedValue<UtcTimestamp>;
    readonly generation: TachographGeneration;
    readonly kind: 'vehicleUse';
    readonly lastUse: IFormattedValue<UtcTimestamp> | null;
    readonly odometerBegin: IFormattedValue<OdometerKilometres> | null;
    readonly odometerEnd: IFormattedValue<OdometerKilometres> | null;
    readonly record: IVehicleUse;
    readonly registrationMemberState: IVehicleUse['registrationMemberState'];
    readonly registrationNumber: IVehicleUse['registrationNumber'];
    readonly source: ISourceReference<TachographGeneration, 'driverCard'>;
    readonly startTimestamp: IFormattedValue<UtcTimestamp>;
    readonly vehicleIdentificationNumber: IVehicleUse['vehicleIdentificationNumber'];
}

export interface ICardUseViewModel {
    readonly cardExpiryDate: IFormattedValue<UtcTimestamp> | null;
    readonly cardIdentityDisplay: string | null;
    readonly cardNumber: ICardUse['cardNumber'];
    readonly cardType: InsertedCardType;
    readonly duration: IFormattedValue<DurationMilliseconds> | null;
    readonly endTimestamp: IFormattedValue<UtcTimestamp> | null;
    readonly firstNames: ICardUse['firstNames'];
    readonly generation: TachographGeneration;
    readonly insertion: IFormattedValue<UtcTimestamp>;
    readonly issuingMemberState: ICardUse['issuingMemberState'];
    readonly kind: 'cardUse';
    readonly odometerAtInsertion: IFormattedValue<OdometerKilometres> | null;
    readonly odometerAtWithdrawal: IFormattedValue<OdometerKilometres> | null;
    readonly record: ICardUse;
    readonly slot: CardSlot;
    readonly source: ISourceReference<TachographGeneration, 'vehicleUnit'>;
    readonly startTimestamp: IFormattedValue<UtcTimestamp>;
    readonly surname: ICardUse['surname'];
    readonly withdrawal: IFormattedValue<UtcTimestamp> | null;
}

export interface IVehicleUnitUseViewModel {
    readonly deviceID: number;
    readonly endTimestamp: IFormattedValue<UtcTimestamp>;
    readonly generation: TachographGeneration;
    readonly kind: 'vehicleUnitUse';
    readonly manufacturerCode: IFormattedValue<number>;
    readonly record: IVehicleUnitUse;
    readonly source: ISourceReference<TachographGeneration, 'driverCard'>;
    readonly startTimestamp: IFormattedValue<UtcTimestamp>;
    readonly usedAt: IFormattedValue<UtcTimestamp>;
    readonly vuSoftwareVersion: string;
}

export type AssociationRecordViewModel = ICardUseViewModel | IVehicleUnitUseViewModel | IVehicleUseViewModel;

export interface IAssociationSectionViewModel {
    readonly allCount: IFormattedValue<number>;
    readonly availableGenerations: readonly TachographGeneration[];
    readonly documentKind: OpenedTachographDocument['content']['documentKind'];
    readonly filter: AssociationGenerationFilter;
    readonly generationCounts: Readonly<Record<TachographGeneration, IFormattedValue<number>>>;
    readonly locale: string;
    readonly records: readonly AssociationRecordViewModel[];
    readonly timeZone: string;
    readonly totalCount: IFormattedValue<number>;
}

function createVehicleUseViewModel(
    record: IVehicleUse,
    localisation: ViewerLocalisationService,
): DocumentViewModelResult<IVehicleUseViewModel> {
    const duration = record.lastUse === null ? null : getUtcDuration(record.firstUse, record.lastUse);
    if (record.lastUse !== null && duration === null) {
        return err(classifyParseError('projectionFailed'));
    }

    const firstUse = formatDateTime(record.firstUse, localisation);
    const lastUse = record.lastUse === null ? null : formatDateTime(record.lastUse, localisation);

    return ok({
        distance: formatOdometer(getOdometerDistance(record.odometerBegin, record.odometerEnd), localisation),
        duration: duration === null ? null : formatDuration(duration, localisation),
        endTimestamp: lastUse,
        firstUse,
        generation: record.source.generation,
        kind: 'vehicleUse',
        lastUse,
        odometerBegin: formatOdometer(record.odometerBegin, localisation),
        odometerEnd: formatOdometer(record.odometerEnd, localisation),
        record,
        registrationMemberState: record.registrationMemberState,
        registrationNumber: record.registrationNumber,
        source: record.source,
        startTimestamp: firstUse,
        vehicleIdentificationNumber: record.vehicleIdentificationNumber,
    });
}

function createCardUseViewModel(
    record: ICardUse,
    localisation: ViewerLocalisationService,
): DocumentViewModelResult<ICardUseViewModel> {
    const durationValue = record.withdrawal === null ? null : getUtcDuration(record.insertion, record.withdrawal);
    if (record.withdrawal !== null && durationValue === null) {
        return err(classifyParseError('projectionFailed'));
    }

    const insertion = formatDateTime(record.insertion, localisation);
    const withdrawal = record.withdrawal === null ? null : formatDateTime(record.withdrawal, localisation);
    const name = [record.surname, record.firstNames].filter((part) => part !== null).join(' ');
    const cardIdentityDisplay = (name.length > 0 ? name : record.cardNumber) ?? null;

    return ok({
        cardExpiryDate: record.cardExpiryDate === null ? null : formatUtcDate(record.cardExpiryDate, localisation),
        cardIdentityDisplay,
        cardNumber: record.cardNumber,
        cardType: record.cardType,
        duration: durationValue === null ? null : formatDuration(durationValue, localisation),
        endTimestamp: withdrawal,
        firstNames: record.firstNames,
        generation: record.source.generation,
        insertion,
        issuingMemberState: record.issuingMemberState,
        kind: 'cardUse',
        odometerAtInsertion: formatOdometer(record.odometerAtInsertion, localisation),
        odometerAtWithdrawal: formatOdometer(record.odometerAtWithdrawal, localisation),
        record,
        slot: record.slot,
        source: record.source,
        startTimestamp: insertion,
        surname: record.surname,
        withdrawal,
    });
}

function createVehicleUnitUseViewModel(
    record: IVehicleUnitUse,
    localisation: ViewerLocalisationService,
): DocumentViewModelResult<IVehicleUnitUseViewModel> {
    const usedAt = formatDateTime(record.usedAt, localisation);
    return ok({
        deviceID: record.deviceID,
        endTimestamp: usedAt,
        generation: record.source.generation,
        kind: 'vehicleUnitUse',
        manufacturerCode: formatNumber(record.manufacturerCode, localisation),
        record,
        source: record.source,
        startTimestamp: usedAt,
        usedAt,
        vuSoftwareVersion: record.vuSoftwareVersion,
    });
}

export function createAssociationSectionViewModel(
    document: OpenedTachographDocument,
    localisation: ViewerLocalisationService,
    requestedFilter: AssociationGenerationFilter = 'all',
): DocumentViewModelResult<IAssociationSectionViewModel> {
    const allSourceRecords = projectDocumentAssociations(document);
    const availableGenerations = (['g1', 'g2', 'g2v2'] as const).filter((generation) =>
        allSourceRecords.some((record) => record.source.generation === generation),
    );
    const filter = requestedFilter === 'all' || availableGenerations.includes(requestedFilter) ? requestedFilter : 'all';
    const sourceRecords =
        filter === 'all' ? allSourceRecords : allSourceRecords.filter((record) => record.source.generation === filter);
    const records: AssociationRecordViewModel[] = [];
    for (const record of sourceRecords) {
        const mapped =
            record.kind === 'vehicleUse'
                ? createVehicleUseViewModel(record, localisation)
                : record.kind === 'vehicleUnitUse'
                  ? createVehicleUnitUseViewModel(record, localisation)
                  : createCardUseViewModel(record, localisation);
        if (!mapped.ok) {
            return mapped;
        }
        records.push(mapped.value);
    }

    return ok({
        allCount: formatNumber(allSourceRecords.length, localisation),
        availableGenerations,
        documentKind: document.content.documentKind,
        filter,
        generationCounts: {
            g1: formatNumber(allSourceRecords.filter((record) => record.source.generation === 'g1').length, localisation),
            g2: formatNumber(allSourceRecords.filter((record) => record.source.generation === 'g2').length, localisation),
            g2v2: formatNumber(allSourceRecords.filter((record) => record.source.generation === 'g2v2').length, localisation),
        },
        locale: localisation.locale,
        records: records,
        timeZone: localisation.timeZone,
        totalCount: formatNumber(records.length, localisation),
    });
}
