import type { ISourceReference, UtcTimestamp } from '#tachograph-domain';

export type InfringementSeverity = 'minor' | 'mostSerious' | 'serious' | 'verySerious';

export type InfringementCategory =
    | 'anomaly'
    | 'biWeeklyDriving'
    | 'break'
    | 'dailyDriving'
    | 'dailyRest'
    | 'ferryDerogation'
    | 'nightWork'
    | 'weeklyDriving'
    | 'weeklyRest'
    | 'workingTime';

export interface ILegalReference {
    readonly article: string;
    readonly description: string;
    readonly regulation: string;
    readonly sourceUrl?: string;
}

export interface IInfringement {
    readonly allowedValueMinutes: number;
    readonly category: InfringementCategory;
    readonly excessOrDeficitMinutes: number;
    readonly id: string;
    readonly legalReference: ILegalReference;
    readonly measuredValueMinutes: number;
    readonly profileId: string;
    readonly recordedAt: UtcTimestamp | null;
    readonly ruleId: string;
    readonly severity: InfringementSeverity;
    readonly source: ISourceReference;
    readonly title: string;
}
