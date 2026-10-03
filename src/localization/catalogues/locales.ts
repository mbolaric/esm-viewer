import { de } from './de.js';
import { en } from './en.js';
import type { TranslationKey } from './en.js';
import { es } from './es.js';
import { fr } from './fr.js';
import { hr } from './hr.js';
import { it } from './it.js';
import { pl } from './pl.js';

export const viewerLocales = ['en', 'de', 'fr', 'it', 'pl', 'es', 'hr'] as const;
export type ViewerLocale = (typeof viewerLocales)[number];

export type IMessageParams = Readonly<{
    'activityWindow.filteredNotice': Readonly<{
        date: string;
    }>;
    'activities.calendar.gridLabel': Readonly<{
        month: string;
    }>;
    'activities.calendar.monthDaysHeading': Readonly<{
        month: string;
    }>;
    'activities.calendar.presenceMinutes': Readonly<{
        minutes: string;
    }>;
    'activities.calendar.presenceSummary': Readonly<{
        present: string;
        total: string;
    }>;
    'activities.calendar.yearDaysHeading': Readonly<{
        year: string;
    }>;
    'activities.calendar.yearLabel': Readonly<{
        year: string;
    }>;
    'activities.crew.notice.crewFailed': Readonly<{
        time: string;
    }>;
    'activities.crew.notice.unknown': Readonly<{
        time: string;
    }>;
    'activities.crew.restWindowRange': Readonly<{
        hours: string;
    }>;
    'activities.crew.restWindowValue': Readonly<{
        end: string;
        hours: string;
        start: string;
    }>;
    'activities.crew.restWindowValueNextDay': Readonly<{
        days: string;
        end: string;
        hours: string;
        start: string;
    }>;
    'activities.continuousDriving.peakNotice': Readonly<{
        peak: string;
    }>;
    'activities.continuousDriving.ratio': Readonly<{
        current: string;
        max: string;
    }>;
    'activities.shift.continuedFromPrevious': Readonly<{
        startTime: string;
    }>;
    'activities.shift.continuesIntoNext': Readonly<{
        endTime: string;
    }>;
    'activities.shift.heading': Readonly<{
        index: string;
        span: string;
    }>;
    'activities.shift.spansAcrossDay': Readonly<{
        endTime: string;
        startTime: string;
    }>;
    'activities.timeline.infringementPin': Readonly<{
        severity: string;
        time: string;
        title: string;
    }>;
    'compliance.legalFormat': Readonly<{
        article: string;
        regulation: string;
    }>;
    'compliance.groupedCaption': Readonly<{
        article: string;
        caption: string;
    }>;
    'compliance.groupedHeading': Readonly<{
        article: string;
        count: string;
    }>;
    'compliance.minutesFormat': Readonly<{
        minutes: string;
    }>;
    'compliance.noResultsDescription': Readonly<{
        count: string;
    }>;
    'compliance.profileVersion': Readonly<{
        name: string;
        version: string;
    }>;
    'comparison.removeConfirmMessage': Readonly<{
        displayName: string;
    }>;
    'eventsFaults.securityCriticalCount': Readonly<{
        count: string;
    }>;
    'export.toast.failed': Readonly<{
        reason: string;
    }>;
    'export.toast.success': Readonly<{
        fileName: string;
    }>;
    'overview.kpi.eventsFaultsSubtext': Readonly<{
        events: string;
        faults: string;
    }>;
    'overview.kpi.securityAlertsSubtext': Readonly<{
        count: string;
    }>;
    'overview.kpi.warningsCount': Readonly<{
        count: string;
    }>;
    'speed.table.page': Readonly<{
        page: string;
        pageCount: string;
        samples: string;
    }>;
    'places.journey.shiftOption': Readonly<{
        current: string;
        date: string;
        distance: string;
        stops: string;
        total: string;
        unit: string;
    }>;
    'table.filterResultCount': Readonly<{
        shown: string;
        total: string;
    }>;
}>;

export const defaultViewerLocale: ViewerLocale = 'en';

export const viewerCatalogues = {
    en,
    de,
    fr,
    it,
    pl,
    es,
    hr,
} satisfies Readonly<Record<ViewerLocale, Readonly<Record<TranslationKey, string>>>>;

export function isViewerLocale(value: unknown): value is ViewerLocale {
    return typeof value === 'string' && viewerLocales.some((locale) => locale === value);
}
