<script lang="ts">
    import type { ILocalisationService } from '#localization';
    import type { DurationMilliseconds, UtcTimestamp } from '#tachograph-domain';
    import type { ComplianceTranslationKey, IComplianceTranslationService } from '#compliance';
    import type { IKeyValueStore, IPdfDocumentRequest } from '#contracts';
    import {
        createAttestationExportModel,
        createInitialAttestationFormDraft,
        missingAttestationFormFields,
        type AttestationRequiredField,
    } from '../../presentation/attestation-form-draft.js';
    import {
        isKnownDriverCardNumber,
        type AttestationReason,
        type IAttestationFormViewModel,
    } from '../../presentation/attestation-form-view-model.js';
    import { generateAttestationFormHtml, type IAttestationFormExportLabels } from '../../presentation/export-document-html.js';
    import { createAttestationFormPdfRequest } from '../../presentation/pdf-document-request.js';
    import { loadCompanySettings, saveCompanySettings } from '../helpers/company-settings.js';
    import { loadDriverAttestationDetails, saveDriverAttestationDetails } from '../helpers/driver-attestation-details.js';
    import { suggestedDocumentFileName } from '../helpers/document-file-name.js';
    import AttestationSheetPreview from './AttestationSheetPreview.svelte';
    import ComplianceDocumentDialog from './ComplianceDocumentDialog.svelte';
    import ComplianceEditField from './ComplianceEditField.svelte';
    import ComplianceEditPanel from './ComplianceEditPanel.svelte';

    interface IProps {
        error?: string | null;
        localisationService: ILocalisationService<UtcTimestamp, DurationMilliseconds>;
        model: IAttestationFormViewModel;
        onchangeReason: (reason: AttestationReason) => void;
        onclose: () => void;
        onprint: (pdfRequest: IPdfDocumentRequest) => Promise<void> | void;
        onsaveHtml?: (html: string, suggestedName: string) => void;
        onsavePdf?: (suggestedName: string, pdfRequest: IPdfDocumentRequest) => void;
        settingsStore: IKeyValueStore;
        translationService: IComplianceTranslationService;
    }

    let {
        error = null,
        localisationService,
        model,
        onchangeReason,
        onclose,
        onprint,
        onsaveHtml = undefined,
        onsavePdf = undefined,
        settingsStore,
        translationService,
    }: IProps = $props();

    // Synchronously seeds draft from persisted settings and document prefill; prevents blank initial render.
    // Captures initial model once so reason-toggle recomputations do not overwrite user-entered fields.
    // svelte-ignore state_referenced_locally
    let draft = $state(
        createInitialAttestationFormDraft(
            model,
            loadCompanySettings(settingsStore),
            isKnownDriverCardNumber(model.driverCardNumber)
                ? loadDriverAttestationDetails(settingsStore, model.driverCardNumber)
                : null,
        ),
    );

    // Persists company settings on field blur rather than via reactive effect to ensure deterministic save ordering.
    function persistCompanySettings(): void {
        saveCompanySettings(settingsStore, draft.company);
    }

    function persistDriverAttestationDetails(): void {
        if (!isKnownDriverCardNumber(model.driverCardNumber)) {
            return;
        }
        saveDriverAttestationDetails(settingsStore, model.driverCardNumber, {
            birthDate: draft.driverBirthDate,
            employmentDate: draft.driverEmploymentDate,
        });
    }

    const exportModel = $derived<IAttestationFormViewModel>(createAttestationExportModel(model, draft));

    // Requires all mandatory EU attestation fields before enabling export or print.
    // Each required field is named by the same label its input shows, so the notice points at what to fill in.
    const requiredFieldLabelKeys = {
        city: 'compliance.attestation.editCity',
        companyName: 'compliance.attestation.item1_undertaking',
        country: 'compliance.attestation.editCountry',
        driverBirthDate: 'compliance.attestation.item9_birthDate',
        driverEmploymentDate: 'compliance.attestation.item11_employmentDate',
        driverLicenceOrId: 'compliance.attestation.item10_licence',
        driverName: 'compliance.attestation.item8_driverName',
        managerName: 'compliance.attestation.item6_name',
        managerPosition: 'compliance.attestation.item7_position',
        periodFrom: 'compliance.attestation.item12_from',
        periodTo: 'compliance.attestation.item13_to',
        postalCode: 'compliance.attestation.editPostalCode',
        street: 'compliance.attestation.editStreet',
        telephone: 'compliance.attestation.item3_tel',
    } satisfies Readonly<Record<AttestationRequiredField, ComplianceTranslationKey>>;
    const missingFields = $derived(missingAttestationFormFields(draft));
    const isComplete = $derived(missingFields.length === 0);

    const attestationLabels: IAttestationFormExportLabels = $derived({
        date: translationService.translate('compliance.attestation.date'),
        declareDriver: translationService.translate('compliance.attestation.declareDriver'),
        driverSignature: translationService.translate('compliance.attestation.driverSignature'),
        footnote1: translationService.translate('compliance.attestation.footnote1'),
        footnote2: translationService.translate('compliance.attestation.footnote2'),
        footnote3: translationService.translate('compliance.attestation.footnote3'),
        forPeriod: translationService.translate('compliance.attestation.forPeriod'),
        item1_undertaking: translationService.translate('compliance.attestation.item1_undertaking'),
        item2_address: translationService.translate('compliance.attestation.item2_address'),
        item3_tel: translationService.translate('compliance.attestation.item3_tel'),
        item4_fax: translationService.translate('compliance.attestation.item4_fax'),
        item5_email: translationService.translate('compliance.attestation.item5_email'),
        item6_name: translationService.translate('compliance.attestation.item6_name'),
        item7_position: translationService.translate('compliance.attestation.item7_position'),
        item8_driverName: translationService.translate('compliance.attestation.item8_driverName'),
        item9_birthDate: translationService.translate('compliance.attestation.item9_birthDate'),
        item10_licence: translationService.translate('compliance.attestation.item10_licence'),
        item11_employmentDate: translationService.translate('compliance.attestation.item11_employmentDate'),
        item12_from: translationService.translate('compliance.attestation.item12_from'),
        item13_to: translationService.translate('compliance.attestation.item13_to'),
        item14_sickLeave: translationService.translate('compliance.attestation.item14_sickLeave'),
        item15_annualLeave: translationService.translate('compliance.attestation.item15_annualLeave'),
        item16_leaveOrRest: translationService.translate('compliance.attestation.item16_leaveOrRest'),
        item17_outOfScope: translationService.translate('compliance.attestation.item17_outOfScope'),
        item18_otherWork: translationService.translate('compliance.attestation.item18_otherWork'),
        item19_available: translationService.translate('compliance.attestation.item19_available'),
        item20_place: translationService.translate('compliance.attestation.item20_place'),
        item21_driverConfirm: translationService.translate('compliance.attestation.item21_driverConfirm'),
        item22_place: translationService.translate('compliance.attestation.item22_place'),
        officialAnnex: translationService.translate('compliance.attestation.officialAnnex'),
        officialInstruction: translationService.translate('compliance.attestation.officialInstruction'),
        officialRegulation: translationService.translate('compliance.attestation.officialRegulation'),
        officialTitle: translationService.translate('compliance.attestation.officialTitle'),
        officialWarning: translationService.translate('compliance.attestation.officialWarning'),
        partUndertaking: translationService.translate('compliance.attestation.partUndertaking'),
        signature: translationService.translate('compliance.attestation.signature'),
        undersigned: translationService.translate('compliance.attestation.undersigned'),
    });

    const pdfRequest = $derived(createAttestationFormPdfRequest(exportModel, attestationLabels, localisationService.locale));

    async function handlePrint(): Promise<void> {
        await onprint(pdfRequest);
    }

    async function handleSaveHtml(): Promise<void> {
        const html = generateAttestationFormHtml(exportModel, attestationLabels, localisationService.locale);
        const suggestedName = suggestedDocumentFileName(
            translationService.translate('compliance.attestation.fileName'),
            draft.driverName,
            translationService.translate('compliance.fileName.driverFallback'),
            '.html',
        );
        await onsaveHtml?.(html, suggestedName);
    }

    async function handleSavePdf(): Promise<void> {
        const suggestedName = suggestedDocumentFileName(
            translationService.translate('compliance.attestation.fileName'),
            draft.driverName,
            translationService.translate('compliance.fileName.driverFallback'),
            '.pdf',
        );
        await onsavePdf?.(suggestedName, pdfRequest);
    }
</script>

<ComplianceDocumentDialog
    {error}
    exportAllowed={isComplete}
    labels={{
        close: translationService.translate('compliance.attestation.close'),
        print: translationService.translate('compliance.attestation.print'),
        saveHtml: translationService.translate('compliance.attestation.saveHtml'),
        savePdf: translationService.translate('compliance.attestation.savePdf'),
        subtitle: translationService.translate('compliance.attestation.subtitle'),
        title: translationService.translate('compliance.attestation.title'),
    }}
    {onclose}
    onprint={handlePrint}
    onsaveHtml={onsaveHtml !== undefined ? handleSaveHtml : undefined}
    onsavePdf={onsavePdf !== undefined ? handleSavePdf : undefined}
    titleId="attestation-form-dialog-title"
    {translationService}
>
    {#if !isComplete}
        <div class="incomplete-notice" role="status">
            <p>{translationService.translate('compliance.attestation.incompleteNotice')}</p>
            <p>{translationService.translate('compliance.attestation.missingFieldsHeading')}</p>
            <ul class="missing-fields">
                {#each missingFields as field (field)}
                    <li>{translationService.translate(requiredFieldLabelKeys[field])}</li>
                {/each}
            </ul>
        </div>
    {/if}

    <fieldset class="reason-selector-fieldset">
        <legend class="reason-legend">{translationService.translate('compliance.attestation.reasonLabel')}</legend>
        <div class="reason-options-grid">
            <label class="reason-option-label" class:selected={model.reason === 'sickLeave'}>
                <input
                    type="radio"
                    name="attestation-reason"
                    value="sickLeave"
                    checked={model.reason === 'sickLeave'}
                    onchange={() => onchangeReason('sickLeave')}
                />
                <span class="reason-text">{translationService.translate('compliance.attestation.reason.sickLeave')}</span>
            </label>
            <label class="reason-option-label" class:selected={model.reason === 'annualLeave'}>
                <input
                    type="radio"
                    name="attestation-reason"
                    value="annualLeave"
                    checked={model.reason === 'annualLeave'}
                    onchange={() => onchangeReason('annualLeave')}
                />
                <span class="reason-text">{translationService.translate('compliance.attestation.reason.annualLeave')}</span>
            </label>
            <label class="reason-option-label" class:selected={model.reason === 'leaveOrRest'}>
                <input
                    type="radio"
                    name="attestation-reason"
                    value="leaveOrRest"
                    checked={model.reason === 'leaveOrRest'}
                    onchange={() => onchangeReason('leaveOrRest')}
                />
                <span class="reason-text">{translationService.translate('compliance.attestation.reason.leaveOrRest')}</span>
            </label>
            <label class="reason-option-label" class:selected={model.reason === 'outOfScope'}>
                <input
                    type="radio"
                    name="attestation-reason"
                    value="outOfScope"
                    checked={model.reason === 'outOfScope'}
                    onchange={() => onchangeReason('outOfScope')}
                />
                <span class="reason-text">{translationService.translate('compliance.attestation.reason.outOfScope')}</span>
            </label>
            <label class="reason-option-label" class:selected={model.reason === 'otherWork'}>
                <input
                    type="radio"
                    name="attestation-reason"
                    value="otherWork"
                    checked={model.reason === 'otherWork'}
                    onchange={() => onchangeReason('otherWork')}
                />
                <span class="reason-text">{translationService.translate('compliance.attestation.reason.otherWork')}</span>
            </label>
            <label class="reason-option-label" class:selected={model.reason === 'available'}>
                <input
                    type="radio"
                    name="attestation-reason"
                    value="available"
                    checked={model.reason === 'available'}
                    onchange={() => onchangeReason('available')}
                />
                <span class="reason-text">{translationService.translate('compliance.attestation.reason.available')}</span>
            </label>
        </div>
    </fieldset>

    <ComplianceEditPanel
        heading={translationService.translate('compliance.attestation.companyHeading')}
        headingId="attestation-company-heading"
    >
        <ComplianceEditField
            required
            autocomplete="organization"
            bind:value={draft.company.companyName}
            label={translationService.translate('compliance.attestation.item1_undertaking')}
            onblur={persistCompanySettings}
        />
        <ComplianceEditField
            required
            autocomplete="address-line1"
            bind:value={draft.company.street}
            label={translationService.translate('compliance.attestation.editStreet')}
            onblur={persistCompanySettings}
        />
        <ComplianceEditField
            required
            autocomplete="postal-code"
            bind:value={draft.company.postalCode}
            label={translationService.translate('compliance.attestation.editPostalCode')}
            onblur={persistCompanySettings}
        />
        <ComplianceEditField
            required
            autocomplete="address-level2"
            bind:value={draft.company.city}
            label={translationService.translate('compliance.attestation.editCity')}
            onblur={persistCompanySettings}
        />
        <ComplianceEditField
            required
            autocomplete="country-name"
            bind:value={draft.company.country}
            label={translationService.translate('compliance.attestation.editCountry')}
            onblur={persistCompanySettings}
        />
        <ComplianceEditField
            required
            autocomplete="tel"
            bind:value={draft.company.telephone}
            label={translationService.translate('compliance.attestation.item3_tel')}
            onblur={persistCompanySettings}
            type="tel"
        />
        <ComplianceEditField
            bind:value={draft.company.faxNumber}
            label={translationService.translate('compliance.attestation.item4_fax')}
            onblur={persistCompanySettings}
            optionalLabel={translationService.translate('compliance.attestation.optionalField')}
            type="tel"
        />
        <ComplianceEditField
            autocomplete="email"
            bind:value={draft.company.email}
            label={translationService.translate('compliance.attestation.item5_email')}
            onblur={persistCompanySettings}
            optionalLabel={translationService.translate('compliance.attestation.optionalField')}
            type="email"
        />
        <ComplianceEditField
            required
            bind:value={draft.company.managerName}
            label={translationService.translate('compliance.attestation.item6_name')}
            onblur={persistCompanySettings}
        />
        <ComplianceEditField
            required
            bind:value={draft.company.managerPosition}
            label={translationService.translate('compliance.attestation.item7_position')}
            onblur={persistCompanySettings}
        />
    </ComplianceEditPanel>

    <ComplianceEditPanel
        heading={translationService.translate('compliance.attestation.driverHeading')}
        headingId="attestation-driver-heading"
        hint={translationService.translate('compliance.attestation.driverHeadingHint')}
    >
        <ComplianceEditField
            required
            bind:value={draft.driverName}
            label={translationService.translate('compliance.attestation.item8_driverName')}
        />
        <ComplianceEditField
            required
            bind:value={draft.driverBirthDate}
            label={translationService.translate('compliance.attestation.item9_birthDate')}
            onblur={persistDriverAttestationDetails}
        />
        <ComplianceEditField
            required
            bind:value={draft.driverLicenceOrId}
            label={translationService.translate('compliance.attestation.item10_licence')}
        />
        <ComplianceEditField
            required
            bind:value={draft.driverEmploymentDate}
            label={translationService.translate('compliance.attestation.item11_employmentDate')}
            onblur={persistDriverAttestationDetails}
        />
        <ComplianceEditField
            required
            bind:value={draft.periodFromFormatted}
            label={translationService.translate('compliance.attestation.item12_from')}
        />
        <ComplianceEditField
            required
            bind:value={draft.periodToFormatted}
            label={translationService.translate('compliance.attestation.item13_to')}
        />
    </ComplianceEditPanel>

    <AttestationSheetPreview {exportModel} {translationService} />
</ComplianceDocumentDialog>

<style>
    .incomplete-notice p {
        margin: var(--space-none);
    }

    .missing-fields {
        margin: var(--space-compact) var(--space-none) var(--space-none);
        padding-inline-start: var(--space-panel);
        font-weight: var(--font-weight-body);
    }

    .incomplete-notice {
        margin: var(--space-none);
        padding: var(--space-actions) var(--space-panel);
        background: var(--color-warning-soft);
        border: var(--border-badge-serious);
        border-radius: var(--radius-panel);
        color: var(--color-warning);
        font-size: var(--font-size-body);
        font-weight: var(--font-weight-action);
    }

    .reason-selector-fieldset {
        border: var(--border-subtle);
        border-radius: var(--radius-panel);
        padding: var(--space-4);
        background: var(--color-surface-subtle);
    }

    .reason-legend {
        font-size: var(--font-size-body);
        font-weight: var(--font-weight-title);
        color: var(--color-text);
        padding-inline: var(--space-2);
    }

    .reason-options-grid {
        display: grid;
        grid-template-columns: var(--layout-overview-columns);
        gap: var(--space-3);
        margin-block-start: var(--space-3);
    }

    .reason-option-label {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        border: var(--border-subtle);
        border-radius: var(--radius-control);
        background: var(--color-surface);
        cursor: pointer;
        font-size: var(--font-size-body);
        transition:
            border-color var(--duration-fast) var(--easing-standard),
            background var(--duration-fast) var(--easing-standard);
    }

    .reason-option-label:hover {
        border-color: var(--color-accent);
    }

    .reason-option-label.selected {
        border-color: var(--color-accent);
        background: var(--color-accent-soft);
        font-weight: var(--font-weight-action);
    }

    .reason-text {
        color: var(--color-text);
    }
</style>
