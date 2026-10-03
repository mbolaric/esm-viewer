import type { ILocalisationService } from '#localization';
import { isDurationMilliseconds, isUtcTimestamp, type DurationMilliseconds, type UtcTimestamp } from '#viewer-domain';

import type {
    ActivityComplianceInput,
    IActivityDayViewModel,
    IActivityRecordViewModel,
    IActivityTotalsViewModel,
    IFormattedValue,
} from '../view-models/document-view-model.js';

// A compliance evaluation with no findings, for view models that do not test compliance.
export const NO_COMPLIANCE_EVALUATION: ActivityComplianceInput = {
    creditedAvailabilityBreaks: [],
    crewDutyPeriods: [],
    infringements: [],
};

export function timestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The activity view-model timestamp fixture must be valid.');
    }
    return value;
}

export function duration(value: number): DurationMilliseconds {
    if (!isDurationMilliseconds(value)) {
        throw new TypeError('The activity view-model duration fixture must be valid.');
    }
    return value;
}

export function formatted<TValue>(value: TValue, display: string): IFormattedValue<TValue> {
    return { display, value };
}

export function totals(overrides: Partial<IActivityTotalsViewModel> = {}): IActivityTotalsViewModel {
    const zero = formatted(duration(0), '0 min');
    return {
        availability: overrides.availability ?? zero,
        breakOrRest: overrides.breakOrRest ?? zero,
        driving: overrides.driving ?? zero,
        unknown: overrides.unknown ?? zero,
        work: overrides.work ?? zero,
    };
}

export function day(
    midnight: UtcTimestamp,
    inputValue: string,
    dayTotals: IActivityTotalsViewModel,
    records: readonly IActivityRecordViewModel[] = [],
): IActivityDayViewModel {
    return {
        continuousDriving: {
            currentContinuousDriving: formatted(duration(0), '0 min'),
            maxContinuousDrivingLimit: formatted(duration((4 * 60 + 30) * 60 * 1_000), '4h 30m'),
            peakContinuousDriving: null,
            percentage: 0,
            status: 'normal',
        },
        creditedBreaks: [],
        crewStatus: 'single',
        date: formatted(midnight, `date:${inputValue}`),
        dateInputValue: inputValue,
        dutyShifts: [],
        generation: 'g1',
        infringements: [],
        midnightUtc: midnight,
        records,
        restWindows: [],
        timelineEnd: duration(24 * 60 * 60 * 1_000),
        timelineTicks: [],
        totals: dayTotals,
    };
}

export function localisation(): ILocalisationService<UtcTimestamp, DurationMilliseconds> {
    return {
        dateFormat: 'ddMMyyyy',
        locale: 'en',
        timeZone: 'UTC',
        formatDateTime: (value) => `date-time:${String(value)}`,
        formatDuration: (value) => `duration:${String(value)}`,
        formatMonthLabel: (value) => `month:${new Date(value).toISOString().slice(0, 7)}`,
        formatMonthShortLabel: (value) => new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(value),
        formatNumber: (value) => `number:${String(value)}`,
        formatDate: (value) => `date:${new Date(value).toISOString().slice(0, 10)}`,
        formatUtcDate: (value) => `utc-date:${new Date(value).toISOString().slice(0, 10)}`,
        formatUtcTime: (value) => `utc-time:${String(value)}`,
        formatWeekdayLabels: () => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    };
}
