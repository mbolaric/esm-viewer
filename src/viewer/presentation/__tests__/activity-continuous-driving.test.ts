import type { ILocalisationService } from '#localization';
import type {
    ActivityKind,
    DurationMilliseconds,
    IRecordedActivityInterval,
    ISourceReference,
    UtcTimestamp,
} from '#viewer-domain';
import {
    createRecordedActivityInterval,
    createSourceReference,
    isDurationMilliseconds,
    isJsonPointer,
    isUtcTimestamp,
} from '#viewer-domain';
import { describe, expect, it } from 'vitest';

import { EU_561_2006_STANDARD, UK_GB_DOMESTIC } from '#compliance';

import {
    createActivitySectionViewModel,
    dutyShiftBelongsToUtcDay,
    getDutyShiftDayRelation,
    type IDutyShiftViewModel,
} from '../view-models/activity-view-model.js';
import { createLocalisationServiceFake, fixtureSingleDriverCrew } from '#testing';
import {
    createDriverCardActivityDocumentFixture,
    createDriverCardActivityDocumentFixtureAcrossDays,
} from './driver-card-activity-document-fixture.js';
import { NO_COMPLIANCE_EVALUATION } from './activity-view-model-fixture.js';

type ViewerLocalisationService = ILocalisationService<UtcTimestamp, number>;

function utc(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The continuous-driving timestamp fixture must be valid.');
    }
    return value;
}

function cardSource(path: string): ISourceReference<'g1', 'driverCard'> {
    if (!isJsonPointer(path)) {
        throw new TypeError('The continuous-driving source fixture must be valid.');
    }
    return createSourceReference('driverCard', 'g1', path);
}

const hour = 3_600_000;
const minute = 60_000;

function interval(activity: ActivityKind, startMs: number, endMs: number, path: string): IRecordedActivityInterval {
    const interval = createRecordedActivityInterval(
        activity,
        utc(startMs),
        utc(endMs),
        cardSource(path),
        fixtureSingleDriverCrew,
    );
    if (interval === null) {
        throw new TypeError('The continuous-driving interval fixture must be valid.');
    }
    return interval;
}

function progressDocument(
    midnight: number,
    intervals: readonly IRecordedActivityInterval[],
): ReturnType<typeof createActivitySectionViewModel> {
    const document = createDriverCardActivityDocumentFixture({
        displayName: 'continuous-driving.ddd',
        intervals,
        midnight,
        openedAt: utc(midnight + 10_000),
        sha256: 'b'.repeat(64),
    });
    return createActivitySectionViewModel(document, localisation(), EU_561_2006_STANDARD, NO_COMPLIANCE_EVALUATION);
}

function localisation(): ViewerLocalisationService {
    return createLocalisationServiceFake({ locale: 'en', timeZone: 'UTC' });
}

function progressOfDay(
    viewModel: ReturnType<typeof createActivitySectionViewModel>,
    dayIndex: number,
): {
    currentMs: number;
    maxMs: number;
    peakMs: number | null;
    percentage: number;
    status: 'danger' | 'normal' | 'warning';
} {
    if (!viewModel.ok) {
        throw new TypeError('The continuous-driving view model must succeed.');
    }
    const day = viewModel.value.days[dayIndex];
    if (day === undefined) {
        throw new TypeError('The continuous-driving view model must contain a day.');
    }
    const progress = day.continuousDriving;
    return {
        currentMs: progress.currentContinuousDriving.value,
        maxMs: progress.maxContinuousDrivingLimit.value,
        peakMs: progress.peakContinuousDriving?.value ?? null,
        percentage: progress.percentage,
        status: progress.status,
    };
}

function unwrapTwoDays(viewModel: ReturnType<typeof createActivitySectionViewModel>): {
    day1: NonNullable<Extract<typeof viewModel, { ok: true }>['value']['days'][number]>;
    day2: NonNullable<Extract<typeof viewModel, { ok: true }>['value']['days'][number]>;
} {
    if (!viewModel.ok) {
        throw new TypeError('The duty-shift view model must succeed.');
    }
    const day1 = viewModel.value.days[0];
    const day2 = viewModel.value.days[1];
    if (day1 === undefined || day2 === undefined) {
        throw new TypeError('The duty-shift view model must contain both days.');
    }
    return { day1, day2 };
}

function progressOf(viewModel: ReturnType<typeof createActivitySectionViewModel>): {
    currentMs: number;
    maxMs: number;
    peakMs: number | null;
    percentage: number;
    status: 'danger' | 'normal' | 'warning';
} {
    return progressOfDay(viewModel, 0);
}

describe('calculateContinuousDrivingProgress', () => {
    it('accumulates driving towards the 4.5-hour statutory limit', () => {
        const midnight = Date.UTC(2026, 6, 27);
        const progress = progressOf(
            progressDocument(midnight, [interval('driving', midnight, midnight + 3 * hour, '/activities/0')]),
        );

        // 3h of 4.5h = 66.7% -> 67%, below the 80% warning threshold.
        expect(progress.percentage).toBe(67);
        expect(progress.status).toBe('normal');
        expect(progress.maxMs).toBe(4 * hour + 30 * minute);
    });

    it('warns at or above 80% of the limit', () => {
        const midnight = Date.UTC(2026, 6, 27);
        const progress = progressOf(
            progressDocument(midnight, [interval('driving', midnight, midnight + 4 * hour, '/activities/0')]),
        );

        // 4h of 4.5h = 88.9% -> 89%.
        expect(progress.percentage).toBe(89);
        expect(progress.status).toBe('warning');
    });

    it('caps at 100% and marks danger only beyond the limit', () => {
        const midnight = Date.UTC(2026, 6, 27);

        const atLimit = progressOf(
            progressDocument(midnight, [interval('driving', midnight, midnight + 4 * hour + 30 * minute, '/activities/0')]),
        );
        expect(atLimit.percentage).toBe(100);
        expect(atLimit.status).toBe('warning');

        const overLimit = progressOf(
            progressDocument(midnight, [interval('driving', midnight, midnight + 5 * hour, '/activities/0')]),
        );
        expect(overLimit.percentage).toBe(100);
        expect(overLimit.status).toBe('danger');
    });

    it('resets accumulation after a full 45-minute break', () => {
        const midnight = Date.UTC(2026, 6, 27);
        const progress = progressOf(
            progressDocument(midnight, [
                interval('driving', midnight, midnight + 2 * hour, '/activities/0'),
                interval('breakOrRest', midnight + 2 * hour, midnight + 2 * hour + 45 * minute, '/activities/1'),
                interval('driving', midnight + 2 * hour + 45 * minute, midnight + 4 * hour + 45 * minute, '/activities/2'),
            ]),
        );

        // The break resets the counter; the 2h driven afterward is the
        // current value (44%). It happens to equal the pre-break peak, so
        // there is no separate historical peak to show.
        expect(progress.percentage).toBe(44);
        expect(progress.status).toBe('normal');
        expect(progress.peakMs).toBeNull();
    });

    it('resets accumulation after a split break of 15 minutes then 30 minutes', () => {
        const midnight = Date.UTC(2026, 6, 27);
        const progress = progressOf(
            progressDocument(midnight, [
                interval('driving', midnight, midnight + 2 * hour, '/activities/0'),
                interval('breakOrRest', midnight + 2 * hour, midnight + 2 * hour + 15 * minute, '/activities/1'),
                interval('driving', midnight + 2 * hour + 15 * minute, midnight + 4 * hour + 15 * minute, '/activities/2'),
                interval('breakOrRest', midnight + 4 * hour + 15 * minute, midnight + 4 * hour + 45 * minute, '/activities/3'),
                interval('driving', midnight + 4 * hour + 45 * minute, midnight + 6 * hour + 45 * minute, '/activities/4'),
            ]),
        );

        // The 30-minute second break resets the current clock to just the
        // 2h driven afterward (44%, normal) - it must not keep showing the
        // 4h peak reached before the reset as a live warning (VIEWER-02).
        // That 4h is still surfaced separately, as historical evidence.
        expect(progress.percentage).toBe(44);
        expect(progress.status).toBe('normal');
        expect(progress.peakMs).toBe(4 * hour);
    });

    it('does not reset on a break shorter than 15 minutes', () => {
        const midnight = Date.UTC(2026, 6, 27);
        const progress = progressOf(
            progressDocument(midnight, [
                interval('driving', midnight, midnight + 2 * hour, '/activities/0'),
                interval('breakOrRest', midnight + 2 * hour, midnight + 2 * hour + 10 * minute, '/activities/1'),
                interval('driving', midnight + 2 * hour + 10 * minute, midnight + 4 * hour + 10 * minute, '/activities/2'),
            ]),
        );

        // A 10-minute pause is not a qualifying break: driving keeps
        // accumulating straight through it, so current and peak are both
        // still 4h (89%, warning) - there is nothing separately historical
        // to show, since the clock never actually stopped.
        expect(progress.percentage).toBe(89);
        expect(progress.status).toBe('warning');
        expect(progress.peakMs).toBeNull();
    });

    it('clears the live warning after a valid break, showing the earlier peak only as historical evidence (VIEWER-02)', () => {
        const midnight = Date.UTC(2026, 6, 27);
        const progress = progressOf(
            progressDocument(midnight, [
                interval('driving', midnight, midnight + 4 * hour, '/activities/0'),
                interval('breakOrRest', midnight + 4 * hour, midnight + 4 * hour + 45 * minute, '/activities/1'),
                interval('driving', midnight + 4 * hour + 45 * minute, midnight + 5 * hour + 45 * minute, '/activities/2'),
            ]),
        );

        // The 45-minute break genuinely reset the legal clock: current
        // reflects only the 1h driven since (22%, normal), not the earlier
        // 4h peak treated as if it were still live. The 4h is still
        // reachable, but only as separate, explicitly historical evidence.
        expect(progress.percentage).toBe(22);
        expect(progress.status).toBe('normal');
        expect(progress.peakMs).toBe(4 * hour);
    });

    it('carries continuous driving across a UTC midnight crossing with no qualifying break (VIEWER-01)', () => {
        const day1Midnight = Date.UTC(2026, 6, 27);
        const day2Midnight = Date.UTC(2026, 6, 28);

        // Driving from 22:00 to 03:00 with no break: 3h before midnight,
        // 2h after - individually under the 4.5h limit, but the driver has
        // actually been driving continuously for 5h by 03:00.
        const viewModel = createActivitySectionViewModel(
            createDriverCardActivityDocumentFixtureAcrossDays({
                days: [
                    {
                        intervals: [interval('driving', day1Midnight - 3 * hour, day1Midnight, '/activities/0')],
                        midnight: day1Midnight - 24 * hour,
                    },
                    {
                        intervals: [interval('driving', day2Midnight, day2Midnight + 3 * hour, '/activities/1')],
                        midnight: day2Midnight,
                    },
                ],
                openedAt: utc(day2Midnight + 3 * hour + 10_000),
            }),
            localisation(),
            EU_561_2006_STANDARD,
            NO_COMPLIANCE_EVALUATION,
        );

        // Day 1 (ending at midnight, 3h in): under the limit on its own.
        const day1Progress = progressOfDay(viewModel, 0);
        expect(day1Progress.percentage).toBe(67);
        expect(day1Progress.status).toBe('normal');

        // Day 2 must already reflect the 3h carried over from before
        // midnight, so by 02:00 into day 2 (5h total) it is in danger - not
        // reset to "2h into a fresh day, still normal" the way isolating
        // each day would (mis)report it.
        const day2Progress = progressOfDay(viewModel, 1);
        expect(day2Progress.percentage).toBe(100);
        expect(day2Progress.status).toBe('danger');
    });

    it('still resets at a qualifying break that happens to fall right after midnight (VIEWER-01)', () => {
        const day1Midnight = Date.UTC(2026, 6, 27);
        const day2Midnight = Date.UTC(2026, 6, 28);

        const viewModel = createActivitySectionViewModel(
            createDriverCardActivityDocumentFixtureAcrossDays({
                days: [
                    {
                        intervals: [interval('driving', day1Midnight - 2 * hour, day1Midnight, '/activities/0')],
                        midnight: day1Midnight - 24 * hour,
                    },
                    {
                        intervals: [
                            interval('breakOrRest', day2Midnight, day2Midnight + 45 * minute, '/activities/1'),
                            interval(
                                'driving',
                                day2Midnight + 45 * minute,
                                day2Midnight + 2 * hour + 45 * minute,
                                '/activities/2',
                            ),
                        ],
                        midnight: day2Midnight,
                    },
                ],
                openedAt: utc(day2Midnight + 2 * hour + 45 * minute + 10_000),
            }),
            localisation(),
            EU_561_2006_STANDARD,
            NO_COMPLIANCE_EVALUATION,
        );

        // The qualifying 45-minute break just after midnight still resets
        // the carried-over 2h - day 2 shows only the 2h driven after the
        // break, not 2h (carried) + 2h (new) as if the break never counted.
        const day2Progress = progressOfDay(viewModel, 1);
        expect(day2Progress.percentage).toBe(44);
        expect(day2Progress.status).toBe('normal');
    });

    it('does not leak a stale peak from an earlier day onto a later day with a proper break in between', () => {
        const day1Midnight = Date.UTC(2026, 6, 27);
        const day2Midnight = Date.UTC(2026, 6, 28);
        const day3Midnight = Date.UTC(2026, 6, 29);

        const viewModel = createActivitySectionViewModel(
            createDriverCardActivityDocumentFixtureAcrossDays({
                days: [
                    {
                        // Day 1: drive 5h straight (danger/100%), then a
                        // qualifying 45-minute break well before midnight.
                        intervals: [
                            interval('driving', day1Midnight + 1 * hour, day1Midnight + 6 * hour, '/activities/0'),
                            interval(
                                'breakOrRest',
                                day1Midnight + 6 * hour,
                                day1Midnight + 6 * hour + 45 * minute,
                                '/activities/1',
                            ),
                        ],
                        midnight: day1Midnight,
                    },
                    {
                        // Day 2: no driving at all - a full rest day.
                        intervals: [interval('breakOrRest', day2Midnight, day2Midnight + 24 * hour, '/activities/2')],
                        midnight: day2Midnight,
                    },
                    {
                        // Day 3: just 31 minutes of driving.
                        intervals: [interval('driving', day3Midnight, day3Midnight + 31 * minute, '/activities/3')],
                        midnight: day3Midnight,
                    },
                ],
                openedAt: utc(day3Midnight + 31 * minute + 10_000),
            }),
            localisation(),
            EU_561_2006_STANDARD,
            NO_COMPLIANCE_EVALUATION,
        );

        // Day 1 ends with a valid break already taken, so its current
        // status is correctly back to normal (VIEWER-02) - the 5-hour
        // exceedance it actually had is still available as that day's own
        // historical peak evidence, just not as a live warning.
        const day1Progress = progressOfDay(viewModel, 0);
        expect(day1Progress.status).toBe('normal');
        expect(day1Progress.peakMs).toBe(5 * hour);

        // Days 2 and 3 must not keep re-displaying day 1's 5-hour peak -
        // the qualifying break at the end of day 1 already closed out that
        // continuous-driving episode, so a later day with only 31 minutes
        // of driving must not still show "45-minute break required".
        const day2Progress = progressOfDay(viewModel, 1);
        expect(day2Progress.currentMs).toBe(0);
        expect(day2Progress.status).toBe('normal');
        expect(day2Progress.peakMs).toBeNull();

        const day3Progress = progressOfDay(viewModel, 2);
        expect(day3Progress.currentMs).toBe(31 * minute);
        expect(day3Progress.status).toBe('normal');
        expect(day3Progress.peakMs).toBeNull();
    });
});

describe('duty shift crew qualification', () => {
    const day1Midnight = Date.UTC(2026, 6, 27);
    const day2Midnight = Date.UTC(2026, 6, 28);
    const document = createDriverCardActivityDocumentFixtureAcrossDays({
        days: [
            {
                intervals: [interval('driving', day1Midnight + 20 * hour, day2Midnight, '/activities/0')],
                midnight: day1Midnight,
            },
            {
                intervals: [interval('driving', day2Midnight, day2Midnight + 2 * hour, '/activities/1')],
                midnight: day2Midnight,
            },
        ],
        openedAt: utc(day2Midnight + 2 * hour + 10_000),
    });

    it('shows the 30-hour window of the compliance duty period that contains the shift', () => {
        const viewModel = createActivitySectionViewModel(document, localisation(), EU_561_2006_STANDARD, {
            ...NO_COMPLIANCE_EVALUATION,
            crewDutyPeriods: [
                {
                    qualification: { failedAt: null, status: 'crew' },
                    windowEnd: day1Midnight + 50 * hour,
                    windowStart: day1Midnight + 20 * hour,
                },
            ],
        });

        const { day1, day2 } = unwrapTwoDays(viewModel);
        expect(day1.dutyShifts[0]?.crew).toMatchObject({
            failedAt: null,
            restWindowEndDayOffset: 2,
            restWindowHours: 30,
            status: 'crew',
        });
        // The 30-hour window runs from 20:00 on day 1 to 02:00 on day 3, clipped to each day it touches.
        expect(day1.restWindows).toEqual([
            expect.objectContaining({ hours: 30, timelineEnd: 24 * hour, timelineStart: 20 * hour }),
        ]);
        expect(day2.restWindows).toEqual([expect.objectContaining({ hours: 30, timelineEnd: 24 * hour, timelineStart: 0 })]);
    });

    it('maps a credited co-driver break and resets continuous-driving progress across midnight', () => {
        const availabilityDocument = createDriverCardActivityDocumentFixtureAcrossDays({
            days: [
                {
                    intervals: [
                        interval('driving', day1Midnight + 18 * hour, day1Midnight + 22 * hour, '/activities/0'),
                        interval('availability', day1Midnight + 22 * hour, day2Midnight, '/activities/1'),
                    ],
                    midnight: day1Midnight,
                },
                {
                    intervals: [
                        interval('availability', day2Midnight, day2Midnight + hour, '/activities/2'),
                        interval('driving', day2Midnight + hour, day2Midnight + 2 * hour, '/activities/3'),
                    ],
                    midnight: day2Midnight,
                },
            ],
            openedAt: utc(day2Midnight + 2 * hour),
        });
        const creditedStart = day1Midnight + 23 * hour + 30 * minute;

        const viewModel = createActivitySectionViewModel(availabilityDocument, localisation(), EU_561_2006_STANDARD, {
            ...NO_COMPLIANCE_EVALUATION,
            creditedAvailabilityBreaks: [{ end: creditedStart + 45 * 60 * 1_000, start: creditedStart }],
        });
        const { day1, day2 } = unwrapTwoDays(viewModel);

        expect(day1.continuousDriving.currentContinuousDriving.value).toBe(4 * hour);
        expect(day2.continuousDriving.currentContinuousDriving.value).toBe(hour);

        const availabilityRecord = day1.records.find((record) => record.activity === 'availability');
        expect(day1.creditedBreaks).toEqual([
            expect.objectContaining({
                recordId: availabilityRecord?.id,
                timelineEnd: 24 * hour,
                timelineStart: 23 * hour + 30 * minute,
            }),
        ]);
    });

    it('names the driving record where the multi-manning condition failed', () => {
        const failedAt = day2Midnight + hour;
        const viewModel = createActivitySectionViewModel(document, localisation(), EU_561_2006_STANDARD, {
            ...NO_COMPLIANCE_EVALUATION,
            crewDutyPeriods: [
                {
                    qualification: { failedAt, status: 'crewFailed' },
                    windowEnd: day1Midnight + 44 * hour,
                    windowStart: day1Midnight + 20 * hour,
                },
            ],
        });

        const { day1 } = unwrapTwoDays(viewModel);
        const crew = day1.dutyShifts[0]?.crew;
        expect(crew?.status).toBe('crewFailed');
        expect(crew?.failedAt?.value).toBe(failedAt);
        expect(day1.dutyShifts[0]?.records.find((record) => record.id === crew?.failedRecordId)?.record.start).toBe(day2Midnight);
    });

    it('assigns the single-driver 24-hour rest window when no crew duty period covers the shift', () => {
        const { day1 } = unwrapTwoDays(
            createActivitySectionViewModel(document, localisation(), EU_561_2006_STANDARD, NO_COMPLIANCE_EVALUATION),
        );

        const crew = day1.dutyShifts[0]?.crew;
        expect(crew?.status).toBe('single');
        expect(crew?.restWindowHours).toBe(24);
        expect(crew?.failedAt).toBeNull();
    });
});

describe('calculateDutyShifts across a UTC midnight boundary (VIEWER-03)', () => {
    it('keeps one continuous duty shift when nothing but midnight interrupts it', () => {
        const day1Midnight = Date.UTC(2026, 6, 27);
        const day2Midnight = Date.UTC(2026, 6, 28);

        // 4h driving before midnight, 2h after, with no break at all - one
        // continuous 6h shift, not two shifts of 4h and 2h.
        const viewModel = createActivitySectionViewModel(
            createDriverCardActivityDocumentFixtureAcrossDays({
                days: [
                    {
                        intervals: [interval('driving', day1Midnight + 20 * hour, day2Midnight, '/activities/0')],
                        midnight: day1Midnight,
                    },
                    {
                        intervals: [interval('driving', day2Midnight, day2Midnight + 2 * hour, '/activities/1')],
                        midnight: day2Midnight,
                    },
                ],
                openedAt: utc(day2Midnight + 2 * hour + 10_000),
            }),
            localisation(),
            EU_561_2006_STANDARD,
            NO_COMPLIANCE_EVALUATION,
        );

        const { day1, day2 } = unwrapTwoDays(viewModel);

        // The continuous 6h shift is visible on both days it touches,
        // rather than disappearing on day 2 and showing "no active duty".
        expect(day1.dutyShifts).toHaveLength(1);
        expect(day1.dutyShifts[0]?.drivingDuration.value).toBe(6 * hour);
        expect(day1.dutyShifts[0]?.totalDutyDuration.value).toBe(6 * hour);
        const shift1 = day1.dutyShifts[0];
        expect(shift1).toBeDefined();
        if (shift1 !== undefined) {
            expect(getDutyShiftDayRelation(shift1, day1.midnightUtc)).toBe('continuesNextDay');
        }

        expect(day2.dutyShifts).toHaveLength(1);
        expect(day2.dutyShifts[0]?.drivingDuration.value).toBe(6 * hour);
        expect(day2.dutyShifts[0]?.totalDutyDuration.value).toBe(6 * hour);
        const shift2 = day2.dutyShifts[0];
        expect(shift2).toBeDefined();
        if (shift2 !== undefined) {
            expect(getDutyShiftDayRelation(shift2, day2.midnightUtc)).toBe('startedPreviousDay');
        }
    });

    it('still splits into two shifts when a qualifying rest itself spans midnight', () => {
        const day1Midnight = Date.UTC(2026, 6, 27);
        const day2Midnight = Date.UTC(2026, 6, 28);

        // A 10-hour qualifying rest, split by the day boundary into a 4h
        // tail on day 1 and a 6h head on day 2 - neither half alone reaches
        // the 9-hour major-rest threshold, but the driver's real, continuous
        // rest does, and must still end the shift before it.
        const viewModel = createActivitySectionViewModel(
            createDriverCardActivityDocumentFixtureAcrossDays({
                days: [
                    {
                        intervals: [
                            interval('driving', day1Midnight + 18 * hour, day1Midnight + 20 * hour, '/activities/0'),
                            interval('breakOrRest', day1Midnight + 20 * hour, day2Midnight, '/activities/1'),
                        ],
                        midnight: day1Midnight,
                    },
                    {
                        intervals: [
                            interval('breakOrRest', day2Midnight, day2Midnight + 6 * hour, '/activities/2'),
                            interval('driving', day2Midnight + 6 * hour, day2Midnight + 8 * hour, '/activities/3'),
                        ],
                        midnight: day2Midnight,
                    },
                ],
                openedAt: utc(day2Midnight + 8 * hour + 10_000),
            }),
            localisation(),
            EU_561_2006_STANDARD,
            NO_COMPLIANCE_EVALUATION,
        );

        const { day1, day2 } = unwrapTwoDays(viewModel);

        expect(day1.dutyShifts).toHaveLength(1);
        expect(day1.dutyShifts[0]?.drivingDuration.value).toBe(2 * hour);
        expect(day2.dutyShifts).toHaveLength(1);
        expect(day2.dutyShifts[0]?.drivingDuration.value).toBe(2 * hour);
    });
});

describe('continuous-driving thresholds follow the selected compliance rule profile (VIEWER-09)', () => {
    it('shows danger at 5 hours under the EU default (4.5h limit), but only normal under UK GB Domestic (5.5h limit)', () => {
        const midnight = Date.UTC(2026, 6, 27);
        const intervals = [interval('driving', midnight, midnight + 5 * hour, '/activities/0')];
        const document = createDriverCardActivityDocumentFixture({
            displayName: 'continuous-driving.ddd',
            intervals,
            midnight,
            openedAt: utc(midnight + 5 * hour + 10_000),
            sha256: 'c'.repeat(64),
        });

        // Same document, same 5h of continuous driving - only the selected
        // profile differs, matching the Compliance screen's own selector
        // (audit's exact reproduction).
        const euProgress = progressOf(
            createActivitySectionViewModel(document, localisation(), EU_561_2006_STANDARD, NO_COMPLIANCE_EVALUATION),
        );
        expect(euProgress.maxMs).toBe(4.5 * hour);
        expect(euProgress.status).toBe('danger');

        const ukProgress = progressOf(
            createActivitySectionViewModel(document, localisation(), UK_GB_DOMESTIC, NO_COMPLIANCE_EVALUATION),
        );
        expect(ukProgress.maxMs).toBe(5.5 * hour);
        // Under the EU default, 5h is already past the 4.5h limit (danger).
        // Under UK GB Domestic's 5.5h limit, the same 5h is below the
        // limit - still above the 80% warning threshold (4.4h), but never
        // "danger", which is the whole point: the same document reads
        // differently once the actual applicable limit differs.
        expect(ukProgress.status).toBe('warning');
    });

    it('a 15+30 split break resets the clock under the EU default but not under a profile with no split-break rule (UK GB Domestic)', () => {
        const midnight = Date.UTC(2026, 6, 27);
        // A textbook valid EU split break: 3h driving, 20 min (>= the
        // 15-minute first half), 3h more driving, then 35 min (>= the
        // 30-minute second half). Under the EU default this is a valid
        // split break and resets the clock after the second half - only
        // the last 3h of driving remains "current". UK GB Domestic's
        // `splitBreaks` is empty - the exact same sequence must never
        // reset, since the profile has no split-break provision to invoke
        // at all (not "a provision with unreachable 0-minute thresholds",
        // which would incorrectly treat any break as valid).
        const intervals = [
            interval('driving', midnight, midnight + 3 * hour, '/activities/0'),
            interval('breakOrRest', midnight + 3 * hour, midnight + 3 * hour + 20 * minute, '/activities/1'),
            interval('driving', midnight + 3 * hour + 20 * minute, midnight + 6 * hour + 20 * minute, '/activities/2'),
            interval('breakOrRest', midnight + 6 * hour + 20 * minute, midnight + 6 * hour + 55 * minute, '/activities/3'),
        ];
        const document = createDriverCardActivityDocumentFixture({
            displayName: 'continuous-driving.ddd',
            intervals,
            midnight,
            openedAt: utc(midnight + 6 * hour + 55 * minute + 10_000),
            sha256: 'd'.repeat(64),
        });

        const euProgress = progressOf(
            createActivitySectionViewModel(document, localisation(), EU_561_2006_STANDARD, NO_COMPLIANCE_EVALUATION),
        );
        expect(euProgress.currentMs).toBe(0);

        const ukProgress = progressOf(
            createActivitySectionViewModel(document, localisation(), UK_GB_DOMESTIC, NO_COMPLIANCE_EVALUATION),
        );
        // Neither break alone reaches UK's 45-minute full-break
        // requirement, and UK has no split-break provision - 3h + 3h = 6h
        // of continuous driving is still live, past UK's 5.5h limit.
        expect(ukProgress.currentMs).toBe(6 * hour);
        expect(ukProgress.status).toBe('danger');
    });
});

describe('dutyShiftBelongsToUtcDay and getDutyShiftDayRelation', () => {
    const day1Midnight = Date.UTC(2026, 6, 27);
    const day2Midnight = Date.UTC(2026, 6, 28);
    const day3Midnight = Date.UTC(2026, 6, 29);

    function createTestDuration(value: number): DurationMilliseconds {
        if (!isDurationMilliseconds(value)) {
            throw new TypeError('The test duration must be valid.');
        }
        return value;
    }

    function createTestShift(startMs: number, endMs: number): IDutyShiftViewModel {
        return {
            crew: null,
            dayUtc: utc(startMs),
            drivingDuration: { display: '0 min', value: createTestDuration(0) },
            formattedSpan: '00:00 – 00:00',
            id: `shift-${String(startMs)}-${String(endMs)}`,
            records: [],
            restDuration: { display: '0 min', value: createTestDuration(0) },
            shiftEnd: { display: '00:00', value: utc(endMs) },
            shiftStart: { display: '00:00', value: utc(startMs) },
            totalDutyDuration: { display: '0 min', value: createTestDuration(0) },
            workDuration: { display: '0 min', value: createTestDuration(0) },
        };
    }

    it('identifies fully contained shifts on a single calendar day', () => {
        const containedShift = createTestShift(day2Midnight + 8 * hour, day2Midnight + 17 * hour);
        expect(dutyShiftBelongsToUtcDay(containedShift, utc(day1Midnight))).toBe(false);
        expect(dutyShiftBelongsToUtcDay(containedShift, utc(day2Midnight))).toBe(true);
        expect(dutyShiftBelongsToUtcDay(containedShift, utc(day3Midnight))).toBe(false);

        expect(getDutyShiftDayRelation(containedShift, utc(day2Midnight))).toBe('contained');
    });

    it('identifies overnight shifts continuing from the previous day', () => {
        // Starts on day 1 at 21:00, ends on day 2 at 06:00
        const overnightShift = createTestShift(day1Midnight + 21 * hour, day2Midnight + 6 * hour);
        expect(dutyShiftBelongsToUtcDay(overnightShift, utc(day1Midnight))).toBe(true);
        expect(dutyShiftBelongsToUtcDay(overnightShift, utc(day2Midnight))).toBe(true);
        expect(dutyShiftBelongsToUtcDay(overnightShift, utc(day3Midnight))).toBe(false);

        expect(getDutyShiftDayRelation(overnightShift, utc(day1Midnight))).toBe('continuesNextDay');
        expect(getDutyShiftDayRelation(overnightShift, utc(day2Midnight))).toBe('startedPreviousDay');
    });

    it('identifies shifts that span completely across a calendar day', () => {
        // Starts on day 1 at 20:00, ends on day 3 at 04:00 (spans all of day 2)
        const longShift = createTestShift(day1Midnight + 20 * hour, day3Midnight + 4 * hour);
        expect(dutyShiftBelongsToUtcDay(longShift, utc(day2Midnight))).toBe(true);
        expect(getDutyShiftDayRelation(longShift, utc(day2Midnight))).toBe('spansAcrossDay');
    });
});
