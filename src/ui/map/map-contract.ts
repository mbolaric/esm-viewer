export type MapMarkerType = 'accent' | 'approximate' | 'end' | 'info' | 'primary' | 'start' | 'warning';

export interface IMapBoundingBox {
    readonly maxLat: number;
    readonly maxLon: number;
    readonly minLat: number;
    readonly minLon: number;
}

export interface IMapWaypoint {
    readonly id: string;
    readonly label: string;
    readonly latitude: number;
    readonly longitude: number;
    readonly markerType: MapMarkerType;
    readonly subtitle?: string | undefined;
    readonly tooltip?: string | undefined;
}

export interface IMapRoute {
    readonly boundingBox?: IMapBoundingBox | undefined;
    readonly waypoints: readonly IMapWaypoint[];
}

export interface IMapControlsLabels {
    readonly ariaLabel: string;
    readonly emptyNotice: string;
    readonly fitRoute: string;
    readonly panDown: string;
    readonly panGroup: string;
    readonly panLeft: string;
    readonly panRight: string;
    readonly panUp: string;
    readonly zoomIn: string;
    readonly zoomOut: string;
}
