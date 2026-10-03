import { DEFAULT_VIEWER_PREFERENCES, type IViewerPreferences } from '#contracts';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import PreferencesDialog from '../components/dialogs/PreferencesDialog.svelte';
import { createViewerTestRenderOptions } from './viewer-test-render.js';

afterEach(() => {
    cleanup();
});

describe('PreferencesDialog', () => {
    it('shows recoverable failures and emits a complete typed preference draft', async () => {
        const apply = vi.fn<(preferences: IViewerPreferences) => void>();
        const cancel = vi.fn();
        render(
            PreferencesDialog,
            {
                props: {
                    availableNightWorkTimeZones: ['UTC', 'Europe/Berlin'],
                    availableTimeZones: ['UTC', 'Europe/Berlin'],
                    loadWarning: true,
                    onapply: apply,
                    oncancel: cancel,
                    preferences: DEFAULT_VIEWER_PREFERENCES,
                    saveError: true,
                    saving: false,
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByRole('status').textContent).toContain('Saved preferences could not be loaded.');
        expect(screen.getByRole('alert').textContent).toContain('Preferences could not be saved.');

        // Default tab: General
        await fireEvent.change(screen.getByLabelText('Language'), {
            target: { value: 'de' },
        });
        await fireEvent.change(screen.getByLabelText('Theme'), {
            target: { value: 'light' },
        });
        await fireEvent.click(screen.getByLabelText('Verify signatures automatically'));

        await fireEvent.click(screen.getByRole('tab', { name: 'Date & Time' }));
        await fireEvent.change(screen.getByLabelText('Time display'), {
            target: { value: 'Europe/Berlin' },
        });
        const dateFormatSelect = screen.getByLabelText('Date format');
        if (!(dateFormatSelect instanceof HTMLSelectElement)) {
            throw new TypeError('The date format control must be a select.');
        }
        expect(dateFormatSelect.value).toBe('ddMMyyyy');
        const timeFormatSelect = screen.getByLabelText('Time format');
        if (!(timeFormatSelect instanceof HTMLSelectElement)) {
            throw new TypeError('The time format control must be a select.');
        }
        expect(timeFormatSelect.value).toBe('h23');
        await fireEvent.change(timeFormatSelect, {
            target: { value: 'h12' },
        });

        await fireEvent.click(screen.getByRole('tab', { name: 'Appearance' }));
        const densityFieldset = screen.getByRole('group', { name: 'Density preview' });
        const compactPreview = densityFieldset.querySelector('[data-density="compact"]');
        const comfortablePreview = densityFieldset.querySelector('[data-density="comfortable"]');
        if (compactPreview === null || comfortablePreview === null) {
            throw new TypeError('Both density preview panels must render.');
        }
        await fireEvent.click(screen.getByRole('radio', { name: 'Comfortable' }));

        await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

        expect(apply).toHaveBeenCalledWith({
            ...DEFAULT_VIEWER_PREFERENCES,
            density: 'comfortable',
            displayDateFormat: 'auto',
            displayTimeFormat: 'h12',
            displayTimeZone: 'Europe/Berlin',
            locale: 'de',
            theme: 'light',
            verificationAutoRun: true,
        });
        expect(cancel).not.toHaveBeenCalled();
    });

    it('re-preselects timezone defaults until the user pins a format', async () => {
        const apply = vi.fn<(preferences: IViewerPreferences) => void>();
        render(
            PreferencesDialog,
            {
                props: {
                    availableNightWorkTimeZones: ['UTC', 'Europe/Berlin', 'America/New_York'],
                    availableTimeZones: ['UTC', 'Europe/Berlin', 'America/New_York'],
                    loadWarning: false,
                    onapply: apply,
                    oncancel: () => undefined,
                    preferences: DEFAULT_VIEWER_PREFERENCES,
                    saveError: false,
                    saving: false,
                },
            },
            createViewerTestRenderOptions(),
        );

        await fireEvent.click(screen.getByRole('tab', { name: 'Date & Time' }));
        await fireEvent.change(screen.getByLabelText('Time display'), {
            target: { value: 'Europe/Berlin' },
        });
        const dateFormatSelect = screen.getByLabelText('Date format');
        const timeFormatSelect = screen.getByLabelText('Time format');
        if (!(dateFormatSelect instanceof HTMLSelectElement) || !(timeFormatSelect instanceof HTMLSelectElement)) {
            throw new TypeError('The format controls must be selects.');
        }
        expect(dateFormatSelect.value).toBe('ddMMyyyy');
        expect(timeFormatSelect.value).toBe('h23');

        await fireEvent.change(screen.getByLabelText('Time display'), {
            target: { value: 'America/New_York' },
        });
        expect(dateFormatSelect.value).toBe('MMddyyyy');
        expect(timeFormatSelect.value).toBe('h12');

        await fireEvent.change(screen.getByLabelText('Date format'), {
            target: { value: 'yyyyMMdd' },
        });
        await fireEvent.change(screen.getByLabelText('Time display'), {
            target: { value: 'UTC' },
        });
        expect(dateFormatSelect.value).toBe('yyyyMMdd');
        expect(timeFormatSelect.value).toBe('h23');

        await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
        expect(apply).toHaveBeenCalledWith({
            ...DEFAULT_VIEWER_PREFERENCES,
            displayDateFormat: 'yyyyMMdd',
            displayTimeFormat: 'auto',
            displayTimeZone: 'UTC',
        });
    });

    it('closes through the native dialog cancel event and disables actions while saving', () => {
        const cancel = vi.fn();
        render(
            PreferencesDialog,
            {
                props: {
                    availableNightWorkTimeZones: ['UTC'],
                    availableTimeZones: ['UTC'],
                    loadWarning: false,
                    onapply: () => undefined,
                    oncancel: cancel,
                    preferences: DEFAULT_VIEWER_PREFERENCES,
                    saveError: false,
                    saving: true,
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByRole('button', { name: 'Applying…' }).hasAttribute('disabled')).toBe(true);
        expect(screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(true);

        const dialog = screen.getByRole('dialog', { name: 'Preferences' });
        dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
        expect(cancel).toHaveBeenCalledOnce();
    });

    it('includes the night-work window fields in the applied preference draft', async () => {
        const apply = vi.fn<(preferences: IViewerPreferences) => void>();
        render(
            PreferencesDialog,
            {
                props: {
                    availableNightWorkTimeZones: ['UTC', 'Europe/Berlin'],
                    availableTimeZones: ['UTC'],
                    loadWarning: false,
                    onapply: apply,
                    oncancel: () => undefined,
                    preferences: DEFAULT_VIEWER_PREFERENCES,
                    saveError: false,
                    saving: false,
                },
            },
            createViewerTestRenderOptions(),
        );

        await fireEvent.click(screen.getByRole('tab', { name: 'Night Work Window' }));
        const nightWorkTimeZoneSelect = screen.getByLabelText('Night window time zone');
        if (!(nightWorkTimeZoneSelect instanceof HTMLSelectElement)) {
            throw new TypeError('The night-work time zone control must be a select.');
        }
        expect(nightWorkTimeZoneSelect.value).toBe('UTC');
        await fireEvent.change(screen.getByLabelText('Night window time zone'), {
            target: { value: 'Europe/Berlin' },
        });
        await fireEvent.change(screen.getByLabelText('Night window start hour'), {
            target: { value: '2' },
        });
        await fireEvent.change(screen.getByLabelText('Night window end hour'), {
            target: { value: '7' },
        });
        await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

        expect(apply).toHaveBeenCalledWith({
            ...DEFAULT_VIEWER_PREFERENCES,
            nightWorkEndHour: 7,
            nightWorkStartHour: 2,
            nightWorkTimeZone: 'Europe/Berlin',
        });
    });

    it('offers only night windows of at least four hours between 00:00 and 07:00 (Directive 2002/15/EC Art. 3(h))', async () => {
        const apply = vi.fn<(preferences: IViewerPreferences) => void>();
        render(
            PreferencesDialog,
            {
                props: {
                    availableNightWorkTimeZones: ['UTC'],
                    availableTimeZones: ['UTC'],
                    loadWarning: false,
                    onapply: apply,
                    oncancel: () => undefined,
                    preferences: DEFAULT_VIEWER_PREFERENCES,
                    saveError: false,
                    saving: false,
                },
            },
            createViewerTestRenderOptions(),
        );

        await fireEvent.click(screen.getByRole('tab', { name: 'Night Work Window' }));
        const optionValues = (label: string): readonly string[] => {
            const select = screen.getByLabelText(label);
            if (!(select instanceof HTMLSelectElement)) {
                throw new TypeError(`${label} must be a select.`);
            }
            return Array.from(select.options, (option) => option.value);
        };
        expect(optionValues('Night window start hour')).toEqual(['0', '1', '2', '3']);
        expect(optionValues('Night window end hour')).toEqual(['4', '5', '6', '7']);

        // A later start moves an end that would leave less than four hours to the shortest valid window.
        await fireEvent.change(screen.getByLabelText('Night window start hour'), {
            target: { value: '3' },
        });
        expect(optionValues('Night window end hour')).toEqual(['7']);
        await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

        expect(apply).toHaveBeenCalledWith({ ...DEFAULT_VIEWER_PREFERENCES, nightWorkEndHour: 7, nightWorkStartHour: 3 });
    });

    it('controls the last-opened folder and recent-file history independently', async () => {
        const apply = vi.fn<(preferences: IViewerPreferences) => void>();
        render(
            PreferencesDialog,
            {
                props: {
                    availableNightWorkTimeZones: ['UTC'],
                    availableTimeZones: ['UTC'],
                    loadWarning: false,
                    onapply: apply,
                    oncancel: () => undefined,
                    preferences: {
                        ...DEFAULT_VIEWER_PREFERENCES,
                        recentFilePathsEnabled: true,
                        recentFilesEnabled: true,
                    },
                    saveError: false,
                    saving: false,
                },
            },
            createViewerTestRenderOptions(),
        );

        await fireEvent.click(screen.getByRole('tab', { name: 'Files & Privacy' }));
        const folderPreference = screen.getByLabelText('Remember last opened folder');
        const recentFilesPreference = screen.getByLabelText('Remember recent files');
        expect(folderPreference).toHaveProperty('checked', true);
        expect(recentFilesPreference).toHaveProperty('checked', true);

        await fireEvent.click(recentFilesPreference);
        await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

        expect(apply).toHaveBeenCalledWith({
            ...DEFAULT_VIEWER_PREFERENCES,
            recentFilePathsEnabled: true,
            recentFilesEnabled: false,
        });
    });
});
