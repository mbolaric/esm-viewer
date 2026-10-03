import type { ISourceReference, UtcTimestamp } from '#tachograph-domain';
import type { EvaluationInterval, EvidencedEvaluationInterval } from '../unrecorded-time.js';
import { MILLISECONDS_PER_MINUTE } from '#time';

import type { IComplianceAssessment } from '../compliance-assessment.js';
import { isQualifyingDailyRest, nextDailyCycleAnchor, resolveDailyCycleWindow } from '../daily-cycle.js';
import type { IInfringement } from '../infringement.js';
import { EU_561_2006_CONSOLIDATED_URL } from '../legal-references.js';
import { createDailyCyclePolicy, type IMultiManningCyclePolicy } from '../multi-manning.js';
import { calculateDeficitSeverity, measureDeficitMinutes, type IRuleProfile } from '../rule-profile.js';

// Art. 8(4): at most 3 reduced daily rests between weekly rests; counter resets on weekly rest.
// Weekly-rest boundaries are derived unclipped up front because >=24h rests exceed the 24h daily-rest window.
// Art. 8(3): a daily rest may extend into a weekly rest, so the weekly rest also closes the partition it ends:
// the part of it inside the last 24h window counts as that cycle's daily rest.
function partitionByWeeklyRest(
    intervals: readonly EvaluationInterval[],
    weeklyRestMs: number,
): readonly {
    readonly initialAnchor: number | null;
    readonly intervals: readonly EvaluationInterval[];
}[] {
    const partitions: { initialAnchor: number | null; intervals: EvaluationInterval[] }[] = [
        { initialAnchor: null, intervals: [] },
    ];

    for (const interval of intervals) {
        if (interval.activity === 'breakOrRest' && interval.end - interval.start >= weeklyRestMs) {
            partitions.at(-1)?.intervals.push(interval);
            partitions.push({ initialAnchor: interval.end, intervals: [] });
            continue;
        }
        partitions.at(-1)?.intervals.push(interval);
    }

    return partitions;
}

export interface IDailyRestEvaluationResult {
    readonly assessments: readonly IComplianceAssessment[];
    readonly infringements: readonly IInfringement[];
}

// Evaluates daily rest compliance under Regulation (EC) 561/2006 Art. 8.
// Requires pre-merged contiguous activity intervals so midnight splits do not break qualifying rest.
export function evaluateDailyRestCompliance(
    intervals: readonly EvaluationInterval[],
    profile: IRuleProfile,
): IDailyRestEvaluationResult {
    if (intervals.length === 0) {
        return { assessments: [], infringements: [] };
    }

    const weeklyRestMs = profile.weeklyRestRules.reducedRestMinutes * MILLISECONDS_PER_MINUTE;
    const partitions = partitionByWeeklyRest(intervals, weeklyRestMs);
    // Built from every interval so a duty period is qualified the same way as in the driving evaluator.
    const cyclePolicy = createDailyCyclePolicy(intervals, profile);

    const assessments: IComplianceAssessment[] = [];
    const infringements: IInfringement[] = [];
    for (const { initialAnchor, intervals: partitionIntervals } of partitions) {
        const result = evaluateDailyRestCycles(partitionIntervals, profile, initialAnchor, cyclePolicy);
        assessments.push(...result.assessments);
        infringements.push(...result.infringements);
    }

    return { assessments, infringements };
}

export function evaluateRestInfringements(
    intervals: readonly EvaluationInterval[],
    profile: IRuleProfile,
): readonly IInfringement[] {
    return evaluateDailyRestCompliance(intervals, profile).infringements;
}

function ferryTrainAssessment(
    reference: EvidencedEvaluationInterval,
    profile: IRuleProfile,
    idSuffix: string,
): IComplianceAssessment {
    return {
        category: 'ferryDerogation',
        id: `daily-rest-ferry-train-interruption-${idSuffix}`,
        legalReference: {
            article: 'Art. 9(1)',
            description:
                'A daily rest interrupted within the ferry/train limits (at most two interruptions, one hour in total) still requires evidence that the driver accompanied the vehicle and had bunk/couchette access, which tachograph activity data alone cannot establish',
            regulation: profile.regulationName,
            sourceUrl: EU_561_2006_CONSOLIDATED_URL,
        },
        profileId: profile.profileId,
        recordedAt: reference.start,
        ruleId: 'DAILY_REST_FERRY_TRAIN_INTERRUPTION_REVIEW',
        source: reference.source,
        status: 'externalEvidenceRequired',
    };
}

function multiManningRestInfringement(
    restMs: number,
    minDailyRestMinutes: number,
    profile: IRuleProfile,
    shiftStart: number,
    recordedAt: UtcTimestamp,
    source: ISourceReference,
): IInfringement {
    const { deficitMinutes, measuredMinutes } = measureDeficitMinutes(restMs, minDailyRestMinutes);
    return {
        allowedValueMinutes: minDailyRestMinutes,
        category: 'dailyRest',
        excessOrDeficitMinutes: deficitMinutes,
        id: `daily-rest-multi-manning-${String(shiftStart)}`,
        legalReference: {
            article: 'Art. 8(5)',
            description: 'Insufficient daily rest period within 30 hours (multi-manning)',
            regulation: profile.regulationName,
        },
        measuredValueMinutes: measuredMinutes,
        profileId: profile.profileId,
        recordedAt,
        ruleId: 'DAILY_REST_MULTI_MANNING',
        severity: calculateDeficitSeverity(deficitMinutes, profile, 'DAILY_REST_MULTI_MANNING'),
        source,
        title: 'Insufficient Daily Rest (Multi-Manning)',
    };
}

function evaluateDailyRestCycles(
    intervals: readonly EvaluationInterval[],
    profile: IRuleProfile,
    initialAnchor: number | null,
    cyclePolicy: IMultiManningCyclePolicy,
): IDailyRestEvaluationResult {
    if (intervals.length === 0) {
        return { assessments: [], infringements: [] };
    }

    const assessments: IComplianceAssessment[] = [];
    const infringements: IInfringement[] = [];
    const requiredRestMs = profile.dailyRestRules.regularRestMinutes * MILLISECONDS_PER_MINUTE;
    const reducedRestMs = profile.dailyRestRules.reducedRestMinutes * MILLISECONDS_PER_MINUTE;
    const splitRest = profile.dailyRestRules.splitRest;
    const fileEndTimestamp = intervals.at(-1)?.end ?? 0;

    let reducedRestCount = 0;
    let i = 0;
    // Art. 8(2): 24h window runs from the end of prior rest. Unobserved rest or gaps wider
    // than a window restart the anchor from the next evidence rather than assuming violations.
    let cycleAnchor: number | null = initialAnchor;

    while (i < intervals.length) {
        const current = intervals[i];
        if (current === undefined) {
            break;
        }

        // Availability is neither working time (Dir. 2002/15/EC) nor rest (Reg. 561/2006);
        // it consumes elapsed cycle time once anchored, but cannot anchor duty on its own.
        if (current.activity !== 'driving' && current.activity !== 'work') {
            i++;
            continue;
        }

        const cycleWindow = resolveDailyCycleWindow(cycleAnchor, current.start, cyclePolicy);
        const shiftStart = cycleWindow.start;
        const windowEnd = cycleWindow.end;
        // Art. 8(5): a qualifying multi-manning duty period needs 9h of rest within its 30h window instead of Art. 8(2).
        const multiManningRules = cyclePolicy.qualify(shiftStart).status === 'crew' ? profile.multiManningRules : null;
        const minimumRestMs =
            multiManningRules === null ? reducedRestMs : multiManningRules.minDailyRestMinutes * MILLISECONDS_PER_MINUTE;

        const restSegments: {
            durationMs: number;
            end: number;
            interval: EvidencedEvaluationInterval;
            // Position of `interval` in `intervals`, so a qualifying rest can advance the cursor without a search.
            intervalIndex: number;
            start: number;
        }[] = [];

        // Preceding rest closed the prior cycle; crediting it here would double-count rest across windows.
        let nextCandidateIdx = i + 1;

        for (let j = i; j < intervals.length; j++) {
            const candidate = intervals[j];
            if (candidate === undefined || candidate.start >= windowEnd) {
                nextCandidateIdx = j;
                break;
            }

            if (candidate.activity === 'breakOrRest') {
                const effectiveStart = Math.max(candidate.start, shiftStart);
                const effectiveEnd = Math.min(candidate.end, windowEnd);
                const effectiveDuration = Math.max(0, effectiveEnd - effectiveStart);
                if (effectiveDuration > 0) {
                    restSegments.push({
                        durationMs: effectiveDuration,
                        end: effectiveEnd,
                        interval: candidate,
                        intervalIndex: j,
                        start: effectiveStart,
                    });
                }
            }
            nextCandidateIdx = j + 1;
        }

        const maxSingleRestMs = restSegments.reduce((max, s) => Math.max(max, s.durationMs), 0);
        const lastRestInterval = restSegments.at(-1)?.interval ?? current;

        const hasValidSplitRest = ((): boolean => {
            if (splitRest === null) {
                return false;
            }
            const firstPeriodMs = splitRest.firstPeriodMinutes * MILLISECONDS_PER_MINUTE;
            const secondPeriodMs = splitRest.secondPeriodMinutes * MILLISECONDS_PER_MINUTE;
            return restSegments.some(
                (first, idx) =>
                    first.durationMs >= firstPeriodMs &&
                    restSegments.slice(idx + 1).some((second) => second.durationMs >= secondPeriodMs),
            );
        })();

        // Art. 9(1): ferry/train regular daily rest allows up to 2 interruptions totaling <= 1 hr.
        // Activity data cannot confirm ferry accompaniment, so matching patterns emit a review assessment
        // rather than suppressing the daily rest infringement.
        const ferryRules = profile.ferryRules;
        const combinedRestMs = restSegments.reduce((sum, segment) => sum + segment.durationMs, 0);
        const firstRestSegment = restSegments[0];
        const lastRestSegment = restSegments.at(-1);
        const interruptionCount = restSegments.length - 1;
        const totalInterruptionMs =
            firstRestSegment !== undefined && lastRestSegment !== undefined
                ? lastRestSegment.end - firstRestSegment.start - combinedRestMs
                : 0;
        const isFerryTrainInterruptedRegularRest =
            ferryRules !== undefined &&
            lastRestSegment !== undefined &&
            restSegments.length >= 2 &&
            interruptionCount <= ferryRules.maxInterruptions &&
            totalInterruptionMs <= ferryRules.maxInterruptionDurationMinutes * MILLISECONDS_PER_MINUTE &&
            combinedRestMs >= requiredRestMs;

        const isTailIncomplete = windowEnd > fileEndTimestamp && windowEnd - fileEndTimestamp >= minimumRestMs - maxSingleRestMs;

        if (!isTailIncomplete) {
            if (
                isFerryTrainInterruptedRegularRest &&
                (maxSingleRestMs < reducedRestMs ||
                    (maxSingleRestMs < requiredRestMs && reducedRestCount + 1 > profile.dailyRestRules.maxReductionsPerPeriod)) &&
                !hasValidSplitRest
            ) {
                assessments.push(ferryTrainAssessment(lastRestSegment.interval, profile, String(shiftStart)));
            }
            if (multiManningRules !== null && maxSingleRestMs < minimumRestMs && !hasValidSplitRest) {
                infringements.push(
                    multiManningRestInfringement(
                        maxSingleRestMs,
                        multiManningRules.minDailyRestMinutes,
                        profile,
                        shiftStart,
                        current.start,
                        lastRestInterval.source,
                    ),
                );
            } else if (maxSingleRestMs < reducedRestMs && !hasValidSplitRest) {
                const isReductionAllowed = reducedRestCount < profile.dailyRestRules.maxReductionsPerPeriod;
                const requiredDailyRestMinutes = isReductionAllowed
                    ? profile.dailyRestRules.reducedRestMinutes
                    : profile.dailyRestRules.regularRestMinutes;
                const { deficitMinutes, measuredMinutes } = measureDeficitMinutes(maxSingleRestMs, requiredDailyRestMinutes);
                const severity = calculateDeficitSeverity(
                    deficitMinutes,
                    profile,
                    isReductionAllowed ? 'DAILY_REST_INSUFFICIENT' : 'DAILY_REST_INSUFFICIENT_REGULAR',
                );

                infringements.push({
                    allowedValueMinutes: requiredDailyRestMinutes,
                    category: 'dailyRest',
                    excessOrDeficitMinutes: deficitMinutes,
                    id: `daily-rest-${String(shiftStart)}`,
                    legalReference: {
                        article: 'Art. 8(2)',
                        description: 'Insufficient daily rest within 24-hour period',
                        regulation: profile.regulationName,
                    },
                    measuredValueMinutes: measuredMinutes,
                    profileId: profile.profileId,
                    recordedAt: current.start,
                    ruleId: 'DAILY_REST_INSUFFICIENT',
                    severity,
                    source: lastRestInterval.source,
                    title: 'Insufficient Daily Rest',
                });
            } else if (maxSingleRestMs < requiredRestMs && !hasValidSplitRest) {
                reducedRestCount++;
                if (reducedRestCount > profile.dailyRestRules.maxReductionsPerPeriod) {
                    const { deficitMinutes, measuredMinutes } = measureDeficitMinutes(
                        maxSingleRestMs,
                        profile.dailyRestRules.regularRestMinutes,
                    );
                    const severity = calculateDeficitSeverity(deficitMinutes, profile, 'DAILY_REST_REDUCTIONS_EXCEEDED');

                    infringements.push({
                        allowedValueMinutes: profile.dailyRestRules.regularRestMinutes,
                        category: 'dailyRest',
                        excessOrDeficitMinutes: deficitMinutes,
                        id: `daily-rest-exceeded-reductions-${String(shiftStart)}`,
                        legalReference: {
                            article: 'Art. 8(4)',
                            description: 'Maximum reduced daily rest periods exceeded',
                            regulation: profile.regulationName,
                        },
                        measuredValueMinutes: measuredMinutes,
                        profileId: profile.profileId,
                        recordedAt: current.start,
                        ruleId: 'DAILY_REST_REDUCTIONS_EXCEEDED',
                        severity,
                        source: lastRestInterval.source,
                        title: 'Excessive Reduced Rest Periods',
                    });
                }
            }
        }

        // Interrupted ferry/train rest does not qualify as cycle-ending rest without external proof.
        const qualifyingRest = restSegments.find((s) => s.durationMs >= reducedRestMs);
        if (qualifyingRest !== undefined) {
            // Use qualifying rest's actual end rather than window-clipped end to preserve credit for spillover rest.
            cycleAnchor = nextDailyCycleAnchor(cycleWindow, qualifyingRest.interval.end);
            // Ensure index advances past evaluated duty to avoid infinite loops on preceding rests.
            i = Math.max(i + 1, qualifyingRest.intervalIndex + 1);
        } else {
            // Rest spanning past window end cannot satisfy this window, but anchors the subsequent window.
            const spanningRest = restSegments.find(
                (segment) => segment.interval.end > windowEnd && isQualifyingDailyRest(segment.interval, profile),
            );
            cycleAnchor = nextDailyCycleAnchor(cycleWindow, spanningRest?.interval.end ?? null);
            i = Math.max(i + 1, nextCandidateIdx);
        }
    }

    return { assessments, infringements };
}
