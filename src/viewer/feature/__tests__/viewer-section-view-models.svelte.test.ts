import { waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { detailedSpeedChartSampleLimit } from '#viewer-application';
import {
    createDetailedSpeedSample,
    createSourceReference,
    isJsonPointer,
    isUtcTimestamp,
    type IDetailedSpeedSample,
} from '#viewer-domain';

import { ViewerDocumentSession } from '../controllers/viewer-document-session.svelte.js';
import { ViewerSectionViewModels } from '../controllers/viewer-section-view-models.svelte.js';
import { createViewerDocumentHarness, type IViewerDocumentHarness } from './viewer-document-harness.js';
import { buildTestViewerPreferences, createViewerTestContext } from './viewer-test-context.js';

interface ISpeedViewModelFixture {
    readonly context: ReturnType<typeof createViewerTestContext>;
    readonly harness: IViewerDocumentHarness;
    readonly samples: readonly IDetailedSpeedSample[];
    readonly session: ViewerDocumentSession;
    readonly viewModels: ViewerSectionViewModels;
    dispose(): Promise<void>;
}

afterEach(() => {
    vi.restoreAllMocks();
});

async function speedViewModelFixture(sampleCount?: number): Promise<ISpeedViewModelFixture> {
    const harness = createViewerDocumentHarness();
    const context = createViewerTestContext(harness.controller);
    const session = new ViewerDocumentSession();
    const viewModels = new ViewerSectionViewModels(context, session);
    const opening = harness.controller.open();
    await waitFor(() => {
        expect(harness.parserRequestCount()).toBe(1);
    });
    const result = harness.successfulVehicleParserResult();
    if (!result.ok || result.value.documentKind !== 'vehicleUnit') {
        throw new TypeError('The speed view-model fixture must be a Vehicle Unit.');
    }
    const first = result.value.detailedSpeedSamples[0];
    if (first === undefined) {
        throw new TypeError('The speed view-model fixture must contain samples.');
    }
    const samples =
        sampleCount === undefined
            ? result.value.detailedSpeedSamples
            : Array.from({ length: sampleCount }, (_, index) => {
                  const recordedAt = first.recordedAt + index * 1_000;
                  const path = `/speed/${String(index)}`;
                  if (!isUtcTimestamp(recordedAt) || !isJsonPointer(path)) {
                      throw new TypeError('The speed fixture timestamp must be valid.');
                  }
                  return createDetailedSpeedSample({
                      ...first,
                      recordedAt,
                      source: createSourceReference('vehicleUnit', 'g2', path),
                  });
              });
    harness.completeLatestParser({ ok: true, value: { ...result.value, detailedSpeedSamples: samples } });
    await opening;
    expect(harness.controller.selectSection('speed')).toBe(true);
    return {
        context,
        harness,
        samples,
        session,
        viewModels,
        dispose: async () => {
            context.preferencesController.dispose();
            await harness.controller.dispose();
        },
    };
}

describe('speed view-model preparation lifetime', () => {
    it('does no hidden-section preparation and discards old rows when another document opens', async () => {
        const fixture = await speedViewModelFixture();
        try {
            const { context, harness, samples, session, viewModels } = fixture;
            const initial = viewModels.speed;
            const first = samples[0];
            if (initial === null || first === undefined) {
                throw new TypeError('The speed lifetime fixture must contain samples.');
            }
            expect(context.documentController.selectRecord(first)).toBe(true);
            expect(context.documentController.selectSection('overview')).toBe(true);
            const formatDateTime = vi.spyOn(context.localisationService, 'formatDateTime');
            session.setSpeedRange(first.recordedAt, first.recordedAt);
            expect(viewModels.speed).toBeNull();
            expect(formatDateTime).not.toHaveBeenCalled();

            const opening = context.documentController.open();
            await waitFor(() => {
                expect(harness.parserRequestCount()).toBe(2);
            });
            harness.completeLatestParser(harness.successfulVehicleParserResult());
            await opening;
            session.syncDocumentKey('replacement');
            expect(context.documentController.selectSection('speed')).toBe(true);
            const replaced = viewModels.speed;
            expect(replaced?.allRecords).not.toBe(initial.allRecords);
            expect(replaced?.allRecords).toHaveLength(samples.length);
            expect(replaced?.allRecords.some((row) => row.record === first)).toBe(false);
            expect(viewModels.selectedSpeedRecord).toBeNull();
            expect(replaced?.pageIndex).toBe(0);
            expect(replaced?.totalSamples.value).toBe(samples.length);
        } finally {
            await fixture.dispose();
        }
    });

    it('selects and clears exact samples without reformatting the full 24-hour recording', async () => {
        const fixture = await speedViewModelFixture(86_400);
        try {
            const { context, samples, viewModels } = fixture;
            const formatDateTime = vi.spyOn(context.localisationService, 'formatDateTime');
            const formatNumber = vi.spyOn(context.localisationService, 'formatNumber');
            const initial = viewModels.speed;
            if (initial === null) {
                throw new TypeError('The speed view model must be available.');
            }
            const chartSamples = new Set(initial.chartRecords.map((row) => row.record));
            const selected = samples.find((sample) => !chartSamples.has(sample));
            if (selected === undefined) {
                throw new TypeError('The recording must contain a sample omitted by downsampling.');
            }
            const initialDateCalls = formatDateTime.mock.calls.length;
            const initialNumberCalls = formatNumber.mock.calls.length;
            expect(context.documentController.selectRecord(selected)).toBe(true);
            const updated = viewModels.speed;
            process.stdout.write(
                `ESM_VIEWER_SPEED_SELECTION ${JSON.stringify({
                    initialDateCalls,
                    initialNumberCalls,
                    samples: samples.length,
                    selectionDateCalls: formatDateTime.mock.calls.length - initialDateCalls,
                    selectionNumberCalls: formatNumber.mock.calls.length - initialNumberCalls,
                })}\n`,
            );
            expect(updated?.allRecords).toBe(initial.allRecords);
            expect(updated?.statistics).toBe(initial.statistics);
            expect(updated?.measurement).toBe(initial.measurement);
            expect(updated?.chartTicks).toBe(initial.chartTicks);
            expect(updated?.chartRecords.some((row) => row.record === selected)).toBe(true);
            expect(updated?.chartRecords.length).toBeLessThanOrEqual(detailedSpeedChartSampleLimit);
            expect(formatDateTime).toHaveBeenCalledTimes(initialDateCalls);
            expect(formatNumber).toHaveBeenCalledTimes(initialNumberCalls);

            expect(context.documentController.clearRecord()).toBe(true);
            expect(viewModels.speed?.allRecords).toBe(initial.allRecords);
            expect(viewModels.speed?.chartRecords).toEqual(initial.chartRecords);
            expect(formatDateTime).toHaveBeenCalledTimes(initialDateCalls);
            expect(formatNumber).toHaveBeenCalledTimes(initialNumberCalls);
        } finally {
            await fixture.dispose();
        }
    });

    it('pages existing rows without rebuilding the range and keeps an off-page sample in the inspector', async () => {
        const fixture = await speedViewModelFixture();
        try {
            const { context, samples, session, viewModels } = fixture;
            const initial = viewModels.speed;
            const selected = samples.at(-1);
            if (initial === null || selected === undefined) {
                throw new TypeError('The paged speed fixture must contain samples.');
            }
            const formatDateTime = vi.spyOn(context.localisationService, 'formatDateTime');
            const formatNumber = vi.spyOn(context.localisationService, 'formatNumber');
            session.setSpeedPage(1);
            const secondPage = viewModels.speed;
            expect(secondPage?.pageIndex).toBe(1);
            expect(secondPage?.records).toHaveLength(2);
            expect(secondPage?.records[0]).toBe(initial.allRecords[300]);
            expect(secondPage?.allRecords).toBe(initial.allRecords);
            expect(secondPage?.chartRecords).toBe(initial.chartRecords);
            expect(formatDateTime).not.toHaveBeenCalled();
            expect(formatNumber).toHaveBeenCalledTimes(1);

            expect(context.documentController.selectRecord(selected)).toBe(true);
            session.setSpeedPage(0);
            expect(viewModels.speed?.records).toHaveLength(300);
            expect(viewModels.selectedSpeedRecord).toBe(selected);
            expect(viewModels.inspector?.sourcePath).toBe(selected.source.path);
            expect(viewModels.speed?.allRecords).toBe(initial.allRecords);
            expect(formatDateTime.mock.calls.length).toBeLessThan(10);
        } finally {
            await fixture.dispose();
        }
    });

    it('rebuilds for range and preference changes without changing the current speed data', async () => {
        const fixture = await speedViewModelFixture();
        try {
            const { context, samples, session, viewModels } = fixture;
            const initial = viewModels.speed;
            const first = samples[0];
            const tenth = samples[9];
            if (initial === null || first === undefined || tenth === undefined) {
                throw new TypeError('The range fixture must contain samples.');
            }
            session.setSpeedRange(first.recordedAt, tenth.recordedAt);
            const ranged = viewModels.speed;
            expect(ranged?.allRecords).toHaveLength(10);
            expect(ranged?.allRecords).not.toBe(initial.allRecords);
            expect(ranged?.range?.start.value).toBe(first.recordedAt);
            expect(ranged?.range?.end.value).toBe(tenth.recordedAt);

            context.preferencesController.open();
            await context.preferencesController.apply(
                buildTestViewerPreferences({ locale: 'de', displayTimeZone: 'Europe/Berlin' }),
            );
            const localized = viewModels.speed;
            expect(localized?.allRecords).not.toBe(ranged?.allRecords);
            expect(localized?.locale).toBe('de');
            expect(localized?.timeZone).toBe('Europe/Berlin');
            expect(localized?.allRecords[0]?.recordedAt.display).not.toBe(ranged?.allRecords[0]?.recordedAt.display);

            context.preferencesController.open();
            await context.preferencesController.apply({
                ...context.preferencesController.snapshot.preferences,
                theme: 'dark',
            });
            expect(viewModels.speed?.allRecords).toEqual(localized?.allRecords);
            expect(viewModels.speed?.range).toEqual(localized?.range);
        } finally {
            await fixture.dispose();
        }
    });
});
