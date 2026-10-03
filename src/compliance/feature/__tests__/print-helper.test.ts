import { describe, expect, it, vi } from 'vitest';
import type { IAttestationFormPdfRequest } from '#contracts';
import type { IViewerExportPort, IViewerPdfPort, ViewerExportOutcome } from '#viewer-application';
import { printDocument, saveDocumentHtml, saveDocumentPdf } from '../helpers/print-helper.js';

function createTestAttestationRequest(): IAttestationFormPdfRequest {
    return {
        box10Label: 'box10',
        box11Label: 'box11',
        box12Label: 'box12',
        box13Label: 'box13',
        box14Label: 'box14',
        box15Label: 'box15',
        box16Label: 'box16',
        box17Label: 'box17',
        box18Label: 'box18',
        box19Label: 'box19',
        box1Label: 'box1',
        box20Label: 'box20',
        box21Label: 'box21',
        box22Label: 'box22',
        box2Label: 'box2',
        box3Label: 'box3',
        box4Label: 'box4',
        box5Label: 'box5',
        box6Label: 'box6',
        box7Label: 'box7',
        box8Label: 'box8',
        box9Label: 'box9',
        companyAddress: '1 Main Street',
        companyEmail: 'office@example.com',
        companyFax: '',
        companyName: 'Acme Transport',
        companyPhone: '',
        date: '2026-08-28',
        dateLabel: 'Date:',
        driverSignatureLabel: 'Signature of the driver:',
        signatureLabel: 'Signature:',
        undersignedLabel: 'I, the undersigned:',
        driverDob: '1980-01-01',
        driverName: 'Jane Doe',
        driverPartTitle: 'Driver',
        drivingLicence: 'DL123456',
        employmentStart: '2020-01-01',
        footnote: 'Footnote',
        instructions: 'Instructions',
        kind: 'attestationForm',
        locale: 'en',
        periodEnd: '2026-08-14 23:59',
        periodPartTitle: 'Period',
        periodStart: '2026-08-01 00:00',
        place: 'Berlin',
        reasonKey: 'annualLeave',
        signatoryName: 'Max Mustermann',
        signatoryPosition: 'Compliance Manager',
        subtitle: 'Regulation',
        title: 'Attestation',
        undertakingPartTitle: 'Undertaking',
        warning: 'Warning',
    };
}

function createPdfPort(
    generatePdf: IViewerPdfPort['generatePdf'],
    printImpl: IViewerPdfPort['print'] = () => Promise.resolve(),
): IViewerPdfPort {
    return {
        generatePdf,
        isSupported: () => true,
        print: printImpl,
    };
}

describe('Compliance print-helper', () => {
    it('saves document as HTML bytes via exportPort', async () => {
        const saveMock = vi.fn<IViewerExportPort['save']>(() => Promise.resolve({ status: 'saved' } as ViewerExportOutcome));
        const exportPort: IViewerExportPort = { save: saveMock };

        const result = await saveDocumentHtml('<html><body>Test</body></html>', 'test.html', exportPort, null);

        expect(result.status).toBe('saved');
        expect(saveMock).toHaveBeenCalledOnce();
        const callArgs = saveMock.mock.calls[0]?.[0];
        expect(callArgs?.suggestedName).toBe('test.html');
        expect(new TextDecoder().decode(callArgs?.bytes)).toBe('<html><body>Test</body></html>');
    });

    it('generates and saves document as PDF bytes via pdfPort and exportPort', async () => {
        const dummyPdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
        const generatePdfMock = vi.fn<IViewerPdfPort['generatePdf']>(() =>
            Promise.resolve({ bytes: dummyPdfBytes, status: 'converted' }),
        );
        const pdfPort = createPdfPort(generatePdfMock);

        const saveMock = vi.fn<IViewerExportPort['save']>(() => Promise.resolve({ status: 'saved' } as ViewerExportOutcome));
        const exportPort: IViewerExportPort = { save: saveMock };
        const req = createTestAttestationRequest();

        const result = await saveDocumentPdf('report.pdf', exportPort, pdfPort, null, req);

        expect(result.status).toBe('saved');
        expect(generatePdfMock).toHaveBeenCalledWith(req);
        expect(saveMock).toHaveBeenCalledOnce();
        const callArgs = saveMock.mock.calls[0]?.[0];
        expect(callArgs?.suggestedName).toBe('report.pdf');
        expect(callArgs?.bytes).toEqual(dummyPdfBytes);
    });

    it('reports an honest printed outcome when the native conversion prints instead of saving', async () => {
        const generatePdfMock = vi.fn<IViewerPdfPort['generatePdf']>(() => Promise.resolve({ status: 'printed' }));
        const pdfPort = createPdfPort(generatePdfMock);
        const saveMock = vi.fn<IViewerExportPort['save']>(() => Promise.resolve({ status: 'saved' } as ViewerExportOutcome));
        const exportPort: IViewerExportPort = { save: saveMock };

        const result = await saveDocumentPdf('report.pdf', exportPort, pdfPort, null, {
            ...createTestAttestationRequest(),
        });

        expect(result.status).toBe('printed');
        expect(saveMock).not.toHaveBeenCalled();
    });

    it('prefers the native print panel and never touches PDF generation', async () => {
        const printMock = vi.fn<IViewerPdfPort['print']>(() => Promise.resolve());
        const generatePdfMock = vi.fn<IViewerPdfPort['generatePdf']>();
        const pdfPort = createPdfPort(generatePdfMock, printMock);

        await printDocument('<html><body>Print me</body></html>', pdfPort);

        expect(printMock).toHaveBeenCalledWith('<html><body>Print me</body></html>');
        expect(generatePdfMock).not.toHaveBeenCalled();
    });

    it('falls back to DOM printing when the native print path is unavailable', async () => {
        const printMock = vi.fn<IViewerPdfPort['print']>(() => Promise.reject(new Error('unavailable')));
        const pdfPort = createPdfPort(() => Promise.resolve({ code: 'exportFailed', status: 'failed' }), printMock);

        await expect(printDocument('<html><body>Print me</body></html>', pdfPort)).resolves.toBeUndefined();
        expect(printMock).toHaveBeenCalledOnce();
    });
});
