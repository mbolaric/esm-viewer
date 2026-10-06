export type {
    IBreakRuleConfig,
    IDailyDrivingRuleConfig,
    IDailyRestRuleConfig,
    IFerryRuleConfig,
    IRuleProfile,
    ISeverityThresholds,
    IWeeklyDrivingRuleConfig,
    IWeeklyRestRuleConfig,
    IWorkingTimeRuleConfig,
} from './rule-profile.js';

export {
    AETR_2020_INTERNATIONAL,
    BUILTIN_RULE_PROFILES,
    DIRECTIVE_2002_15_EC_WORKING_TIME,
    EU_561_2006_STANDARD,
    EU_MOBILITY_PACKAGE_2020,
    UK_GB_DOMESTIC,
} from './rule-profile.js';

export type { IInfringement, ILegalReference, InfringementCategory, InfringementSeverity } from './infringement.js';

export type { ComplianceAssessmentRuleId, ComplianceAssessmentStatus, IComplianceAssessment } from './compliance-assessment.js';

export { mergeContiguousActivityIntervals } from './interval-merge.js';

export type { EvaluationInterval, IUnrecordedRestInterval, UnrecordedTimeKind } from './unrecorded-time.js';

// Shared continuous-driving rule machine: the break evaluator and presentation both read these samples.
export { sampleContinuousDrivingByDay, type IContinuousDrivingDaySample } from './continuous-driving.js';

export {
    resolveCreditedAvailabilityBreaks,
    resolveCrewDutyPeriods,
    type CrewQualificationStatus,
    type ICreditedAvailabilityBreak,
    type ICrewDutyPeriod,
    type ICrewQualification,
} from './multi-manning.js';

export { evaluateAnomalyInfringements } from './evaluators/anomaly-evaluator.js';
export { evaluateBreakInfringements } from './evaluators/break-evaluator.js';
export { evaluateDrivingInfringements } from './evaluators/driving-evaluator.js';
export { evaluateRestInfringements } from './evaluators/rest-evaluator.js';
export { evaluateWorkingTimeInfringements, type INightWindow } from './evaluators/working-time-evaluator.js';
