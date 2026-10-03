import { describe, expect, it } from 'vitest';

import { translateInfringementRuleTitle, type InfringementRuleTranslationKey } from '../infringement-rule-messages.js';
import { createTranslationService } from '../translation-service.js';

const translationService = createTranslationService<'en', InfringementRuleTranslationKey>(
    { locale: 'en' },
    {
        en: {
            'compliance.rule.ANOMALY_DRIVING_WITHOUT_CARD': 'Driving without card',
            'compliance.rule.ANOMALY_MOTION_DATA_ERROR': 'Motion data error',
            'compliance.rule.ANOMALY_VEHICLE_MOTION_CONFLICT': 'Vehicle motion conflict',
            'compliance.rule.BREAK_CONTINUOUS_DRIVING': 'Continuous driving',
            'compliance.rule.DAILY_DRIVING_LIMIT': 'Daily driving limit',
            'compliance.rule.DAILY_REST_INSUFFICIENT': 'Daily rest insufficient',
            'compliance.rule.DAILY_REST_REDUCTIONS_EXCEEDED': 'Daily rest reductions exceeded',
            'compliance.rule.NIGHT_WORK_DAILY_LIMIT_10H': 'Night work limit',
            'compliance.rule.WEEKLY_DRIVING_BIWEEKLY_LIMIT': 'Fortnightly driving limit',
            'compliance.rule.WEEKLY_DRIVING_LIMIT': 'Weekly driving limit',
            'compliance.rule.WEEKLY_REST_INSUFFICIENT': 'Weekly rest insufficient',
            'compliance.rule.WEEKLY_REST_MAX_SPACING_EXCEEDED': 'Weekly rest spacing exceeded',
            'compliance.rule.WEEKLY_REST_REGULAR_MISSING': 'Regular weekly rest missing',
            'compliance.rule.WORKING_TIME_BREAK_6H': 'Break after 6 hours',
            'compliance.rule.WORKING_TIME_BREAK_9H': 'Break after 9 hours',
            'compliance.rule.WORKING_TIME_WEEKLY_AVERAGE_48H': 'Weekly average 48 hours',
            'compliance.rule.WORKING_TIME_WEEKLY_LIMIT_60H': 'Weekly limit 60 hours',
        },
    },
    'en',
    { report: () => Promise.resolve() },
);

describe('translateInfringementRuleTitle', () => {
    it('translates a known rule ID through its catalogue key', () => {
        expect(translateInfringementRuleTitle('DAILY_DRIVING_LIMIT', translationService)).toBe('Daily driving limit');
    });

    it('shows an unknown or inherited-property rule ID as the raw ID', () => {
        expect(translateInfringementRuleTitle('FUTURE_RULE', translationService)).toBe('FUTURE_RULE');
        expect(translateInfringementRuleTitle('toString', translationService)).toBe('toString');
    });
});
