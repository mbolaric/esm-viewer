import { DEFAULT_VIEWER_PREFERENCES, isFileDisplayName, isReopenToken, type IViewerPreferences } from '#contracts';
import type { IViewerPreferencesStore, IViewerPreferencesTarget, ViewerPreferencesSaveResult } from '#viewer-application';
import { describe, expect, it, vi } from 'vitest';

import { ViewerPreferencesController } from '../controllers/viewer-preferences-controller.svelte.js';

interface IPreferencesHarness {
    readonly applied: IViewerPreferences[];
    readonly controller: ViewerPreferencesController;
    readonly dispose: ReturnType<typeof vi.fn<IViewerPreferencesTarget['dispose']>>;
    readonly save: ReturnType<typeof vi.fn<IViewerPreferencesStore['save']>>;
}

const changedPreferences = {
    ...DEFAULT_VIEWER_PREFERENCES,
    density: 'comfortable',
    theme: 'light',
} as const;

function preferencesHarness(
    saveResult: ViewerPreferencesSaveResult = { ok: true, value: null },
    initialPreferences: IViewerPreferences | null = DEFAULT_VIEWER_PREFERENCES,
    loadWarning = false,
    applyResults: readonly boolean[] = [],
    onapplied?: (previous: IViewerPreferences, next: IViewerPreferences) => void,
): IPreferencesHarness {
    const applied: IViewerPreferences[] = [];
    const dispose = vi.fn<IViewerPreferencesTarget['dispose']>();
    const save = vi.fn<IViewerPreferencesStore['save']>(() => Promise.resolve(saveResult));
    const controller = new ViewerPreferencesController({
        initialPreferences,
        loadWarning,
        ...(onapplied === undefined ? {} : { onapplied }),
        store: {
            load: () => Promise.resolve({ ok: true, value: DEFAULT_VIEWER_PREFERENCES }),
            save,
        },
        target: {
            apply: (preferences) => {
                const result = applyResults[applied.length] ?? true;
                applied.push(preferences);
                return result;
            },
            dispose,
        },
    });

    return {
        applied,
        controller,
        dispose,
        save,
    };
}

function expectRestoredAppearance(harness: IPreferencesHarness): void {
    expect(harness.applied).toEqual([DEFAULT_VIEWER_PREFERENCES, changedPreferences, DEFAULT_VIEWER_PREFERENCES]);
    expect(harness.controller.snapshot).toMatchObject({
        isOpen: true,
        preferences: DEFAULT_VIEWER_PREFERENCES,
        saveError: true,
        saving: false,
    });
}

describe('ViewerPreferencesController', () => {
    it('applies and persists supported preferences as one application-wide state', async () => {
        const harness = preferencesHarness();
        const preferences = {
            ...DEFAULT_VIEWER_PREFERENCES,
            density: 'comfortable',
            displayTimeZone: 'Europe/Berlin',
            theme: 'dark',
        } as const;

        expect(harness.controller.availableTimeZones).toContain('UTC');
        expect(harness.controller.availableTimeZones).toContain('Europe/Berlin');
        expect(harness.controller.availableTimeZones.length).toBeGreaterThan(1);
        expect(harness.controller.open()).toBe(true);
        await expect(harness.controller.apply(preferences)).resolves.toBe(true);

        expect(harness.save).toHaveBeenCalledWith(preferences);
        expect(harness.applied).toEqual([DEFAULT_VIEWER_PREFERENCES, preferences]);
        expect(harness.controller.snapshot).toEqual({
            isOpen: false,
            loadWarning: false,
            preferences,
            saveError: false,
            saving: false,
        });
        expect(harness.controller.locale).toBe('en');
        expect(harness.controller.timeZone).toBe('Europe/Berlin');
        expect(harness.controller.dateFormat).toBe('auto');
        expect(harness.controller.timeFormat).toBe('auto');
    });

    it('exposes the selected date and time formats and rejects unsupported updates', async () => {
        const harness = preferencesHarness();
        const preferences = {
            ...DEFAULT_VIEWER_PREFERENCES,
            displayDateFormat: 'ddMMyyyy',
            displayTimeFormat: 'h23',
        } as const;

        expect(harness.controller.open()).toBe(true);
        await expect(harness.controller.apply(preferences)).resolves.toBe(true);
        expect(harness.controller.dateFormat).toBe('ddMMyyyy');
        expect(harness.controller.timeFormat).toBe('h23');

        harness.controller.open();
        await expect(
            harness.controller.apply({
                ...DEFAULT_VIEWER_PREFERENCES,
                displayDateFormat: 'unknown',
            }),
        ).resolves.toBe(false);
        expect(harness.controller.dateFormat).toBe('ddMMyyyy');
        expect(harness.controller.timeFormat).toBe('h23');
    });

    it('keeps the dialog actionable and restores appearance when persistence fails', async () => {
        const harness = preferencesHarness({
            error: 'preferencesSaveFailed',
            ok: false,
        });

        harness.controller.open();
        await expect(harness.controller.apply(changedPreferences)).resolves.toBe(false);

        expectRestoredAppearance(harness);
    });

    it('restores appearance without saving when the renderer target rejects a change', async () => {
        const harness = preferencesHarness({ ok: true, value: null }, DEFAULT_VIEWER_PREFERENCES, false, [true, false, true]);

        harness.controller.open();
        await expect(harness.controller.apply(changedPreferences)).resolves.toBe(false);

        expectRestoredAppearance(harness);
        expect(harness.save).not.toHaveBeenCalled();
    });

    it('falls back from unsupported stored preferences and rejects invalid updates', async () => {
        const harness = preferencesHarness(
            { ok: true, value: null },
            {
                ...DEFAULT_VIEWER_PREFERENCES,
                displayTimeZone: 'Invalid/Zone',
                locale: 'de',
            },
        );

        expect(harness.controller.snapshot).toMatchObject({
            loadWarning: true,
            preferences: DEFAULT_VIEWER_PREFERENCES,
        });
        harness.controller.open();
        await expect(
            harness.controller.apply({
                ...DEFAULT_VIEWER_PREFERENCES,
                displayTimeZone: 'Invalid/Zone',
            }),
        ).resolves.toBe(false);
        expect(harness.save).not.toHaveBeenCalled();
        expect(harness.controller.snapshot.saveError).toBe(true);
    });

    it('applies night-work window changes and rejects unsupported values', async () => {
        const harness = preferencesHarness();
        const preferences = {
            ...DEFAULT_VIEWER_PREFERENCES,
            nightWorkEndHour: 5,
            nightWorkStartHour: 1,
            nightWorkTimeZone: 'Europe/Berlin',
        } as const;

        expect(harness.controller.availableNightWorkTimeZones).toContain('UTC');
        expect(harness.controller.availableNightWorkTimeZones.length).toBeGreaterThan(1);

        harness.controller.open();
        await expect(harness.controller.apply(preferences)).resolves.toBe(true);
        expect(harness.controller.snapshot.preferences).toEqual(preferences);

        harness.controller.open();
        await expect(
            harness.controller.apply({
                ...preferences,
                nightWorkEndHour: 1,
                nightWorkStartHour: 5,
            }),
        ).resolves.toBe(false);
        expect(harness.controller.snapshot.preferences).toEqual(preferences);
    });

    it('reports the previous and new preferences only after a successful save', async () => {
        const onapplied = vi.fn<(previous: IViewerPreferences, next: IViewerPreferences) => void>();
        const failing = preferencesHarness(
            { error: 'preferencesSaveFailed', ok: false },
            DEFAULT_VIEWER_PREFERENCES,
            false,
            [],
            onapplied,
        );

        failing.controller.open();
        await failing.controller.apply(changedPreferences);
        expect(onapplied).not.toHaveBeenCalled();

        const succeeding = preferencesHarness(undefined, DEFAULT_VIEWER_PREFERENCES, false, [], onapplied);
        succeeding.controller.open();
        await succeeding.controller.apply(changedPreferences);
        expect(onapplied).toHaveBeenCalledExactlyOnceWith(DEFAULT_VIEWER_PREFERENCES, changedPreferences);
    });

    it('cancels editable state and disposes its renderer target once', () => {
        const harness = preferencesHarness();

        expect(harness.controller.open()).toBe(true);
        expect(harness.controller.cancel()).toBe(true);
        expect(harness.controller.snapshot.isOpen).toBe(false);

        harness.controller.dispose();
        harness.controller.dispose();
        expect(harness.dispose).toHaveBeenCalledOnce();
        expect(harness.controller.open()).toBe(false);
    });

    it('ignores a recorded recent file while the preference is disabled', () => {
        const harness = preferencesHarness(
            { ok: true, value: null },
            {
                ...DEFAULT_VIEWER_PREFERENCES,
                recentFilePathsEnabled: true,
                recentFilesEnabled: false,
            },
        );
        const displayName = 'card.ddd';
        const reopenToken = '/private/tachograph/card.ddd';
        if (!isFileDisplayName(displayName) || !isReopenToken(reopenToken)) {
            throw new TypeError('The recent-file fixture must be valid.');
        }

        harness.controller.recordRecentFile({ displayName, openedAtEpochMs: 1, reopenToken });

        expect(harness.controller.snapshot.preferences.recentFiles).toEqual([]);
        expect(harness.save).not.toHaveBeenCalled();
    });

    it('records, dedupes, caps, and clears recent files while the preference is enabled', () => {
        const harness = preferencesHarness(
            { ok: true, value: null },
            {
                ...DEFAULT_VIEWER_PREFERENCES,
                recentFilePathsEnabled: false,
                recentFilesEnabled: true,
            },
        );
        const displayName = 'card.ddd';
        const reopenToken = '/private/tachograph/card.ddd';
        const otherReopenToken = '/private/tachograph/other.ddd';
        if (!isFileDisplayName(displayName) || !isReopenToken(reopenToken) || !isReopenToken(otherReopenToken)) {
            throw new TypeError('The recent-file fixture must be valid.');
        }

        harness.controller.recordRecentFile({ displayName, openedAtEpochMs: 1, reopenToken });
        harness.controller.recordRecentFile({
            displayName,
            openedAtEpochMs: 2,
            reopenToken: otherReopenToken,
        });
        // Reopening moves entry to the front without duplicates.
        harness.controller.recordRecentFile({ displayName, openedAtEpochMs: 3, reopenToken });

        expect(harness.controller.snapshot.preferences.recentFiles).toEqual([
            { displayName, openedAtEpochMs: 3, reopenToken },
            { displayName, openedAtEpochMs: 2, reopenToken: otherReopenToken },
        ]);
        expect(harness.save).toHaveBeenCalledTimes(3);

        harness.controller.clearRecentFiles();

        expect(harness.controller.snapshot.preferences.recentFiles).toEqual([]);
        expect(harness.save).toHaveBeenCalledTimes(4);
    });

    it('persists a separate page size for each table', () => {
        const harness = preferencesHarness();

        expect(harness.controller.getPageSize('viewer.documents')).toBe(50);

        harness.controller.setPageSize('viewer.documents', 25);
        harness.controller.setPageSize('viewer.activity', 100);

        expect(harness.controller.getPageSize('viewer.documents')).toBe(25);
        expect(harness.controller.getPageSize('viewer.activity')).toBe(100);
        expect(harness.save).toHaveBeenLastCalledWith({
            ...DEFAULT_VIEWER_PREFERENCES,
            tablePageSizes: {
                'viewer.documents': 25,
                'viewer.activity': 100,
            },
        });
    });
});
