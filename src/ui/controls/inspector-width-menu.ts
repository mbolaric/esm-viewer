export interface IInspectorWidthLabels {
    readonly defaultLabel: string;
    readonly menuLabel: string;
    readonly narrowLabel: string;
    readonly resizeLabel: string;
    readonly wideLabel: string;
}

export const DEFAULT_INSPECTOR_WIDTH = 320;
export const DEFAULT_INSPECTOR_MAXIMUM_WIDTH = 440;
export const DEFAULT_INSPECTOR_MINIMUM_WIDTH = 280;

export function clampInspectorWidth(width: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, Math.round(width)));
}
