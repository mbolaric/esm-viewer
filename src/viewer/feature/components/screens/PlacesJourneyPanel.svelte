<script lang="ts">
    import {
        Button,
        getApproximateCountryPosition,
        Icon,
        type IMapControlsLabels,
        type IMapRoute,
        type IMapWaypoint,
        OfflineRouteMap,
        SegmentedControl,
    } from '#ui';
    import { isLatitude, isLongitude, type Latitude, type Longitude } from '#viewer-domain';
    import { mapJourneyLegsToMapRoute, type IJourneyLegViewModel, type IJourneyShiftSummary } from '#viewer-presentation';
    import { useViewerTranslationService } from '../../viewer-context.js';

    interface IProps {
        activeShift: IJourneyShiftSummary;
        // The screen owns the active shift because the records table below is filtered to it.
        onselectshift: (shiftId: string) => void;
        onselectwaypoint: (waypoint: IMapWaypoint) => void;
        selectedWaypointId: string | null;
        shifts: readonly IJourneyShiftSummary[];
    }

    let { activeShift, onselectshift, onselectwaypoint, selectedWaypointId, shifts }: IProps = $props();

    const translationService = useViewerTranslationService();
    const activeShiftIndex = $derived(shifts.findIndex((shift) => shift.id === activeShift.id));
    const journeySummary = $derived(activeShift.summary);

    type PlacesJourneyViewMode = 'splitView' | 'stepTrack' | 'vectorMap';
    let journeyViewMode = $state<PlacesJourneyViewMode>('stepTrack');

    // Offsets start and end country-only legs within country polygon to show approximate positions.
    function resolveApproximateCountryPosition(leg: IJourneyLegViewModel): { latitude: Latitude; longitude: Longitude } | null {
        const position = getApproximateCountryPosition(leg.country, leg.type === 'start' ? -1 : 1);
        if (position === null) {
            return null;
        }
        const longitude = position[0];
        const latitude = position[1];
        if (!isLatitude(latitude) || !isLongitude(longitude)) {
            return null;
        }
        return { latitude, longitude };
    }

    const mapRoute = $derived.by<IMapRoute | null>(() => {
        return mapJourneyLegsToMapRoute(journeySummary.legs, journeyLegLabel, {
            badge: translationService.translate('places.map.approximateBadge'),
            notice: translationService.translate('places.map.approximateNotice'),
            resolveCountryPosition: resolveApproximateCountryPosition,
        });
    });

    const mapControlsLabels: IMapControlsLabels = $derived({
        ariaLabel: translationService.translate('places.map.ariaLabel'),
        emptyNotice: translationService.translate('places.map.emptyNotice'),
        fitRoute: translationService.translate('places.map.fitRoute'),
        panDown: translationService.translate('places.map.panDown'),
        panGroup: translationService.translate('places.map.panGroup'),
        panLeft: translationService.translate('places.map.panLeft'),
        panRight: translationService.translate('places.map.panRight'),
        panUp: translationService.translate('places.map.panUp'),
        zoomIn: translationService.translate('places.map.zoomIn'),
        zoomOut: translationService.translate('places.map.zoomOut'),
    });

    function navigatePreviousShift(): void {
        if (activeShiftIndex > 0) {
            const prev = shifts[activeShiftIndex - 1];
            if (prev !== undefined) {
                onselectshift(prev.id);
            }
        }
    }

    function navigateNextShift(): void {
        if (activeShiftIndex >= 0 && activeShiftIndex < shifts.length - 1) {
            const next = shifts[activeShiftIndex + 1];
            if (next !== undefined) {
                onselectshift(next.id);
            }
        }
    }

    function handleShiftChange(event: Event): void {
        if (event.currentTarget instanceof HTMLSelectElement) {
            onselectshift(event.currentTarget.value);
        }
    }

    function journeyLegLabel(type: IJourneyLegViewModel['type']): string {
        switch (type) {
            case 'start':
                return translationService.translate('places.journey.legStart');
            case 'end':
                return translationService.translate('places.journey.legEnd');
            case 'border':
                return translationService.translate('places.journey.legBorder');
            case 'gnss':
                return translationService.translate('places.positionType');
            case 'loadUnload':
                return translationService.translate('places.journey.legLoadUnload');
        }
    }
</script>

<section class="journey-flow-card" aria-label={translationService.translate('places.journey.heading')}>
    <div class="journey-header">
        <div class="journey-header-left">
            <div class="journey-title">
                <Icon name="circleGauge" />
                <strong>{translationService.translate('places.journey.heading')}</strong>
            </div>
            {#if shifts.length > 1}
                <nav class="shift-nav-controls" aria-label={translationService.translate('places.journey.shiftNavHeading')}>
                    <Button
                        ariaLabel={translationService.translate('places.journey.previousShift')}
                        disabled={activeShiftIndex <= 0}
                        icon="chevronLeft"
                        iconOnly
                        label={translationService.translate('places.journey.previousShift')}
                        onclick={navigatePreviousShift}
                        size="compact"
                        variant="ghost"
                    />
                    <div class="shift-select-wrapper">
                        <select
                            aria-label={translationService.translate('places.journey.shiftNavHeading')}
                            class="shift-select"
                            value={activeShift.id}
                            onchange={handleShiftChange}
                        >
                            {#each shifts as shift, idx (shift.id)}
                                <option value={shift.id}>
                                    {translationService.translate('places.journey.shiftOption', {
                                        current: String(idx + 1),
                                        date: shift.dateLabel,
                                        distance: shift.totalKilometres?.display ?? '0',
                                        stops: String(shift.stopCount),
                                        total: String(shifts.length),
                                        unit: translationService.translate('associations.kilometreUnit'),
                                    })}
                                </option>
                            {/each}
                        </select>
                    </div>
                    <Button
                        ariaLabel={translationService.translate('places.journey.nextShift')}
                        disabled={activeShiftIndex >= shifts.length - 1}
                        icon="chevronRight"
                        iconOnly
                        label={translationService.translate('places.journey.nextShift')}
                        onclick={navigateNextShift}
                        size="compact"
                        variant="ghost"
                    />
                </nav>
            {/if}
        </div>
        <div class="journey-header-right">
            <SegmentedControl
                ariaLabel={translationService.translate('places.journey.viewModeLabel')}
                onchange={(mode: PlacesJourneyViewMode) => {
                    journeyViewMode = mode;
                }}
                options={[
                    {
                        label: translationService.translate('places.journey.viewStepTrack'),
                        value: 'stepTrack',
                    },
                    {
                        label: translationService.translate('places.journey.viewVectorMap'),
                        value: 'vectorMap',
                    },
                    {
                        label: translationService.translate('places.journey.viewSplit'),
                        value: 'splitView',
                    },
                ]}
                value={journeyViewMode}
            />
            {#if activeShift.formattedSpan.length > 0}
                <span class="journey-span-badge">
                    {translationService.translate('places.journey.shiftSpan')}
                    {activeShift.formattedSpan}
                </span>
            {/if}
            {#if journeySummary.totalShiftKilometres !== null}
                <div class="journey-stat">
                    <span>{translationService.translate('places.journey.totalDistance')}</span>
                    <strong>
                        {journeySummary.totalShiftKilometres.display}
                        {translationService.translate('associations.kilometreUnit')}
                    </strong>
                </div>
            {/if}
            {#if journeySummary.hasOdometerDiscrepancy}
                <span class="journey-discrepancy-note">
                    <Icon name="triangleAlert" />
                    {translationService.translate('places.journey.odometerDiscrepancy')}
                </span>
            {/if}
        </div>
    </div>

    {#if journeyViewMode === 'stepTrack' || journeyViewMode === 'splitView'}
        <div class="journey-track" role="region" aria-label={translationService.translate('places.journey.trackAria')}>
            {#each journeySummary.legs as leg, index (leg.id)}
                <div class="journey-step" class:step-end={leg.type === 'end'} class:step-start={leg.type === 'start'}>
                    {#if index > 0}
                        <div class="journey-connector" aria-hidden="true"></div>
                    {/if}
                    <div class="step-badge">
                        <Icon name={leg.icon} />
                    </div>
                    <div class="step-info">
                        <span class="step-label">{journeyLegLabel(leg.type)}</span>
                        <strong class="step-country">{leg.country}</strong>
                        <span class="step-time">{leg.timestamp.display}</span>
                        {#if leg.odometer !== null}
                            <span class="step-odo">
                                {leg.odometer.display}
                                {translationService.translate('associations.kilometreUnit')}
                            </span>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    {/if}

    {#if journeyViewMode === 'vectorMap' || journeyViewMode === 'splitView'}
        <div class="journey-map-wrapper">
            <OfflineRouteMap labels={mapControlsLabels} {onselectwaypoint} route={mapRoute} {selectedWaypointId} />
        </div>
    {/if}
</section>

<style>
    .journey-flow-card {
        display: flex;
        flex-direction: column;
        gap: var(--space-stack);
        padding: var(--space-dialog);
        background: var(--color-surface-subtle);
        border: var(--border-region);
        border-radius: var(--radius-panel);
    }

    .journey-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: var(--space-actions);
        padding-inline: var(--space-actions);
        padding-block: var(--space-actions);
        border-block-end: var(--border-region);
    }

    .journey-header-left {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-panel);
    }

    .journey-header-right {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-actions);
    }

    .shift-nav-controls {
        display: flex;
        align-items: center;
        gap: var(--space-compact);
    }

    .shift-select-wrapper {
        display: flex;
        align-items: center;
    }

    .shift-select {
        font-size: var(--font-size-body);
        font-weight: var(--font-weight-action);
        color: var(--color-text);
        background: var(--color-surface);
        border: var(--border-control);
        border-radius: var(--radius-control);
        padding-block: var(--space-compact);
        padding-inline: var(--space-actions);
        cursor: pointer;
    }

    .shift-select:focus-visible {
        outline: var(--border-focus);
        outline-offset: var(--space-focus-offset);
    }

    .journey-span-badge {
        font-size: var(--font-size-metadata);
        color: var(--color-text-muted);
        background: var(--color-surface);
        border: var(--border-badge);
        border-radius: var(--radius-chip);
        padding-block: var(--space-compact);
        padding-inline: var(--space-control-block);
        font-variant-numeric: tabular-nums;
    }

    .journey-title {
        display: flex;
        align-items: center;
        gap: var(--space-actions);
        font-size: var(--font-size-section);
        font-weight: var(--font-weight-title);
    }

    .journey-stat {
        display: flex;
        align-items: center;
        gap: var(--space-actions);
        font-size: var(--font-size-body);
        color: var(--color-text-muted);
    }

    .journey-stat strong {
        color: var(--color-text);
        font-variant-numeric: tabular-nums;
    }

    .journey-discrepancy-note {
        display: flex;
        align-items: center;
        gap: var(--space-compact);
        font-size: var(--font-size-metadata);
        color: var(--color-warning);
    }

    .journey-track {
        display: flex;
        align-items: flex-start;
        gap: var(--space-none);
        overflow-x: auto;
        overflow-y: hidden;
        padding-block: var(--space-actions) var(--space-compact);
        padding-inline: var(--space-actions);
    }

    .journey-step {
        display: flex;
        align-items: flex-start;
        flex: var(--layout-overview-action-flex);
    }

    .journey-connector {
        inline-size: var(--size-journey-connector-inline);
        block-size: var(--size-journey-connector-block);
        background: var(--color-border);
        margin-inline: var(--space-compact);
        margin-block-start: var(--size-journey-connector-margin-top);
    }

    .step-badge {
        display: flex;
        align-items: center;
        justify-content: center;
        inline-size: var(--size-journey-step-badge);
        block-size: var(--size-journey-step-badge);
        border-radius: var(--radius-pill);
        background: var(--color-surface);
        border: var(--border-badge);
        color: var(--color-text-muted);
        margin-inline-end: var(--space-compact);
    }

    .step-start .step-badge {
        border-color: var(--color-accent);
        color: var(--color-accent);
    }

    .step-end .step-badge {
        border-color: var(--color-success, var(--color-accent));
        color: var(--color-success, var(--color-accent));
    }

    .step-info {
        display: flex;
        flex-direction: column;
        gap: var(--gap-step-info);
        line-height: var(--line-height-body);
    }

    .step-label {
        font-size: var(--font-size-metadata);
        color: var(--color-text-muted);
    }

    .step-country {
        font-size: var(--font-size-body);
        color: var(--color-text);
    }

    .step-time {
        font-size: var(--font-size-metadata);
        color: var(--color-text-muted);
        font-variant-numeric: tabular-nums;
    }

    .step-odo {
        font-size: var(--font-size-metadata);
        color: var(--color-text-muted);
        font-variant-numeric: tabular-nums;
    }

    .journey-map-wrapper {
        margin-block-start: var(--space-compact);
        inline-size: var(--size-full);
    }
</style>
