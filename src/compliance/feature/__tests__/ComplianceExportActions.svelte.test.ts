import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ComplianceExportActions from '../components/ComplianceExportActions.svelte';
import { ComplianceExportStatus } from '../components/compliance-export-status.svelte.js';
import { createViewerTestRenderOptions } from '#testing';

afterEach(() => {
    cleanup();
});

describe('ComplianceExportActions', () => {
    it('renders only Close and Print when no save actions are provided', () => {
        render(
            ComplianceExportActions,
            {
                props: {
                    closeLabel: 'Close',
                    onclose: vi.fn(),
                    onprint: vi.fn(),
                    printLabel: 'Print',
                    status: new ComplianceExportStatus(),
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByRole('button', { name: 'Close' })).toBeDefined();
        expect(screen.getByRole('button', { name: 'Print' })).toBeDefined();
        expect(screen.queryByRole('button', { name: /save/iu })).toBeNull();
    });

    it('renders Save HTML and Save PDF only when those actions are provided', () => {
        render(
            ComplianceExportActions,
            {
                props: {
                    closeLabel: 'Close',
                    onclose: vi.fn(),
                    onprint: vi.fn(),
                    printLabel: 'Print',
                    saveHtml: { label: 'Save HTML', onclick: vi.fn() },
                    savePdf: { label: 'Save PDF', onclick: vi.fn() },
                    status: new ComplianceExportStatus(),
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByRole('button', { name: 'Save HTML' })).toBeDefined();
        expect(screen.getByRole('button', { name: 'Save PDF' })).toBeDefined();
    });

    it('calls onclose directly, without going through the busy/export gate', async () => {
        const onclose = vi.fn();
        render(
            ComplianceExportActions,
            {
                props: {
                    closeLabel: 'Close',
                    exportAllowed: false,
                    onclose,
                    onprint: vi.fn(),
                    printLabel: 'Print',
                    status: new ComplianceExportStatus(),
                },
            },
            createViewerTestRenderOptions(),
        );

        await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(onclose).toHaveBeenCalledOnce();
    });

    it('runs onprint through the shared status and disables actions while pending, then clears it', async () => {
        let resolvePrint: (() => void) | undefined;
        const onprint = vi.fn<() => Promise<void>>(
            () =>
                new Promise<void>((resolve) => {
                    resolvePrint = resolve;
                }),
        );
        const status = new ComplianceExportStatus();

        render(
            ComplianceExportActions,
            {
                props: {
                    closeLabel: 'Close',
                    onclose: vi.fn(),
                    onprint,
                    printLabel: 'Print',
                    saveHtml: { label: 'Save HTML', onclick: vi.fn() },
                    status,
                },
            },
            createViewerTestRenderOptions(),
        );

        const printBtn = screen.getByRole('button', { name: 'Print' });
        await fireEvent.click(printBtn);

        expect(onprint).toHaveBeenCalledOnce();
        expect(status.busy).toBe(true);
        expect(status.busyAction).toBe('printing');
        expect(printBtn).toHaveProperty('disabled', true);
        expect(screen.getByRole('button', { name: 'Save HTML' })).toHaveProperty('disabled', true);
        expect(screen.getByRole('button', { name: 'Close' })).toHaveProperty('disabled', true);

        resolvePrint?.();
        await tick();
        await tick();

        expect(status.busy).toBe(false);
        expect(printBtn).toHaveProperty('disabled', false);
    });

    it('never runs a second export action while one is already in flight (executes one at a time)', async () => {
        let resolvePrint: (() => void) | undefined;
        const onprint = vi.fn<() => Promise<void>>(
            () =>
                new Promise<void>((resolve) => {
                    resolvePrint = resolve;
                }),
        );
        const onSaveHtml = vi.fn();

        render(
            ComplianceExportActions,
            {
                props: {
                    closeLabel: 'Close',
                    onclose: vi.fn(),
                    onprint,
                    printLabel: 'Print',
                    saveHtml: { label: 'Save HTML', onclick: onSaveHtml },
                    status: new ComplianceExportStatus(),
                },
            },
            createViewerTestRenderOptions(),
        );

        await fireEvent.click(screen.getByRole('button', { name: 'Print' }));
        await fireEvent.click(screen.getByRole('button', { name: 'Save HTML' }));

        expect(onSaveHtml).not.toHaveBeenCalled();
        resolvePrint?.();
    });

    it('disables Print/Save but not Close when exportAllowed is false', () => {
        render(
            ComplianceExportActions,
            {
                props: {
                    closeLabel: 'Close',
                    exportAllowed: false,
                    onclose: vi.fn(),
                    onprint: vi.fn(),
                    printLabel: 'Print',
                    saveHtml: { label: 'Save HTML', onclick: vi.fn() },
                    savePdf: { label: 'Save PDF', onclick: vi.fn() },
                    status: new ComplianceExportStatus(),
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByRole('button', { name: 'Close' })).toHaveProperty('disabled', false);
        expect(screen.getByRole('button', { name: 'Print' })).toHaveProperty('disabled', true);
        expect(screen.getByRole('button', { name: 'Save HTML' })).toHaveProperty('disabled', true);
        expect(screen.getByRole('button', { name: 'Save PDF' })).toHaveProperty('disabled', true);
    });

    it('calls savePdf.onclick when the Save PDF button is clicked', async () => {
        const onSavePdf = vi.fn();
        render(
            ComplianceExportActions,
            {
                props: {
                    closeLabel: 'Close',
                    onclose: vi.fn(),
                    onprint: vi.fn(),
                    printLabel: 'Print',
                    savePdf: { label: 'Save PDF', onclick: onSavePdf },
                    status: new ComplianceExportStatus(),
                },
            },
            createViewerTestRenderOptions(),
        );

        await fireEvent.click(screen.getByRole('button', { name: 'Save PDF' }));
        expect(onSavePdf).toHaveBeenCalledOnce();
    });
});
