export {
    evaluateDocumentCompliance,
    nightWindowFromPreferences,
    type IComplianceEvaluationResult,
    type INightWorkPreferences,
} from './compliance-service.js';

export {
    evaluateDocumentComplianceScenario,
    COMPLIANCE_SCENARIO_VERSION,
    MAX_COMPLIANCE_SCENARIO_ASSUMPTIONS,
    type ComplianceScenarioAssumption,
    type ComplianceScenarioResult,
    type ComplianceScenarioUnavailableReason,
    type IComplianceScenarioRequest,
} from './compliance-scenario.js';
