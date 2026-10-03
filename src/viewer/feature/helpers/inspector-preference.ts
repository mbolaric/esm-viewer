import type { IKeyValueStore } from '#contracts';
import {
    clampInspectorWidth,
    DEFAULT_INSPECTOR_MAXIMUM_WIDTH,
    DEFAULT_INSPECTOR_MINIMUM_WIDTH,
    DEFAULT_INSPECTOR_WIDTH,
} from '#ui';

const inspectorWidthStorageKey = 'esm-viewer.inspectorWidth';

function clampToInspectorBounds(width: number): number {
    return clampInspectorWidth(width, DEFAULT_INSPECTOR_MINIMUM_WIDTH, DEFAULT_INSPECTOR_MAXIMUM_WIDTH);
}

export function loadInspectorWidth(store: IKeyValueStore): number {
    const stored = store.getItem(inspectorWidthStorageKey);
    const parsed = stored === null ? Number.NaN : Number.parseFloat(stored);
    return Number.isFinite(parsed) ? clampToInspectorBounds(parsed) : DEFAULT_INSPECTOR_WIDTH;
}

export function saveInspectorWidth(store: IKeyValueStore, width: number): void {
    store.setItem(inspectorWidthStorageKey, String(clampToInspectorBounds(width)));
}
