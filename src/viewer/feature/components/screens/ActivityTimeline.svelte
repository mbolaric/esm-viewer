<script lang="ts">
    import {
        translateActivityKind,
        translateInfringementRule,
        translateInfringementSeverity,
    } from '../../helpers/viewer-labels.js';
    import { ERROR_CODES } from '#contracts';
    import {
        Icon,
        IntervalTimelineChart,
        type IIntervalTimelineChartModel,
        type IIntervalTimelineLane,
        type IIntervalTimelineSegment,
        type IntervalTimelineRuntimeLoader,
        type IntervalTimelineVariant,
    } from '#ui';
    import { ACTIVITY_KINDS, type ActivityInterval, type ActivityKind } from '#viewer-domain';
    import type {
        IActivityDayViewModel,
        IActivityInfringementPinViewModel,
        IActivityRecordViewModel,
    } from '#viewer-presentation';

    import { activityBandHeight, activityColorToken } from '../../helpers/activity-visual.js';
    import { useViewerTranslationService } from '../../viewer-context.js';

    interface IProps {
        day: IActivityDayViewModel;
        onclearrecord: () => void;
        onfailure: () => void;
        onselectinfringement?: ((pin: IActivityInfringementPinViewModel) => void) | undefined;
        onselectrecord: (record: ActivityInterval) => void;
        runtimeLoader?: IntervalTimelineRuntimeLoader | undefined;
        selectedRecord: ActivityInterval | null;
        timeBasis: string;
        variant: IntervalTimelineVariant;
    }

    let {
        day,
        onclearrecord,
        onfailure,
        onselectinfringement = undefined,
        onselectrecord,
        runtimeLoader = undefined,
        selectedRecord,
        timeBasis,
        variant,
    }: IProps = $props();

    const translationService = useViewerTranslationService();
    // Extra segments share their record's ID up to this separator, so selecting one selects the record.
    const SEGMENT_PART_SEPARATOR = '#';
    const CREDITED_BREAK_LANE = 'creditedBreak';
    const CO_DRIVER_SLOT_LANE = 'coDriverSlot';
    const TWO_CARDS_LANE = 'twoCards';

    // Drawn in the availability band's place, so in the band view it covers the credited part of the availability.
    const creditedBreakLane = $derived<IIntervalTimelineLane>({
        bandHeight: activityBandHeight('availability'),
        colorToken: activityColorToken('availability'),
        id: CREDITED_BREAK_LANE,
        label: translationService.translate('activities.crew.lane.creditedBreak'),
        pattern: 'diagonal',
    });
    // Crew lanes are rows of their own, so they appear only in the lanes view and only on days with crew records.
    const showsCrewLanes = $derived(
        variant === 'lanes' &&
            day.records.some((record) => record.record.crewPresence === 'crew' || record.record.slot === 'CoDriver'),
    );
    const lanes = $derived([
        ...ACTIVITY_KINDS.map((activity): IIntervalTimelineLane => ({
            bandHeight: activityBandHeight(activity),
            colorToken: activityColorToken(activity),
            id: activity,
            label: activityLabel(activity),
            pattern: activity === 'unknown' ? 'diagonal' : 'solid',
        })),
        ...(day.creditedBreaks.length > 0 ? [creditedBreakLane] : []),
        ...(showsCrewLanes
            ? [
                  {
                      bandHeight: 0,
                      colorToken: '--color-crew-slot-lane',
                      id: CO_DRIVER_SLOT_LANE,
                      label: translationService.translate('activities.crew.lane.coDriverSlot'),
                      pattern: 'solid',
                  } satisfies IIntervalTimelineLane,
                  {
                      bandHeight: 0,
                      colorToken: '--color-crew-lane',
                      id: TWO_CARDS_LANE,
                      label: translationService.translate('activities.crew.lane.twoCards'),
                      pattern: 'solid',
                  } satisfies IIntervalTimelineLane,
              ]
            : []),
    ]);
    const selectedSegmentId = $derived(day.records.find((record) => record.record === selectedRecord)?.id ?? null);
    const model = $derived<IIntervalTimelineChartModel>({
        ariaDescription: translationService.translate('activities.timeline.ariaDescription'),
        domainEnd: day.timelineEnd,
        domainStart: 0,
        lanes,
        ranges: day.restWindows.map((window) => ({
            colorToken: '--color-chart-range-fill',
            end: window.timelineEnd,
            id: window.id,
            label: translationService.translate('activities.crew.restWindowRange', { hours: String(window.hours) }),
            start: window.timelineStart,
        })),
        segments: [
            ...day.records.map((record) => ({
                description: segmentDescription(record),
                end: record.timelineEnd,
                id: record.id,
                laneId: record.activity,
                start: record.timelineStart,
            })),
            ...day.creditedBreaks.map((credited) => ({
                description: `${translationService.translate('activities.crew.lane.creditedBreak')}, ${credited.start.display}–${credited.end.display}, ${timeBasis}`,
                end: credited.timelineEnd,
                id: `${credited.recordId}${SEGMENT_PART_SEPARATOR}${CREDITED_BREAK_LANE}`,
                laneId: CREDITED_BREAK_LANE,
                start: credited.timelineStart,
            })),
            ...(showsCrewLanes ? day.records.flatMap(crewSegments) : []),
        ],
        selectedSegmentId,
        ticks: day.timelineTicks.map((tick) => ({
            display: tick.display,
            value: tick.offset,
        })),
        variant,
    });

    function crewSegment(record: IActivityRecordViewModel, laneId: string, label: string): IIntervalTimelineSegment {
        return {
            description: `${label}, ${record.start.display}–${record.end.display}, ${record.duration.display}, ${timeBasis}`,
            end: record.timelineEnd,
            id: `${record.id}${SEGMENT_PART_SEPARATOR}${laneId}`,
            laneId,
            start: record.timelineStart,
        };
    }

    function crewSegments(record: IActivityRecordViewModel): readonly IIntervalTimelineSegment[] {
        return [
            ...(record.record.slot === 'CoDriver'
                ? [crewSegment(record, CO_DRIVER_SLOT_LANE, translationService.translate('activities.crew.lane.coDriverSlot'))]
                : []),
            ...(record.record.crewPresence === 'crew'
                ? [crewSegment(record, TWO_CARDS_LANE, translationService.translate('activities.crew.lane.twoCards'))]
                : []),
        ];
    }

    function segmentDescription(record: IActivityRecordViewModel): string {
        return `${activityLabel(record.activity)}, ${record.start.display}–${record.end.display}, ${record.duration.display}, ${timeBasis}`;
    }

    function activityLabel(activity: ActivityKind): string {
        return translateActivityKind(activity, translationService);
    }

    function selectSegment(segmentId: string | null): void {
        if (segmentId === null) {
            onclearrecord();
            return;
        }
        const recordId = segmentId.split(SEGMENT_PART_SEPARATOR)[0];
        const record = day.records.find((candidate) => candidate.id === recordId);
        if (record !== undefined) {
            onselectrecord(record.record);
        }
    }

    function selectInfringement(pin: IActivityInfringementPinViewModel): void {
        onselectinfringement?.(pin);
    }

    function pinAriaLabel(pin: IActivityInfringementPinViewModel): string {
        return translationService.translate('activities.timeline.infringementPin', {
            severity: translateInfringementSeverity(pin.severity, translationService),
            time: pin.formattedTime,
            title: translateInfringementRule(pin.ruleId, translationService),
        });
    }
</script>

<div class="timeline-wrapper">
    {#if day.infringements.length > 0}
        <div
            class="infringement-pins-bar"
            role="region"
            aria-label={translationService.translate('activities.timeline.infringementsRegion')}
        >
            <div class="pins-track">
                {#each day.infringements as pin (pin.id)}
                    <button
                        type="button"
                        class="infringement-pin"
                        data-severity={pin.severity}
                        title={pinAriaLabel(pin)}
                        aria-label={pinAriaLabel(pin)}
                        onclick={() => {
                            selectInfringement(pin);
                        }}
                    >
                        <span class="pin-badge">
                            {#if pin.severity === 'mostSerious'}
                                <Icon name="octagonAlert" size="small" />
                            {:else if pin.severity === 'verySerious'}
                                <Icon name="circleX" size="small" />
                            {:else if pin.severity === 'serious'}
                                <Icon name="triangleAlert" size="small" />
                            {:else}
                                <Icon name="circleAlert" size="small" />
                            {/if}
                            <span class="pin-time">{pin.formattedTime}</span>
                            <span class="pin-title">{translateInfringementRule(pin.ruleId, translationService)}</span>
                        </span>
                    </button>
                {/each}
            </div>
        </div>
    {/if}

    <IntervalTimelineChart
        labels={{
            failureCode: ERROR_CODES.chartRenderFailed,
            failureCodeLabel: translationService.translate('failure.errorCode'),
            failureDescription: translationService.translate('activities.timeline.failureDescription'),
            failureHeading: translationService.translate('activities.timeline.failureHeading'),
            keyboardHelp: translationService.translate('activities.timeline.keyboardHelp'),
            loading: translationService.translate('activities.timeline.loading'),
            retry: translationService.translate('activities.timeline.retry'),
            roleDescription: translationService.translate('activities.timeline.roleDescription'),
        }}
        {model}
        {onfailure}
        onselect={selectSegment}
        {runtimeLoader}
    />
</div>

<style>
    .timeline-wrapper {
        display: flex;
        flex-direction: column;
        gap: var(--space-compact);
        inline-size: var(--size-full);
    }

    .infringement-pins-bar {
        inline-size: var(--size-full);
        padding: var(--space-none);
    }

    .pins-track {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-compact);
        inline-size: var(--size-full);
    }

    .infringement-pin {
        display: inline-flex;
        align-items: center;
        margin: var(--space-none);
        padding: var(--space-none);
        background: var(--color-transparent);
        border: var(--border-chart-interaction);
        cursor: pointer;
    }

    .pin-badge {
        display: inline-flex;
        align-items: center;
        gap: var(--space-compact);
        padding-inline: var(--space-actions);
        padding-block: var(--space-compact);
        border-radius: var(--radius-pill);
        font-size: var(--font-size-metadata);
        font-weight: var(--font-weight-action);
    }

    .infringement-pin:focus-visible {
        outline: var(--border-focus);
        outline-offset: var(--space-focus-offset);
        border-radius: var(--radius-pill);
    }

    .infringement-pin[data-severity='mostSerious'] .pin-badge,
    .infringement-pin[data-severity='verySerious'] .pin-badge {
        background-color: var(--color-badge-critical-bg);
        border: var(--border-badge-critical);
        color: var(--color-danger);
    }

    .infringement-pin[data-severity='serious'] .pin-badge {
        background-color: var(--color-badge-serious-bg);
        border: var(--border-badge-serious);
        color: var(--color-warning);
    }

    .infringement-pin[data-severity='minor'] .pin-badge {
        background-color: var(--color-badge-minor-bg);
        border: var(--border-badge-minor);
        color: var(--color-text-muted);
    }

    .pin-time {
        font-variant-numeric: tabular-nums;
        font-weight: var(--font-weight-title);
    }
</style>
