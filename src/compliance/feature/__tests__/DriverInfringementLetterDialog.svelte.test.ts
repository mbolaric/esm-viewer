import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DriverInfringementLetterDialog from '../components/DriverInfringementLetterDialog.svelte';
import type { IInfringementLetterViewModel } from '../../presentation/infringement-letter-view-model.js';
import { createMemoryKeyValueStore, type IKeyValueStore, type IPdfDocumentRequest } from '#contracts';
import { loadCompanySettings, saveCompanySettings, type ICompanySettings } from '../helpers/company-settings.js';
import { createViewerTestRenderOptions, type IViewerTestRenderOptions } from '#testing';
import { isUtcTimestamp, type UtcTimestamp } from '#tachograph-domain';

let settingsStore: IKeyValueStore = createMemoryKeyValueStore();

afterEach(() => {
    cleanup();
    // A fresh store per test keeps one test's saved details out of the next test's initial render.
    settingsStore = createMemoryKeyValueStore();
});

function utc(v: number): UtcTimestamp {
    if (!isUtcTimestamp(v)) {
        throw new TypeError('Invalid utc');
    }
    return v;
}

interface IRenderLetterDialogProps {
    model: IInfringementLetterViewModel;
    onclose: () => void;
    onprint: (pdfRequest: IPdfDocumentRequest) => void | Promise<void>;
    onsaveHtml?: (html: string, suggestedName: string) => void;
    onsavePdf?: (suggestedName: string, pdfRequest: IPdfDocumentRequest) => void;
}

function renderLetterDialog(
    props: IRenderLetterDialogProps,
    options: IViewerTestRenderOptions = createViewerTestRenderOptions(),
): ReturnType<typeof render> {
    const context = options.wrapperProps.context;
    return render(
        DriverInfringementLetterDialog,
        {
            props: {
                ...props,
                localisationService: context.localisationService,
                settingsStore,
                translationService: context.translationService,
            },
        },
        options,
    );
}

const persistedSettings: ICompanySettings = {
    address: 'Logistics Park 5',
    city: 'Frankfurt',
    companyName: 'Persisted GmbH',
    country: 'Germany',
    email: 'compliance@acme.example',
    faxNumber: '+49 69 123456',
    managerName: 'Klaus Meier',
    managerPosition: 'Transport Manager',
    postalCode: '60327',
    street: 'Mainzer Landstr. 1',
    telephone: '+49 69 654321',
    vatOrRegistration: 'DE123456789',
};

describe('DriverInfringementLetterDialog', () => {
    const mockModel: IInfringementLetterViewModel = {
        auditPeriod: '01.07.2026 – 28.07.2026',
        cardNumber: 'D1234567890',
        company: {
            address: 'Logistics Park 5, Frankfurt',
            companyName: 'Trans-Euro Spedition GmbH',
            managerName: 'Klaus Fischer',
            vatOrRegistration: 'DE123456789',
        },
        driverName: 'Mustermann Max',
        driverExplanation: '',
        fileName: 'driver.ddd',
        generatedAt: '28.07.2026 14:00',
        issuingMemberState: 'Germany',
        items: [
            {
                allowedValue: '4h 30m',
                dateTimeDisplay: '15.07.2026 10:00',
                excess: '+45m',
                legalReference: 'Article 7(1)',
                measuredValue: '5h 15m',
                ruleId: 'break-exceeded',
                severity: 'serious',
                sourcePointer: '/EF_DRIVER_ACTIVITY_DATA/0',
                timestamp: utc(1721037600),
                title: 'Continuous driving without 45m break',
            },
        ],
        minorCount: 0,
        mostSeriousCount: 0,
        seriousCount: 1,
        totalInfringements: 1,
        vehicleRegistration: 'F-TR 100',
        verySeriousCount: 0,
        vin: null,
    };

    it('renders preview letter and triggers print callback on button click', async () => {
        const onclose = vi.fn();
        const onprint = vi.fn();

        renderLetterDialog({
            model: mockModel,
            onclose,
            onprint,
        });

        expect(screen.getByText('Trans-Euro Spedition GmbH')).toBeDefined();
        expect(screen.getByText('Mustermann Max')).toBeDefined();
        expect(screen.getByText('Continuous driving without 45m break')).toBeDefined();
        expect(
            screen.getByText(
                'ESM Viewer calculation — not a certified legal assessment. Confirm important findings with a qualified specialist.',
            ),
        ).toBeDefined();

        const printBtn = screen.getByRole('button', {
            name: 'Print Letter',
        });
        await fireEvent.click(printBtn);

        expect(onprint).toHaveBeenCalledOnce();
        expect(onprint.mock.calls[0]?.[0]).toMatchObject({
            kind: 'infringementLetter',
            title: 'Driver Infringement Acknowledgment Letter',
        });
    });

    it('shows a busy status while the print callback is pending, like the export buttons', async () => {
        const onclose = vi.fn();
        let resolvePrint: (() => void) | undefined;
        const onprint = vi.fn<(pdfRequest: IPdfDocumentRequest) => Promise<void>>(
            () =>
                new Promise<void>((resolve) => {
                    resolvePrint = resolve;
                }),
        );

        renderLetterDialog({
            model: mockModel,
            onclose,
            onprint,
        });

        const printBtn = screen.getByRole('button', { name: 'Print Letter' });
        await fireEvent.click(printBtn);

        expect(screen.getByText('Printing…')).toBeDefined();
        expect(printBtn).toHaveProperty('disabled', true);

        resolvePrint?.();
    });

    it('triggers onsaveHtml and onsavePdf callbacks', async () => {
        const onclose = vi.fn();
        const onprint = vi.fn();
        const onsaveHtml = vi.fn();
        const onsavePdf = vi.fn<(suggestedName: string, pdfRequest: IPdfDocumentRequest) => void>();

        renderLetterDialog({
            model: mockModel,
            onclose,
            onprint,
            onsaveHtml,
            onsavePdf,
        });

        const saveHtmlBtn = screen.getByRole('button', { name: 'Save Letter HTML' });
        await fireEvent.click(saveHtmlBtn);
        expect(onsaveHtml).toHaveBeenCalledOnce();
        expect(onsaveHtml.mock.calls[0]?.[1]).toBe('Infringement_Letter_Mustermann_Max.html');

        const savePdfBtn = screen.getByRole('button', { name: 'Save Letter PDF' });
        await fireEvent.click(savePdfBtn);
        expect(onsavePdf).toHaveBeenCalledOnce();
        await fireEvent.click(screen.getByRole('button', { name: 'Print Letter' }));
        expect(onprint).toHaveBeenCalledExactlyOnceWith(onsavePdf.mock.calls[0]?.[1]);
        expect(onsavePdf.mock.calls[0]?.[0]).toBe('Infringement_Letter_Mustermann_Max.pdf');
        const pdfRequest = onsavePdf.mock.calls[0]?.[1];
        if (pdfRequest?.kind !== 'infringementLetter') {
            throw new TypeError('The letter dialog must request an infringement-letter PDF.');
        }
        expect(pdfRequest.footerNotice).toContain('not a certified legal assessment');
    });

    it('prints the edited company details and driver explanation through the PDF request', async () => {
        const onclose = vi.fn();
        const onprint = vi.fn<(pdfRequest: IPdfDocumentRequest) => void>();

        renderLetterDialog({
            model: { ...mockModel, company: { ...mockModel.company, companyName: '' } },
            onclose,
            onprint,
        });

        const companyInput = screen.getByRole('textbox', { name: 'Company Name' });
        await fireEvent.input(companyInput, { target: { value: 'Acme Fleet Logistics GmbH' } });
        const explanation = screen.getByRole('textbox', {
            name: 'Driver Comments / Explanation of Exceptional Circumstances (Article 12 Reg. 561/2006):',
        });
        await fireEvent.input(explanation, {
            target: { value: 'Detour due to road closure.' },
        });

        const printBtn = screen.getByRole('button', { name: 'Print Letter' });
        await fireEvent.click(printBtn);

        expect(onprint).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({
                kind: 'infringementLetter',
                companyName: 'Acme Fleet Logistics GmbH',
                driverComments: 'Detour due to road closure.',
            }),
        );
    });

    it('uses localized labels for the PDF date/VIN fields instead of hardcoded English (REPORT-04)', async () => {
        const onclose = vi.fn();
        const onprint = vi.fn();
        const onsavePdf = vi.fn<(suggestedName: string, pdfRequest: IPdfDocumentRequest) => void>();

        renderLetterDialog(
            {
                model: mockModel,
                onclose,
                onprint,
                onsavePdf,
            },
            createViewerTestRenderOptions({ locale: 'de' }),
        );

        const savePdfBtn = screen.getByRole('button', { name: 'Schreiben als PDF speichern' });
        await fireEvent.click(savePdfBtn);

        expect(onsavePdf).toHaveBeenCalledOnce();
        await fireEvent.click(screen.getByRole('button', { name: 'Schreiben drucken' }));
        expect(onprint).toHaveBeenCalledExactlyOnceWith(onsavePdf.mock.calls[0]?.[1]);
        const pdfRequest = onsavePdf.mock.calls[0]?.[1];
        if (pdfRequest?.kind !== 'infringementLetter') {
            throw new TypeError('The letter dialog must request an infringement-letter PDF.');
        }
        expect(pdfRequest.dateSignatureLabel).toBe('Datum');
        expect(pdfRequest.vinLabel).toBe('Fahrzeug-Identifizierungsnummer');
    });

    it('updates the on-screen preview immediately when company details are edited (REPORT-03)', async () => {
        const onclose = vi.fn();
        const onprint = vi.fn();

        renderLetterDialog({
            model: mockModel,
            onclose,
            onprint,
        });

        expect(screen.getByText('Trans-Euro Spedition GmbH')).toBeDefined();

        const companyInput = screen.getByRole('textbox', { name: 'Company Name' });
        await fireEvent.input(companyInput, { target: { value: 'Acme Fleet Logistics GmbH' } });

        // The visible preview - not just the printed/exported output - must
        // reflect the edit without requiring print/export first.
        expect(screen.getByText('Acme Fleet Logistics GmbH')).toBeDefined();
        expect(screen.queryByText('Trans-Euro Spedition GmbH')).toBeNull();
    });

    it('shows persisted company details immediately on first render, never a blank flash', () => {
        saveCompanySettings(settingsStore, { ...persistedSettings, companyName: 'Acme Transport S.A.' });

        renderLetterDialog({ model: mockModel, onclose: vi.fn(), onprint: vi.fn() });

        expect(screen.getByText('Acme Transport S.A.')).toBeDefined();
        expect(screen.queryByText('Trans-Euro Spedition GmbH')).toBeNull();
        expect(loadCompanySettings(settingsStore)).toEqual({ ...persistedSettings, companyName: 'Acme Transport S.A.' });
    });

    it('does not write to storage until a company field is blurred', async () => {
        renderLetterDialog({ model: mockModel, onclose: vi.fn(), onprint: vi.fn() });

        expect(loadCompanySettings(settingsStore)).toBeNull();

        const companyInput = screen.getByRole('textbox', { name: 'Company Name' });
        await fireEvent.input(companyInput, { target: { value: 'Acme Fleet Logistics GmbH' } });
        expect(loadCompanySettings(settingsStore)).toBeNull();

        await fireEvent.blur(companyInput);
        expect(loadCompanySettings(settingsStore)?.companyName).toBe('Acme Fleet Logistics GmbH');
    });

    it('preserves stored fields the letter dialog does not edit when persisting', async () => {
        saveCompanySettings(settingsStore, persistedSettings);

        renderLetterDialog({ model: mockModel, onclose: vi.fn(), onprint: vi.fn() });

        const managerInput = screen.getByRole('textbox', { name: 'Manager Name' });
        await fireEvent.input(managerInput, { target: { value: 'Erika Musterfrau' } });
        await fireEvent.blur(managerInput);

        expect(loadCompanySettings(settingsStore)).toEqual({ ...persistedSettings, managerName: 'Erika Musterfrau' });
    });

    it('calls onclose when close button is clicked', async () => {
        const onclose = vi.fn();
        const onprint = vi.fn();

        renderLetterDialog({
            model: mockModel,
            onclose,
            onprint,
        });

        const closeBtn = screen.getByRole('button', { name: 'Close letter dialog' });
        await fireEvent.click(closeBtn);

        expect(onclose).toHaveBeenCalledOnce();
    });
});
