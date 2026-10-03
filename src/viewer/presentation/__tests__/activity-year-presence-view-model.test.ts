import { describe, expect, it } from 'vitest';

import { createActivityYearPresenceViewModel } from '../view-models/activity-year-presence-view-model.js';
import type { IActivityDayViewModel } from '../view-models/document-view-model.js';

import { day, duration, formatted, localisation, timestamp, totals } from './activity-view-model-fixture.js';

function days(): readonly IActivityDayViewModel[] {
    return [
        day(timestamp(Date.UTC(2026, 0, 10)), '2026-01-10', totals({ driving: formatted(duration(60 * 60 * 1_000), '1 hr') })),
        day(
            timestamp(Date.UTC(2026, 6, 26)),
            '2026-07-26',
            totals({
                driving: formatted(duration(30 * 60 * 1_000), '30 min'),
                work: formatted(duration(90 * 60 * 1_000), '1 hr, 30 min'),
            }),
        ),
        day(timestamp(Date.UTC(2025, 11, 31)), '2025-12-31', totals({ unknown: formatted(duration(15 * 60 * 1_000), '15 min') })),
    ];
}

describe('createActivityYearPresenceViewModel', () => {
    it('lays out a 31-by-12 heatmap with short localized month labels', () => {
        const viewModel = createActivityYearPresenceViewModel(days(), 2026, localisation());

        expect(viewModel.year).toBe(2026);
        expect(viewModel.yearLabel).toBe('number:2026');
        expect(viewModel.monthLabels).toHaveLength(12);
        expect(viewModel.monthLabels[0]).toBe('Jan');
        expect(viewModel.monthLabels[6]).toBe('Jul');
        expect(viewModel.days).toHaveLength(31);
        for (const row of viewModel.days) {
            expect(row).toHaveLength(12);
        }
        expect(viewModel.days[29]?.[1]?.isInMonth).toBe(false);
        expect(viewModel.days[30]?.[0]?.isInMonth).toBe(true);
        expect(viewModel.yearStart).toBe('2026-01-01');
        expect(viewModel.yearEnd).toBe('2026-12-31');
    });

    it('measures per-day presence intensity from recorded activity minutes', () => {
        const viewModel = createActivityYearPresenceViewModel(days(), 2026, localisation());

        const januaryTenth = viewModel.days[9]?.[0];
        if (januaryTenth === undefined) {
            throw new TypeError('The January 10 cell must exist.');
        }
        expect(januaryTenth.hasActivities).toBe(true);
        expect(januaryTenth.indexInDays).toBe(0);
        expect(januaryTenth.minutes).toBe(60);
        expect(januaryTenth.intensity).toBeCloseTo(60 / 1440, 2);
        expect(januaryTenth.minutesDisplay).toBe('duration:3600000');

        const julyTwentySixth = viewModel.days[25]?.[6];
        if (julyTwentySixth === undefined) {
            throw new TypeError('The July 26 cell must exist.');
        }
        expect(julyTwentySixth.minutes).toBe(120);
        expect(julyTwentySixth.indexInDays).toBe(1);
        expect(julyTwentySixth.intensity).toBeCloseTo(120 / 1440, 2);

        const julyFirst = viewModel.days[0]?.[6];
        if (julyFirst === undefined) {
            throw new TypeError('The July 1 cell must exist.');
        }
        expect(julyFirst.hasActivities).toBe(false);
        expect(julyFirst.indexInDays).toBeNull();
        expect(julyFirst.intensity).toBe(0);
    });

    it('counts presence and lists only the decoded days of the year', () => {
        const viewModel = createActivityYearPresenceViewModel(days(), 2026, localisation());

        expect(viewModel.presentDayCount.value).toBe(2);
        expect(viewModel.totalDayCount.value).toBe(2);
        expect(viewModel.yearDays.map((entry) => entry.day.dateInputValue)).toEqual(['2026-01-10', '2026-07-26']);
        expect(viewModel.yearDays.map((entry) => entry.index)).toEqual([0, 1]);
    });

    it('sums viewer-calculated totals across the visible year', () => {
        const viewModel = createActivityYearPresenceViewModel(days(), 2026, localisation());

        expect(viewModel.yearTotals.driving.value).toBe(duration(90 * 60 * 1_000));
        expect(viewModel.yearTotals.work.value).toBe(duration(90 * 60 * 1_000));
        expect(viewModel.yearTotals.unknown.value).toBe(duration(0));
        expect(viewModel.yearTotals.driving.display).toBe('duration:5400000');
    });

    it('excludes adjacent years from presence and totals', () => {
        const viewModel = createActivityYearPresenceViewModel(days(), 2025, localisation());

        expect(viewModel.yearDays).toHaveLength(1);
        expect(viewModel.yearDays[0]?.day.dateInputValue).toBe('2025-12-31');
        expect(viewModel.presentDayCount.value).toBe(1);
        expect(viewModel.yearTotals.unknown.value).toBe(duration(15 * 60 * 1_000));
    });
});
