import { evaluateDocumentCompliance } from '#compliance';
import { EU_561_2006_STANDARD } from '#compliance-rules';
import { createLocalisationServiceFake, fixtureSingleDriverCrew, fixtureSourceReference, fixtureUtcTimestamp } from '#testing';
import { createRecordedActivityInterval, type ActivityKind, type IRecordedActivityInterval } from '#viewer-domain';
import { describe, expect, it } from 'vitest';

import { createDriverCardActivityDocumentFixtureAcrossDays } from './driver-card-activity-document-fixture.js';
import { createActivitySectionViewModel, type IActivityDayViewModel } from '../view-models/activity-view-model.js';

const hour = 60 * 60 * 1_000;
const minute = 60 * 1_000;
const day1Midnight = Date.UTC(2026, 0, 5);
const day2Midnight = day1Midnight + 24 * hour;
const day5Midnight = day1Midnight + 4 * 24 * hour;

function interval(activity: ActivityKind, start: number, end: number, path: string): IRecordedActivityInterval {
    const created = createRecordedActivityInterval(
        activity,
        fixtureUtcTimestamp(start),
        fixtureUtcTimestamp(end),
        fixtureSourceReference('driverCard', 'g1', `/activities/${path}`),
        fixtureSingleDriverCrew,
    );
    if (created === null) {
        throw new TypeError('The continuous-driving compliance fixture interval must be valid.');
    }
    return created;
}

// Builds the day view from a real compliance evaluation, so the notice and the findings come from the same document.
function evaluate(
    days: readonly { readonly intervals: readonly IRecordedActivityInterval[]; readonly midnight: number }[],
    openedAt: number,
): { readonly continuousDrivingFindings: number; readonly days: readonly IActivityDayViewModel[] } {
    const document = createDriverCardActivityDocumentFixtureAcrossDays({
        days,
        openedAt: fixtureUtcTimestamp(openedAt),
    });
    const evaluation = evaluateDocumentCompliance(document, EU_561_2006_STANDARD);
    const result = createActivitySectionViewModel(document, createLocalisationServiceFake(), EU_561_2006_STANDARD, evaluation);
    if (!result.ok) {
        throw new TypeError('The continuous-driving compliance fixture document must produce a section view model.');
    }
    return {
        continuousDrivingFindings: evaluation.infringements.filter(
            (infringement) => infringement.ruleId === 'BREAK_CONTINUOUS_DRIVING',
        ).length,
        days: result.value.days,
    };
}

function progressFor(day: IActivityDayViewModel | undefined): { readonly status: string; readonly valueMs: number } {
    if (day === undefined) {
        throw new TypeError('The continuous-driving compliance fixture day must exist.');
    }
    return {
        status: day.continuousDriving.status,
        valueMs: day.continuousDriving.currentContinuousDriving.value,
    };
}

// The notice and the Compliance screen read the same evaluation, so they must never disagree about one document.
describe('continuous-driving notice against the compliance evaluation', () => {
    it('treats a card-out gap inside the day as rest, like the break evaluator does', () => {
        const { continuousDrivingFindings, days } = evaluate(
            [
                {
                    intervals: [
                        interval('driving', day1Midnight + 8 * hour, day1Midnight + 12 * hour, '0'),
                        interval('driving', day1Midnight + 14 * hour, day1Midnight + 15 * hour, '1'),
                    ],
                    midnight: day1Midnight,
                },
            ],
            day1Midnight + 20 * hour,
        );

        expect(continuousDrivingFindings).toBe(0);
        expect(progressFor(days[0])).toEqual({ status: 'normal', valueMs: hour });
    });

    it('keeps a 45-minute break that midnight splits as one break', () => {
        const { continuousDrivingFindings, days } = evaluate(
            [
                {
                    intervals: [
                        interval('driving', day1Midnight + 19 * hour + 40 * minute, day1Midnight + 23 * hour + 40 * minute, '0'),
                        interval('breakOrRest', day1Midnight + 23 * hour + 40 * minute, day2Midnight, '1'),
                    ],
                    midnight: day1Midnight,
                },
                {
                    intervals: [
                        interval('breakOrRest', day2Midnight, day2Midnight + 25 * minute, '2'),
                        interval('driving', day2Midnight + 25 * minute, day2Midnight + 85 * minute, '3'),
                    ],
                    midnight: day2Midnight,
                },
            ],
            day2Midnight + 2 * hour,
        );

        expect(continuousDrivingFindings).toBe(0);
        expect(progressFor(days[1])).toEqual({ status: 'normal', valueMs: hour });
    });

    it('resets the stint across days with no records at all', () => {
        const { continuousDrivingFindings, days } = evaluate(
            [
                {
                    intervals: [
                        interval('driving', day1Midnight + 6 * hour, day1Midnight + 10 * hour, '0'),
                        interval('work', day1Midnight + 10 * hour, day1Midnight + 16 * hour, '1'),
                    ],
                    midnight: day1Midnight,
                },
                {
                    intervals: [
                        interval('driving', day5Midnight + 6 * hour, day5Midnight + 10 * hour, '2'),
                        interval('work', day5Midnight + 10 * hour, day5Midnight + 16 * hour, '3'),
                    ],
                    midnight: day5Midnight,
                },
            ],
            day5Midnight + 20 * hour,
        );

        expect(continuousDrivingFindings).toBe(0);
        expect(progressFor(days[1])).toEqual({ status: 'warning', valueMs: 4 * hour });
    });

    it('still shows the danger state on the day the stint crosses the limit (control case)', () => {
        const { continuousDrivingFindings, days } = evaluate(
            [
                {
                    intervals: [interval('driving', day1Midnight + 6 * hour, day1Midnight + 11 * hour, '0')],
                    midnight: day1Midnight,
                },
            ],
            day1Midnight + 12 * hour,
        );

        expect(continuousDrivingFindings).toBe(1);
        expect(progressFor(days[0])).toEqual({ status: 'danger', valueMs: 5 * hour });
    });

    it('samples a midnight-crossing stint on both days without restarting it', () => {
        const { days } = evaluate(
            [
                {
                    intervals: [interval('driving', day1Midnight + 22 * hour, day2Midnight, '0')],
                    midnight: day1Midnight,
                },
                {
                    intervals: [interval('driving', day2Midnight, day2Midnight + 3 * hour, '1')],
                    midnight: day2Midnight,
                },
            ],
            day2Midnight + 4 * hour,
        );

        expect(progressFor(days[0]).valueMs).toBe(2 * hour);
        expect(progressFor(days[1]).valueMs).toBe(5 * hour);
        expect(progressFor(days[1]).status).toBe('danger');
        // The record projection still lists the day's own recorded intervals.
        expect(days[1]?.records.some((record) => record.record.activity === 'driving')).toBe(true);
    });
});
