<script lang="ts">
    import type { ILocalisationService } from '#localization';
    import type { DurationMilliseconds, UtcTimestamp } from '#tachograph-domain';
    import type { IComplianceTranslationService } from '#compliance';
    import type { IKeyValueStore, IPdfDocumentRequest } from '#contracts';
    import type { IInfringementLetterViewModel } from '../../presentation/infringement-letter-view-model.js';
    import {
        generateInfringementLetterHtml,
        type IInfringementLetterExportLabels,
    } from '../../presentation/export-document-html.js';
    import {
        createInfringementLetterExportModel,
        createInitialInfringementLetterDraft,
    } from '../../presentation/infringement-letter-draft.js';
    import { createInfringementLetterPdfRequest } from '../../presentation/pdf-document-request.js';
    import { loadCompanySettings, mergeCompanySettings, saveCompanySettings } from '../helpers/company-settings.js';
    import { suggestedDocumentFileName } from '../helpers/document-file-name.js';
    import ComplianceDocumentDialog from './ComplianceDocumentDialog.svelte';
    import ComplianceEditField from './ComplianceEditField.svelte';
    import ComplianceEditPanel from './ComplianceEditPanel.svelte';

    interface IProps {
        error?: string | null;
        localisationService: ILocalisationService<UtcTimestamp, DurationMilliseconds>;
        model: IInfringementLetterViewModel;
        onclose: () => void;
        onprint: (html: string) => Promise<void> | void;
        onsaveHtml?: (html: string, suggestedName: string) => void;
        onsavePdf?: (suggestedName: string, pdfRequest: IPdfDocumentRequest) => void;
        settingsStore: IKeyValueStore;
        translationService: IComplianceTranslationService;
    }

    let {
        error = null,
        localisationService,
        model,
        onclose,
        onprint,
        onsaveHtml = undefined,
        onsavePdf = undefined,
        settingsStore,
        translationService,
    }: IProps = $props();

    // Synchronously seeds draft from persisted settings and document prefill; prevents blank initial render.
    // Captures initial model once so later model recomputation does not overwrite user-entered fields.
    // svelte-ignore state_referenced_locally
    let draft = $state(createInitialInfringementLetterDraft(model, loadCompanySettings(settingsStore)));

    // Persists company settings on field blur rather than via reactive effect to ensure deterministic save ordering.
    function persistCompanySettings(): void {
        saveCompanySettings(settingsStore, mergeCompanySettings(loadCompanySettings(settingsStore), draft.company));
    }

    const exportModel = $derived(createInfringementLetterExportModel(model, draft));

    // Renders preview strictly from exportModel so on-screen edits match exported output.
    const cardDetailsDisplay = $derived(`${exportModel.cardNumber} (${exportModel.issuingMemberState})`);

    function severityLabel(severity: 'minor' | 'mostSerious' | 'serious' | 'verySerious'): string {
        switch (severity) {
            case 'minor':
                return translationService.translate('compliance.letter.severity.minor');
            case 'serious':
                return translationService.translate('compliance.letter.severity.serious');
            case 'verySerious':
                return translationService.translate('compliance.letter.severity.verySerious');
            case 'mostSerious':
                return translationService.translate('compliance.letter.severity.mostSerious');
        }
    }

    const letterLabels: IInfringementLetterExportLabels = $derived({
        auditPeriod: translationService.translate('compliance.letter.auditPeriod'),
        cardNumber: translationService.translate('compliance.letter.cardNumber'),
        colAllowed: translationService.translate('compliance.colAllowed'),
        colDateTime: translationService.translate('compliance.letter.colDateTime'),
        colDescription: translationService.translate('compliance.letter.colDescription'),
        colExcess: translationService.translate('compliance.colExcess'),
        colMeasured: translationService.translate('compliance.colMeasured'),
        colNum: translationService.translate('compliance.letter.colNum'),
        colSeverity: translationService.translate('compliance.colSeverity'),
        date: translationService.translate('compliance.letter.date'),
        dateAndSignature: translationService.translate('compliance.letter.dateAndSignature'),
        driver: translationService.translate('compliance.letter.driver'),
        driverAckText: translationService.translate('compliance.letter.driverAckText'),
        driverExplanation: translationService.translate('compliance.letter.driverExplanation'),
        driverSignature: translationService.translate('compliance.letter.driverSignature'),
        file: translationService.translate('compliance.letter.file'),
        generated: translationService.translate('compliance.letter.generated'),
        managerSignature: translationService.translate('compliance.letter.managerSignature'),
        qualification: translationService.translate('compliance.letter.qualification'),
        severityMinor: translationService.translate('compliance.letter.severity.minor'),
        severityMostSerious: translationService.translate('compliance.letter.severity.mostSerious'),
        severitySerious: translationService.translate('compliance.letter.severity.serious'),
        severityVerySerious: translationService.translate('compliance.letter.severity.verySerious'),
        statement: translationService.translate('compliance.letter.statement'),
        title: translationService.translate('compliance.letter.title'),
        totalInfringements: translationService.translate('compliance.letter.totalInfringements'),
        vehicle: translationService.translate('compliance.letter.vehicle'),
        vin: translationService.translate('compliance.letter.vin'),
    });

    async function handlePrint(): Promise<void> {
        const html = generateInfringementLetterHtml(exportModel, letterLabels, localisationService.locale);
        await onprint(html);
    }

    async function handleSaveHtml(): Promise<void> {
        const html = generateInfringementLetterHtml(exportModel, letterLabels, localisationService.locale);
        const suggestedName = suggestedDocumentFileName(
            translationService.translate('compliance.letter.fileName'),
            model.driverName,
            translationService.translate('compliance.fileName.driverFallback'),
            '.html',
        );
        await onsaveHtml?.(html, suggestedName);
    }

    async function handleSavePdf(): Promise<void> {
        const suggestedName = suggestedDocumentFileName(
            translationService.translate('compliance.letter.fileName'),
            model.driverName,
            translationService.translate('compliance.fileName.driverFallback'),
            '.pdf',
        );
        const pdfRequest = createInfringementLetterPdfRequest(
            exportModel,
            letterLabels,
            severityLabel,
            translationService.translate('compliance.letter.companyHeading'),
            letterLabels.date,
            letterLabels.vin,
            localisationService.locale,
        );
        await onsavePdf?.(suggestedName, pdfRequest);
    }
</script>

<ComplianceDocumentDialog
    {error}
    labels={{
        close: translationService.translate('compliance.letter.close'),
        print: translationService.translate('compliance.letter.print'),
        saveHtml: translationService.translate('compliance.letter.saveHtml'),
        savePdf: translationService.translate('compliance.letter.savePdf'),
        subtitle: translationService.translate('compliance.letter.subtitle'),
        title: translationService.translate('compliance.letter.title'),
    }}
    {onclose}
    onprint={handlePrint}
    onsaveHtml={onsaveHtml !== undefined ? handleSaveHtml : undefined}
    onsavePdf={onsavePdf !== undefined ? handleSavePdf : undefined}
    titleId="infringement-letter-dialog-title"
    {translationService}
>
    <ComplianceEditPanel
        heading={translationService.translate('compliance.letter.companyHeading')}
        headingId="letter-company-heading"
    >
        <ComplianceEditField
            autocomplete="organization"
            bind:value={draft.company.companyName}
            label={translationService.translate('compliance.letter.companyName')}
            onblur={persistCompanySettings}
        />
        <ComplianceEditField
            autocomplete="street-address"
            bind:value={draft.company.address}
            label={translationService.translate('compliance.letter.companyAddress')}
            onblur={persistCompanySettings}
        />
        <ComplianceEditField
            bind:value={draft.company.managerName}
            label={translationService.translate('compliance.letter.managerName')}
            onblur={persistCompanySettings}
        />
        <ComplianceEditField
            bind:value={draft.company.vatOrRegistration}
            label={translationService.translate('compliance.letter.vatOrRegistration')}
            onblur={persistCompanySettings}
        />

        <ComplianceEditField
            multiline
            bind:value={draft.driverExplanation}
            label={translationService.translate('compliance.letter.driverExplanation')}
        />
    </ComplianceEditPanel>

    <div class="letter-preview-sheet">
        <header class="sheet-header">
            <div class="company-col">
                <h2 class="company-name">{exportModel.company.companyName}</h2>
                <div class="company-addr">{exportModel.company.address}</div>
                {#if exportModel.company.vatOrRegistration.length > 0}
                    <div class="company-vat">{exportModel.company.vatOrRegistration}</div>
                {/if}
            </div>
            <div class="meta-col">
                <div class="meta-item">
                    <span class="meta-k">{translationService.translate('compliance.letter.generated')}</span>
                    {exportModel.generatedAt}
                </div>
                <div class="meta-item">
                    <span class="meta-k">{translationService.translate('compliance.letter.auditPeriod')}</span>
                    {exportModel.auditPeriod}
                </div>
                <div class="meta-item">
                    <span class="meta-k">{translationService.translate('compliance.letter.totalInfringements')}</span>
                    <strong>{exportModel.totalInfringements}</strong>
                </div>
            </div>
        </header>

        <div class="driver-summary-box">
            <div class="driver-field">
                <span class="lbl">{translationService.translate('compliance.letter.driver')}</span>
                <span class="val">{exportModel.driverName}</span>
            </div>
            <div class="driver-field">
                <span class="lbl">{translationService.translate('compliance.letter.cardNumber')}</span>
                <span class="val">{cardDetailsDisplay}</span>
            </div>
            {#if exportModel.vehicleRegistration !== null}
                <div class="driver-field">
                    <span class="lbl">{translationService.translate('compliance.letter.vehicle')}</span>
                    <span class="val">{exportModel.vehicleRegistration}</span>
                </div>
            {/if}
            <div class="driver-field">
                <span class="lbl">{translationService.translate('compliance.letter.file')}</span>
                <span class="val">{exportModel.fileName}</span>
            </div>
        </div>

        <p class="qualification-notice">{letterLabels.qualification}</p>

        <table class="infringement-preview-table">
            <thead>
                <tr>
                    <th class="col-num">{translationService.translate('compliance.letter.colNum')}</th>
                    <th class="col-datetime">{translationService.translate('compliance.letter.colDateTime')}</th>
                    <th>{translationService.translate('compliance.letter.colDescription')}</th>
                    <th class="col-sev">{translationService.translate('compliance.colSeverity')}</th>
                    <th class="col-val">{translationService.translate('compliance.colMeasured')}</th>
                    <th class="col-val">{translationService.translate('compliance.colAllowed')}</th>
                    <th class="col-val">{translationService.translate('compliance.colExcess')}</th>
                </tr>
            </thead>
            <tbody>
                {#each exportModel.items as item, index (item.ruleId + String(item.timestamp) + String(index))}
                    <tr>
                        <td class="col-num">{index + 1}</td>
                        <td class="col-datetime">{item.dateTimeDisplay}</td>
                        <td>
                            <div class="item-title">{item.title}</div>
                            <div class="item-ref">{item.legalReference}</div>
                        </td>
                        <td class="col-sev">
                            <span class="sev-badge sev-{item.severity}">{severityLabel(item.severity)}</span>
                        </td>
                        <td class="col-val">{item.measuredValue}</td>
                        <td class="col-val">{item.allowedValue}</td>
                        <td class="col-val excess-val">{item.excess}</td>
                    </tr>
                {/each}
            </tbody>
        </table>

        <div class="statement-box">
            <p>
                {translationService.translate('compliance.letter.statement')}
            </p>
        </div>

        {#if draft.driverExplanation.trim().length > 0}
            <div class="driver-explanation-box">
                <div class="explanation-title">
                    {translationService.translate('compliance.letter.driverExplanation')}
                </div>
                <p>{draft.driverExplanation}</p>
            </div>
        {/if}

        <div class="signature-row">
            <div class="sig-col">
                <div class="sig-caption">
                    {translationService.translate('compliance.letter.driverSignature')}
                </div>
                <div class="sig-line">
                    {translationService.translate('compliance.letter.dateAndSignature')}
                </div>
            </div>
            <div class="sig-col">
                <div class="sig-caption">
                    {translationService.translate('compliance.letter.managerSignature')}
                </div>
                <div class="sig-line">
                    {translationService.translate('compliance.letter.dateAndSignature')}
                </div>
            </div>
        </div>
    </div>
</ComplianceDocumentDialog>

<style>
    .letter-preview-sheet {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
        padding: var(--space-6);
        background: var(--color-surface);
        border: var(--border-panel);
        border-radius: var(--radius-panel);
        box-shadow: var(--shadow-card);
    }

    .sheet-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-block-end: var(--border-subtle);
        padding-block-end: var(--space-4);
    }

    .company-col {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
    }

    .company-name {
        margin: var(--space-none);
        font-size: var(--font-size-title);
        font-weight: var(--font-weight-title);
        color: var(--color-text);
    }

    .company-addr,
    .company-vat {
        font-size: var(--font-size-body);
        color: var(--color-text-muted);
    }

    .meta-col {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        text-align: right;
        font-size: var(--font-size-body);
    }

    .meta-k {
        color: var(--color-text-muted);
        margin-inline-end: var(--space-2);
    }

    .driver-summary-box {
        display: grid;
        grid-template-columns: var(--layout-overview-columns);
        gap: var(--space-3);
        padding: var(--space-4);
        background: var(--color-surface-subtle);
        border-radius: var(--radius-control);
        font-size: var(--font-size-body);
    }

    .driver-field {
        display: flex;
        gap: var(--space-2);
    }

    .lbl {
        color: var(--color-text-muted);
        font-weight: var(--font-weight-action);
    }

    .val {
        color: var(--color-text);
        font-weight: var(--font-weight-action);
    }

    .infringement-preview-table {
        inline-size: var(--size-full);
        border-collapse: collapse;
        font-size: var(--font-size-body);
    }

    .infringement-preview-table th {
        text-align: left;
        padding: var(--space-3) var(--space-4);
        background: var(--color-surface-subtle);
        border-block-end: var(--border-panel);
        font-weight: var(--font-weight-action);
        color: var(--color-text-muted);
    }

    .infringement-preview-table td {
        padding: var(--space-3) var(--space-4);
        border-block-end: var(--border-subtle);
        vertical-align: top;
    }

    .col-num {
        color: var(--color-text-muted);
        text-align: center;
        white-space: nowrap;
    }

    .col-datetime {
        white-space: nowrap;
    }

    .col-val {
        text-align: right;
    }

    .excess-val {
        font-weight: var(--font-weight-title);
        color: var(--color-danger);
    }

    .item-title {
        font-weight: var(--font-weight-action);
        color: var(--color-text);
        line-height: var(--line-height-body);
    }

    .item-ref {
        font-size: var(--font-size-metadata);
        color: var(--color-text-muted);
        margin-block-start: var(--space-1);
    }

    .sev-badge {
        display: inline-block;
        padding: var(--space-1) var(--space-2);
        border-radius: var(--radius-control);
        font-size: var(--font-size-metadata);
        font-weight: var(--font-weight-action);
    }

    .sev-minor {
        background: var(--color-accent-soft);
        color: var(--color-accent);
    }

    .sev-serious {
        background: var(--color-warning-soft);
        color: var(--color-warning);
    }

    .sev-verySerious {
        background: var(--color-danger-soft);
        color: var(--color-danger);
    }

    .driver-explanation-box {
        margin-block-start: var(--space-stack);
        padding: var(--space-actions) var(--space-panel);
        background: var(--color-surface-subtle);
        border-inline-start: var(--border-callout);
        border-radius: var(--radius-control);
    }

    .driver-explanation-box .explanation-title {
        font-size: var(--font-size-metadata);
        font-weight: var(--font-weight-action);
        color: var(--color-text-muted);
    }

    .driver-explanation-box p {
        margin: var(--space-compact) var(--space-none) var(--space-none);
        white-space: pre-wrap;
    }

    .statement-box {
        padding: var(--space-4);
        background: var(--color-surface-subtle);
        border-inline-start: var(--border-callout);
        border-radius: var(--radius-control);
        font-size: var(--font-size-body);
        line-height: var(--line-height-body);
    }

    .statement-box p {
        margin: var(--space-none);
    }

    .qualification-notice {
        margin: var(--space-none);
        padding: var(--space-3);
        background: var(--color-surface-subtle);
        border: var(--border-region);
        border-radius: var(--radius-control);
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
        line-height: var(--line-height-body);
    }

    .signature-row {
        display: grid;
        grid-template-columns: var(--layout-overview-columns);
        gap: var(--space-6);
        margin-block-start: var(--space-4);
        padding-block-start: var(--space-5);
        border-block-start: var(--border-subtle);
    }

    .sig-caption {
        font-weight: var(--font-weight-action);
        font-size: var(--font-size-body);
        color: var(--color-text);
        margin-block-end: var(--space-3);
    }

    .sig-line {
        font-size: var(--font-size-body);
        color: var(--color-text-muted);
        line-height: var(--line-height-body);
    }
</style>
