import type { IViewerPreferences } from '#contracts';
import type { IErrorService } from '#error-reporting';
import { createLocalisationService, createTranslationService } from '#localization';
import type { IViewerPreferencesStore, IViewerPreferencesTarget } from '#viewer-application';
import type { DurationMilliseconds, UtcTimestamp } from '#viewer-domain';
import { describe, expect, it } from 'vitest';

import {
    createActivityDatePickerLocalisation,
    type IDatePickerLocalisationContext,
} from '../helpers/date-picker-localisation.js';
import { defaultViewerLocale, viewerCatalogues } from '#i18n-locales';
import { ViewerPreferencesController } from '../controllers/viewer-preferences-controller.svelte.js';

const julyTwentySeventh = Date.UTC(2026, 6, 27);
const julyTwentyEighth = Date.UTC(2026, 6, 28);

type TestDateFormat = 'auto' | 'ddMMyyyy' | 'yyyyMMdd';

function preferences(displayDateFormat: TestDateFormat): IViewerPreferences {
    return {
        density: 'compact',
        displayDateFormat,
        displayTimeFormat: 'h23',
        displayTimeZone: 'UTC',
        locale: defaultViewerLocale,
        nightWorkEndHour: 4,
        nightWorkStartHour: 0,
        nightWorkTimeZone: 'UTC',
        pinnedTableColumnIds: {},
        recentFiles: [],
        recentFilesEnabled: false,
        recentFilePathsEnabled: false,
        tablePageSizes: {},
        theme: 'system',
        verificationAutoRun: false,
        version: 1,
    } as const;
}

const store: IViewerPreferencesStore = {
    load: () => Promise.resolve({ ok: true, value: preferences('ddMMyyyy') }),
    save: () => Promise.resolve({ ok: true, value: null }),
};

const target: IViewerPreferencesTarget = {
    apply: () => true,
    dispose: () => undefined,
};

function context(displayDateFormat: TestDateFormat): IDatePickerLocalisationContext {
    const preferencesController = new ViewerPreferencesController({
        initialPreferences: preferences(displayDateFormat),
        loadWarning: false,
        store,
        target,
    });
    const localisationResult = createLocalisationService<UtcTimestamp, DurationMilliseconds>(
        preferencesController,
        preferencesController,
        preferencesController,
    );
    if (!localisationResult.ok) {
        throw new TypeError('The test localisation service configuration must be valid.');
    }
    const errorService = {
        report(): Promise<void> {
            return Promise.resolve();
        },
    } satisfies IErrorService;
    return {
        localisationService: localisationResult.value,
        preferencesController,
        translationService: createTranslationService(preferencesController, viewerCatalogues, defaultViewerLocale, errorService),
    };
}

describe('createActivityDatePickerLocalisation', () => {
    it('follows the day-first display date format', () => {
        const adapter = createActivityDatePickerLocalisation(context('ddMMyyyy'));

        expect(adapter.localise.formatValue(julyTwentySeventh)).toBe('27.07.2026');
        expect(adapter.localise.parseValue('28.07.2026', julyTwentySeventh)).toBe(julyTwentyEighth);
        expect(adapter.placeholder).toBe('dd.MM.yyyy');
    });

    it('follows the year-first display date format', () => {
        const adapter = createActivityDatePickerLocalisation(context('yyyyMMdd'));

        expect(adapter.localise.formatValue(julyTwentySeventh)).toBe('2026-07-27');
        expect(adapter.localise.parseValue('2026-07-28', julyTwentySeventh)).toBe(julyTwentyEighth);
        expect(adapter.placeholder).toBe('yyyy-MM-dd');
    });

    it('resolves the automatic format for the UTC time zone to a medium date', () => {
        const adapter = createActivityDatePickerLocalisation(context('auto'));

        expect(adapter.localise.formatValue(julyTwentySeventh)).toBe('Jul 27, 2026');
        expect(adapter.localise.parseValue('Jul 28, 2026', julyTwentySeventh)).toBe(julyTwentyEighth);
        expect(adapter.placeholder).toBe('MMM d, yyyy');
        expect(adapter.localise.weekdayLabels).toHaveLength(7);
        expect(adapter.labels.clear).toBe('Clear date');
        expect(adapter.labels.toggle).toBe('Open date picker');
    });
});
