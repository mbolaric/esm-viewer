import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryKeyValueStore, type IKeyValueStore, type IPdfDocumentRequest } from '#contracts';
import AttestationFormDialog from '../components/AttestationFormDialog.svelte';
import { loadCompanySettings, saveCompanySettings, type ICompanySettings } from '../helpers/company-settings.js';
import { mockAttestationFormViewModel as mockModel } from '../../presentation/__tests__/attestation-form-fixture.js';
import type { AttestationReason, IAttestationFormViewModel } from '../../presentation/attestation-form-view-model.js';
import { createViewerTestRenderOptions, type IViewerTestRenderOptions } from '#testing';

let settingsStore: IKeyValueStore = createMemoryKeyValueStore();

afterEach(() => {
    cleanup();
    // A fresh store per test keeps one test's saved details out of the next test's initial render.
    settingsStore = createMemoryKeyValueStore();
});

interface IRenderAttestationDialogProps {
    model: IAttestationFormViewModel;
    onchangeReason: (reason: AttestationReason) => void;
    onclose: () => void;
    onprint: (html: string) => void | Promise<void>;
    onsaveHtml?: (html: string, suggestedName: string) => void;
    onsavePdf?: (suggestedName: string, pdfRequest: IPdfDocumentRequest) => void;
}

function renderAttestationDialog(
    props: IRenderAttestationDialogProps,
    options: IViewerTestRenderOptions = createViewerTestRenderOptions(),
): ReturnType<typeof render> {
    const context = options.wrapperProps.context;
    return render(
        AttestationFormDialog,
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

// Renders dialog with blank birth/employment dates for a given (or fixture's default) driver card.
function renderWithBlankDriverDates(cardNumber = mockModel.driverCardNumber): ReturnType<typeof render> {
    return renderAttestationDialog({
        model: {
            ...mockModel,
            driverBirthDate: '',
            driverCardNumber: cardNumber,
            driverEmploymentDate: '',
        },
        onchangeReason: vi.fn(),
        onclose: vi.fn(),
        onprint: vi.fn(),
    });
}

describe('AttestationFormDialog', () => {
    it('renders form fields and radio options, calls onchangeReason on selection', async () => {
        const onclose = vi.fn();
        const onprint = vi.fn();
        const onchangeReason = vi.fn();

        renderAttestationDialog({
            model: mockModel,
            onchangeReason,
            onclose,
            onprint,
        });

        expect(screen.getByText('EuroTrans Logistics')).toBeDefined();
        expect(screen.getByText('Schmidt Hans')).toBeDefined();

        const sickLeaveRadio = screen.getByLabelText('14. On sick leave');
        await fireEvent.click(sickLeaveRadio);

        expect(onchangeReason).toHaveBeenCalledWith('sickLeave');

        const printBtn = screen.getByRole('button', {
            name: 'Print Attestation',
        });
        await fireEvent.click(printBtn);

        expect(onprint).toHaveBeenCalledOnce();
        expect(onprint.mock.calls[0]?.[0]).toContain('ATTESTATION OF ACTIVITIES');
    });

    it('triggers onsaveHtml and onsavePdf callbacks', async () => {
        const onclose = vi.fn();
        const onprint = vi.fn();
        const onchangeReason = vi.fn();
        const onsaveHtml = vi.fn();
        const onsavePdf = vi.fn();

        renderAttestationDialog({
            model: mockModel,
            onchangeReason,
            onclose,
            onprint,
            onsaveHtml,
            onsavePdf,
        });

        const saveHtmlBtn = screen.getByRole('button', { name: 'Save Attestation HTML' });
        await fireEvent.click(saveHtmlBtn);
        expect(onsaveHtml).toHaveBeenCalledOnce();
        expect(onsaveHtml.mock.calls[0]?.[1]).toBe('EU_Attestation_Schmidt_Hans.html');

        const savePdfBtn = screen.getByRole('button', { name: 'Save Attestation PDF' });
        await fireEvent.click(savePdfBtn);
        expect(onsavePdf).toHaveBeenCalledOnce();
        expect(onsavePdf.mock.calls[0]?.[0]).toBe('EU_Attestation_Schmidt_Hans.pdf');
    });

    it('uses the edited company details in the exported attestation HTML', async () => {
        const onclose = vi.fn();
        const onprint = vi.fn<(html: string) => void>();
        const onchangeReason = vi.fn();

        renderAttestationDialog({
            model: { ...mockModel, companyName: '' },
            onchangeReason,
            onclose,
            onprint,
        });

        const companyInput = screen.getByRole('textbox', {
            name: '1. Name of the undertaking:',
        });
        await fireEvent.input(companyInput, { target: { value: 'Acme Transport S.A.' } });

        const printBtn = screen.getByRole('button', { name: 'Print Attestation' });
        await fireEvent.click(printBtn);

        const firstPrintCall = onprint.mock.calls[0];
        const html = firstPrintCall?.[0];
        if (html === undefined) {
            throw new TypeError('The attestation print callback must receive HTML.');
        }
        expect(html).toContain('Acme Transport S.A.');
        expect(html).not.toContain('EuroTrans Logistics');
    });

    it('updates the on-screen preview immediately when driver fields are edited (REPORT-05)', async () => {
        const onclose = vi.fn();
        const onprint = vi.fn();
        const onchangeReason = vi.fn();

        renderAttestationDialog({
            model: mockModel,
            onchangeReason,
            onclose,
            onprint,
        });

        expect(screen.getByText('15.05.1980')).toBeDefined();

        const birthDateInput = screen.getByRole('textbox', {
            name: '9. Date of birth (day/month/year):',
        });
        await fireEvent.input(birthDateInput, { target: { value: '01.01.1990' } });

        expect(screen.getByText('01.01.1990')).toBeDefined();
        expect(screen.queryByText('15.05.1980')).toBeNull();
    });

    it('disables printing and export until every required field is filled in, then re-enables (REPORT-05)', async () => {
        const onclose = vi.fn();
        const onprint = vi.fn();
        const onchangeReason = vi.fn();

        renderAttestationDialog({
            model: { ...mockModel, driverBirthDate: '' },
            onchangeReason,
            onclose,
            onprint,
        });

        const printBtn = screen.getByRole('button', { name: 'Print Attestation' });
        expect(printBtn).toHaveProperty('disabled', true);
        expect(screen.getByText(/Fill in the required fields/)).toBeDefined();
        expect(screen.getByRole('listitem').textContent).toBe('9. Date of birth (day/month/year):');

        const birthDateInput = screen.getByRole('textbox', {
            name: '9. Date of birth (day/month/year):',
        });
        await fireEvent.input(birthDateInput, { target: { value: '15.05.1980' } });

        expect(printBtn).toHaveProperty('disabled', false);
        expect(screen.queryByText(/Fill in the required fields/)).toBeNull();

        await fireEvent.click(printBtn);
        expect(onprint).toHaveBeenCalledOnce();
    });

    it('marks fax and e-mail as optional and every other editable field as required', () => {
        renderAttestationDialog({ model: mockModel, onchangeReason: vi.fn(), onclose: vi.fn(), onprint: vi.fn() });

        const fax = screen.getByLabelText(/4\. Fax/);
        const email = screen.getByLabelText(/5\. E-mail/);
        const companyName = screen.getByRole('textbox', { name: '1. Name of the undertaking:' });

        expect(fax.getAttribute('aria-required')).toBeNull();
        expect(email.getAttribute('aria-required')).toBeNull();
        expect(fax.closest('label')?.textContent).toContain('(optional)');
        expect(email.closest('label')?.textContent).toContain('(optional)');
        expect(companyName.getAttribute('aria-required')).toBe('true');
        expect(companyName.closest('label')?.textContent).not.toContain('(optional)');
    });

    it('shows a busy status while the print callback is pending, like the export buttons', async () => {
        const onclose = vi.fn();
        let resolvePrint: (() => void) | undefined;
        const onprint = vi.fn<(html: string) => Promise<void>>(
            () =>
                new Promise<void>((resolve) => {
                    resolvePrint = resolve;
                }),
        );

        renderAttestationDialog({
            model: mockModel,
            onchangeReason: vi.fn(),
            onclose,
            onprint,
        });

        const printBtn = screen.getByRole('button', { name: 'Print Attestation' });
        await fireEvent.click(printBtn);

        expect(screen.getByText('Printing…')).toBeDefined();
        expect(printBtn).toHaveProperty('disabled', true);

        resolvePrint?.();
    });

    it('shows persisted company settings immediately on first render, never a blank flash (REPORT-05)', () => {
        const persisted: ICompanySettings = {
            address: 'Logistics Park 5',
            city: 'Frankfurt',
            companyName: 'Acme Transport S.A.',
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
        saveCompanySettings(settingsStore, persisted);

        renderAttestationDialog({
            // The document's own (different) prefill must lose to the
            // persisted settings - proves the draft is seeded from
            // storage, not from `model`, whenever storage has a value.
            model: { ...mockModel, companyName: 'Document Prefill GmbH' },
            onchangeReason: vi.fn(),
            onclose: vi.fn(),
            onprint: vi.fn(),
        });

        expect(screen.getByText('Acme Transport S.A.')).toBeDefined();
        expect(screen.getByText('Klaus Meier')).toBeDefined();
        expect(screen.queryByText('Document Prefill GmbH')).toBeNull();
    });

    it('persists an edited company field on blur, without waiting for other fields', async () => {
        renderAttestationDialog({
            model: mockModel,
            onchangeReason: vi.fn(),
            onclose: vi.fn(),
            onprint: vi.fn(),
        });

        const companyInput = screen.getByRole('textbox', {
            name: '1. Name of the undertaking:',
        });
        await fireEvent.input(companyInput, { target: { value: 'Acme Transport S.A.' } });
        await fireEvent.blur(companyInput);

        expect(loadCompanySettings(settingsStore)?.companyName).toBe('Acme Transport S.A.');
    });

    it('persists birth date and employment date per driver card, and restores them on reopen', async () => {
        const { unmount } = renderWithBlankDriverDates();

        const birthDateInput = screen.getByRole('textbox', {
            name: '9. Date of birth (day/month/year):',
        });
        const employmentDateInput = screen.getByRole('textbox', {
            name: '11. who has started to work at the undertaking on (day/month/year):',
        });
        await fireEvent.input(birthDateInput, { target: { value: '15.05.1980' } });
        await fireEvent.blur(birthDateInput);
        await fireEvent.input(employmentDateInput, { target: { value: '01.01.2020' } });
        await fireEvent.blur(employmentDateInput);
        unmount();

        // Reopening the dialog for the SAME driver card must restore both
        // fields, never a blank flash, mirroring the company-settings
        // guarantee above but scoped to `mockModel.driverCardNumber`.
        renderWithBlankDriverDates();

        expect(screen.getByText('15.05.1980')).toBeDefined();
        expect(screen.getByText('01.01.2020')).toBeDefined();
    });

    it('never mixes a different driver card number into the birth/employment date prefill', async () => {
        const { unmount } = renderWithBlankDriverDates();

        const birthDateInput = screen.getByRole('textbox', {
            name: '9. Date of birth (day/month/year):',
        });
        await fireEvent.input(birthDateInput, { target: { value: '15.05.1980' } });
        await fireEvent.blur(birthDateInput);
        unmount();

        renderWithBlankDriverDates('D111111111');

        expect(screen.queryByText('15.05.1980')).toBeNull();
    });

    it('calls onclose when close button is clicked', async () => {
        const onclose = vi.fn();
        const onprint = vi.fn();
        const onchangeReason = vi.fn();

        renderAttestationDialog({
            model: mockModel,
            onchangeReason,
            onclose,
            onprint,
        });

        const closeBtn = screen.getByRole('button', { name: 'Close attestation dialog' });
        await fireEvent.click(closeBtn);

        expect(onclose).toHaveBeenCalledOnce();
    });
});
