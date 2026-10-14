import type { UtcTimestamp } from '#tachograph-domain';

export interface IConfirmedFerryRest {
    readonly start: UtcTimestamp;
    readonly end: UtcTimestamp;
    readonly restKind: 'regularDaily' | 'reducedWeekly' | 'regularWeekly';
    readonly restDurationMs: number;
}

export interface IArticle12CycleExtension {
    readonly windowStart: UtcTimestamp;
    readonly extensionMs: number;
    readonly drivingStart: UtcTimestamp;
    readonly drivingEnd: UtcTimestamp;
}

export interface IComplianceScenarioEvidence {
    readonly ferryRests: readonly IConfirmedFerryRest[];
    readonly cycleExtensions: readonly IArticle12CycleExtension[];
}
