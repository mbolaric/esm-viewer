import type { ISourceReference, UtcTimestamp } from '#tachograph-domain';
import type { ILegalReference, InfringementCategory } from './infringement.js';

export type ComplianceAssessmentStatus = 'externalEvidenceRequired';

export type ComplianceAssessmentRuleId =
    | 'CONSECUTIVE_REDUCED_WEEKLY_REST_COMPENSATION_REVIEW'
    | 'CONSECUTIVE_REDUCED_WEEKLY_REST_DEROGATION_REVIEW'
    | 'DAILY_REST_FERRY_TRAIN_INTERRUPTION_REVIEW'
    | 'DRIVER_RETURN_ORGANISATION_REVIEW'
    | 'MOBILITY_PACKAGE_TRANSITION_APPLICABILITY_REVIEW'
    | 'MULTI_MANNING_AVAILABILITY_BREAK_REVIEW'
    | 'UNRECORDED_PERIOD_REVIEW'
    | 'WEEKLY_REST_FERRY_TRAIN_INTERRUPTION_REVIEW'
    | 'WEEKLY_REST_VEHICLE_ACCOMMODATION_REVIEW';

// Tracks compliance requirements needing external evidence, separate from definitive infringements.
export interface IComplianceAssessment {
    readonly category: InfringementCategory;
    readonly id: string;
    readonly legalReference: ILegalReference;
    readonly profileId: string;
    readonly recordedAt: UtcTimestamp | null;
    readonly ruleId: ComplianceAssessmentRuleId;
    readonly source: ISourceReference | null;
    readonly status: ComplianceAssessmentStatus;
}
