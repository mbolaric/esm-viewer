import { createOpenedTachographDocument, type IDriverCardApplication, type IParsedDriverCardDocument } from '#viewer-application';
import { decodeFileMetadata } from '#contracts';
import type {
    DurationMilliseconds,
    IActivityDay,
    IRecordedActivityInterval,
    ISourceReference,
    UtcTimestamp,
} from '#tachograph-domain';
import {
    createRecordedActivityInterval,
    createSourceReference,
    isDurationMilliseconds,
    isJsonPointer,
    isUtcTimestamp,
    type ActivityKind,
} from '#tachograph-domain';
import { describe, expect, it } from 'vitest';

import { evaluateDocumentCompliance } from '../../application/compliance-service.js';
import {
    createComplianceViewModel,
    translateComplianceAssessmentRule,
    type IComplianceTranslationService,
} from '../compliance-view-model.js';
import { BUILTIN_RULE_PROFILES, EU_561_2006_STANDARD, EU_MOBILITY_PACKAGE_2020 } from '../../domain/rule-profile.js';
import { fixtureSingleDriverCrew } from '#testing';

const translationServiceFake: IComplianceTranslationService = {
    translate: (key: string, params?: unknown): string => {
        if (typeof params === 'object' && params !== null) {
            return Object.entries(params).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), key);
        }
        return key;
    },
};

describe('Compliance View Model', () => {
    it('returns empty compliance summary when document is null', () => {
        const viewModel = createComplianceViewModel(null, translationServiceFake, EU_561_2006_STANDARD);

        expect(viewModel.selectedProfile.profileId).toBe(EU_561_2006_STANDARD.profileId);
        expect(viewModel.availableProfiles).toHaveLength(BUILTIN_RULE_PROFILES.length);
        expect(viewModel.infringements).toHaveLength(0);
        expect(viewModel.assessments).toHaveLength(0);
        expect(viewModel.summary.totalInfringements).toBe(0);
        expect(viewModel.summary.verySeriousCount).toBe(0);
        expect(viewModel.summary.seriousCount).toBe(0);
        expect(viewModel.summary.minorCount).toBe(0);
    });

    it('collapses repeated occurrences of the same assessment rule into one entry with an occurrence count', () => {
        // Three consecutive weeks, each with only a 30h reduced weekly rest
        // (never a 45h regular one) - the two adjacent week-pairs (week0/1
        // and week1/2) each independently trigger the same Mobility Package
        // "two consecutive reduced weekly rests" review, exactly the
        // real-world shape that used to repeat the identical explanation
        // paragraph once per pair.
        function utc(value: number): UtcTimestamp {
            if (!isUtcTimestamp(value)) {
                throw new TypeError('The compliance fixture timestamp must be valid.');
            }
            return value;
        }

        function duration(value: number): DurationMilliseconds {
            if (!isDurationMilliseconds(value)) {
                throw new TypeError('The compliance fixture duration must be valid.');
            }
            return value;
        }

        function cardSource(path: string): ISourceReference<'g2', 'driverCard'> {
            if (!isJsonPointer(path)) {
                throw new TypeError('The compliance fixture source path must be valid.');
            }
            return createSourceReference('driverCard', 'g2', path);
        }

        function recordedInterval(activity: ActivityKind, startMs: number, durationMinutes: number): IRecordedActivityInterval {
            const interval = createRecordedActivityInterval(
                activity,
                utc(startMs),
                utc(startMs + durationMinutes * 60000),
                cardSource('/cardDataResponses/gen2/activityData/0'),
                fixtureSingleDriverCrew,
            );
            if (interval === null) {
                throw new TypeError('The compliance fixture interval must be valid.');
            }
            return interval;
        }

        function threeWeekReducedRestIntervals(firstMondayUtc: number): readonly IRecordedActivityInterval[] {
            const intervals: IRecordedActivityInterval[] = [];
            for (let week = 0; week < 3; week++) {
                const weekStart = firstMondayUtc + week * 7 * 24 * 3600 * 1000;
                intervals.push(recordedInterval('driving', weekStart, 600));
                intervals.push(recordedInterval('breakOrRest', weekStart + 4 * 24 * 3600 * 1000 + 18 * 3600 * 1000, 30 * 60));
                intervals.push(recordedInterval('driving', weekStart + 6 * 24 * 3600 * 1000, 600));
            }
            // Extend coverage through the third week's Sunday 24:00 so all
            // three weeks are "fully covered" and both adjacent pairs
            // (week0/1, week1/2) are evaluated.
            const lastWeekStart = firstMondayUtc + 2 * 7 * 24 * 3600 * 1000;
            intervals.push(recordedInterval('driving', lastWeekStart + 6 * 24 * 3600 * 1000 + 10 * 3600 * 1000, 14 * 60));
            // Unrecorded time between records is evaluated as rest, so the gaps are recorded as availability to keep
            // the 30-hour rests the only weekly rests.
            const contiguous: IRecordedActivityInterval[] = [];
            for (const interval of intervals) {
                const previousEnd = contiguous.at(-1)?.end;
                if (previousEnd !== undefined && interval.start > previousEnd) {
                    contiguous.push(recordedInterval('availability', previousEnd, (interval.start - previousEnd) / 60000));
                }
                contiguous.push(interval);
            }
            return contiguous;
        }

        function activityDay(intervals: readonly IRecordedActivityInterval[]): IActivityDay {
            const midnightUtc = intervals[0]?.start;
            if (midnightUtc === undefined) {
                throw new TypeError('The compliance fixture needs at least one interval.');
            }
            return {
                intervals,
                midnightUtc,
                totals: {
                    availability: duration(0),
                    breakOrRest: duration(0),
                    driving: duration(4 * 3_600_000),
                    unknown: duration(0),
                    work: duration(0),
                },
            };
        }

        function application(day: IActivityDay): IDriverCardApplication {
            return {
                activityDays: [day],
                cardNotes: null,
                events: [],
                faults: [],
                generation: 'g2',
                identity: null,
                locations: [],
                source: cardSource('/cardDataResponses'),
                technicalRecords: [],
                verification: { dataFiles: {}, dataFileSourcePaths: {}, generation: 'g2' },
                vehicleUnitUses: [],
                vehicleUses: [],
                warnings: [],
            };
        }

        function parsedDriverCard(applications: readonly IDriverCardApplication[]): IParsedDriverCardDocument {
            return {
                applications,
                cardType: 'driverCard',
                documentKind: 'driverCard',
                generation: 'g2',
                parserVariant: 'cardGen2',
                rawTree: {},
                sections: [],
            };
        }

        const mondayUtc = new Date('2026-06-15T00:00:00Z').getTime();
        const metadata = decodeFileMetadata({
            byteLength: 3,
            displayName: 'weekly-rest.ddd',
            sha256: 'c'.repeat(64),
        });
        if (!metadata.ok) {
            throw new TypeError('The compliance fixture metadata must be valid.');
        }
        const document = createOpenedTachographDocument(
            {
                ...metadata.value,
                openedAt: utc(Date.UTC(2026, 7, 25, 10, 49, 28)),
                reopenToken: null,
                sourceToken: null,
            },
            parsedDriverCard([application(activityDay(threeWeekReducedRestIntervals(mondayUtc)))]),
        );

        const viewModel = createComplianceViewModel(document, translationServiceFake, EU_MOBILITY_PACKAGE_2020);

        const derogationReviews = viewModel.assessments.filter(
            (assessment) => assessment.assessment.ruleId === 'CONSECUTIVE_REDUCED_WEEKLY_REST_DEROGATION_REVIEW',
        );
        expect(derogationReviews).toHaveLength(1);
        expect(derogationReviews[0]?.occurrenceCount).toBe(2);

        const compensationReviews = viewModel.assessments.filter(
            (assessment) => assessment.assessment.ruleId === 'CONSECUTIVE_REDUCED_WEEKLY_REST_COMPENSATION_REVIEW',
        );
        expect(compensationReviews).toHaveLength(1);
        expect(compensationReviews[0]?.occurrenceCount).toBe(2);

        // A caller-supplied evaluation is reused as-is instead of re-running the rule engine.
        const evaluation = evaluateDocumentCompliance(document, EU_MOBILITY_PACKAGE_2020);
        const reused = createComplianceViewModel(
            document,
            translationServiceFake,
            EU_MOBILITY_PACKAGE_2020,
            'all',
            'all',
            '',
            undefined,
            evaluation,
        );
        expect(reused).toEqual(viewModel);
        const emptied = createComplianceViewModel(
            document,
            translationServiceFake,
            EU_MOBILITY_PACKAGE_2020,
            'all',
            'all',
            '',
            undefined,
            { ...evaluation, assessments: [], infringements: [] },
        );
        expect(emptied.assessments).toHaveLength(0);
    });

    it('maps external-evidence assessment rules to exact localized title and description keys', () => {
        expect(
            translateComplianceAssessmentRule('CONSECUTIVE_REDUCED_WEEKLY_REST_DEROGATION_REVIEW', translationServiceFake),
        ).toEqual({
            description: 'compliance.assessment.rule.CONSECUTIVE_REDUCED_WEEKLY_REST_DEROGATION_REVIEW.description',
            title: 'compliance.assessment.rule.CONSECUTIVE_REDUCED_WEEKLY_REST_DEROGATION_REVIEW.title',
        });
        expect(translateComplianceAssessmentRule('DRIVER_RETURN_ORGANISATION_REVIEW', translationServiceFake)).toEqual({
            description: 'compliance.assessment.rule.DRIVER_RETURN_ORGANISATION_REVIEW.description',
            title: 'compliance.assessment.rule.DRIVER_RETURN_ORGANISATION_REVIEW.title',
        });
        expect(
            translateComplianceAssessmentRule('MOBILITY_PACKAGE_TRANSITION_APPLICABILITY_REVIEW', translationServiceFake),
        ).toEqual({
            description: 'compliance.assessment.rule.MOBILITY_PACKAGE_TRANSITION_APPLICABILITY_REVIEW.description',
            title: 'compliance.assessment.rule.MOBILITY_PACKAGE_TRANSITION_APPLICABILITY_REVIEW.title',
        });
    });

    it('translates infringement rule IDs into localized titles', async () => {
        const { translateInfringementRule } = await import('../compliance-view-model.js');
        expect(translateInfringementRule('BREAK_CONTINUOUS_DRIVING', translationServiceFake)).toBe(
            'compliance.rule.BREAK_CONTINUOUS_DRIVING',
        );
        expect(translateInfringementRule('WORKING_TIME_BREAK_6H', translationServiceFake)).toBe(
            'compliance.rule.WORKING_TIME_BREAK_6H',
        );
        expect(translateInfringementRule('WORKING_TIME_WEEKLY_LIMIT_60H', translationServiceFake)).toBe(
            'compliance.rule.WORKING_TIME_WEEKLY_LIMIT_60H',
        );
        expect(translateInfringementRule('WEEKLY_DRIVING_BIWEEKLY_LIMIT', translationServiceFake)).toBe(
            'compliance.rule.WEEKLY_DRIVING_BIWEEKLY_LIMIT',
        );
        expect(translateInfringementRule('WEEKLY_REST_INSUFFICIENT', translationServiceFake)).toBe(
            'compliance.rule.WEEKLY_REST_INSUFFICIENT',
        );
        expect(translateInfringementRule('WEEKLY_REST_REGULAR_MISSING', translationServiceFake)).toBe(
            'compliance.rule.WEEKLY_REST_REGULAR_MISSING',
        );
        expect(translateInfringementRule('WORKING_TIME_WEEKLY_AVERAGE_48H', translationServiceFake)).toBe(
            'compliance.rule.WORKING_TIME_WEEKLY_AVERAGE_48H',
        );
        expect(translateInfringementRule('NIGHT_WORK_DAILY_LIMIT_10H', translationServiceFake)).toBe(
            'compliance.rule.NIGHT_WORK_DAILY_LIMIT_10H',
        );
    });

    it('translates new infringement categories into localized category labels', async () => {
        const { translateInfringementCategory } = await import('../compliance-view-model.js');
        expect(translateInfringementCategory('workingTime', translationServiceFake)).toBe('compliance.categoryWorkingTime');
        expect(translateInfringementCategory('nightWork', translationServiceFake)).toBe('compliance.categoryNightWork');
        expect(translateInfringementCategory('ferryDerogation', translationServiceFake)).toBe(
            'compliance.categoryFerryDerogation',
        );
    });
});
