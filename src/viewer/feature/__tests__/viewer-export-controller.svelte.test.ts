import { isSourceToken, type IFactualReportPdfRequest, type SourceToken } from '#contracts';
import { describe, expect, it, vi } from 'vitest';
import type { ITranslationService } from '#localization';
import type {
    IViewerExportPort,
    IViewerPdfPort,
    IViewerRuntimeVersionsPort,
    OpenedTachographDocument,
} from '#viewer-application';
import { isUtcTimestamp } from '#viewer-domain';
import { createLocalisationServiceFake } from '#testing';
import { ComplianceProfileController } from '#compliance-feature';

import {
    ViewerExportController,
    type IViewerExportControllerDependencies,
} from '../controllers/viewer-export-controller.svelte.js';
import { ViewerPreferencesController } from '../controllers/viewer-preferences-controller.svelte.js';
import type { IMessageParams, TranslationKey } from '#i18n-locales';
import { vehicleUnitDocumentFixture as sharedVehicleUnitDocumentFixture } from './vehicle-unit-document-fixture.js';

const translationService: ITranslationService<TranslationKey, IMessageParams> = {
    translate: (key: string, _params?: unknown): string => {
        return key;
    },
};

function createTestExportController(overrides: Partial<IViewerExportControllerDependencies> = {}): ViewerExportController {
    return new ViewerExportController({
        complianceProfileController: new ComplianceProfileController(),
        exportPort: { save: () => Promise.resolve({ status: 'saved' }) },
        localisationService: createLocalisationServiceFake(),
        pdfPort: createPdfPort(),
        preferencesController: new ViewerPreferencesController({
            initialPreferences: null,
            loadWarning: false,
            store: {
                load: () => Promise.resolve({ error: 'preferencesLoadFailed', ok: false }),
                save: () => Promise.resolve({ ok: true, value: null }),
            },
            target: {
                apply: () => true,
                dispose: () => undefined,
            },
        }),
        runtimeVersionsPort,
        translationService,
        ...overrides,
    });
}

const runtimeVersionsPort: IViewerRuntimeVersionsPort = {
    load: () =>
        Promise.resolve({
            ok: true,
            value: {
                application: 'test',
                architecture: 'x64',
                parserCommit: 'a'.repeat(40),
                parserVersion: '0.0.0-test',
                platform: 'linux',
                runtime: '36',
            },
        }),
};

function vehicleUnitDocumentFixture(): OpenedTachographDocument {
    const openedAtCandidate = Date.UTC(2026, 6, 27);
    if (!isUtcTimestamp(openedAtCandidate)) {
        throw new TypeError('The export controller fixture openedAt must be valid.');
    }
    return sharedVehicleUnitDocumentFixture('vu.ddd', 'a'.repeat(64), openedAtCandidate);
}

function createTestFactualReportRequest(): IFactualReportPdfRequest {
    return {
        footerNotice: '',
        headerFields: [
            { label: 'Driver', value: 'Jane Doe' },
            { label: 'Card Number', value: 'DF123456' },
            { label: 'File', value: 'C_JANE_DOE.ddd' },
            { label: 'Generated', value: '2026-08-28 12:00' },
        ],
        kind: 'factualReport',
        locale: 'en',
        orientation: 'portrait',
        sections: [],
        subtitle: 'Report',
        summaryItems: [],
        summaryTitle: 'Summary',
        title: 'Factual Report',
    };
}

function createPdfPort(): IViewerPdfPort {
    return {
        generatePdf: () =>
            Promise.resolve({
                bytes: new TextEncoder().encode('pdf'),
                status: 'converted',
            }),
        isSupported: () => true,
        print: () => Promise.resolve(),
    };
}

function createTrackedConvertingPdfPort(bytes: Uint8Array): {
    readonly generatePdf: ReturnType<typeof vi.fn<IViewerPdfPort['generatePdf']>>;
    readonly pdfPort: IViewerPdfPort;
} {
    const generatePdf = vi.fn<IViewerPdfPort['generatePdf']>(() => Promise.resolve({ bytes, status: 'converted' }));
    return {
        generatePdf,
        pdfPort: { generatePdf, isSupported: () => true, print: () => Promise.resolve() },
    };
}

describe('ViewerExportController', () => {
    it('opens, changes format, saves through the port, and closes', async () => {
        const save = vi.fn<IViewerExportPort['save']>(() => Promise.resolve({ status: 'saved' }));
        const generatePdf = vi.fn<IViewerPdfPort['generatePdf']>(() =>
            Promise.resolve({ bytes: new TextEncoder().encode('pdf'), status: 'converted' }),
        );
        const controller = createTestExportController({
            exportPort: { save },
            pdfPort: { generatePdf, isSupported: () => true, print: () => Promise.resolve() },
        });

        expect(controller.open()).toBe(true);
        expect(controller.open()).toBe(false);
        expect(controller.snapshot).toMatchObject({
            format: 'html',
            isOpen: true,
            saving: false,
        });
        expect(controller.setFormat('rawJson')).toBe(true);
        expect(controller.snapshot.format).toBe('rawJson');

        const result = await controller.export(new TextEncoder().encode('{}'), 'raw.json', null);
        expect(result).toBe('saved');

        expect(save).toHaveBeenCalledWith({
            bytes: new TextEncoder().encode('{}'),
            sourceToken: null,
            suggestedName: 'raw.json',
        });
        expect(controller.snapshot).toMatchObject({
            isOpen: false,
            saving: false,
        });
    });

    it('keeps the dialog open and reports a typed failure', async () => {
        const save = vi.fn<IViewerExportPort['save']>(() => Promise.resolve({ code: 'destinationExists', status: 'failed' }));
        const controller = createTestExportController({
            exportPort: { save },
        });

        controller.open();
        await controller.export(new TextEncoder().encode('{}'), 'report.html', null);

        expect(controller.snapshot).toMatchObject({
            error: 'destinationExists',
            isOpen: true,
            saving: false,
        });
        expect(controller.setFormat('html')).toBe(true);
        expect(controller.cancel()).toBe(true);
    });

    it('keeps the dialog open when native save dialog is cancelled', async () => {
        const save = vi.fn<IViewerExportPort['save']>(() => Promise.resolve({ status: 'cancelled' }));
        const controller = createTestExportController({
            exportPort: { save },
        });

        controller.open();
        const outcome = await controller.export(new TextEncoder().encode('{}'), 'report.html', null);

        expect(outcome).toBe('cancelled');
        expect(controller.snapshot.isOpen).toBe(true);
        expect(controller.snapshot.saving).toBe(false);
    });

    it('passes the source token through for native-opened files', async () => {
        const save = vi.fn<IViewerExportPort['save']>(() => Promise.resolve({ status: 'saved' }));
        const controller = createTestExportController({
            exportPort: { save },
        });
        const sourceTokenCandidate = '00000000-0000-4000-8000-000000000000';
        if (!isSourceToken(sourceTokenCandidate)) {
            throw new TypeError('The source-token fixture must be valid.');
        }
        const sourceToken: SourceToken = sourceTokenCandidate;

        controller.open();
        await controller.export(new TextEncoder().encode('{}'), 'report.html', sourceToken);

        expect(save).toHaveBeenCalledWith({
            bytes: new TextEncoder().encode('{}'),
            sourceToken,
            suggestedName: 'report.html',
        });
    });

    it('generates vector PDF through the pdf port before saving a PDF report', async () => {
        const save = vi.fn<IViewerExportPort['save']>(() => Promise.resolve({ status: 'saved' }));
        const { generatePdf, pdfPort } = createTrackedConvertingPdfPort(new TextEncoder().encode('%PDF'));
        const controller = createTestExportController({
            exportPort: { save },
            pdfPort,
        });

        controller.open();
        expect(controller.setFormat('pdf')).toBe(true);
        const req = createTestFactualReportRequest();
        await controller.exportPdf(req, 'report.pdf', null);

        expect(generatePdf).toHaveBeenCalledWith(req);
        expect(save).toHaveBeenCalledWith({
            bytes: new TextEncoder().encode('%PDF'),
            sourceToken: null,
            suggestedName: 'report.pdf',
        });
        expect(controller.snapshot).toMatchObject({
            isOpen: false,
            saving: false,
        });
    });

    it('reports a typed failure when PDF conversion fails', async () => {
        const controller = createTestExportController({
            exportPort: {
                save: () => Promise.resolve({ status: 'saved' }),
            },
            pdfPort: {
                generatePdf: () => Promise.resolve({ code: 'exportFailed', status: 'failed' }),
                isSupported: () => true,
                print: () => Promise.resolve(),
            },
        });

        controller.open();
        await controller.exportPdf(createTestFactualReportRequest(), 'report.pdf', null);

        expect(controller.snapshot).toMatchObject({
            error: 'exportFailed',
            format: 'pdf',
            isOpen: true,
            saving: false,
        });
    });

    it('closes the dialog when the pdf port prints through the system dialog', async () => {
        const save = vi.fn<IViewerExportPort['save']>(() => Promise.resolve({ status: 'saved' }));
        const controller = createTestExportController({
            exportPort: { save },
            pdfPort: {
                generatePdf: () => Promise.resolve({ status: 'printed' }),
                isSupported: () => true,
                print: () => Promise.resolve(),
            },
        });

        controller.open();
        expect(controller.setFormat('pdf')).toBe(true);
        await controller.exportPdf(createTestFactualReportRequest(), 'report.pdf', null);

        expect(save).not.toHaveBeenCalled();
        expect(controller.snapshot).toMatchObject({
            error: null,
            isOpen: false,
            saving: false,
        });
    });

    describe('exportCurrentDocument', () => {
        it('builds and saves the raw JSON export, naming the file from the document', async () => {
            const save = vi.fn<IViewerExportPort['save']>(() => Promise.resolve({ status: 'saved' }));
            const controller = createTestExportController({
                exportPort: { save },
            });
            controller.open();
            controller.setFormat('rawJson');

            const result = await controller.exportCurrentDocument(vehicleUnitDocumentFixture());

            expect(result).toEqual({ fileName: 'vu.ddd.json', status: 'saved' });
            expect(save).toHaveBeenCalledOnce();
            expect(controller.snapshot).toMatchObject({ isOpen: false, saving: false });
        });

        it('builds and saves the HTML export through the runtime versions port and localisation', async () => {
            const save = vi.fn<IViewerExportPort['save']>(() => Promise.resolve({ status: 'saved' }));
            const controller = createTestExportController({
                exportPort: { save },
            });
            controller.open();

            const result = await controller.exportCurrentDocument(vehicleUnitDocumentFixture());

            expect(result).toEqual({ fileName: 'vu.ddd.html', status: 'saved' });
            const savedRequest = save.mock.calls[0]?.[0];
            const html = new TextDecoder().decode(savedRequest?.bytes);
            expect(html).toContain('<!DOCTYPE html>');
        });

        it('generates a vector PDF through the pdf port for the pdf format', async () => {
            const save = vi.fn<IViewerExportPort['save']>(() => Promise.resolve({ status: 'saved' }));
            const { generatePdf, pdfPort } = createTrackedConvertingPdfPort(new TextEncoder().encode('%PDF'));
            const controller = createTestExportController({
                exportPort: { save },
                pdfPort,
            });
            controller.open();
            controller.setFormat('pdf');

            const result = await controller.exportCurrentDocument(vehicleUnitDocumentFixture());

            expect(result).toEqual({ fileName: 'vu.ddd.pdf', status: 'saved' });
            expect(generatePdf).toHaveBeenCalledOnce();
            expect(save).toHaveBeenCalledWith(expect.objectContaining({ bytes: new TextEncoder().encode('%PDF') }));
        });

        it('reports the file name even when the save is cancelled', async () => {
            const controller = createTestExportController({
                exportPort: { save: () => Promise.resolve({ status: 'cancelled' }) },
            });
            controller.open();
            controller.setFormat('rawJson');

            const result = await controller.exportCurrentDocument(vehicleUnitDocumentFixture());

            expect(result).toEqual({ fileName: 'vu.ddd.json', status: 'cancelled' });
        });
    });
});
