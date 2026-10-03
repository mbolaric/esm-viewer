import type { JsonPointer } from '#tachograph-domain';
import type { OpenedTachographDocument } from '#viewer-application';
import { normalizeSearchText, translateInfringementRuleTitle, type ITranslationService } from '#localization';

import { evaluateDocumentCompliance, type IComplianceEvaluationResult } from '../application/compliance-service.js';
import type { ComplianceAssessmentRuleId, IComplianceAssessment } from '../domain/compliance-assessment.js';
import type { INightWindow } from '../domain/evaluators/working-time-evaluator.js';
import type { IInfringement, InfringementCategory, InfringementSeverity } from '../domain/infringement.js';
import { BUILTIN_RULE_PROFILES, EU_561_2006_STANDARD, type IRuleProfile } from '../domain/rule-profile.js';

export interface IComplianceSummary {
    readonly totalInfringements: number;
    readonly mostSeriousCount: number;
    readonly verySeriousCount: number;
    readonly seriousCount: number;
    readonly minorCount: number;
    readonly anomalyCount: number;
}

export interface IInfringementViewModel {
    readonly allowedDisplay: string;
    readonly category: InfringementCategory;
    readonly categoryDisplay: string;
    readonly excessDisplay: string;
    readonly generationDisplay: string;
    readonly id: string;
    readonly infringement: IInfringement;
    readonly legalDisplay: string;
    readonly measuredDisplay: string;
    readonly severity: InfringementSeverity;
    readonly severityDisplay: string;
    readonly sourcePath: JsonPointer;
    readonly title: string;
}

export interface IGroupedInfringementsViewModel {
    readonly article: string;
    readonly items: readonly IInfringementViewModel[];
}

export interface IComplianceAssessmentViewModel {
    readonly assessment: IComplianceAssessment;
    readonly description: string;
    readonly id: string;
    readonly legalDisplay: string;
    // Count of distinct triggering periods for this assessment rule across the document.
    readonly occurrenceCount: number;
    readonly title: string;
}

export interface ITranslatedComplianceAssessment {
    readonly description: string;
    readonly title: string;
}

export interface IComplianceViewModel {
    readonly assessments: readonly IComplianceAssessmentViewModel[];
    readonly availableProfiles: readonly IRuleProfile[];
    readonly categoryFilter: InfringementCategory | 'all';
    readonly documentKind: OpenedTachographDocument['content']['documentKind'] | null;
    readonly groupedInfringements: readonly IGroupedInfringementsViewModel[];
    readonly hasActiveFilters: boolean;
    readonly infringements: readonly IInfringementViewModel[];
    readonly searchFilter: string;
    readonly selectedProfile: IRuleProfile;
    readonly severityFilter: InfringementSeverity | 'all';
    readonly summary: IComplianceSummary;
}

export type IComplianceMessageParams = Readonly<{
    'compliance.assessment.occurrenceCount': Readonly<{
        count: number | string;
    }>;
    'compliance.groupedCaption': Readonly<{
        article: string;
        caption: string;
    }>;
    'compliance.groupedHeading': Readonly<{
        article: string;
        count: number | string;
    }>;
    'compliance.legalFormat': Readonly<{
        article: string;
        regulation: string;
    }>;
    'compliance.minutesFormat': Readonly<{
        minutes: number | string;
    }>;
    'compliance.noResultsDescription': Readonly<{
        count: number | string;
    }>;
    'compliance.profileVersion': Readonly<{
        name: string;
        version: number | string;
    }>;
    'export.toast.failed': Readonly<{
        reason: string;
    }>;
    'export.toast.success': Readonly<{
        fileName: string;
    }>;
}>;

// Scoped translation key contract for compliance feature UI and export copy.
export type ComplianceTranslationKey =
    | keyof IComplianceMessageParams
    | 'compliance.assessment.rule.CONSECUTIVE_REDUCED_WEEKLY_REST_COMPENSATION_REVIEW.description'
    | 'compliance.assessment.rule.CONSECUTIVE_REDUCED_WEEKLY_REST_COMPENSATION_REVIEW.title'
    | 'compliance.assessment.rule.DAILY_REST_FERRY_TRAIN_INTERRUPTION_REVIEW.description'
    | 'compliance.assessment.rule.DAILY_REST_FERRY_TRAIN_INTERRUPTION_REVIEW.title'
    | 'compliance.assessment.rule.WEEKLY_REST_FERRY_TRAIN_INTERRUPTION_REVIEW.description'
    | 'compliance.assessment.rule.WEEKLY_REST_FERRY_TRAIN_INTERRUPTION_REVIEW.title'
    | 'compliance.assessment.rule.CONSECUTIVE_REDUCED_WEEKLY_REST_DEROGATION_REVIEW.description'
    | 'compliance.assessment.rule.CONSECUTIVE_REDUCED_WEEKLY_REST_DEROGATION_REVIEW.title'
    | 'compliance.assessment.rule.DRIVER_RETURN_ORGANISATION_REVIEW.description'
    | 'compliance.assessment.rule.DRIVER_RETURN_ORGANISATION_REVIEW.title'
    | 'compliance.assessment.rule.MOBILITY_PACKAGE_TRANSITION_APPLICABILITY_REVIEW.description'
    | 'compliance.assessment.rule.MOBILITY_PACKAGE_TRANSITION_APPLICABILITY_REVIEW.title'
    | 'compliance.assessment.rule.MULTI_MANNING_AVAILABILITY_BREAK_REVIEW.description'
    | 'compliance.assessment.rule.MULTI_MANNING_AVAILABILITY_BREAK_REVIEW.title'
    | 'compliance.assessment.rule.UNRECORDED_PERIOD_REVIEW.description'
    | 'compliance.assessment.rule.UNRECORDED_PERIOD_REVIEW.title'
    | 'compliance.assessment.rule.WEEKLY_REST_VEHICLE_ACCOMMODATION_REVIEW.description'
    | 'compliance.assessment.rule.WEEKLY_REST_VEHICLE_ACCOMMODATION_REVIEW.title'
    | 'compliance.assessments.description'
    | 'compliance.assessments.heading'
    | 'compliance.allCategories'
    | 'compliance.allSeverities'
    | 'compliance.anomalies'
    | 'compliance.anomalyScopeLabel'
    | 'compliance.attestation.button'
    | 'compliance.attestation.close'
    | 'compliance.attestation.companyHeading'
    | 'compliance.attestation.date'
    | 'compliance.attestation.declareDriver'
    | 'compliance.attestation.driverHeading'
    | 'compliance.attestation.driverHeadingHint'
    | 'compliance.attestation.driverSignature'
    | 'compliance.attestation.editCity'
    | 'compliance.attestation.editCountry'
    | 'compliance.attestation.editPostalCode'
    | 'compliance.attestation.editStreet'
    | 'compliance.attestation.footnote1'
    | 'compliance.attestation.footnote2'
    | 'compliance.attestation.footnote3'
    | 'compliance.attestation.forPeriod'
    | 'compliance.attestation.incompleteNotice'
    | 'compliance.attestation.fileName'
    | 'compliance.fileName.driverFallback'
    | 'compliance.letter.fileName'
    | 'compliance.attestation.missingFieldsHeading'
    | 'compliance.attestation.optionalField'
    | 'compliance.attestation.item10_licence'
    | 'compliance.attestation.item11_employmentDate'
    | 'compliance.attestation.item12_from'
    | 'compliance.attestation.item13_to'
    | 'compliance.attestation.item14_sickLeave'
    | 'compliance.attestation.item15_annualLeave'
    | 'compliance.attestation.item16_leaveOrRest'
    | 'compliance.attestation.item17_outOfScope'
    | 'compliance.attestation.item18_otherWork'
    | 'compliance.attestation.item19_available'
    | 'compliance.attestation.item1_undertaking'
    | 'compliance.attestation.item20_place'
    | 'compliance.attestation.item21_driverConfirm'
    | 'compliance.attestation.item22_place'
    | 'compliance.attestation.item2_address'
    | 'compliance.attestation.item3_tel'
    | 'compliance.attestation.item4_fax'
    | 'compliance.attestation.item5_email'
    | 'compliance.attestation.item6_name'
    | 'compliance.attestation.item7_position'
    | 'compliance.attestation.item8_driverName'
    | 'compliance.attestation.item9_birthDate'
    | 'compliance.attestation.officialAnnex'
    | 'compliance.attestation.officialInstruction'
    | 'compliance.attestation.officialRegulation'
    | 'compliance.attestation.officialTitle'
    | 'compliance.attestation.officialWarning'
    | 'compliance.attestation.partUndertaking'
    | 'compliance.attestation.print'
    | 'compliance.attestation.reason.annualLeave'
    | 'compliance.attestation.reason.available'
    | 'compliance.attestation.reason.leaveOrRest'
    | 'compliance.attestation.reason.otherWork'
    | 'compliance.attestation.reason.outOfScope'
    | 'compliance.attestation.reason.sickLeave'
    | 'compliance.attestation.reasonLabel'
    | 'compliance.attestation.saveHtml'
    | 'compliance.attestation.savePdf'
    | 'compliance.attestation.signature'
    | 'compliance.attestation.subtitle'
    | 'compliance.attestation.title'
    | 'compliance.attestation.undersigned'
    | 'compliance.categoryAnomaly'
    | 'compliance.categoryBiWeeklyDriving'
    | 'compliance.categoryBreak'
    | 'compliance.categoryDailyDriving'
    | 'compliance.categoryDailyRest'
    | 'compliance.categoryFerryDerogation'
    | 'compliance.categoryNightWork'
    | 'compliance.categoryWeeklyDriving'
    | 'compliance.categoryWeeklyRest'
    | 'compliance.categoryWorkingTime'
    | 'compliance.colAllowed'
    | 'compliance.colCategory'
    | 'compliance.colExcess'
    | 'compliance.colLegal'
    | 'compliance.colMeasured'
    | 'compliance.colSeverity'
    | 'compliance.colSource'
    | 'compliance.colTitle'
    | 'compliance.emptyDescription'
    | 'compliance.emptyTitle'
    | 'compliance.groupByArticle'
    | 'compliance.letter.auditPeriod'
    | 'compliance.letter.button'
    | 'compliance.letter.cardNumber'
    | 'compliance.letter.close'
    | 'compliance.letter.colDateTime'
    | 'compliance.letter.colDescription'
    | 'compliance.letter.colNum'
    | 'compliance.letter.companyAddress'
    | 'compliance.letter.companyHeading'
    | 'compliance.letter.companyName'
    | 'compliance.letter.date'
    | 'compliance.letter.dateAndSignature'
    | 'compliance.letter.driver'
    | 'compliance.letter.driverAckText'
    | 'compliance.letter.driverExplanation'
    | 'compliance.letter.driverSignature'
    | 'compliance.letter.file'
    | 'compliance.letter.generated'
    | 'compliance.letter.managerName'
    | 'compliance.letter.managerSignature'
    | 'compliance.letter.print'
    | 'compliance.letter.qualification'
    | 'compliance.letter.saveHtml'
    | 'compliance.letter.savePdf'
    | 'compliance.letter.severity.minor'
    | 'compliance.letter.severity.mostSerious'
    | 'compliance.letter.severity.serious'
    | 'compliance.letter.severity.verySerious'
    | 'compliance.letter.statement'
    | 'compliance.letter.subtitle'
    | 'compliance.letter.title'
    | 'compliance.letter.totalInfringements'
    | 'compliance.letter.vatOrRegistration'
    | 'compliance.letter.vehicle'
    | 'compliance.letter.vin'
    | 'compliance.mobilityPackageScopeNotice'
    | 'compliance.noResultsTitle'
    | 'compliance.qualification'
    | 'compliance.regulatoryProfile'
    | 'compliance.regulation.AETR_2020_INTERNATIONAL'
    | 'compliance.regulation.DIRECTIVE_2002_15_EC'
    | 'compliance.regulation.EU_165_2014'
    | 'compliance.regulation.EU_561_2006_STANDARD'
    | 'compliance.regulation.EU_MOBILITY_PACKAGE_2020'
    | 'compliance.profileName.AETR_2020_INTERNATIONAL'
    | 'compliance.profileName.DIRECTIVE_2002_15_EC_WORKING_TIME'
    | 'compliance.profileName.EU_561_2006_STANDARD'
    | 'compliance.profileName.EU_MOBILITY_PACKAGE_2020'
    | 'compliance.profileName.UK_GB_DOMESTIC'
    | 'compliance.rule.ANOMALY_DRIVING_WITHOUT_CARD'
    | 'compliance.rule.ANOMALY_MOTION_DATA_ERROR'
    | 'compliance.rule.ANOMALY_VEHICLE_MOTION_CONFLICT'
    | 'compliance.rule.BREAK_CONTINUOUS_DRIVING'
    | 'compliance.rule.DAILY_DRIVING_LIMIT'
    | 'compliance.rule.DAILY_REST_INSUFFICIENT'
    | 'compliance.rule.DAILY_REST_MULTI_MANNING'
    | 'compliance.rule.DAILY_REST_REDUCTIONS_EXCEEDED'
    | 'compliance.rule.NIGHT_WORK_DAILY_LIMIT_10H'
    | 'compliance.rule.WEEKLY_DRIVING_BIWEEKLY_LIMIT'
    | 'compliance.rule.WEEKLY_DRIVING_LIMIT'
    | 'compliance.rule.WEEKLY_REST_INSUFFICIENT'
    | 'compliance.rule.WEEKLY_REST_MAX_SPACING_EXCEEDED'
    | 'compliance.rule.WEEKLY_REST_REGULAR_MISSING'
    | 'compliance.rule.WORKING_TIME_BREAK_6H'
    | 'compliance.rule.WORKING_TIME_BREAK_9H'
    | 'compliance.rule.WORKING_TIME_WEEKLY_AVERAGE_48H'
    | 'compliance.rule.WORKING_TIME_WEEKLY_LIMIT_60H'
    | 'compliance.searchLabel'
    | 'compliance.searchPlaceholder'
    | 'compliance.severityKpiSubtext'
    | 'compliance.severityMinor'
    | 'compliance.severityMostSerious'
    | 'compliance.severitySerious'
    | 'compliance.severityVerySerious'
    | 'compliance.subtitle'
    | 'compliance.tableCaption'
    | 'compliance.totalInfringements'
    | 'compliance.viewFlat'
    | 'compliance.viewLabel'
    | 'export.error.destinationExists'
    | 'export.error.generic'
    | 'export.error.io'
    | 'export.error.sourceConflict'
    | 'export.exporting'
    | 'export.printing'
    | 'export.toast.printed'
    | 'navigator.section.compliance'
    | 'overview.openSource'
    | 'table.columns'
    | 'table.pinColumn';

export type IComplianceTranslationService = ITranslationService<ComplianceTranslationKey, IComplianceMessageParams>;

// Narrows a runtime string to one of a translation table's keys.
function isTableKey<TTable extends object>(table: TTable, key: string): key is Extract<keyof TTable, string> {
    return Object.hasOwn(table, key);
}

// Maps English regulation names from rule profiles to localized translation keys.
const LEGAL_REGULATION_TRANSLATION_KEYS = {
    'European Agreement Concerning the Work of Crews of Vehicles Engaged in International Road Transport (AETR)':
        'compliance.regulation.AETR_2020_INTERNATIONAL',
    'Directive 2002/15/EC': 'compliance.regulation.DIRECTIVE_2002_15_EC',
    'Regulation (EU) No 165/2014': 'compliance.regulation.EU_165_2014',
    'Regulation (EC) No 561/2006': 'compliance.regulation.EU_561_2006_STANDARD',
    'Regulation (EC) No 561/2006, as amended by Regulation (EU) 2020/1054': 'compliance.regulation.EU_MOBILITY_PACKAGE_2020',
} satisfies Readonly<Record<string, ComplianceTranslationKey>>;

// Translates legal instrument names; article citations remain language-neutral.
export function translateLegalRegulationName(regulationName: string, translationService: IComplianceTranslationService): string {
    return isTableKey(LEGAL_REGULATION_TRANSLATION_KEYS, regulationName)
        ? translationService.translate(LEGAL_REGULATION_TRANSLATION_KEYS[regulationName])
        : regulationName;
}

// Maps built-in rule profile IDs to localized display name keys.
const PROFILE_NAME_TRANSLATION_KEYS = {
    AETR_2020_INTERNATIONAL: 'compliance.profileName.AETR_2020_INTERNATIONAL',
    DIRECTIVE_2002_15_EC_WORKING_TIME: 'compliance.profileName.DIRECTIVE_2002_15_EC_WORKING_TIME',
    EU_561_2006_STANDARD: 'compliance.profileName.EU_561_2006_STANDARD',
    EU_MOBILITY_PACKAGE_2020: 'compliance.profileName.EU_MOBILITY_PACKAGE_2020',
    UK_GB_DOMESTIC: 'compliance.profileName.UK_GB_DOMESTIC',
} satisfies Readonly<Record<string, ComplianceTranslationKey>>;

// Translates profile name for display, falling back to English default if unmapped.
export function translateRuleProfileName(
    profileId: string,
    fallbackName: string,
    translationService: IComplianceTranslationService,
): string {
    return isTableKey(PROFILE_NAME_TRANSLATION_KEYS, profileId)
        ? translationService.translate(PROFILE_NAME_TRANSLATION_KEYS[profileId])
        : fallbackName;
}

// Translates infringement rule ID for timeline and compliance display.
export function translateInfringementRule(ruleId: string, translationService: IComplianceTranslationService): string {
    return translateInfringementRuleTitle(ruleId, translationService);
}

const INFRINGEMENT_SEVERITY_TRANSLATION_KEYS = {
    minor: 'compliance.severityMinor',
    mostSerious: 'compliance.severityMostSerious',
    serious: 'compliance.severitySerious',
    verySerious: 'compliance.severityVerySerious',
} satisfies Readonly<Record<InfringementSeverity, ComplianceTranslationKey>>;

export function translateInfringementSeverity(
    severity: InfringementSeverity,
    translationService: IComplianceTranslationService,
): string {
    return translationService.translate(INFRINGEMENT_SEVERITY_TRANSLATION_KEYS[severity]);
}

const INFRINGEMENT_CATEGORY_TRANSLATION_KEYS = {
    anomaly: 'compliance.categoryAnomaly',
    biWeeklyDriving: 'compliance.categoryBiWeeklyDriving',
    break: 'compliance.categoryBreak',
    dailyDriving: 'compliance.categoryDailyDriving',
    dailyRest: 'compliance.categoryDailyRest',
    ferryDerogation: 'compliance.categoryFerryDerogation',
    nightWork: 'compliance.categoryNightWork',
    weeklyDriving: 'compliance.categoryWeeklyDriving',
    weeklyRest: 'compliance.categoryWeeklyRest',
    workingTime: 'compliance.categoryWorkingTime',
} satisfies Readonly<Record<InfringementCategory, ComplianceTranslationKey>>;

export function translateInfringementCategory(
    category: InfringementCategory,
    translationService: IComplianceTranslationService,
): string {
    return translationService.translate(INFRINGEMENT_CATEGORY_TRANSLATION_KEYS[category]);
}

function mapInfringementToViewModel(
    infringement: IInfringement,
    generationDisplay: string,
    translationService: IComplianceTranslationService,
): IInfringementViewModel {
    return {
        allowedDisplay: translationService.translate('compliance.minutesFormat', {
            minutes: String(infringement.allowedValueMinutes),
        }),
        category: infringement.category,
        categoryDisplay: translateInfringementCategory(infringement.category, translationService),
        excessDisplay: translationService.translate('compliance.minutesFormat', {
            minutes: String(infringement.excessOrDeficitMinutes),
        }),
        generationDisplay,
        id: infringement.id,
        infringement,
        legalDisplay: translationService.translate('compliance.legalFormat', {
            article: infringement.legalReference.article,
            regulation: infringement.legalReference.regulation,
        }),
        measuredDisplay: translationService.translate('compliance.minutesFormat', {
            minutes: String(infringement.measuredValueMinutes),
        }),
        severity: infringement.severity,
        severityDisplay: translateInfringementSeverity(infringement.severity, translationService),
        sourcePath: infringement.source.path,
        title: translateInfringementRule(infringement.ruleId, translationService),
    };
}

// Groups assessments by ruleId so shared descriptions display once with an occurrence count.
function groupAssessmentsByRule(
    assessments: readonly IComplianceAssessment[],
): readonly { readonly count: number; readonly first: IComplianceAssessment }[] {
    const groups: { count: number; first: IComplianceAssessment }[] = [];
    const indexByRuleId = new Map<string, number>();
    for (const assessment of assessments) {
        const index = indexByRuleId.get(assessment.ruleId);
        if (index === undefined) {
            indexByRuleId.set(assessment.ruleId, groups.length);
            groups.push({ count: 1, first: assessment });
            continue;
        }
        const group = groups[index];
        if (group !== undefined) {
            group.count += 1;
        }
    }
    return groups;
}

function mapAssessmentToViewModel(
    assessment: IComplianceAssessment,
    occurrenceCount: number,
    translationService: IComplianceTranslationService,
): IComplianceAssessmentViewModel {
    const translated = translateComplianceAssessmentRule(assessment.ruleId, translationService);
    return {
        assessment,
        description: translated.description,
        id: assessment.id,
        legalDisplay: translationService.translate('compliance.legalFormat', {
            article: assessment.legalReference.article,
            regulation: assessment.legalReference.regulation,
        }),
        occurrenceCount,
        title: translated.title,
    };
}

const ASSESSMENT_RULE_TRANSLATION_KEYS = {
    CONSECUTIVE_REDUCED_WEEKLY_REST_COMPENSATION_REVIEW: {
        description: 'compliance.assessment.rule.CONSECUTIVE_REDUCED_WEEKLY_REST_COMPENSATION_REVIEW.description',
        title: 'compliance.assessment.rule.CONSECUTIVE_REDUCED_WEEKLY_REST_COMPENSATION_REVIEW.title',
    },
    CONSECUTIVE_REDUCED_WEEKLY_REST_DEROGATION_REVIEW: {
        description: 'compliance.assessment.rule.CONSECUTIVE_REDUCED_WEEKLY_REST_DEROGATION_REVIEW.description',
        title: 'compliance.assessment.rule.CONSECUTIVE_REDUCED_WEEKLY_REST_DEROGATION_REVIEW.title',
    },
    DAILY_REST_FERRY_TRAIN_INTERRUPTION_REVIEW: {
        description: 'compliance.assessment.rule.DAILY_REST_FERRY_TRAIN_INTERRUPTION_REVIEW.description',
        title: 'compliance.assessment.rule.DAILY_REST_FERRY_TRAIN_INTERRUPTION_REVIEW.title',
    },
    DRIVER_RETURN_ORGANISATION_REVIEW: {
        description: 'compliance.assessment.rule.DRIVER_RETURN_ORGANISATION_REVIEW.description',
        title: 'compliance.assessment.rule.DRIVER_RETURN_ORGANISATION_REVIEW.title',
    },
    MOBILITY_PACKAGE_TRANSITION_APPLICABILITY_REVIEW: {
        description: 'compliance.assessment.rule.MOBILITY_PACKAGE_TRANSITION_APPLICABILITY_REVIEW.description',
        title: 'compliance.assessment.rule.MOBILITY_PACKAGE_TRANSITION_APPLICABILITY_REVIEW.title',
    },
    MULTI_MANNING_AVAILABILITY_BREAK_REVIEW: {
        description: 'compliance.assessment.rule.MULTI_MANNING_AVAILABILITY_BREAK_REVIEW.description',
        title: 'compliance.assessment.rule.MULTI_MANNING_AVAILABILITY_BREAK_REVIEW.title',
    },
    UNRECORDED_PERIOD_REVIEW: {
        description: 'compliance.assessment.rule.UNRECORDED_PERIOD_REVIEW.description',
        title: 'compliance.assessment.rule.UNRECORDED_PERIOD_REVIEW.title',
    },
    WEEKLY_REST_FERRY_TRAIN_INTERRUPTION_REVIEW: {
        description: 'compliance.assessment.rule.WEEKLY_REST_FERRY_TRAIN_INTERRUPTION_REVIEW.description',
        title: 'compliance.assessment.rule.WEEKLY_REST_FERRY_TRAIN_INTERRUPTION_REVIEW.title',
    },
    WEEKLY_REST_VEHICLE_ACCOMMODATION_REVIEW: {
        description: 'compliance.assessment.rule.WEEKLY_REST_VEHICLE_ACCOMMODATION_REVIEW.description',
        title: 'compliance.assessment.rule.WEEKLY_REST_VEHICLE_ACCOMMODATION_REVIEW.title',
    },
} satisfies Readonly<
    Record<
        ComplianceAssessmentRuleId,
        { readonly description: ComplianceTranslationKey; readonly title: ComplianceTranslationKey }
    >
>;

export function translateComplianceAssessmentRule(
    ruleId: ComplianceAssessmentRuleId,
    translationService: IComplianceTranslationService,
): ITranslatedComplianceAssessment {
    return {
        description: translationService.translate(ASSESSMENT_RULE_TRANSLATION_KEYS[ruleId].description),
        title: translationService.translate(ASSESSMENT_RULE_TRANSLATION_KEYS[ruleId].title),
    };
}

const defaultTranslationService: IComplianceTranslationService = {
    translate: (key: string, params?: unknown): string => {
        if (typeof params === 'object' && params !== null) {
            return Object.entries(params).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), key);
        }
        return key;
    },
};

export function createComplianceViewModel(
    document: OpenedTachographDocument | null,
    translationService: IComplianceTranslationService = defaultTranslationService,
    profile: IRuleProfile = EU_561_2006_STANDARD,
    categoryFilter: InfringementCategory | 'all' = 'all',
    severityFilter: InfringementSeverity | 'all' = 'all',
    searchFilter = '',
    nightWindow?: INightWindow,
    // Lets a caller that already evaluated this document reuse the result; it must match profile and nightWindow.
    evaluation?: IComplianceEvaluationResult,
): IComplianceViewModel {
    const hasActiveFilters = categoryFilter !== 'all' || severityFilter !== 'all' || searchFilter.trim().length > 0;

    if (document === null) {
        return {
            assessments: [],
            availableProfiles: BUILTIN_RULE_PROFILES,
            categoryFilter,
            documentKind: null,
            groupedInfringements: [],
            hasActiveFilters,
            infringements: [],
            searchFilter,
            selectedProfile: profile,
            severityFilter,
            summary: {
                anomalyCount: 0,
                minorCount: 0,
                mostSeriousCount: 0,
                seriousCount: 0,
                totalInfringements: 0,
                verySeriousCount: 0,
            },
        };
    }

    const evaluationResult = evaluation ?? evaluateDocumentCompliance(document, profile, nightWindow);
    const rawInfringements = evaluationResult.infringements;
    const assessments = groupAssessmentsByRule(evaluationResult.assessments).map((group) =>
        mapAssessmentToViewModel(group.first, group.count, translationService),
    );

    const summary: IComplianceSummary = {
        anomalyCount: rawInfringements.filter((i) => i.category === 'anomaly').length,
        minorCount: rawInfringements.filter((i) => i.severity === 'minor').length,
        mostSeriousCount: rawInfringements.filter((i) => i.severity === 'mostSerious').length,
        seriousCount: rawInfringements.filter((i) => i.severity === 'serious').length,
        totalInfringements: rawInfringements.length,
        verySeriousCount: rawInfringements.filter((i) => i.severity === 'verySerious').length,
    };

    const query = normalizeSearchText(searchFilter.trim());
    const generationDisplay = document.content.generation.toUpperCase();

    const filteredInfringements: IInfringementViewModel[] = [];
    const groupedMap = new Map<string, IInfringementViewModel[]>();

    for (const item of rawInfringements) {
        if (categoryFilter !== 'all' && item.category !== categoryFilter) {
            continue;
        }
        if (severityFilter !== 'all' && item.severity !== severityFilter) {
            continue;
        }
        if (query.length > 0) {
            const textToSearch = normalizeSearchText(
                `${item.title} ${item.ruleId} ${item.legalReference.article} ${item.legalReference.regulation}`,
            );
            if (!textToSearch.includes(query)) {
                continue;
            }
        }

        const vm = mapInfringementToViewModel(item, generationDisplay, translationService);
        filteredInfringements.push(vm);

        const groupKey = vm.legalDisplay;
        const existingGroup = groupedMap.get(groupKey);
        if (existingGroup !== undefined) {
            existingGroup.push(vm);
        } else {
            groupedMap.set(groupKey, [vm]);
        }
    }

    const groupedInfringements: IGroupedInfringementsViewModel[] = Array.from(groupedMap.entries()).map(([article, items]) => ({
        article,
        items,
    }));

    return {
        assessments,
        availableProfiles: BUILTIN_RULE_PROFILES,
        categoryFilter,
        documentKind: document.content.documentKind,
        groupedInfringements,
        hasActiveFilters,
        infringements: filteredInfringements,
        searchFilter,
        selectedProfile: profile,
        severityFilter,
        summary,
    };
}
