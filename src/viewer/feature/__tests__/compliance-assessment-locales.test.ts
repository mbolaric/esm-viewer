import { describe, expect, it } from 'vitest';

import { viewerCatalogues } from '#i18n-locales';

const { en, de } = viewerCatalogues;

const assessmentKeys = [
    'compliance.assessment.occurrenceCount',
    'compliance.assessment.rule.CONSECUTIVE_REDUCED_WEEKLY_REST_COMPENSATION_REVIEW.description',
    'compliance.assessment.rule.CONSECUTIVE_REDUCED_WEEKLY_REST_COMPENSATION_REVIEW.title',
    'compliance.assessment.rule.CONSECUTIVE_REDUCED_WEEKLY_REST_DEROGATION_REVIEW.description',
    'compliance.assessment.rule.CONSECUTIVE_REDUCED_WEEKLY_REST_DEROGATION_REVIEW.title',
    'compliance.assessment.rule.DRIVER_RETURN_ORGANISATION_REVIEW.description',
    'compliance.assessment.rule.DRIVER_RETURN_ORGANISATION_REVIEW.title',
    'compliance.assessment.rule.MOBILITY_PACKAGE_TRANSITION_APPLICABILITY_REVIEW.description',
    'compliance.assessment.rule.MOBILITY_PACKAGE_TRANSITION_APPLICABILITY_REVIEW.title',
    'compliance.assessment.rule.MULTI_MANNING_AVAILABILITY_BREAK_REVIEW.description',
    'compliance.assessment.rule.MULTI_MANNING_AVAILABILITY_BREAK_REVIEW.title',
    'compliance.assessment.rule.UNRECORDED_PERIOD_REVIEW.description',
    'compliance.assessment.rule.UNRECORDED_PERIOD_REVIEW.title',
    'compliance.assessment.rule.WEEKLY_REST_VEHICLE_ACCOMMODATION_REVIEW.description',
    'compliance.assessment.rule.WEEKLY_REST_VEHICLE_ACCOMMODATION_REVIEW.title',
    'compliance.assessments.description',
    'compliance.assessments.heading',
] as const;

describe('compliance assessment locale copy', () => {
    it('provides non-empty English and German text for every external-evidence key', () => {
        for (const key of assessmentKeys) {
            expect(en[key].trim()).not.toBe('');
            expect(de[key].trim()).not.toBe('');
        }
    });

    it('states that external-evidence reviews are not infringements', () => {
        expect(en['compliance.assessments.description']).toContain('not infringements');
        expect(de['compliance.assessments.description']).toContain('nicht um Verstöße');
    });
});
