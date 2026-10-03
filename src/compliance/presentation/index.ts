export type {
    ComplianceTranslationKey,
    IComplianceAssessmentViewModel,
    IComplianceMessageParams,
    IComplianceSummary,
    IComplianceTranslationService,
    IComplianceViewModel,
    IGroupedInfringementsViewModel,
    IInfringementViewModel,
    ITranslatedComplianceAssessment,
} from './compliance-view-model.js';
export {
    createComplianceViewModel,
    translateComplianceAssessmentRule,
    translateInfringementCategory,
    translateInfringementRule,
    translateInfringementSeverity,
    translateLegalRegulationName,
    translateRuleProfileName,
} from './compliance-view-model.js';

export type {
    ICompanyLetterDetails,
    IInfringementLetterItemViewModel,
    IInfringementLetterViewModel,
} from './infringement-letter-view-model.js';
export { DEFAULT_COMPANY_DETAILS, createInfringementLetterViewModel } from './infringement-letter-view-model.js';

export type { AttestationReason, IAttestationCompanyInput, IAttestationFormViewModel } from './attestation-form-view-model.js';
export {
    DEFAULT_ATTESTATION_COMPANY,
    UNKNOWN_DRIVER_CARD_NUMBER,
    createAttestationFormViewModel,
    isKnownDriverCardNumber,
} from './attestation-form-view-model.js';

export type {
    IAttestationCompanyDraft,
    IAttestationFormDraft,
    IPersistedDriverAttestationDetails,
} from './attestation-form-draft.js';
export {
    createAttestationExportModel,
    createInitialAttestationFormDraft,
    isAttestationFormDraftComplete,
    missingAttestationFormFields,
    ATTESTATION_REQUIRED_FIELDS,
    type AttestationRequiredField,
} from './attestation-form-draft.js';

export { generateAttestationFormHtml, generateInfringementLetterHtml } from './export-document-html.js';

export { createAttestationFormPdfRequest, createInfringementLetterPdfRequest } from './pdf-document-request.js';
