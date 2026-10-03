import type {
    ComparisonDiffColumn,
    IOpenedDocumentComparisonRowViewModel,
    IOpenedDocumentComparisonViewModel,
} from '#viewer-presentation';
import {
    isDurationMilliseconds,
    isOdometerKilometres,
    isUtcTimestamp,
    type DurationMilliseconds,
    type OdometerKilometres,
    type UtcTimestamp,
} from '#viewer-domain';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ComparisonScreen from '../components/screens/ComparisonScreen.svelte';
import { createDocumentScopedValue } from '../controllers/document-scoped-value.svelte.js';
import {
    createViewerTestRenderOptions,
    createViewerTestRenderOptionsWithContext,
    type IViewerTestRenderOptions,
} from './viewer-test-render.js';

afterEach(() => {
    cleanup();
});

interface IRenderComparisonScreenProps {
    onclear: () => void;
    onremove: (key: string) => void;
    onreopen: (key: string) => void;
    viewModel: IOpenedDocumentComparisonViewModel;
}

function renderComparisonScreen(
    props: IRenderComparisonScreenProps,
    options: IViewerTestRenderOptions = createViewerTestRenderOptions(),
): ReturnType<typeof render> {
    const context = options.wrapperProps.context;
    return render(
        ComparisonScreen,
        {
            props: {
                ...props,
                exportPort: context.exportPort,
                filterText: createDocumentScopedValue(''),
                localisationService: context.localisationService,
                pdfPort: context.pdfPort,
                toastController: context.toastController,
                translationService: context.translationService,
            },
        },
        options,
    );
}

function formatted<TValue>(value: TValue, display: string): { display: string; value: TValue } {
    return { display, value };
}

function timestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The comparison screen fixture timestamp must be valid.');
    }
    return value;
}

function duration(value: number): DurationMilliseconds {
    if (!isDurationMilliseconds(value)) {
        throw new TypeError('The comparison screen fixture duration must be valid.');
    }
    return value;
}

function odometer(value: number): OdometerKilometres {
    if (!isOdometerKilometres(value)) {
        throw new TypeError('The comparison screen fixture odometer must be valid.');
    }
    return value;
}

function row(displayName: string, key: string, reopenable = false): IOpenedDocumentComparisonRowViewModel {
    return {
        activityTotals: null,
        byteLength: formatted(512, '512'),
        coverage: null,
        displayName,
        documentKind: 'driverCard',
        generations: ['g1'],
        identitySummary: 'Test Driver',
        integrity: {
            assessment: {
                reason: 'notRequested',
                status: 'notChecked',
            },
            checkedItems: formatted(0, '0'),
            invalidItems: formatted(0, '0'),
            status: 'notChecked',
            validItems: formatted(0, '0'),
        },
        key,
        odometerRange: null,
        openedAt: formatted(timestamp(1_752_000_000_000), '27 Jun 2026, 00:00:00'),
        overlappingSessionCount: 0,
        reopenable,
        securityCounts: {
            operationalNotice: 0,
            securityCritical: 0,
            sensorDiagnostic: 0,
        },
        sha256: 'a'.repeat(64),
        totals: {
            activityDays: formatted(0, '0'),
            events: formatted(0, '0'),
            faults: formatted(0, '0'),
            inferredActivityGaps: formatted(0, '0'),
            recordedActivityIntervals: formatted(0, '0'),
            totalEventsAndFaults: formatted(0, '0'),
            warnings: formatted(0, '0'),
        },
    };
}

function viewModel(
    records: readonly IOpenedDocumentComparisonRowViewModel[],
    differingColumns: readonly ComparisonDiffColumn[] = [],
): IOpenedDocumentComparisonViewModel {
    return {
        differingColumns,
        locale: 'en',
        records,
        timeZone: 'UTC',
    };
}

describe('ComparisonScreen', () => {
    it('shows an empty state when no documents were opened', () => {
        renderComparisonScreen({
            onclear: () => undefined,
            onremove: () => undefined,
            onreopen: () => undefined,
            viewModel: viewModel([]),
        });

        expect(screen.getByText(/Open another document to add it to the history/)).toBeTruthy();
    });

    it('renders comparison rows with file, identity, and integrity evidence', () => {
        renderComparisonScreen({
            onclear: () => undefined,
            onremove: () => undefined,
            onreopen: () => undefined,
            viewModel: viewModel([row('first.ddd', 'key-1'), row('second.ddd', 'key-2')]),
        });

        expect(screen.getByRole('table')).toBeTruthy();
        expect(screen.getByText('first.ddd')).toBeTruthy();
        expect(screen.getByText('second.ddd')).toBeTruthy();
        expect(screen.getAllByText('Test Driver')).toHaveLength(2);
        expect(screen.getAllByText('Not checked')).toHaveLength(2);
    });

    it('renders evidence-level activity, odometer, security, and overlap columns', () => {
        const evidenceRow: IOpenedDocumentComparisonRowViewModel = {
            ...row('evidence.ddd', 'key-evidence'),
            activityTotals: {
                availability: formatted(duration(0), '0m'),
                breakOrRest: formatted(duration(0), '0m'),
                driving: formatted(duration(7_200_000), '2h'),
                work: formatted(duration(0), '0m'),
            },
            odometerRange: {
                max: formatted(odometer(10_120), '10,120'),
                min: formatted(odometer(10_000), '10,000'),
            },
            overlappingSessionCount: 1,
            securityCounts: {
                operationalNotice: 0,
                securityCritical: 2,
                sensorDiagnostic: 1,
            },
        };
        renderComparisonScreen({
            onclear: () => undefined,
            onremove: () => undefined,
            onreopen: () => undefined,
            viewModel: viewModel([evidenceRow]),
        });

        expect(screen.getByText('2h')).toBeTruthy();
        expect(screen.getByText('10,000 through 10,120 km')).toBeTruthy();
        expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
    });

    it('exports comparison HTML without throwing when chosen from the export dialog', async () => {
        renderComparisonScreen({
            onclear: () => undefined,
            onremove: () => undefined,
            onreopen: () => undefined,
            viewModel: viewModel([row('first.ddd', 'key-1'), row('second.ddd', 'key-2')]),
        });

        const exportButton = screen.getByRole('button', { name: 'Export' });
        expect(exportButton).toHaveProperty('disabled', false);
        await fireEvent.click(exportButton);

        const dialog = await screen.findByRole('dialog', { name: 'Export document' });
        expect(within(dialog).queryByRole('radio', { name: /Raw JSON/ })).toBeNull();
        await fireEvent.click(within(dialog).getByRole('radio', { name: /HTML report/ }));
        await fireEvent.click(within(dialog).getByRole('button', { name: 'Export' }));
    });

    it('reports a failed save by toast, since the export dialog is already closed', async () => {
        const defaults = createViewerTestRenderOptions();
        const context = {
            ...defaults.wrapperProps.context,
            exportPort: { save: () => Promise.resolve({ code: 'ioFailure', status: 'failed' } as const) },
        };
        renderComparisonScreen(
            {
                onclear: () => undefined,
                onremove: () => undefined,
                onreopen: () => undefined,
                viewModel: viewModel([row('first.ddd', 'key-1'), row('second.ddd', 'key-2')]),
            },
            createViewerTestRenderOptionsWithContext(context),
        );

        await fireEvent.click(screen.getByRole('button', { name: 'Export' }));
        const dialog = await screen.findByRole('dialog', { name: 'Export document' });
        await fireEvent.click(within(dialog).getByRole('radio', { name: /HTML report/ }));
        await fireEvent.click(within(dialog).getByRole('button', { name: 'Export' }));

        await vi.waitFor(() => {
            expect(context.toastController.toasts.map((toast) => toast.message)).toContain(
                'Export failed: The file could not be written.',
            );
        });
    });

    it('removes one row and clears the whole comparison', async () => {
        const onremove = vi.fn();
        const onclear = vi.fn();
        renderComparisonScreen({
            onclear,
            onremove,
            onreopen: () => undefined,
            viewModel: viewModel([row('first.ddd', 'key-1')]),
        });

        await fireEvent.click(screen.getByRole('button', { name: /Remove from history/ }));
        expect(onremove).toHaveBeenCalledWith('key-1');

        await fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
        expect(onclear).toHaveBeenCalled();
    });

    it('reopens a session-opened document and hides the action for dropped files', async () => {
        const onreopen = vi.fn();
        renderComparisonScreen({
            onclear: () => undefined,
            onremove: () => undefined,
            onreopen,
            viewModel: viewModel([row('reopenable.ddd', 'key-open', true), row('dropped.ddd', 'key-dropped')]),
        });

        const reopenButton = screen.getByRole('button', { name: 'Open again' });
        await fireEvent.click(reopenButton);
        expect(onreopen).toHaveBeenCalledWith('key-open');
        expect(screen.getAllByRole('button', { name: 'Open again' })).toHaveLength(1);
    });

    it('highlights differing columns after enabling diff mode', async () => {
        const differing = ['integrity', 'coverage'] as const;
        renderComparisonScreen({
            onclear: () => undefined,
            onremove: () => undefined,
            onreopen: () => undefined,
            viewModel: viewModel([row('first.ddd', 'key-1'), row('second.ddd', 'key-2')], [...differing]),
        });

        const diffButton = screen.getByRole('button', { name: 'Show differences' });
        expect(diffButton).toHaveProperty('disabled', false);
        expect(screen.queryAllByTitle('Differs across documents')).toHaveLength(0);

        await fireEvent.click(diffButton);

        expect(screen.getByRole('button', { name: 'Show differences' }).getAttribute('aria-pressed')).toBe('true');
        expect(screen.getAllByTitle('Differs across documents')).toHaveLength(4);
    });

    it('disables diff mode for a single-document history', () => {
        renderComparisonScreen({
            onclear: () => undefined,
            onremove: () => undefined,
            onreopen: () => undefined,
            viewModel: viewModel([row('only.ddd', 'key-1')]),
        });

        expect(screen.getByRole('button', { name: 'Show differences' })).toHaveProperty('disabled', true);
    });

    it('renders the screen container with fill-height layout for fixed viewport data grid', () => {
        const { container } = renderComparisonScreen({
            onclear: () => undefined,
            onremove: () => undefined,
            onreopen: () => undefined,
            viewModel: viewModel([row('only.ddd', 'key-1')]),
        });

        const article = container.querySelector('article.comparison-screen');
        expect(article).not.toBeNull();
        expect(article?.classList.contains('fill-height')).toBe(true);
        const dataTable = container.querySelector('.table-shell');
        expect(dataTable?.classList.contains('fill-height')).toBe(true);
    });
});
