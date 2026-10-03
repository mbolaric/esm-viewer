<script lang="ts">
    import Icon from '../icon/Icon.svelte';
    import { EUROPE_COUNTRIES, EUROPE_MAP_BOUNDS, getCountryCentroid } from './europe-vector-data.js';
    import type { IMapControlsLabels, IMapRoute, IMapWaypoint, MapMarkerType } from './map-contract.js';

    interface IProps {
        labels: IMapControlsLabels;
        onselectwaypoint?: (waypoint: IMapWaypoint) => void;
        route: IMapRoute | null;
        selectedWaypointId?: string | null;
    }

    let { labels, onselectwaypoint, route, selectedWaypointId = null }: IProps = $props();

    const SVG_WIDTH = 1000;
    const SVG_HEIGHT = 700;
    const FIT_MAXIMUM_ZOOM = 6;
    const MAP_FIT_RATIO = 0.65;
    const MAXIMUM_ZOOM = 8;
    const MINIMUM_ROUTE_EXTENT = 80;
    const MINIMUM_ZOOM = 1;
    const PAN_STEP = 40;
    const RESET_ZOOM_THRESHOLD = 1.05;
    const WHEEL_ZOOM_IN_FACTOR = 1.15;
    const WHEEL_ZOOM_OUT_FACTOR = 0.87;
    const ZOOM_BUTTON_FACTOR = 1.3;

    let zoom = $state(MINIMUM_ZOOM);
    let panX = $state(0);
    let panY = $state(0);
    let hoveredWaypoint = $state<IMapWaypoint | null>(null);

    let isDragging = $state(false);
    let startPointerX = 0;
    let startPointerY = 0;
    let startPanX = 0;
    let startPanY = 0;
    let mapContainer: HTMLElement | null = $state(null);

    function projectLon(lon: number): number {
        const clampedLon = Math.max(EUROPE_MAP_BOUNDS.minLon, Math.min(EUROPE_MAP_BOUNDS.maxLon, lon));
        return ((clampedLon - EUROPE_MAP_BOUNDS.minLon) / (EUROPE_MAP_BOUNDS.maxLon - EUROPE_MAP_BOUNDS.minLon)) * SVG_WIDTH;
    }

    function projectLat(lat: number): number {
        const clampedLat = Math.max(EUROPE_MAP_BOUNDS.minLat, Math.min(EUROPE_MAP_BOUNDS.maxLat, lat));
        return ((EUROPE_MAP_BOUNDS.maxLat - clampedLat) / (EUROPE_MAP_BOUNDS.maxLat - EUROPE_MAP_BOUNDS.minLat)) * SVG_HEIGHT;
    }

    function formatPolygonPath(polygon: readonly (readonly [number, number])[]): string {
        return (
            polygon
                .map(([lon, lat], index) => {
                    const x = projectLon(lon).toFixed(1);
                    const y = projectLat(lat).toFixed(1);
                    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                })
                .join(' ') + ' Z'
        );
    }

    const validWaypoints = $derived(
        route?.waypoints.filter(
            (wp) =>
                !isNaN(wp.latitude) &&
                !isNaN(wp.longitude) &&
                wp.latitude >= EUROPE_MAP_BOUNDS.minLat &&
                wp.latitude <= EUROPE_MAP_BOUNDS.maxLat &&
                wp.longitude >= EUROPE_MAP_BOUNDS.minLon &&
                wp.longitude <= EUROPE_MAP_BOUNDS.maxLon,
        ) ?? [],
    );

    const routePolylinePath = $derived.by(() => {
        if (validWaypoints.length < 2) {
            return '';
        }
        return validWaypoints
            .map((wp, idx) => {
                const x = projectLon(wp.longitude).toFixed(1);
                const y = projectLat(wp.latitude).toFixed(1);
                return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
            })
            .join(' ');
    });

    function fitRoute(): void {
        if (validWaypoints.length === 0) {
            zoom = MINIMUM_ZOOM;
            panX = 0;
            panY = 0;
            return;
        }

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        for (const wp of validWaypoints) {
            const x = projectLon(wp.longitude);
            const y = projectLat(wp.latitude);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }

        const width = Math.max(MINIMUM_ROUTE_EXTENT, maxX - minX);
        const height = Math.max(MINIMUM_ROUTE_EXTENT, maxY - minY);
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const fitScaleX = (SVG_WIDTH * MAP_FIT_RATIO) / width;
        const fitScaleY = (SVG_HEIGHT * MAP_FIT_RATIO) / height;
        const targetZoom = Math.max(MINIMUM_ZOOM, Math.min(FIT_MAXIMUM_ZOOM, Math.min(fitScaleX, fitScaleY)));

        zoom = targetZoom;
        panX = (SVG_WIDTH / 2 - centerX) * targetZoom;
        panY = (SVG_HEIGHT / 2 - centerY) * targetZoom;
    }

    $effect(() => {
        if (validWaypoints.length > 0) {
            fitRoute();
        }
    });

    function handleZoomIn(): void {
        zoom = Math.min(MAXIMUM_ZOOM, zoom * ZOOM_BUTTON_FACTOR);
    }

    function handleZoomOut(): void {
        const nextZoom = zoom / ZOOM_BUTTON_FACTOR;
        if (nextZoom <= RESET_ZOOM_THRESHOLD) {
            zoom = MINIMUM_ZOOM;
            panX = 0;
            panY = 0;
        } else {
            zoom = nextZoom;
        }
    }

    function handlePan(deltaX: number, deltaY: number): void {
        panX += deltaX * PAN_STEP;
        panY += deltaY * PAN_STEP;
    }

    function handleKeyDown(event: KeyboardEvent): void {
        // Keyboard arrow panning per WCAG 2.2 keyboard-only operation.
        switch (event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                handlePan(1, 0);
                break;
            case 'ArrowRight':
                event.preventDefault();
                handlePan(-1, 0);
                break;
            case 'ArrowUp':
                event.preventDefault();
                handlePan(0, 1);
                break;
            case 'ArrowDown':
                event.preventDefault();
                handlePan(0, -1);
                break;
        }
    }

    function handlePointerDown(event: PointerEvent): void {
        if (event.button !== 0) {
            return;
        }
        isDragging = true;
        startPointerX = event.clientX;
        startPointerY = event.clientY;
        startPanX = panX;
        startPanY = panY;
        if (event.currentTarget instanceof HTMLElement) {
            event.currentTarget.setPointerCapture(event.pointerId);
        }
    }

    function handlePointerMove(event: PointerEvent): void {
        if (!isDragging) {
            return;
        }
        const dx = event.clientX - startPointerX;
        const dy = event.clientY - startPointerY;
        const width = mapContainer?.clientWidth ?? SVG_WIDTH;
        const scaleFactor = SVG_WIDTH / width;

        panX = startPanX + dx * scaleFactor;
        panY = startPanY + dy * scaleFactor;
    }

    function handlePointerUp(event: PointerEvent): void {
        if (isDragging) {
            isDragging = false;
            if (event.currentTarget instanceof HTMLElement) {
                try {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                } catch {
                    // Ignore if not captured
                }
            }
        }
    }

    function handleWheel(event: WheelEvent): void {
        event.preventDefault();
        const factor = event.deltaY < 0 ? WHEEL_ZOOM_IN_FACTOR : WHEEL_ZOOM_OUT_FACTOR;
        const nextZoom = Math.max(MINIMUM_ZOOM, Math.min(MAXIMUM_ZOOM, zoom * factor));
        if (nextZoom <= RESET_ZOOM_THRESHOLD) {
            zoom = MINIMUM_ZOOM;
            panX = 0;
            panY = 0;
        } else {
            zoom = nextZoom;
        }
    }

    function formatCoordinates(lat: number, lon: number): string {
        return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    }

    function getMarkerColor(type: MapMarkerType): string {
        switch (type) {
            case 'start':
                return 'var(--color-success)';
            case 'end':
                return 'var(--color-danger)';
            case 'info':
                return 'var(--color-info)';
            case 'warning':
                return 'var(--color-warning)';
            case 'approximate':
                return 'var(--color-text-muted)';
            case 'accent':
            case 'primary':
            default:
                return 'var(--color-accent)';
        }
    }

    function getMarkerIcon(type: MapMarkerType): 'circleCheck' | 'circleGauge' | 'circleHelp' | 'mapPin' | 'truck' {
        switch (type) {
            case 'start':
                return 'mapPin';
            case 'end':
                return 'circleCheck';
            case 'info':
                return 'circleGauge';
            case 'approximate':
                return 'circleHelp';
            case 'warning':
            case 'accent':
            case 'primary':
            default:
                return 'truck';
        }
    }
</script>

<div
    bind:this={mapContainer}
    class="offline-route-map-container"
    role="region"
    aria-label={labels.ariaLabel}
    onwheel={handleWheel}
>
    <div class="map-controls">
        <button type="button" class="map-control-button" title={labels.zoomIn} aria-label={labels.zoomIn} onclick={handleZoomIn}>
            <Icon name="plus" />
        </button>
        <button
            type="button"
            class="map-control-button"
            title={labels.zoomOut}
            aria-label={labels.zoomOut}
            onclick={handleZoomOut}
            disabled={zoom <= 1}
        >
            <Icon name="minus" />
        </button>
        <button
            type="button"
            class="map-control-button fit-button"
            title={labels.fitRoute}
            aria-label={labels.fitRoute}
            onclick={fitRoute}
        >
            <Icon name="layers" />
            <span>{labels.fitRoute}</span>
        </button>
        <div class="map-pan-controls" role="group" aria-label={labels.panGroup}>
            <button
                type="button"
                class="map-control-button"
                title={labels.panUp}
                aria-label={labels.panUp}
                onclick={() => handlePan(0, 1)}
                onkeydown={handleKeyDown}
            >
                <Icon name="chevronUp" />
            </button>
            <button
                type="button"
                class="map-control-button"
                title={labels.panLeft}
                aria-label={labels.panLeft}
                onclick={() => handlePan(1, 0)}
                onkeydown={handleKeyDown}
            >
                <Icon name="chevronLeft" />
            </button>
            <button
                type="button"
                class="map-control-button"
                title={labels.panRight}
                aria-label={labels.panRight}
                onclick={() => handlePan(-1, 0)}
                onkeydown={handleKeyDown}
            >
                <Icon name="chevronRight" />
            </button>
            <button
                type="button"
                class="map-control-button"
                title={labels.panDown}
                aria-label={labels.panDown}
                onclick={() => handlePan(0, -1)}
                onkeydown={handleKeyDown}
            >
                <Icon name="chevronDown" />
            </button>
        </div>
    </div>

    <!-- Map Canvas Host (Mouse Drag-to-Pan Surface) -->
    <div
        class="map-canvas-host"
        class:is-dragging={isDragging}
        role="presentation"
        onpointerdown={handlePointerDown}
        onpointermove={handlePointerMove}
        onpointerup={handlePointerUp}
        onpointercancel={handlePointerUp}
    >
        <svg
            class="offline-map-svg"
            viewBox="0 0 {SVG_WIDTH} {SVG_HEIGHT}"
            preserveAspectRatio="xMidYMid meet"
            aria-label={labels.ariaLabel}
        >
            <defs>
                <marker
                    id="route-arrow"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="5"
                    markerHeight="5"
                    orient="auto-start-reverse"
                >
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" class="route-arrow-marker" />
                </marker>
            </defs>

            <!-- Fixed Sea Canvas Background -->
            <rect width={SVG_WIDTH} height={SVG_HEIGHT} class="map-sea-background" />

            <!-- Transformable Map Surface (Pan & Zoom) -->
            <g transform="translate({panX + 500 * (1 - zoom)}, {panY + 350 * (1 - zoom)}) scale({zoom})">
                <!-- Expanded Sea background inside transform to prevent gaps when panning/zooming -->
                <rect x="-4000" y="-3000" width="9000" height="7000" class="map-sea-background" />

                <!-- European Landmass & Country Polygons -->
                <g class="country-layer">
                    {#each EUROPE_COUNTRIES as country (country.code)}
                        <g class="country-group" data-country={country.code}>
                            {#each country.polygons as poly, polyIdx (polyIdx)}
                                <path d={formatPolygonPath(poly)} class="country-polygon" data-code={country.code} />
                            {/each}
                        </g>
                    {/each}
                </g>

                <!-- Country Name & Code Labels -->
                <g class="country-labels-layer" aria-hidden="true">
                    {#each EUROPE_COUNTRIES as country (country.code)}
                        {@const centroid = getCountryCentroid(country.code)}
                        {#if centroid !== null}
                            {@const cx = projectLon(centroid[0])}
                            {@const cy = projectLat(centroid[1])}
                            <text x={cx} y={cy} class="country-code-label" text-anchor="middle" dominant-baseline="central">
                                {country.code}
                            </text>
                        {/if}
                    {/each}
                </g>

                <!-- Route Connector Polyline -->
                {#if routePolylinePath.length > 0}
                    <path d={routePolylinePath} class="route-connector-glow" fill="none" />
                    <path
                        d={routePolylinePath}
                        class="route-connector-line"
                        fill="none"
                        marker-mid="url(#route-arrow)"
                        marker-end="url(#route-arrow)"
                    />
                {/if}

                <!-- Waypoint Markers -->
                <g class="waypoint-layer">
                    {#each validWaypoints as wp (wp.id)}
                        {@const cx = projectLon(wp.longitude)}
                        {@const cy = projectLat(wp.latitude)}
                        {@const isSelected = wp.id === selectedWaypointId}
                        {@const markerColor = getMarkerColor(wp.markerType)}

                        <a
                            href="#{wp.id}"
                            class="waypoint-node"
                            class:selected={isSelected}
                            role="button"
                            tabindex="0"
                            aria-label={wp.label}
                            onclick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onselectwaypoint?.(wp);
                            }}
                            onmouseenter={() => (hoveredWaypoint = wp)}
                            onmouseleave={() => (hoveredWaypoint = null)}
                        >
                            {#if isSelected}
                                <circle {cx} {cy} r="9" class="waypoint-halo-selected" />
                            {/if}
                            <circle {cx} {cy} r="6" class="waypoint-halo" />
                            <circle {cx} {cy} r="3" fill={markerColor} class="waypoint-dot" />
                        </a>
                    {/each}
                </g>
            </g>
        </svg>
    </div>

    <!-- Tooltip Overlay -->
    {#if hoveredWaypoint}
        <div class="map-hover-tooltip" role="tooltip">
            <div class="tooltip-header">
                <Icon name={getMarkerIcon(hoveredWaypoint.markerType)} />
                <strong>{hoveredWaypoint.label}</strong>
            </div>
            {#if hoveredWaypoint.subtitle}
                <div class="tooltip-row">{hoveredWaypoint.subtitle}</div>
            {/if}
            {#if hoveredWaypoint.tooltip}
                <div class="tooltip-row metadata">{hoveredWaypoint.tooltip}</div>
            {/if}
            <div class="tooltip-row coordinates">
                {formatCoordinates(hoveredWaypoint.latitude, hoveredWaypoint.longitude)}
            </div>
        </div>
    {/if}

    {#if validWaypoints.length === 0}
        <div class="map-empty-overlay">
            <Icon name="mapPin" />
            <p>{labels.emptyNotice}</p>
        </div>
    {/if}
</div>

<style>
    .offline-route-map-container {
        position: relative;
        inline-size: var(--size-full);
        block-size: var(--size-map-height);
        border-radius: var(--radius-panel);
        border: var(--border-region);
        background-color: var(--color-canvas);
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        touch-action: none;
    }

    .map-canvas-host {
        position: relative;
        inline-size: var(--size-full);
        block-size: var(--size-full);
        padding: var(--space-none);
        margin: var(--space-none);
        background-color: var(--color-canvas);
        display: block;
        cursor: grab;
        user-select: none;
    }

    .map-canvas-host.is-dragging {
        cursor: grabbing;
    }

    .offline-map-svg {
        inline-size: var(--size-full);
        block-size: var(--size-full);
        display: block;
        user-select: none;
        background-color: var(--color-canvas);
    }

    .map-sea-background {
        fill: var(--color-canvas);
    }

    .country-polygon {
        fill: var(--color-surface);
        stroke: var(--color-border-strong);
        stroke-width: var(--border-width-hairline);
        stroke-linejoin: round;
    }

    .country-polygon:hover {
        fill: var(--color-surface-hover);
        stroke: var(--color-accent);
    }

    .country-code-label {
        font-family: var(--font-family-body);
        font-size: var(--font-size-metadata);
        font-weight: var(--font-weight-title);
        letter-spacing: var(--letter-spacing-group);
        fill: var(--color-text-muted);
        paint-order: stroke;
        stroke: var(--color-surface);
        stroke-linecap: round;
        stroke-linejoin: round;
        pointer-events: none;
        user-select: none;
    }

    .route-connector-glow {
        stroke: var(--color-accent);
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .route-connector-line {
        stroke: var(--color-accent);
        stroke-dasharray: var(--stroke-dasharray-route);
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .route-arrow-marker {
        fill: var(--color-accent);
    }

    .waypoint-node {
        cursor: pointer;
        outline: none;
    }

    .waypoint-node:focus-visible .waypoint-halo {
        stroke: var(--color-focus);
        stroke-width: var(--size-focus-ring);
    }

    .waypoint-halo {
        fill: var(--color-surface);
        stroke: var(--color-border);
        stroke-width: var(--border-width-hairline);
    }

    .waypoint-halo-selected {
        fill: none;
        stroke: var(--color-focus);
        stroke-width: var(--size-focus-ring);
    }

    .map-controls {
        position: absolute;
        top: var(--space-actions);
        right: var(--space-actions);
        display: flex;
        flex-direction: column;
        gap: var(--space-compact);
        z-index: var(--z-index-map-overlay);
    }

    .map-control-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-compact);
        min-inline-size: var(--size-map-control);
        block-size: var(--size-map-control);
        padding: var(--space-compact) var(--space-actions);
        background-color: var(--color-surface);
        border: var(--border-control);
        border-radius: var(--radius-control);
        color: var(--color-text);
        font-size: var(--font-size-body);
        font-weight: var(--font-weight-title);
        cursor: pointer;
        box-shadow: var(--shadow-card);
    }

    .map-control-button:hover:not(:disabled) {
        background-color: var(--color-surface-hover);
        border-color: var(--color-border-strong);
    }

    .map-control-button:focus-visible {
        outline: var(--border-focus);
        outline-offset: var(--space-focus-offset);
    }

    .map-control-button:disabled {
        opacity: var(--opacity-disabled);
        cursor: not-allowed;
    }

    .fit-button {
        font-size: var(--font-size-metadata);
        font-weight: var(--font-weight-action);
        padding: var(--space-compact) var(--space-actions);
    }

    .map-hover-tooltip {
        position: absolute;
        bottom: var(--space-actions);
        left: var(--space-actions);
        background-color: var(--color-surface);
        border: var(--border-panel);
        border-radius: var(--radius-control);
        padding: var(--space-compact) var(--space-actions);
        box-shadow: var(--shadow-tooltip);
        display: flex;
        flex-direction: column;
        gap: var(--space-compact);
        font-size: var(--font-size-metadata);
        color: var(--color-text);
        pointer-events: none;
        z-index: var(--z-index-map-overlay);
    }

    .tooltip-header {
        display: flex;
        align-items: center;
        gap: var(--space-compact);
        font-size: var(--font-size-body);
        font-weight: var(--font-weight-title);
    }

    .tooltip-row.metadata {
        color: var(--color-text-muted);
    }

    .tooltip-row.coordinates {
        font-family: var(--font-family-source);
        color: var(--color-text-muted);
    }

    .map-empty-overlay {
        position: absolute;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-actions);
        color: var(--color-text-muted);
        text-align: center;
        padding: var(--space-panel);
        max-inline-size: var(--size-map-empty-max);
    }
</style>
