import type { TranslationKey } from './catalogues/en.js';
import type { ITranslationService } from './translation-service.js';

// Compliance screens and host-provided reports share one set of catalogue keys.
const INFRINGEMENT_RULE_TRANSLATION_KEYS = {
    ANOMALY_DRIVING_WITHOUT_CARD: 'compliance.rule.ANOMALY_DRIVING_WITHOUT_CARD',
    ANOMALY_MOTION_DATA_ERROR: 'compliance.rule.ANOMALY_MOTION_DATA_ERROR',
    ANOMALY_VEHICLE_MOTION_CONFLICT: 'compliance.rule.ANOMALY_VEHICLE_MOTION_CONFLICT',
    BREAK_CONTINUOUS_DRIVING: 'compliance.rule.BREAK_CONTINUOUS_DRIVING',
    DAILY_DRIVING_LIMIT: 'compliance.rule.DAILY_DRIVING_LIMIT',
    DAILY_REST_INSUFFICIENT: 'compliance.rule.DAILY_REST_INSUFFICIENT',
    DAILY_REST_MULTI_MANNING: 'compliance.rule.DAILY_REST_MULTI_MANNING',
    DAILY_REST_REDUCTIONS_EXCEEDED: 'compliance.rule.DAILY_REST_REDUCTIONS_EXCEEDED',
    NIGHT_WORK_DAILY_LIMIT_10H: 'compliance.rule.NIGHT_WORK_DAILY_LIMIT_10H',
    WEEKLY_DRIVING_BIWEEKLY_LIMIT: 'compliance.rule.WEEKLY_DRIVING_BIWEEKLY_LIMIT',
    WEEKLY_DRIVING_LIMIT: 'compliance.rule.WEEKLY_DRIVING_LIMIT',
    WEEKLY_REST_INSUFFICIENT: 'compliance.rule.WEEKLY_REST_INSUFFICIENT',
    WEEKLY_REST_MAX_SPACING_EXCEEDED: 'compliance.rule.WEEKLY_REST_MAX_SPACING_EXCEEDED',
    WEEKLY_REST_REGULAR_MISSING: 'compliance.rule.WEEKLY_REST_REGULAR_MISSING',
    WORKING_TIME_BREAK_6H: 'compliance.rule.WORKING_TIME_BREAK_6H',
    WORKING_TIME_BREAK_9H: 'compliance.rule.WORKING_TIME_BREAK_9H',
    WORKING_TIME_WEEKLY_AVERAGE_48H: 'compliance.rule.WORKING_TIME_WEEKLY_AVERAGE_48H',
    WORKING_TIME_WEEKLY_LIMIT_60H: 'compliance.rule.WORKING_TIME_WEEKLY_LIMIT_60H',
} satisfies Readonly<Record<string, TranslationKey>>;

export type InfringementRuleTranslationKey =
    (typeof INFRINGEMENT_RULE_TRANSLATION_KEYS)[keyof typeof INFRINGEMENT_RULE_TRANSLATION_KEYS];

function isKnownRuleId(ruleId: string): ruleId is keyof typeof INFRINGEMENT_RULE_TRANSLATION_KEYS {
    return Object.hasOwn(INFRINGEMENT_RULE_TRANSLATION_KEYS, ruleId);
}

// A rule ID without a catalogue title (for example one stored by a newer version) is shown as the raw ID.
export function translateInfringementRuleTitle(
    ruleId: string,
    translationService: ITranslationService<InfringementRuleTranslationKey>,
): string {
    return isKnownRuleId(ruleId) ? translationService.translate(INFRINGEMENT_RULE_TRANSLATION_KEYS[ruleId]) : ruleId;
}
