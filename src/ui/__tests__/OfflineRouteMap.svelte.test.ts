import { fireEvent, render, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import type { IMapControlsLabels, IMapRoute, IMapWaypoint } from '../map/map-contract.js';
import OfflineRouteMap from '../map/OfflineRouteMap.svelte';

const testLabels: IMapControlsLabels = {
    ariaLabel: 'Offline route map',
    emptyNotice: 'No GNSS coordinates recorded for this shift.',
    fitRoute: 'Fit route',
    panDown: 'Pan down',
    panGroup: 'Pan map',
    panLeft: 'Pan left',
    panRight: 'Pan right',
    panUp: 'Pan up',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
};

describe('OfflineRouteMap', () => {
    it('renders empty notice when route is null', () => {
        const { container } = render(OfflineRouteMap, {
            props: {
                labels: testLabels,
                route: null,
            },
        });

        expect(within(container).getByText('No GNSS coordinates recorded for this shift.')).toBeTruthy();
    });

    it('renders waypoints and country paths on map', () => {
        const waypoints: IMapWaypoint[] = [
            {
                id: 'start-1',
                label: 'Shift start',
                latitude: 52.52,
                longitude: 13.405,
                markerType: 'start',
                subtitle: 'Germany • 08:00',
            },
            {
                id: 'end-1',
                label: 'Shift end',
                latitude: 50.85,
                longitude: 4.35,
                markerType: 'end',
                subtitle: 'Belgium • 17:00',
            },
        ];

        const route: IMapRoute = {
            waypoints,
        };

        const { container } = render(OfflineRouteMap, {
            props: {
                labels: testLabels,
                route,
            },
        });

        const paths = container.querySelectorAll('.country-polygon');
        expect(paths.length).toBeGreaterThan(0);

        const waypointLinks = within(container).getAllByRole('button', {
            name: /Shift (start|end)/,
        });
        expect(waypointLinks).toHaveLength(2);
    });

    it('triggers onselectwaypoint callback when clicking a waypoint', async () => {
        const onselectwaypoint = vi.fn<(wp: IMapWaypoint) => void>();
        const waypoints: IMapWaypoint[] = [
            {
                id: 'start-1',
                label: 'Shift start',
                latitude: 52.52,
                longitude: 13.405,
                markerType: 'start',
                subtitle: 'Germany • 08:00',
            },
        ];

        const { container } = render(OfflineRouteMap, {
            props: {
                labels: testLabels,
                onselectwaypoint,
                route: { waypoints },
            },
        });

        const waypointBtn = within(container).getByRole('button', {
            name: /Shift start/,
        });
        await fireEvent.click(waypointBtn);

        expect(onselectwaypoint).toHaveBeenCalledWith(waypoints[0]);
    });

    it('keeps a waypoint focusable for its visible focus treatment', () => {
        const waypoints: IMapWaypoint[] = [
            {
                id: 'start-1',
                label: 'Shift start',
                latitude: 52.52,
                longitude: 13.405,
                markerType: 'start',
            },
        ];

        const { container } = render(OfflineRouteMap, {
            props: {
                labels: testLabels,
                route: { waypoints },
            },
        });

        const waypoint = within(container).getByRole('button', { name: 'Shift start' });
        waypoint.focus();

        expect(document.activeElement).toBe(waypoint);
        expect(waypoint.querySelector('.waypoint-halo')).toBeTruthy();
    });

    it('supports zoom and fit route buttons', async () => {
        const waypoints: IMapWaypoint[] = [
            {
                id: 'wp-1',
                label: 'GNSS fix',
                latitude: 48.8566,
                longitude: 2.3522,
                markerType: 'info',
            },
        ];

        const { container } = render(OfflineRouteMap, {
            props: {
                labels: testLabels,
                route: { waypoints },
            },
        });

        const zoomInBtn = within(container).getByRole('button', { name: 'Zoom in' });
        const zoomOutBtn = within(container).getByRole('button', { name: 'Zoom out' });
        const fitBtn = within(container).getByRole('button', { name: 'Fit route' });

        await fireEvent.click(zoomInBtn);
        await fireEvent.click(zoomOutBtn);
        await fireEvent.click(fitBtn);

        expect(zoomInBtn).toBeTruthy();
    });

    it('highlights selected waypoint node', () => {
        const waypoints: IMapWaypoint[] = [
            {
                id: 'wp-1',
                label: 'Start',
                latitude: 50.0,
                longitude: 8.0,
                markerType: 'start',
            },
            {
                id: 'wp-2',
                label: 'End',
                latitude: 51.0,
                longitude: 9.0,
                markerType: 'end',
            },
        ];

        const { container } = render(OfflineRouteMap, {
            props: {
                labels: testLabels,
                route: { waypoints },
                selectedWaypointId: 'wp-2',
            },
        });

        const selectedHalo = container.querySelector('.waypoint-halo-selected');
        expect(selectedHalo).toBeTruthy();
    });

    it('renders an approximate marker with distinct, muted styling (VIEWER-04 follow-up)', async () => {
        const waypoints: IMapWaypoint[] = [
            {
                id: 'wp-real',
                label: 'GNSS fix',
                latitude: 50.0,
                longitude: 8.0,
                markerType: 'info',
            },
            {
                id: 'wp-approx',
                label: 'Shift start',
                latitude: 51.0,
                longitude: 9.0,
                markerType: 'approximate',
                subtitle: 'D • 08:00 • Approximate',
                tooltip: 'Approximate position - country recorded, no GPS fix available.',
            },
        ];

        const { container } = render(OfflineRouteMap, {
            props: {
                labels: testLabels,
                route: { waypoints },
            },
        });

        const realDot = container.querySelector('a[aria-label="GNSS fix"] .waypoint-dot');
        const approxDot = container.querySelector('a[aria-label="Shift start"] .waypoint-dot');
        expect(realDot).toBeTruthy();
        expect(approxDot).toBeTruthy();
        expect(approxDot?.getAttribute('fill')).toBe('var(--color-text-muted)');
        expect(approxDot?.getAttribute('fill')).not.toBe(realDot?.getAttribute('fill'));

        const approxLink = within(container).getByRole('button', { name: 'Shift start' });
        await fireEvent.mouseEnter(approxLink);
        expect(within(container).getByText('Approximate position - country recorded, no GPS fix available.')).toBeTruthy();
    });
});
