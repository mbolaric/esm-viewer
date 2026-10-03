import type { DocumentSectionRecord, DocumentWorkspaceSection } from '#viewer-application';
import type {
    ActivityInterval,
    ActivityKind,
    CardSlot,
    DailyWorkPeriodEntryType,
    DocumentKind,
    EventFaultCode,
    EventFaultRecordPurpose,
    IdentityName,
    IRecordedCardReference,
    InsertedCardType,
    JsonPointer,
    LoadTypeKind,
    LoadUnloadOperationType,
    TachographGeneration,
} from '#viewer-domain';

import type {
    AssociationRecordViewModel,
    IActivityRecordViewModel,
    IEventFaultRecordViewModel,
    IdentityViewModel,
    LocationRecordViewModel,
} from './document-view-model.js';
import type { IActivityInfringementPinViewModel } from './activity-view-model.js';
import type { ISpeedSampleViewModel } from './speed-view-model.js';
import type { ITechnicalRecordViewModel, TechnicalFieldKey, TechnicalFieldValue } from './technical-view-model.js';

export type InspectorLabelKey =
    | 'accuracy'
    | 'activity'
    | 'allowedValue'
    | 'article'
    | 'authenticationStatus'
    | 'cardContext'
    | 'cardExpiry'
    | 'cardHolderBirthDate'
    | 'cardIssueDate'
    | 'cardIssuingAuthorityName'
    | 'cardNumber'
    | 'cardType'
    | 'cardValidityBegin'
    | 'category'
    | 'coDriverCard'
    | 'code'
    | 'country'
    | 'countryEntered'
    | 'countryLeft'
    | 'description'
    | 'determinedAt'
    | 'deviceId'
    | 'distance'
    | 'driverCard'
    | 'duration'
    | 'end'
    | 'entryType'
    | 'excessOrDeficit'
    | 'firstNames'
    | 'firstUse'
    | 'inserted'
    | 'issuingMemberState'
    | 'lastUse'
    | 'latitude'
    | 'loadType'
    | 'longitude'
    | 'manufacturerCode'
    | 'measuredValue'
    | 'odometer'
    | 'odometerAtInsertion'
    | 'odometerAtWithdrawal'
    | 'odometerBegin'
    | 'odometerEnd'
    | 'operationType'
    | 'origin'
    | 'position'
    | 'purpose'
    | 'recordedTime'
    | 'region'
    | 'registrationMemberState'
    | 'registrationNumber'
    | 'regulation'
    | 'rule'
    | 'severity'
    | 'similarOccurrences'
    | 'slot'
    | 'softwareVersion'
    | 'speed'
    | 'start'
    | 'surname'
    | 'type'
    | 'usedAt'
    | 'vehicleIdentificationNumber'
    | 'withdrawn';

export type InspectorRowValue =
    | { readonly kind: 'activity'; readonly value: ActivityKind }
    | { readonly kind: 'cardReference'; readonly value: IRecordedCardReference | null }
    | { readonly kind: 'cardType'; readonly value: InsertedCardType }
    | { readonly kind: 'display'; readonly display: string | null }
    | { readonly kind: 'entryType'; readonly value: DailyWorkPeriodEntryType }
    | { readonly kind: 'eventFaultCode'; readonly value: EventFaultCode }
    | { readonly kind: 'eventFaultRecordKind'; readonly value: 'event' | 'fault' }
    | { readonly kind: 'infringementRule'; readonly value: string }
    | {
          readonly kind: 'infringementSeverity';
          readonly value: 'minor' | 'mostSerious' | 'serious' | 'verySerious';
      }
    | { readonly kind: 'loadType'; readonly value: LoadTypeKind }
    | { readonly kind: 'operationType'; readonly value: LoadUnloadOperationType }
    | { readonly kind: 'origin'; readonly value: ActivityInterval['origin'] }
    | { readonly kind: 'recordPurpose'; readonly value: EventFaultRecordPurpose }
    | { readonly kind: 'slot'; readonly value: CardSlot }
    | { readonly kind: 'technicalKind'; readonly value: ITechnicalRecordViewModel['kind'] };

export interface IRecordInspectorRowViewModel {
    readonly labelKey: InspectorLabelKey | TechnicalFieldKey;
    readonly value: InspectorRowValue | TechnicalFieldValue;
}

export interface IRecordInspectorHeadingViewModel {
    readonly detail: string | null;
    readonly emphasis: InspectorRowValue;
}

export interface IRecordInspectorViewModel {
    readonly documentKind: DocumentKind;
    readonly generation: TachographGeneration | null;
    readonly heading: IRecordInspectorHeadingViewModel;
    readonly rows: readonly IRecordInspectorRowViewModel[];
    readonly section: DocumentWorkspaceSection;
    readonly sourcePath: JsonPointer | null;
}

export interface IRecordInspectorSources {
    readonly activityRows: readonly IActivityRecordViewModel[];
    readonly associationRows: readonly AssociationRecordViewModel[];
    readonly eventFaultRows: readonly IEventFaultRecordViewModel[];
    readonly identityRows: readonly IdentityViewModel[];
    readonly locationRows: readonly LocationRecordViewModel[];
    readonly speedRows: readonly ISpeedSampleViewModel[];
    readonly technicalRows: readonly ITechnicalRecordViewModel[];
}

function displayValue(display: string | null): InspectorRowValue {
    return {
        display,
        kind: 'display',
    };
}

function displayRow(labelKey: InspectorLabelKey, display: string | null): IRecordInspectorRowViewModel {
    return {
        labelKey,
        value: displayValue(display),
    };
}

function enumRow(labelKey: InspectorLabelKey, value: InspectorRowValue): IRecordInspectorRowViewModel {
    return {
        labelKey,
        value,
    };
}

function createActivityRows(row: IActivityRecordViewModel): IRecordInspectorRowViewModel[] {
    return [
        enumRow('activity', { kind: 'activity', value: row.activity }),
        displayRow('start', row.start.display),
        displayRow('end', row.end.display),
        displayRow('duration', row.duration.display),
        enumRow('origin', { kind: 'origin', value: row.origin }),
    ];
}

function createSpeedRows(row: ISpeedSampleViewModel): IRecordInspectorRowViewModel[] {
    return [displayRow('recordedTime', row.recordedAt.display), displayRow('speed', row.speed.display)];
}

function createEventFaultRows(row: IEventFaultRecordViewModel): IRecordInspectorRowViewModel[] {
    const rows: IRecordInspectorRowViewModel[] = [
        enumRow('type', { kind: 'eventFaultRecordKind', value: row.recordKind }),
        enumRow('code', { kind: 'eventFaultCode', value: row.code }),
        displayRow('start', row.start.display),
        displayRow('end', row.end?.display ?? null),
        displayRow('duration', row.duration?.display ?? null),
    ];

    if (row.recordPurpose !== null) {
        rows.push(enumRow('purpose', { kind: 'recordPurpose', value: row.recordPurpose }));
    }
    rows.push(displayRow('similarOccurrences', row.similarOccurrences?.display ?? null));
    rows.push(displayRow('registrationNumber', row.registrationNumber ?? null));
    rows.push(displayRow('registrationMemberState', row.registrationMemberState ?? null));

    return rows;
}

function createCardUseRows(
    row: Extract<AssociationRecordViewModel, { readonly kind: 'cardUse' }>,
): IRecordInspectorRowViewModel[] {
    return [
        enumRow('cardType', { kind: 'cardType', value: row.cardType }),
        displayRow('cardNumber', row.cardNumber ?? null),
        displayRow('surname', row.surname ?? null),
        displayRow('firstNames', row.firstNames ?? null),
        displayRow('issuingMemberState', row.issuingMemberState ?? null),
        enumRow('slot', { kind: 'slot', value: row.slot }),
        displayRow('inserted', row.insertion.display),
        displayRow('withdrawn', row.withdrawal?.display ?? null),
        displayRow('odometerAtInsertion', row.odometerAtInsertion?.display ?? null),
        displayRow('odometerAtWithdrawal', row.odometerAtWithdrawal?.display ?? null),
        displayRow('duration', row.duration?.display ?? null),
        displayRow('cardExpiry', row.cardExpiryDate?.display ?? null),
    ];
}

function createVehicleUseRows(
    row: Extract<AssociationRecordViewModel, { readonly kind: 'vehicleUse' }>,
): IRecordInspectorRowViewModel[] {
    return [
        displayRow('registrationNumber', row.registrationNumber ?? null),
        displayRow('registrationMemberState', row.registrationMemberState ?? null),
        displayRow('vehicleIdentificationNumber', row.vehicleIdentificationNumber ?? null),
        displayRow('firstUse', row.firstUse.display),
        displayRow('lastUse', row.lastUse?.display ?? null),
        displayRow('duration', row.duration?.display ?? null),
        displayRow('odometerBegin', row.odometerBegin?.display ?? null),
        displayRow('odometerEnd', row.odometerEnd?.display ?? null),
        displayRow('distance', row.distance?.display ?? null),
    ];
}

function createVehicleUnitUseRows(
    row: Extract<AssociationRecordViewModel, { readonly kind: 'vehicleUnitUse' }>,
): IRecordInspectorRowViewModel[] {
    return [
        displayRow('usedAt', row.usedAt.display),
        displayRow('manufacturerCode', row.manufacturerCode.display),
        displayRow('deviceId', String(row.deviceID)),
        displayRow('softwareVersion', row.vuSoftwareVersion),
    ];
}

function createCardReferenceRows(row: LocationRecordViewModel): IRecordInspectorRowViewModel[] {
    if (row.kind === 'accumulatedDrivingPosition') {
        return [
            enumRow('driverCard', { kind: 'cardReference', value: row.driverCard }),
            enumRow('coDriverCard', { kind: 'cardReference', value: row.coDriverCard }),
        ];
    }
    if (row.kind === 'dailyWorkPeriodPlace') {
        return [enumRow('cardContext', { kind: 'cardReference', value: row.card })];
    }

    return [];
}

function createPositionRows(row: LocationRecordViewModel): IRecordInspectorRowViewModel[] {
    if (row.kind === 'loadTypeEntry') {
        return [];
    }
    const position = row.position;
    if (position === null) {
        return [displayRow('position', null)];
    }

    return [
        displayRow('position', position.coordinateDisplayValue),
        displayRow('latitude', position.latitude.display),
        displayRow('longitude', position.longitude.display),
        displayRow('accuracy', position.accuracy.display),
        displayRow('authenticationStatus', position.authenticationStatus?.display ?? null),
        displayRow('determinedAt', position.determinedAt.display),
    ];
}

function createLocationRows(row: LocationRecordViewModel): IRecordInspectorRowViewModel[] {
    let baseRows: IRecordInspectorRowViewModel[];

    if (row.kind === 'dailyWorkPeriodPlace') {
        baseRows = [
            enumRow('entryType', { kind: 'entryType', value: row.entryType }),
            displayRow('recordedTime', row.entryAt.display),
            displayRow('country', row.country ?? null),
            displayRow('region', row.region ?? null),
            displayRow('odometer', row.odometer?.display ?? null),
        ];
    } else if (row.kind === 'accumulatedDrivingPosition') {
        baseRows = [displayRow('recordedTime', row.recordedAt.display), displayRow('odometer', row.odometer?.display ?? null)];
    } else if (row.kind === 'borderCrossing') {
        baseRows = [
            displayRow('recordedTime', row.crossedAt.display),
            displayRow('countryLeft', row.countryLeft ?? null),
            displayRow('countryEntered', row.countryEntered ?? null),
            displayRow('odometer', row.odometer?.display ?? null),
        ];
    } else if (row.kind === 'loadUnloadOperation') {
        baseRows = [
            displayRow('recordedTime', row.operationAt.display),
            enumRow('operationType', { kind: 'operationType', value: row.operationType }),
            displayRow('country', row.country ?? null),
            displayRow('region', row.region ?? null),
            displayRow('odometer', row.odometer?.display ?? null),
        ];
    } else {
        baseRows = [
            displayRow('recordedTime', row.enteredAt.display),
            enumRow('loadType', { kind: 'loadType', value: row.loadType }),
        ];
    }

    return [...baseRows, ...createCardReferenceRows(row), ...createPositionRows(row)];
}

function createDriverIdentityRows(row: Extract<IdentityViewModel, { readonly kind: 'driver' }>): IRecordInspectorRowViewModel[] {
    return [
        displayRow('cardNumber', row.identity.cardNumber),
        displayRow('surname', row.identity.surname ?? null),
        displayRow('firstNames', row.identity.firstNames ?? null),
        displayRow('cardHolderBirthDate', row.cardHolderBirthDate?.display ?? null),
        displayRow('issuingMemberState', row.identity.issuingMemberState ?? null),
        displayRow('cardIssueDate', row.cardIssueDate?.display ?? null),
        displayRow('cardValidityBegin', row.cardValidityBegin?.display ?? null),
        displayRow('cardExpiry', row.cardExpiryDate?.display ?? null),
        displayRow('cardIssuingAuthorityName', row.cardIssuingAuthorityName ?? null),
    ];
}

function createVehicleIdentityRows(
    row: Extract<IdentityViewModel, { readonly kind: 'vehicle' }>,
): IRecordInspectorRowViewModel[] {
    return [
        displayRow('registrationNumber', row.identity.registrationNumber ?? null),
        displayRow('registrationMemberState', row.identity.registrationMemberState ?? null),
        displayRow('vehicleIdentificationNumber', row.identity.vehicleIdentificationNumber ?? null),
    ];
}

function createTechnicalRows(row: ITechnicalRecordViewModel): IRecordInspectorRowViewModel[] {
    return [
        enumRow('type', { kind: 'technicalKind', value: row.kind }),
        ...row.fields.map((field) => ({
            labelKey: field.key,
            value: field.value,
        })),
    ];
}

function createHeading(emphasis: InspectorRowValue, detail: string | null): IRecordInspectorHeadingViewModel {
    return {
        detail,
        emphasis,
    };
}

function createCardUseHeading(
    row: Extract<AssociationRecordViewModel, { readonly kind: 'cardUse' }>,
): IRecordInspectorHeadingViewModel {
    const name = [row.surname, row.firstNames].filter((part): part is IdentityName => part !== null).join(' ');
    if (name.length > 0) {
        return createHeading(displayValue(name), row.insertion.display);
    }
    if (row.cardNumber !== null) {
        return createHeading(displayValue(row.cardNumber), row.insertion.display);
    }

    return createHeading({ kind: 'cardType', value: row.cardType }, row.insertion.display);
}

function createVehicleUseHeading(
    row: Extract<AssociationRecordViewModel, { readonly kind: 'vehicleUse' }>,
): IRecordInspectorHeadingViewModel {
    const identity = row.registrationNumber ?? row.registrationMemberState;
    return createHeading(displayValue(identity ?? null), row.firstUse.display);
}

function createVehicleUnitUseHeading(
    row: Extract<AssociationRecordViewModel, { readonly kind: 'vehicleUnitUse' }>,
): IRecordInspectorHeadingViewModel {
    return createHeading(displayValue(row.vuSoftwareVersion), row.usedAt.display);
}

function createDriverIdentityHeading(
    row: Extract<IdentityViewModel, { readonly kind: 'driver' }>,
): IRecordInspectorHeadingViewModel {
    const name = [row.identity.surname, row.identity.firstNames].filter((part): part is IdentityName => part !== null).join(' ');
    return createHeading(displayValue(name.length > 0 ? name : row.identity.cardNumber), null);
}

function createVehicleIdentityHeading(
    row: Extract<IdentityViewModel, { readonly kind: 'vehicle' }>,
): IRecordInspectorHeadingViewModel {
    const identity = row.identity.registrationNumber ?? row.identity.registrationMemberState;
    return createHeading(displayValue(identity ?? null), null);
}

export function createRecordInspectorViewModel(
    record: DocumentSectionRecord,
    section: DocumentWorkspaceSection,
    documentKind: DocumentKind,
    sources: IRecordInspectorSources,
): IRecordInspectorViewModel {
    if ('origin' in record) {
        const row = sources.activityRows.find((entry) => entry.record === record) ?? null;
        if (row !== null) {
            return {
                documentKind,
                generation: row.generation,
                heading: createHeading({ kind: 'activity', value: row.activity }, `${row.start.display}–${row.end.display}`),
                rows: createActivityRows(row),
                section,
                sourcePath: row.source?.path ?? null,
            };
        }
    } else if ('recordKind' in record) {
        const row = sources.eventFaultRows.find((entry) => entry.record === record) ?? null;
        if (row !== null) {
            return {
                documentKind,
                generation: row.generation,
                heading: createHeading({ kind: 'eventFaultCode', value: row.code }, row.start.display),
                rows: createEventFaultRows(row),
                section,
                sourcePath: row.source.path,
            };
        }
    } else if (record.kind === 'detailedSpeedSample') {
        const row = sources.speedRows.find((sample) => sample.record === record) ?? null;
        if (row !== null) {
            return {
                documentKind,
                generation: row.generation,
                heading: createHeading(displayValue(row.recordedAt.display), null),
                rows: createSpeedRows(row),
                section,
                sourcePath: row.source.path,
            };
        }
    } else if (record.kind === 'cardUse' || record.kind === 'vehicleUnitUse' || record.kind === 'vehicleUse') {
        const row = sources.associationRows.find((entry) => entry.record === record) ?? null;
        if (row !== null) {
            const heading =
                row.kind === 'cardUse'
                    ? createCardUseHeading(row)
                    : row.kind === 'vehicleUnitUse'
                      ? createVehicleUnitUseHeading(row)
                      : createVehicleUseHeading(row);
            const rows =
                row.kind === 'cardUse'
                    ? createCardUseRows(row)
                    : row.kind === 'vehicleUnitUse'
                      ? createVehicleUnitUseRows(row)
                      : createVehicleUseRows(row);
            return {
                documentKind,
                generation: row.generation,
                heading,
                rows,
                section,
                sourcePath: row.source.path,
            };
        }
    } else if (
        record.kind === 'dailyWorkPeriodPlace' ||
        record.kind === 'accumulatedDrivingPosition' ||
        record.kind === 'borderCrossing' ||
        record.kind === 'loadUnloadOperation' ||
        record.kind === 'loadTypeEntry'
    ) {
        const row = sources.locationRows.find((entry) => entry.record === record) ?? null;
        if (row !== null) {
            let heading: IRecordInspectorHeadingViewModel;
            if (row.kind === 'dailyWorkPeriodPlace') {
                heading = createHeading({ kind: 'entryType', value: row.entryType }, row.entryAt.display);
            } else if (row.kind === 'accumulatedDrivingPosition') {
                heading = createHeading(displayValue(row.recordedAt.display), null);
            } else if (row.kind === 'borderCrossing') {
                heading = createHeading(displayValue(row.crossedAt.display), null);
            } else if (row.kind === 'loadUnloadOperation') {
                heading = createHeading({ kind: 'operationType', value: row.operationType }, row.operationAt.display);
            } else {
                heading = createHeading({ kind: 'loadType', value: row.loadType }, row.enteredAt.display);
            }
            return {
                documentKind,
                generation: record.source.generation,
                heading,
                rows: createLocationRows(row),
                section,
                sourcePath: row.source.path,
            };
        }
    } else if (record.kind === 'driver' || record.kind === 'vehicle') {
        const row = sources.identityRows.find((entry) => entry.identity === record) ?? null;
        if (row !== null) {
            const heading = row.kind === 'driver' ? createDriverIdentityHeading(row) : createVehicleIdentityHeading(row);
            return {
                documentKind,
                generation: record.source.generation,
                heading,
                rows: row.kind === 'driver' ? createDriverIdentityRows(row) : createVehicleIdentityRows(row),
                section,
                sourcePath: record.source.path,
            };
        }
    } else {
        const row = sources.technicalRows.find((entry) => entry.source.path === record.source.path) ?? null;
        if (row !== null) {
            return {
                documentKind,
                generation: row.generation,
                heading: createHeading({ kind: 'technicalKind', value: row.kind }, row.recordedAt),
                rows: createTechnicalRows(row),
                section,
                sourcePath: row.source.path,
            };
        }
    }

    return {
        documentKind,
        generation: null,
        heading: createHeading(displayValue(null), null),
        rows: [],
        section,
        sourcePath: null,
    };
}

export function createActivityInfringementInspectorViewModel(
    pin: IActivityInfringementPinViewModel,
    documentKind: DocumentKind,
): IRecordInspectorViewModel {
    const rows: IRecordInspectorRowViewModel[] = [
        enumRow('severity', { kind: 'infringementSeverity', value: pin.severity }),
        displayRow('regulation', pin.regulation),
        displayRow('article', pin.article),
        enumRow('description', { kind: 'infringementRule', value: pin.ruleId }),
        displayRow('recordedTime', pin.formattedTime),
    ];

    if (pin.measuredValueMinutes > 0 || pin.allowedValueMinutes > 0) {
        rows.push(
            displayRow('measuredValue', `${String(pin.measuredValueMinutes)} min`),
            displayRow('allowedValue', `${String(pin.allowedValueMinutes)} min`),
        );
        if (pin.excessOrDeficitMinutes !== 0) {
            const prefix = pin.excessOrDeficitMinutes > 0 ? '+' : '';
            rows.push(displayRow('excessOrDeficit', `${prefix}${String(pin.excessOrDeficitMinutes)} min`));
        }
    }

    return {
        documentKind,
        generation: pin.source.generation,
        heading: createHeading({ kind: 'infringementRule', value: pin.ruleId }, pin.formattedTime),
        rows,
        section: 'activities',
        sourcePath: pin.source.path,
    };
}
