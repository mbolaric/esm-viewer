import type { DocumentKind } from './tachograph.js';

export type SharedDocumentCapability = 'activities' | 'events' | 'faults' | 'identity' | 'technicalData';
export type DriverCardCapability = SharedDocumentCapability | 'controlActivities' | 'places' | 'specificConditions' | 'vehicles';
export type VehicleUnitCapability =
    | SharedDocumentCapability
    | 'borderCrossings'
    | 'calibrations'
    | 'companyLocks'
    | 'detailedSpeed'
    | 'downloadHistory'
    | 'drivers'
    | 'positions'
    | 'sensorData'
    | 'timeAdjustments';

export type DocumentCapability = DriverCardCapability | VehicleUnitCapability;
export type DocumentCapabilityFor<TDocumentKind extends DocumentKind> = TDocumentKind extends 'driverCard'
    ? DriverCardCapability
    : VehicleUnitCapability;

export interface IDocumentCapabilities<TDocumentKind extends DocumentKind = DocumentKind> {
    readonly applicable: readonly DocumentCapabilityFor<TDocumentKind>[];
    readonly documentKind: TDocumentKind;
}

export function createDocumentCapabilities<TDocumentKind extends DocumentKind>(
    documentKind: TDocumentKind,
    applicable: readonly DocumentCapabilityFor<TDocumentKind>[],
): IDocumentCapabilities<TDocumentKind> {
    return {
        applicable: [...new Set(applicable)],
        documentKind,
    };
}
