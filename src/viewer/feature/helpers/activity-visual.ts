import type { ChartColorToken, IconName } from '#ui';
import type { ActivityKind } from '#viewer-domain';

export function activityBandHeight(activity: ActivityKind): number {
    switch (activity) {
        case 'availability':
            return 0.7;
        case 'breakOrRest':
            return 0.3;
        case 'driving':
            return 1;
        case 'unknown':
            return 0.2;
        case 'work':
            return 0.4;
    }
}

export function activityColorToken(activity: ActivityKind): ChartColorToken {
    switch (activity) {
        case 'availability':
            return '--color-activity-availability';
        case 'breakOrRest':
            return '--color-activity-break-rest';
        case 'driving':
            return '--color-activity-driving';
        case 'unknown':
            return '--color-activity-unknown';
        case 'work':
            return '--color-activity-work';
    }
}

export function activityIcon(activity: ActivityKind): IconName {
    switch (activity) {
        case 'availability':
            return 'hourglass';
        case 'breakOrRest':
            return 'bed';
        case 'driving':
            return 'circleGauge';
        case 'unknown':
            return 'circleHelp';
        case 'work':
            return 'hammer';
    }
}

// Static Lucide geometry for HTML exports, which cannot render Svelte icon components. A test compares it with the
// installed icon library so an upgrade cannot silently desynchronise the export from the UI.
export const activityIconNodes: Readonly<Record<ActivityKind, string>> = {
    availability:
        '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
    breakOrRest: '<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>',
    driving: '<path d="M15.6 2.7a10 10 0 1 0 5.7 5.7"/><circle cx="12" cy="12" r="2"/><path d="M13.4 10.6 19 5"/>',
    unknown: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    work: '<path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>',
};

export function activityIconSvg(activity: ActivityKind): string {
    return `<svg class="activity-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${activityIconNodes[activity]}</svg>`;
}
