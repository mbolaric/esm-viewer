import { classifyParseError, err, ok } from '#contracts';
import {
    type CrewQualificationStatus,
    type IComplianceEvaluationResult,
    type ICrewDutyPeriod,
    type IInfringement,
    type IRuleProfile,
    sampleContinuousDrivingByDay,
} from '#compliance';
import {
    getUtcDuration,
    isDurationMilliseconds,
    isUtcTimestamp,
    utcIntervalsOverlap,
    type ActivityInterval,
    type ActivityKind,
    type DurationMilliseconds,
    type ISourceReference,
    type TachographGeneration,
    type UtcTimestamp,
} from '#viewer-domain';
import {
    projectDocumentActivityDays,
    projectDocumentCanonicalActivityDays,
    type IDocumentActivityRecord,
    type OpenedTachographDocument,
} from '#viewer-application';
import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_HOUR, MILLISECONDS_PER_MINUTE } from '#time';

import {
    type DocumentViewModelResult,
    formatDuration,
    formatUtcDate,
    formatUtcDateInputValue,
    formatUtcTime,
    type IFormattedValue,
    utcMidnightOfDay,
    type ViewerLocalisationService,
} from '../helpers/view-model-formatting.js';

export interface IActivityTotalsViewModel {
    readonly availability: IFormattedValue<DurationMilliseconds>;
    readonly breakOrRest: IFormattedValue<DurationMilliseconds>;
    readonly driving: IFormattedValue<DurationMilliseconds>;
    readonly unknown: IFormattedValue<DurationMilliseconds>;
    readonly work: IFormattedValue<DurationMilliseconds>;
}

export interface IActivityRecordViewModel {
    readonly activity: ActivityKind;
    readonly duration: IFormattedValue<DurationMilliseconds>;
    readonly end: IFormattedValue<UtcTimestamp>;
    readonly generation: TachographGeneration;
    readonly id: string;
    readonly origin: IDocumentActivityRecord['interval']['origin'];
    readonly record: ActivityInterval;
    readonly searchValues: readonly string[];
    readonly source: ISourceReference | null;
    readonly start: IFormattedValue<UtcTimestamp>;
    readonly timelineEnd: DurationMilliseconds;
    readonly timelineStart: DurationMilliseconds;
}

export interface IActivityTimelineTickViewModel {
    readonly display: string;
    readonly offset: DurationMilliseconds;
}

// Which daily-rest rule the compliance evaluation applied to a duty shift, and why.
export interface IDutyShiftCrewViewModel {
    // First driving after the first hour without a second card (crewFailed) or with unknown crew status (unknown).
    readonly failedAt: IFormattedValue<UtcTimestamp> | null;
    readonly failedRecordId: string | null;
    readonly restWindowEnd: IFormattedValue<UtcTimestamp>;
    // Calendar days between the window's start and end dates, for the "+1d" marker.
    readonly restWindowEndDayOffset: number;
    readonly restWindowHours: number;
    readonly restWindowStart: IFormattedValue<UtcTimestamp>;
    readonly status: CrewQualificationStatus;
}

export interface IDutyShiftViewModel {
    // Null when no compliance duty period covers the shift's start.
    readonly crew: IDutyShiftCrewViewModel | null;
    readonly dayUtc: UtcTimestamp;
    readonly drivingDuration: IFormattedValue<DurationMilliseconds>;
    readonly formattedSpan: string;
    readonly id: string;
    readonly records: readonly IActivityRecordViewModel[];
    readonly restDuration: IFormattedValue<DurationMilliseconds>;
    readonly shiftEnd: IFormattedValue<UtcTimestamp>;
    readonly shiftStart: IFormattedValue<UtcTimestamp>;
    readonly totalDutyDuration: IFormattedValue<DurationMilliseconds>;
    readonly workDuration: IFormattedValue<DurationMilliseconds>;
}

export type DutyShiftDayRelation = 'contained' | 'continuesNextDay' | 'spansAcrossDay' | 'startedPreviousDay';

// Returns true if shift active span touches calendar day (starts, ends, or spans across midnight).
export function dutyShiftBelongsToUtcDay(shift: IDutyShiftViewModel, midnightUtc: UtcTimestamp): boolean {
    const dayStart = midnightUtc;
    const dayEnd = dayStart + MILLISECONDS_PER_DAY;
    return utcIntervalsOverlap({ end: shift.shiftEnd.value, start: shift.shiftStart.value }, { end: dayEnd, start: dayStart });
}

// Returns whether duty shift is fully contained in or spans across current calendar day.
export function getDutyShiftDayRelation(shift: IDutyShiftViewModel, currentDayMidnightUtc: UtcTimestamp): DutyShiftDayRelation {
    const dayStart = currentDayMidnightUtc;
    const dayEnd = dayStart + MILLISECONDS_PER_DAY;

    const startsBefore = shift.shiftStart.value < dayStart;
    const endsAfter = shift.shiftEnd.value > dayEnd;

    if (startsBefore && endsAfter) {
        return 'spansAcrossDay';
    }
    if (startsBefore) {
        return 'startedPreviousDay';
    }
    if (endsAfter) {
        return 'continuesNextDay';
    }
    return 'contained';
}

export interface IContinuousDrivingProgressViewModel {
    readonly currentContinuousDriving: IFormattedValue<DurationMilliseconds>;
    readonly maxContinuousDrivingLimit: IFormattedValue<DurationMilliseconds>;
    readonly peakContinuousDriving: IFormattedValue<DurationMilliseconds> | null;
    readonly percentage: number;
    readonly status: 'normal' | 'warning' | 'danger';
}

export interface IActivityInfringementPinViewModel {
    readonly allowedValueMinutes: number;
    readonly article: string;
    readonly category: string;
    readonly description: string;
    readonly excessOrDeficitMinutes: number;
    readonly formattedTime: string;
    readonly id: string;
    readonly matchedRecordId: string | null;
    readonly measuredValueMinutes: number;
    readonly percentage: number;
    readonly recordedAt: UtcTimestamp | null;
    readonly regulation: string;
    readonly ruleId: string;
    readonly severity: 'minor' | 'mostSerious' | 'serious' | 'verySerious';
    readonly source: ISourceReference;
    readonly timeOffsetMs: DurationMilliseconds;
    readonly title: string;
}

// The part of a co-driver availability record counted as a break (Art. 7, third paragraph), clipped to the day.
export interface IActivityCreditedBreakViewModel {
    readonly end: IFormattedValue<UtcTimestamp>;
    readonly recordId: string;
    readonly start: IFormattedValue<UtcTimestamp>;
    readonly timelineEnd: DurationMilliseconds;
    readonly timelineStart: DurationMilliseconds;
}

// A daily-rest window of a multi-manning-related duty period, clipped to the day for the timeline.
export interface IActivityRestWindowViewModel {
    readonly hours: number;
    readonly id: string;
    readonly status: CrewQualificationStatus;
    readonly timelineEnd: DurationMilliseconds;
    readonly timelineStart: DurationMilliseconds;
}

export type ActivityComplianceInput = Pick<
    IComplianceEvaluationResult,
    'creditedAvailabilityBreaks' | 'crewDutyPeriods' | 'evaluationIntervals' | 'infringements'
>;

export interface IActivityDayViewModel {
    readonly continuousDriving: IContinuousDrivingProgressViewModel;
    readonly creditedBreaks: readonly IActivityCreditedBreakViewModel[];
    // The most telling crew state among the day's duty shifts, for day lists and the calendar.
    readonly crewStatus: CrewQualificationStatus;
    readonly date: IFormattedValue<UtcTimestamp>;
    readonly dateInputValue: string;
    readonly dutyShifts: readonly IDutyShiftViewModel[];
    readonly generation: TachographGeneration;
    readonly infringements: readonly IActivityInfringementPinViewModel[];
    readonly midnightUtc: UtcTimestamp;
    readonly records: readonly IActivityRecordViewModel[];
    readonly restWindows: readonly IActivityRestWindowViewModel[];
    readonly timelineEnd: DurationMilliseconds;
    readonly timelineTicks: readonly IActivityTimelineTickViewModel[];
    readonly totals: IActivityTotalsViewModel;
}

export interface IActivitySectionViewModel {
    readonly days: readonly IActivityDayViewModel[];
    readonly locale: string;
    readonly timeZone: 'UTC';
}

function createActivityRecordViewModel(
    record: IDocumentActivityRecord,
    localisation: ViewerLocalisationService,
): DocumentViewModelResult<IActivityRecordViewModel> {
    const duration = getUtcDuration(record.interval.start, record.interval.end);
    const timelineStart = getUtcDuration(record.midnightUtc, record.interval.start);
    const timelineEnd = getUtcDuration(record.midnightUtc, record.interval.end);
    if (duration === null || timelineStart === null || timelineEnd === null) {
        return err(classifyParseError('projectionFailed'));
    }

    const start = formatUtcTime(record.interval.start, localisation);
    const end = formatUtcTime(record.interval.end, localisation);
    const formattedDuration = formatDuration(duration, localisation);
    return ok({
        activity: record.interval.activity,
        duration: formattedDuration,
        end,
        generation: record.generation,
        id: `${record.generation}:${String(record.interval.start)}:${String(record.interval.end)}:${record.interval.activity}:${record.interval.origin}`,
        origin: record.interval.origin,
        record: record.interval,
        searchValues: [start.display, end.display, formattedDuration.display, record.source?.path].filter(
            (value): value is string => value !== undefined,
        ),
        source: record.source,
        start,
        timelineEnd,
        timelineStart,
    });
}
const MAX_PERCENTAGE = 100;
const MAX_CONTINUOUS_DRIVING_PROGRESS_RATIO = 1.5;
const CONTINUOUS_DRIVING_WARNING_RATIO = 0.8;

const MAJOR_REST_BREAK_THRESHOLD_MS = 9 * MILLISECONDS_PER_HOUR;

function maxContinuousDrivingMs(profile: IRuleProfile): number {
    return profile.breakRules.maxContinuousDrivingMinutes * MILLISECONDS_PER_MINUTE;
}

const TIMELINE_TICK_HOURS = [0, 6, 12, 18] as const;

function createActivityTimelineTicks(
    midnightUtc: UtcTimestamp,
    localisation: ViewerLocalisationService,
): readonly IActivityTimelineTickViewModel[] | null {
    const ticks: IActivityTimelineTickViewModel[] = [];
    for (const hour of TIMELINE_TICK_HOURS) {
        const timestampValue = midnightUtc + hour * MILLISECONDS_PER_HOUR;
        if (!isUtcTimestamp(timestampValue)) {
            return null;
        }
        const timestamp = timestampValue;
        const offset = getUtcDuration(midnightUtc, timestamp);
        if (offset === null) {
            return null;
        }
        ticks.push({
            display: localisation.formatUtcTime(timestamp),
            offset,
        });
    }

    const dayEndValue = midnightUtc + MILLISECONDS_PER_DAY;
    if (!isUtcTimestamp(dayEndValue)) {
        return null;
    }
    const dayEnd = getUtcDuration(midnightUtc, dayEndValue);
    if (dayEnd === null) {
        return null;
    }
    ticks.push({
        display: '24:00',
        offset: dayEnd,
    });
    return ticks;
}

// currentMs drives active progress/status; peakMs records highest continuous stretch reached within the period.
function buildContinuousDrivingProgressViewModel(
    currentMs: number,
    peakMs: number,
    maxContinuousDrivingMs: number,
    localisation: ViewerLocalisationService,
): IContinuousDrivingProgressViewModel {
    const ratio = Math.min(MAX_CONTINUOUS_DRIVING_PROGRESS_RATIO, currentMs / maxContinuousDrivingMs);
    const percentage = Math.min(MAX_PERCENTAGE, Math.round(ratio * MAX_PERCENTAGE));
    const status: 'normal' | 'warning' | 'danger' =
        currentMs > maxContinuousDrivingMs
            ? 'danger'
            : currentMs >= maxContinuousDrivingMs * CONTINUOUS_DRIVING_WARNING_RATIO
              ? 'warning'
              : 'normal';

    const currentDuration = requireDurationMilliseconds(currentMs);
    const maxDuration = requireDurationMilliseconds(maxContinuousDrivingMs);
    const peakContinuousDriving = peakMs > currentMs ? formatDuration(requireDurationMilliseconds(peakMs), localisation) : null;

    return {
        currentContinuousDriving: formatDuration(currentDuration, localisation),
        maxContinuousDrivingLimit: formatDuration(maxDuration, localisation),
        peakContinuousDriving,
        percentage,
        status,
    };
}

// Evaluates duty shifts across complete chronologically-ordered records to preserve spans across midnight.
export function calculateDutyShifts(
    records: readonly IActivityRecordViewModel[],
    localisation: ViewerLocalisationService,
): readonly IDutyShiftViewModel[] {
    const shifts: IDutyShiftViewModel[] = [];
    let currentShiftRecords: IActivityRecordViewModel[] = [];

    let index = 0;
    while (index < records.length) {
        const record = records[index];
        if (record === undefined) {
            break;
        }

        const isRest = record.activity === 'breakOrRest' || record.activity === 'unknown';
        if (!isRest) {
            currentShiftRecords.push(record);
            index++;
            continue;
        }

        // Merges midnight-split contiguous rest records to evaluate against major-rest threshold.
        let runEnd = index;
        let runDurationMs: number = record.duration.value;
        while (runEnd + 1 < records.length) {
            const current = records[runEnd];
            const next = records[runEnd + 1];
            if (next?.activity !== record.activity || current?.record.end !== next.record.start) {
                break;
            }
            runDurationMs += next.duration.value;
            runEnd++;
        }

        if (runDurationMs >= MAJOR_REST_BREAK_THRESHOLD_MS) {
            if (currentShiftRecords.length > 0) {
                const shift = finalizeDutyShift(currentShiftRecords, localisation);
                if (shift !== null) {
                    shifts.push(shift);
                }
                currentShiftRecords = [];
            }
        } else {
            for (let runIndex = index; runIndex <= runEnd; runIndex++) {
                const runRecord = records[runIndex];
                if (runRecord !== undefined) {
                    currentShiftRecords.push(runRecord);
                }
            }
        }

        index = runEnd + 1;
    }

    if (currentShiftRecords.length > 0) {
        const shift = finalizeDutyShift(currentShiftRecords, localisation);
        if (shift !== null) {
            shifts.push(shift);
        }
    }

    return shifts;
}

function finalizeDutyShift(
    records: readonly IActivityRecordViewModel[],
    localisation: ViewerLocalisationService,
): IDutyShiftViewModel | null {
    const activeRecords = records.filter(
        (r) => r.activity === 'driving' || r.activity === 'work' || r.activity === 'availability',
    );
    if (activeRecords.length === 0) {
        return null;
    }

    const firstActive = activeRecords[0];
    const lastActive = activeRecords.at(-1);
    if (firstActive === undefined || lastActive === undefined) {
        return null;
    }

    const firstIndex = records.indexOf(firstActive);
    const lastIndex = records.lastIndexOf(lastActive);
    const shiftRecords = records.slice(firstIndex, lastIndex + 1);

    const shiftStart = firstActive.start;
    const shiftEnd = lastActive.end;
    const totalMs = getUtcDuration(firstActive.record.start, lastActive.record.end);
    if (totalMs === null) {
        return null;
    }

    const dayUtc = utcMidnightOfDay(shiftStart.value);
    if (dayUtc === null) {
        return null;
    }

    let drivingMs = 0;
    let workMs = 0;
    let restMs = 0;

    for (const rec of shiftRecords) {
        if (rec.activity === 'driving') {
            drivingMs += rec.duration.value;
        } else if (rec.activity === 'work' || rec.activity === 'availability') {
            workMs += rec.duration.value;
        } else {
            restMs += rec.duration.value;
        }
    }

    const drivingDuration = requireDurationMilliseconds(drivingMs);
    const workDuration = requireDurationMilliseconds(workMs);
    const restDuration = requireDurationMilliseconds(restMs);
    const totalDutyDuration = requireDurationMilliseconds(totalMs);

    return {
        crew: null,
        dayUtc,
        drivingDuration: formatDuration(drivingDuration, localisation),
        formattedSpan: `${shiftStart.display} – ${shiftEnd.display}`,
        id: `shift-${String(shiftStart.value)}-${String(shiftEnd.value)}`,
        records: shiftRecords,
        restDuration: formatDuration(restDuration, localisation),
        shiftEnd,
        shiftStart,
        totalDutyDuration: formatDuration(totalDutyDuration, localisation),
        workDuration: formatDuration(workDuration, localisation),
    };
}

function mapDayInfringements(
    infringements: readonly IInfringement[],
    midnightUtc: UtcTimestamp,
    records: readonly IActivityRecordViewModel[],
    localisation: ViewerLocalisationService,
): readonly IActivityInfringementPinViewModel[] {
    const dayStart = midnightUtc;
    const dayEnd = dayStart + MILLISECONDS_PER_DAY;
    const dayPins: IActivityInfringementPinViewModel[] = [];

    for (const infringement of infringements) {
        const recordedAt = infringement.recordedAt;
        if (recordedAt !== null && recordedAt >= dayStart && recordedAt < dayEnd) {
            const timeOffsetMs = requireDurationMilliseconds(Math.max(0, recordedAt - dayStart));
            const percentage = Math.min(MAX_PERCENTAGE, Math.max(0, (timeOffsetMs / MILLISECONDS_PER_DAY) * MAX_PERCENTAGE));
            const matchedRecord =
                records.find((record) => recordedAt >= record.record.start && recordedAt <= record.record.end) ?? null;

            dayPins.push({
                allowedValueMinutes: infringement.allowedValueMinutes,
                article: infringement.legalReference.article,
                category: infringement.category,
                description: infringement.legalReference.description,
                excessOrDeficitMinutes: infringement.excessOrDeficitMinutes,
                formattedTime: localisation.formatUtcTime(recordedAt),
                id: infringement.id,
                matchedRecordId: matchedRecord?.id ?? null,
                measuredValueMinutes: infringement.measuredValueMinutes,
                percentage,
                recordedAt,
                regulation: infringement.legalReference.regulation,
                ruleId: infringement.ruleId,
                severity: infringement.severity,
                source: infringement.source,
                timeOffsetMs,
                title: infringement.title,
            });
        }
    }

    return dayPins;
}

function requireDurationMilliseconds(value: number): DurationMilliseconds {
    if (isDurationMilliseconds(value)) {
        return value;
    }
    throw new TypeError(`Expected safe non-negative duration in milliseconds, received ${String(value)}`);
}

const CREW_STATUS_PRECEDENCE: readonly CrewQualificationStatus[] = ['crew', 'crewFailed', 'unknown'];

function dayCrewStatus(shifts: readonly IDutyShiftViewModel[]): CrewQualificationStatus {
    return CREW_STATUS_PRECEDENCE.find((status) => shifts.some((shift) => shift.crew?.status === status)) ?? 'single';
}

function createDutyShiftCrewViewModel(
    shift: IDutyShiftViewModel,
    crewDutyPeriods: readonly ICrewDutyPeriod[],
    localisation: ViewerLocalisationService,
): IDutyShiftCrewViewModel | null {
    const shiftStart = shift.shiftStart.value;
    const period = crewDutyPeriods.findLast(
        (candidate) => candidate.windowStart <= shiftStart && shiftStart < candidate.windowEnd,
    );
    if (period !== undefined && isUtcTimestamp(period.windowStart) && isUtcTimestamp(period.windowEnd)) {
        const startMidnight = utcMidnightOfDay(period.windowStart);
        const endMidnight = utcMidnightOfDay(period.windowEnd);
        if (startMidnight !== null && endMidnight !== null) {
            const failedAt = period.qualification.failedAt;
            const failedAtTimestamp = failedAt !== null && isUtcTimestamp(failedAt) ? failedAt : null;
            const failedRecord =
                failedAtTimestamp === null
                    ? undefined
                    : shift.records.find(
                          (record) => record.record.start <= failedAtTimestamp && failedAtTimestamp < record.record.end,
                      );

            return {
                failedAt: failedAtTimestamp === null ? null : formatUtcTime(failedAtTimestamp, localisation),
                failedRecordId: failedRecord?.id ?? null,
                restWindowEnd: formatUtcTime(period.windowEnd, localisation),
                restWindowEndDayOffset: Math.round((endMidnight - startMidnight) / MILLISECONDS_PER_DAY),
                restWindowHours: Math.round((period.windowEnd - period.windowStart) / MILLISECONDS_PER_HOUR),
                restWindowStart: formatUtcTime(period.windowStart, localisation),
                status: period.qualification.status,
            };
        }
    }

    // Single-driver fallback: every shift has an applied 24-hour rest window (§5.1.2)
    const windowEnd = shiftStart + MILLISECONDS_PER_DAY;
    if (!isUtcTimestamp(windowEnd)) {
        return null;
    }
    const startMidnight = utcMidnightOfDay(shiftStart);
    const endMidnight = utcMidnightOfDay(windowEnd);
    return {
        failedAt: null,
        failedRecordId: null,
        restWindowEnd: formatUtcTime(windowEnd, localisation),
        restWindowEndDayOffset:
            startMidnight !== null && endMidnight !== null ? Math.round((endMidnight - startMidnight) / MILLISECONDS_PER_DAY) : 1,
        restWindowHours: 24,
        restWindowStart: formatUtcTime(shiftStart, localisation),
        status: 'single',
    };
}

function clipToDay(start: number, end: number, midnightUtc: UtcTimestamp): { end: number; start: number } | null {
    const clippedStart = Math.max(start, midnightUtc);
    const clippedEnd = Math.min(end, midnightUtc + MILLISECONDS_PER_DAY);
    return clippedEnd > clippedStart ? { end: clippedEnd, start: clippedStart } : null;
}

function mapDayCreditedBreaks(
    creditedBreaks: ActivityComplianceInput['creditedAvailabilityBreaks'],
    midnightUtc: UtcTimestamp,
    records: readonly IActivityRecordViewModel[],
    localisation: ViewerLocalisationService,
): readonly IActivityCreditedBreakViewModel[] {
    return creditedBreaks.flatMap((credited) => {
        const clipped = clipToDay(credited.start, credited.end, midnightUtc);
        if (clipped === null || !isUtcTimestamp(clipped.start) || !isUtcTimestamp(clipped.end)) {
            return [];
        }
        const record = records.find(
            (candidate) =>
                candidate.activity === 'availability' &&
                candidate.record.start <= clipped.start &&
                clipped.start < candidate.record.end,
        );
        if (record === undefined) {
            return [];
        }
        return [
            {
                end: formatUtcTime(clipped.end, localisation),
                recordId: record.id,
                start: formatUtcTime(clipped.start, localisation),
                timelineEnd: requireDurationMilliseconds(clipped.end - midnightUtc),
                timelineStart: requireDurationMilliseconds(clipped.start - midnightUtc),
            },
        ];
    });
}

// Only windows that multi-manning changed or could have changed are drawn; a single-driver window needs no shading.
function mapDayRestWindows(
    shifts: readonly IDutyShiftViewModel[],
    midnightUtc: UtcTimestamp,
): readonly IActivityRestWindowViewModel[] {
    const windows = new Map<number, IActivityRestWindowViewModel>();
    for (const shift of shifts) {
        const crew = shift.crew;
        if (crew === null || crew.status === 'single' || windows.has(crew.restWindowStart.value)) {
            continue;
        }
        const clipped = clipToDay(crew.restWindowStart.value, crew.restWindowEnd.value, midnightUtc);
        if (clipped !== null) {
            windows.set(crew.restWindowStart.value, {
                hours: crew.restWindowHours,
                id: `rest-window-${String(crew.restWindowStart.value)}`,
                status: crew.status,
                timelineEnd: requireDurationMilliseconds(clipped.end - midnightUtc),
                timelineStart: requireDurationMilliseconds(clipped.start - midnightUtc),
            });
        }
    }
    return [...windows.values()];
}

// Receives pre-evaluated compliance results and the selected profile from composition layer.
export function createActivitySectionViewModel(
    document: OpenedTachographDocument,
    localisation: ViewerLocalisationService,
    profile: IRuleProfile,
    evaluation: ActivityComplianceInput,
): DocumentViewModelResult<IActivitySectionViewModel> {
    const { crewDutyPeriods, infringements } = evaluation;
    // The day list keeps one entry per distinct evidence so a conflict stays visible, while shifts, crew state and
    // break presentation read the canonical day per midnight: the compliance evaluation reads that same set, and a
    // shared walk over both conflicting copies would invent a duty shift longer than the clock time it covers.
    const projectedDays = projectDocumentActivityDays(document);
    const canonicalDays = projectDocumentCanonicalActivityDays(document);
    const firstDay = projectedDays[0];
    if (firstDay === undefined) {
        return ok({
            days: [],
            locale: localisation.locale,
            timeZone: 'UTC',
        });
    }

    const timelineTicks = createActivityTimelineTicks(firstDay.day.midnightUtc, localisation);
    const timelineEnd = timelineTicks?.at(-1)?.offset;
    if (timelineTicks === null || timelineEnd === undefined) {
        return err(classifyParseError('projectionFailed'));
    }

    const continuousDrivingLimitMs = maxContinuousDrivingMs(profile);
    const continuousDrivingByDay = sampleContinuousDrivingByDay(
        projectedDays.map((projectedDay) => projectedDay.day.midnightUtc),
        evaluation.evaluationIntervals,
        profile,
    ).map((sample) =>
        buildContinuousDrivingProgressViewModel(sample.valueMs, sample.peakMs, continuousDrivingLimitMs, localisation),
    );

    const recordsByDay: IActivityRecordViewModel[][] = [];
    const canonicalRecords: IActivityRecordViewModel[] = [];
    for (const projectedDay of projectedDays) {
        const records: IActivityRecordViewModel[] = [];
        for (const record of projectedDay.records) {
            const mapped = createActivityRecordViewModel(record, localisation);
            if (!mapped.ok) {
                return mapped;
            }
            records.push(mapped.value);
        }
        recordsByDay.push(records);
    }
    for (const projectedDay of canonicalDays) {
        for (const record of projectedDay.records) {
            const mapped = createActivityRecordViewModel(record, localisation);
            if (!mapped.ok) {
                return mapped;
            }
            canonicalRecords.push(mapped.value);
        }
    }

    // Shifts computed once across the canonical records, then attributed to each shift's starting calendar day.
    const allDutyShifts = calculateDutyShifts(canonicalRecords, localisation).map((shift) => ({
        ...shift,
        crew: createDutyShiftCrewViewModel(shift, crewDutyPeriods, localisation),
    }));

    const days: IActivityDayViewModel[] = [];
    for (const [dayIndex, projectedDay] of projectedDays.entries()) {
        const records = recordsByDay[dayIndex] ?? [];

        const continuousDriving = continuousDrivingByDay[dayIndex];
        if (continuousDriving === undefined) {
            return err(classifyParseError('projectionFailed'));
        }

        const dutyShifts = allDutyShifts.filter((shift) => dutyShiftBelongsToUtcDay(shift, projectedDay.day.midnightUtc));
        days.push({
            continuousDriving,
            creditedBreaks: mapDayCreditedBreaks(
                evaluation.creditedAvailabilityBreaks,
                projectedDay.day.midnightUtc,
                records,
                localisation,
            ),
            crewStatus: dayCrewStatus(dutyShifts),
            date: formatUtcDate(projectedDay.day.midnightUtc, localisation),
            dateInputValue: formatUtcDateInputValue(projectedDay.day.midnightUtc),
            dutyShifts,
            generation: projectedDay.generation,
            infringements: mapDayInfringements(infringements, projectedDay.day.midnightUtc, records, localisation),
            midnightUtc: projectedDay.day.midnightUtc,
            records: records,
            restWindows: mapDayRestWindows(dutyShifts, projectedDay.day.midnightUtc),
            timelineEnd,
            timelineTicks,
            totals: {
                availability: formatDuration(projectedDay.day.totals.availability, localisation),
                breakOrRest: formatDuration(projectedDay.day.totals.breakOrRest, localisation),
                driving: formatDuration(projectedDay.day.totals.driving, localisation),
                unknown: formatDuration(projectedDay.day.totals.unknown, localisation),
                work: formatDuration(projectedDay.day.totals.work, localisation),
            },
        });
    }

    return ok({
        days: days,
        locale: localisation.locale,
        timeZone: 'UTC',
    });
}
