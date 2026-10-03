import type { EvaluationInterval, EvidencedEvaluationInterval } from '../unrecorded-time.js';
import { calendarWeekStart, getCalendarWeekKey, MILLISECONDS_PER_MINUTE, MILLISECONDS_PER_WEEK, parseIsoUtcDay } from '#time';
import type { IComplianceAssessment } from '../compliance-assessment.js';
import type { IInfringement } from '../infringement.js';
import { EU_2020_1054_MOBILITY_PACKAGE_URL, EU_561_2006_CONSOLIDATED_URL } from '../legal-references.js';
import {
    calculateDeficitSeverity,
    calculateSeverity,
    measureDeficitMinutes,
    measureExcessMinutes,
    type IFerryRuleConfig,
    type IRuleProfile,
} from '../rule-profile.js';

// Art. 9(1): reduced weekly rest may be interrupted up to 2 times, totaling <= 1 hr.
// Greedily groups candidate rest fragments within profile interruption limits across 2-week windows.
function findFerryTrainInterruptedReducedRest(
    intervals: readonly EvaluationInterval[],
    windowStart: number,
    windowEnd: number,
    ferryRules: IFerryRuleConfig,
    reducedRestMs: number,
): EvaluationInterval | undefined {
    const fragments = intervals.filter(
        (interval) => interval.activity === 'breakOrRest' && interval.start < windowEnd && interval.end > windowStart,
    );

    const closedGroups: EvaluationInterval[][] = [];
    let group: EvaluationInterval[] = [];
    for (const fragment of fragments) {
        if (group.length === 0) {
            group = [fragment];
            continue;
        }
        const candidateGroup = [...group, fragment];
        const combinedMs = candidateGroup.reduce((sum, f) => sum + (f.end - f.start), 0);
        const first = candidateGroup[0];
        const last = candidateGroup.at(-1);
        const totalInterruptionMs = first !== undefined && last !== undefined ? last.end - first.start - combinedMs : 0;
        if (
            candidateGroup.length - 1 <= ferryRules.maxInterruptions &&
            totalInterruptionMs <= ferryRules.maxInterruptionDurationMinutes * MILLISECONDS_PER_MINUTE
        ) {
            group = candidateGroup;
        } else {
            closedGroups.push(group);
            group = [fragment];
        }
    }
    if (group.length > 0) {
        closedGroups.push(group);
    }

    for (const closedGroup of closedGroups) {
        if (closedGroup.length < 2) {
            continue;
        }
        const combinedMs = closedGroup.reduce((sum, f) => sum + (f.end - f.start), 0);
        if (combinedMs >= reducedRestMs) {
            return closedGroup.at(-1);
        }
    }
    return undefined;
}

function ferryTrainWeeklyRestAssessment(
    reference: EvaluationInterval,
    profile: IRuleProfile,
    idSuffix: string,
): IComplianceAssessment {
    return {
        category: 'weeklyRest',
        id: `weekly-rest-ferry-train-interruption-${idSuffix}`,
        legalReference: {
            article: 'Art. 9(1)',
            description:
                'A reduced weekly rest interrupted within the ferry/train limits (at most two interruptions, one hour in total) still requires evidence that the driver accompanied the vehicle and had bunk/couchette access, which tachograph activity data alone cannot establish',
            regulation: profile.regulationName,
            sourceUrl: EU_561_2006_CONSOLIDATED_URL,
        },
        profileId: profile.profileId,
        recordedAt: reference.start,
        ruleId: 'WEEKLY_REST_FERRY_TRAIN_INTERRUPTION_REVIEW',
        source: reference.source,
        status: 'externalEvidenceRequired',
    };
}

type MobilityApplicability = 'crossesEffectiveDate' | 'postEffective' | 'preEffective';

interface IWeekSpan {
    readonly end: number;
    readonly key: string;
    readonly start: number;
}

function weekSpanOfMonday(monday: number): IWeekSpan {
    return {
        end: monday + MILLISECONDS_PER_WEEK,
        key: new Date(monday).toISOString().slice(0, 10),
        start: monday,
    };
}

// Returns every calendar week fully covered by document bounds, preserving consecutive calendar pairs across empty weeks.
function fullWeeksWithinDocument(fileStart: number, fileEnd: number): readonly IWeekSpan[] {
    const firstMonday = calendarWeekStart(getCalendarWeekKey(fileStart));
    if (!Number.isFinite(firstMonday)) {
        return [];
    }

    const weeks: IWeekSpan[] = [];
    for (let monday = firstMonday; monday < fileEnd; monday += MILLISECONDS_PER_WEEK) {
        const week = weekSpanOfMonday(monday);
        if (week.start >= fileStart && week.end <= fileEnd) {
            weeks.push(week);
        }
    }
    return weeks;
}

interface IRestSpan {
    readonly end: number;
    readonly interval: EvidencedEvaluationInterval;
    readonly start: number;
}

// Art. 8(6): rolling deadline requires weekly rest within six 24h periods from previous rest.
// Evaluated only after an initial observed weekly rest.
function evaluateMaxRestSpacing(
    restSpans: readonly IRestSpan[],
    fileEnd: number,
    profile: IRuleProfile,
): readonly IInfringement[] {
    const infringements: IInfringement[] = [];
    const maxSpacingMs = profile.weeklyRestRules.maxRestSpacingMinutes * MILLISECONDS_PER_MINUTE;

    for (let index = 0; index < restSpans.length; index++) {
        const rest = restSpans[index];
        if (rest === undefined) {
            continue;
        }
        const next = restSpans[index + 1];
        const deadline = rest.end + maxSpacingMs;

        // Trailing gaps only violate once document coverage conclusively extends past the deadline.
        const isConclusiveViolation = next !== undefined ? next.start > deadline : deadline < fileEnd;
        if (!isConclusiveViolation) {
            continue;
        }

        const gapEndMs = next?.start ?? fileEnd;
        const { excessMinutes: deficitMinutes, measuredMinutes } = measureExcessMinutes(
            gapEndMs - rest.end,
            profile.weeklyRestRules.maxRestSpacingMinutes,
        );

        infringements.push({
            allowedValueMinutes: profile.weeklyRestRules.maxRestSpacingMinutes,
            category: 'weeklyRest',
            excessOrDeficitMinutes: deficitMinutes,
            id: `weekly-rest-max-spacing-${String(rest.end)}`,
            legalReference: {
                article: 'Art. 8(6)',
                description: 'Weekly rest period did not start within six 24-hour periods of the previous one',
                regulation: profile.regulationName,
            },
            measuredValueMinutes: measuredMinutes,
            profileId: profile.profileId,
            recordedAt: next?.interval.start ?? rest.interval.end,
            ruleId: 'WEEKLY_REST_MAX_SPACING_EXCEEDED',
            severity: calculateSeverity(deficitMinutes, profile, 'WEEKLY_REST_MAX_SPACING_EXCEEDED'),
            source: rest.interval.source,
            title: 'Weekly Rest Started Too Late',
        });
    }

    return infringements;
}

function longestNonQualifyingRestInPair(
    intervals: readonly EvaluationInterval[],
    pairStart: number,
    pairEnd: number,
    reducedRestMs: number,
): number {
    let longestMs = 0;
    for (const interval of intervals) {
        if (interval.activity !== 'breakOrRest') {
            continue;
        }
        const durationMs = interval.end - interval.start;
        const overlaps = interval.start < pairEnd && interval.end > pairStart;
        if (overlaps && durationMs < reducedRestMs) {
            longestMs = Math.max(longestMs, durationMs);
        }
    }
    return longestMs;
}

interface IRegularRestEvaluationResult {
    readonly assessments: readonly IComplianceAssessment[];
    readonly infringements: readonly IInfringement[];
}

function mobilityAssessment(
    ruleId: IComplianceAssessment['ruleId'],
    article: string,
    description: string,
    profile: IRuleProfile,
    idSuffix: string,
    reference: IRestSpan | undefined,
): IComplianceAssessment {
    return {
        category: 'weeklyRest',
        id: `${ruleId.toLowerCase()}-${idSuffix}`,
        legalReference: {
            article,
            description,
            regulation: profile.regulationName,
            sourceUrl: EU_2020_1054_MOBILITY_PACKAGE_URL,
        },
        profileId: profile.profileId,
        recordedAt: reference?.interval.start ?? null,
        ruleId,
        source: reference?.interval.source ?? null,
        status: 'externalEvidenceRequired',
    };
}

function mobilityEffectiveFrom(profile: IRuleProfile): number | null {
    if (profile.weeklyRestRules.legalRegime !== 'mobilityPackage2020') {
        return null;
    }
    return parseIsoUtcDay(profile.effectiveFrom);
}

function mobilityApplicabilityForWindow(
    windowStart: number,
    windowEnd: number,
    effectiveFrom: number | null,
): MobilityApplicability {
    if (effectiveFrom === null || windowEnd <= effectiveFrom) {
        return 'preEffective';
    }
    if (windowStart >= effectiveFrom) {
        return 'postEffective';
    }
    return 'crossesEffectiveDate';
}

// Art. 8(6): two distinct rests required per two consecutive weeks (at least one regular). Spanning rests satisfy one week (Art. 8(9)).
function evaluateRegularRestPresence(
    weeks: readonly IWeekSpan[],
    restSpans: readonly IRestSpan[],
    intervals: readonly EvaluationInterval[],
    profile: IRuleProfile,
): IRegularRestEvaluationResult {
    const assessments: IComplianceAssessment[] = [];
    const infringements: IInfringement[] = [];
    const reducedRestMs = profile.weeklyRestRules.reducedRestMinutes * MILLISECONDS_PER_MINUTE;
    const regularRestMs = profile.weeklyRestRules.regularRestMinutes * MILLISECONDS_PER_MINUTE;
    const effectiveFrom = mobilityEffectiveFrom(profile);
    // Suppress redundant reports when overlapping 2-week pairs share the same missing rest root cause.
    let previousPairWasInsufficient = false;
    let previousPairWasMissingRegular = false;

    for (let index = 0; index < weeks.length - 1; index++) {
        const firstWeek = weeks[index];
        const secondWeek = weeks[index + 1];
        if (firstWeek === undefined || secondWeek === undefined) {
            previousPairWasInsufficient = false;
            previousPairWasMissingRegular = false;
            continue;
        }

        const restsInPair = restSpans.filter((rest) => rest.start < secondWeek.end && rest.end > firstWeek.start);

        // A pair is judged only when it holds recorded activity: unrecorded time alone shows nothing of the driver.
        const referenceInterval = intervals.find(
            (interval) => interval.origin === 'recorded' && interval.start < secondWeek.end && interval.end > firstWeek.start,
        );
        if (restsInPair.length < 2) {
            if (referenceInterval?.origin !== 'recorded') {
                previousPairWasInsufficient = false;
                continue;
            }
            if (profile.ferryRules !== undefined) {
                const ferryCandidate = findFerryTrainInterruptedReducedRest(
                    intervals,
                    firstWeek.start,
                    secondWeek.end,
                    profile.ferryRules,
                    reducedRestMs,
                );
                if (ferryCandidate !== undefined) {
                    assessments.push(ferryTrainWeeklyRestAssessment(ferryCandidate, profile, firstWeek.key));
                }
            }
            const wasAlreadyReported = previousPairWasInsufficient;
            previousPairWasInsufficient = true;
            if (wasAlreadyReported) {
                continue;
            }
            // When one rest is present, the second is missing; measure deficit against longest attempt only if 0 rests found.
            const closestRestMs =
                restsInPair.length === 0
                    ? longestNonQualifyingRestInPair(intervals, firstWeek.start, secondWeek.end, reducedRestMs)
                    : 0;
            const { deficitMinutes, measuredMinutes } = measureDeficitMinutes(
                closestRestMs,
                profile.weeklyRestRules.reducedRestMinutes,
            );
            infringements.push({
                allowedValueMinutes: profile.weeklyRestRules.reducedRestMinutes,
                category: 'weeklyRest',
                excessOrDeficitMinutes: deficitMinutes,
                id: `weekly-rest-quota-${firstWeek.key}`,
                legalReference: {
                    article: 'Art. 8(6)',
                    description: 'Fewer than two qualifying weekly rest periods were recorded across two consecutive weeks',
                    regulation: profile.regulationName,
                    sourceUrl: EU_561_2006_CONSOLIDATED_URL,
                },
                measuredValueMinutes: measuredMinutes,
                profileId: profile.profileId,
                recordedAt: referenceInterval.start,
                ruleId: 'WEEKLY_REST_INSUFFICIENT',
                severity: calculateDeficitSeverity(deficitMinutes, profile, 'WEEKLY_REST_INSUFFICIENT'),
                source: referenceInterval.source,
                title: 'Insufficient Weekly Rest',
            });
            continue;
        }
        previousPairWasInsufficient = false;

        const hasRegularRest = restsInPair.some((rest) => rest.end - rest.start >= regularRestMs);
        if (hasRegularRest) {
            previousPairWasMissingRegular = false;
            continue;
        }

        const reference = restsInPair[0];

        const mobilityApplicability = mobilityApplicabilityForWindow(firstWeek.start, secondWeek.end, effectiveFrom);
        if (mobilityApplicability === 'postEffective') {
            assessments.push(
                mobilityAssessment(
                    'CONSECUTIVE_REDUCED_WEEKLY_REST_DEROGATION_REVIEW',
                    'Art. 8(6), third and fourth subparagraphs',
                    'Two consecutive reduced weekly rests require international-goods and location evidence that tachograph activity data alone cannot establish',
                    profile,
                    firstWeek.key,
                    reference,
                ),
                mobilityAssessment(
                    'CONSECUTIVE_REDUCED_WEEKLY_REST_COMPENSATION_REVIEW',
                    'Art. 8(6b)',
                    'Compensation timing after two consecutive reduced weekly rests depends on whether the international-goods derogation applies',
                    profile,
                    firstWeek.key,
                    reference,
                ),
            );
            previousPairWasMissingRegular = false;
            continue;
        }
        if (mobilityApplicability === 'crossesEffectiveDate') {
            assessments.push(
                mobilityAssessment(
                    'MOBILITY_PACKAGE_TRANSITION_APPLICABILITY_REVIEW',
                    'Article 1(6), effective 20 August 2020',
                    'The two-week window crosses the Mobility Package effective date, so the applicable weekly-rest regime requires review before drawing a conclusion',
                    profile,
                    firstWeek.key,
                    reference,
                ),
            );
            previousPairWasMissingRegular = false;
            continue;
        }

        if (reference === undefined) {
            previousPairWasMissingRegular = false;
            continue;
        }

        const wasAlreadyReportedMissingRegular = previousPairWasMissingRegular;
        previousPairWasMissingRegular = true;
        if (wasAlreadyReportedMissingRegular) {
            continue;
        }

        const maxRestInPair = Math.max(...restsInPair.map((rest) => rest.end - rest.start));
        const { deficitMinutes, measuredMinutes } = measureDeficitMinutes(
            maxRestInPair,
            profile.weeklyRestRules.regularRestMinutes,
        );
        infringements.push({
            allowedValueMinutes: profile.weeklyRestRules.regularRestMinutes,
            category: 'weeklyRest',
            excessOrDeficitMinutes: deficitMinutes,
            id: `weekly-rest-regular-${firstWeek.key}`,
            legalReference: {
                article: 'Art. 8(6)',
                description: 'No regular weekly rest period of at least 45 hours in two consecutive weeks',
                regulation: profile.regulationName,
                sourceUrl: EU_561_2006_CONSOLIDATED_URL,
            },
            measuredValueMinutes: measuredMinutes,
            profileId: profile.profileId,
            recordedAt: reference.interval.start,
            ruleId: 'WEEKLY_REST_REGULAR_MISSING',
            severity: calculateDeficitSeverity(deficitMinutes, profile, 'WEEKLY_REST_REGULAR_MISSING'),
            source: reference.interval.source,
            title: 'Regular Weekly Rest Missing',
        });
    }

    return { assessments, infringements };
}

function createMobilityBaselineAssessments(
    weeks: readonly IWeekSpan[],
    restSpans: readonly IRestSpan[],
    profile: IRuleProfile,
): readonly IComplianceAssessment[] {
    const effectiveFrom = mobilityEffectiveFrom(profile);
    if (effectiveFrom === null) {
        return [];
    }

    const assessments: IComplianceAssessment[] = [];
    const regularRestMs = profile.weeklyRestRules.regularRestMinutes * MILLISECONDS_PER_MINUTE;
    const postEffectiveRegularRest = restSpans.find(
        (rest) => rest.start >= effectiveFrom && rest.end - rest.start >= regularRestMs,
    );
    if (postEffectiveRegularRest !== undefined) {
        assessments.push(
            mobilityAssessment(
                'WEEKLY_REST_VEHICLE_ACCOMMODATION_REVIEW',
                'Art. 8(8)',
                'Vehicle and accommodation facts for regular or compensatory weekly rest are not recorded in tachograph activity data',
                profile,
                'document',
                postEffectiveRegularRest,
            ),
        );
    }

    const postEffectiveWeeks = weeks.filter((week) => week.start >= effectiveFrom);
    if (postEffectiveWeeks.length >= 4) {
        assessments.push(
            mobilityAssessment(
                'DRIVER_RETURN_ORGANISATION_REVIEW',
                'Art. 8(8a)',
                'Employer organisation of a return opportunity within each four-week period, and before compensatory regular rest after two consecutive reductions, requires evidence outside the tachograph file',
                profile,
                'document',
                undefined,
            ),
        );
    }

    return assessments;
}

// Reg. 561/2006 Art. 8(6): evaluates weekly rest quotas over consecutive weeks and max 6x24h rest spacing.
// Requires pre-merged contiguous intervals to handle spans across UTC midnights.
export interface IWeeklyRestEvaluationResult {
    readonly assessments: readonly IComplianceAssessment[];
    readonly infringements: readonly IInfringement[];
}

export function evaluateWeeklyRestCompliance(
    intervals: readonly EvaluationInterval[],
    profile: IRuleProfile,
): IWeeklyRestEvaluationResult {
    if (intervals.length === 0) {
        return { assessments: [], infringements: [] };
    }

    const reducedRestMs = profile.weeklyRestRules.reducedRestMinutes * MILLISECONDS_PER_MINUTE;
    const fileStart = intervals[0]?.start ?? 0;
    const fileEnd = intervals.at(-1)?.end ?? 0;

    const restSpans: IRestSpan[] = [];
    for (const interval of intervals) {
        if (interval.activity === 'breakOrRest') {
            const durationMs = Math.max(0, interval.end - interval.start);
            if (durationMs >= reducedRestMs) {
                restSpans.push({ end: interval.end, interval, start: interval.start });
            }
        }
    }

    const weeks = fullWeeksWithinDocument(fileStart, fileEnd);
    const regularRestResult = evaluateRegularRestPresence(weeks, restSpans, intervals, profile);

    return {
        assessments: [...createMobilityBaselineAssessments(weeks, restSpans, profile), ...regularRestResult.assessments],
        infringements: [...evaluateMaxRestSpacing(restSpans, fileEnd, profile), ...regularRestResult.infringements],
    };
}

export function evaluateWeeklyRestInfringements(
    intervals: readonly EvaluationInterval[],
    profile: IRuleProfile,
): readonly IInfringement[] {
    return evaluateWeeklyRestCompliance(intervals, profile).infringements;
}
