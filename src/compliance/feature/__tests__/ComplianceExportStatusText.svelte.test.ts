import { cleanup, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ComplianceExportStatusText from '../components/ComplianceExportStatusText.svelte';
import { ComplianceExportStatus } from '../components/compliance-export-status.svelte.js';
import { createViewerTestRenderOptions } from '#testing';

afterEach(() => {
    cleanup();
});

function renderStatusText(status: ComplianceExportStatus): ReturnType<typeof render> {
    const options = createViewerTestRenderOptions();
    return render(
        ComplianceExportStatusText,
        { props: { status, translationService: options.wrapperProps.context.translationService } },
        options,
    );
}

describe('ComplianceExportStatusText', () => {
    it('renders nothing while the shared status is idle', () => {
        const status = new ComplianceExportStatus();

        renderStatusText(status);

        expect(screen.queryByText('Printing…')).toBeNull();
        expect(screen.queryByText('Exporting…')).toBeNull();
    });

    it('shows the printing label while the shared status is running a print action', async () => {
        const status = new ComplianceExportStatus();

        renderStatusText(status);

        let resolveRun: (() => void) | undefined;
        const runPromise = status.run('printing', () => {
            return new Promise<void>((resolve) => {
                resolveRun = resolve;
            });
        });
        await tick();

        expect(screen.getByText('Printing…')).toBeDefined();

        resolveRun?.();
        await runPromise;
    });

    it('shows the exporting label for HTML/PDF export actions', async () => {
        const status = new ComplianceExportStatus();

        renderStatusText(status);

        let resolveRun: (() => void) | undefined;
        const runPromise = status.run('exportingPdf', () => {
            return new Promise<void>((resolve) => {
                resolveRun = resolve;
            });
        });
        await tick();

        expect(screen.getByText('Exporting…')).toBeDefined();

        resolveRun?.();
        await runPromise;
    });
});
