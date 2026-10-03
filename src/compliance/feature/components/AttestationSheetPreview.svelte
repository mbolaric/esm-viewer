<script lang="ts">
    import type { IComplianceTranslationService } from '#compliance';
    import type { IAttestationFormViewModel } from '../../presentation/attestation-form-view-model.js';

    interface IProps {
        // The same merged model that print and export use, so the preview always matches the output.
        exportModel: IAttestationFormViewModel;
        translationService: IComplianceTranslationService;
    }

    let { exportModel, translationService }: IProps = $props();

    const companyAddressDisplay = $derived(
        `${exportModel.companyStreet}, ${exportModel.companyPostalCode} ${exportModel.companyCity}, ${exportModel.companyCountry}`,
    );

    function checkbox(checked: boolean): string {
        return checked ? '[✓]' : '[ ]';
    }
</script>

<div class="attestation-sheet-preview">
    <div class="annex-header">
        {translationService.translate('compliance.attestation.officialAnnex')}
    </div>
    <div class="form-title">
        {translationService.translate('compliance.attestation.officialTitle')}
    </div>
    <div class="form-subtitle">
        {translationService.translate('compliance.attestation.officialRegulation')}
    </div>
    <div class="instruction-notice">
        {translationService.translate('compliance.attestation.officialInstruction')}
    </div>
    <div class="warning-notice">
        {translationService.translate('compliance.attestation.officialWarning')}
    </div>

    <div class="undertaking-box">
        <div class="section-heading">
            {translationService.translate('compliance.attestation.partUndertaking')}
        </div>
        <div class="form-row">
            <span class="row-label">{translationService.translate('compliance.attestation.item1_undertaking')}</span>
            <span class="row-val">{exportModel.companyName}</span>
        </div>
        <div class="form-row">
            <span class="row-label">{translationService.translate('compliance.attestation.item2_address')}</span>
            <span class="row-val">{companyAddressDisplay}</span>
        </div>
        <div class="form-row">
            <span class="row-label">{translationService.translate('compliance.attestation.item3_tel')}</span>
            <span class="row-val">{exportModel.companyTelephone}</span>
        </div>
        <div class="form-row">
            <span class="row-label">{translationService.translate('compliance.attestation.item4_fax')}</span>
            <span class="row-val">{exportModel.companyFax}</span>
        </div>
        <div class="form-row">
            <span class="row-label">{translationService.translate('compliance.attestation.item5_email')}</span>
            <span class="row-val">{exportModel.companyEmail}</span>
        </div>

        <div class="section-heading">
            {translationService.translate('compliance.attestation.undersigned')}
        </div>
        <div class="form-row">
            <span class="row-label">{translationService.translate('compliance.attestation.item6_name')}</span>
            <span class="row-val">{exportModel.managerName}</span>
        </div>
        <div class="form-row">
            <span class="row-label">{translationService.translate('compliance.attestation.item7_position')}</span>
            <span class="row-val">{exportModel.managerPosition}</span>
        </div>

        <div class="section-heading">
            {translationService.translate('compliance.attestation.declareDriver')}
        </div>
        <div class="form-row">
            <span class="row-label">{translationService.translate('compliance.attestation.item8_driverName')}</span>
            <span class="row-val">{exportModel.driverName}</span>
        </div>
        <div class="form-row">
            <span class="row-label">{translationService.translate('compliance.attestation.item9_birthDate')}</span>
            <span class="row-val">{exportModel.driverBirthDate}</span>
        </div>
        <div class="form-row">
            <span class="row-label">{translationService.translate('compliance.attestation.item10_licence')}</span>
            <span class="row-val">{exportModel.driverLicenceOrId}</span>
        </div>
        <div class="form-row">
            <span class="row-label">{translationService.translate('compliance.attestation.item11_employmentDate')}</span>
            <span class="row-val">{exportModel.driverEmploymentDate}</span>
        </div>

        <div class="section-heading">
            {translationService.translate('compliance.attestation.forPeriod')}
        </div>
        <div class="form-row">
            <span class="row-label">{translationService.translate('compliance.attestation.item12_from')}</span>
            <span class="row-val">{exportModel.periodFromFormatted}</span>
        </div>
        <div class="form-row">
            <span class="row-label">{translationService.translate('compliance.attestation.item13_to')}</span>
            <span class="row-val">{exportModel.periodToFormatted}</span>
        </div>

        <div class="checkboxes-list">
            <div class="cb-item" class:active={exportModel.box14_sickLeave}>
                <span class="cb-box">{checkbox(exportModel.box14_sickLeave)}</span>
                <span>{translationService.translate('compliance.attestation.item14_sickLeave')}</span>
            </div>
            <div class="cb-item" class:active={exportModel.box15_annualLeave}>
                <span class="cb-box">{checkbox(exportModel.box15_annualLeave)}</span>
                <span>{translationService.translate('compliance.attestation.item15_annualLeave')}</span>
            </div>
            <div class="cb-item" class:active={exportModel.box16_leaveOrRest}>
                <span class="cb-box">{checkbox(exportModel.box16_leaveOrRest)}</span>
                <span>{translationService.translate('compliance.attestation.item16_leaveOrRest')}</span>
            </div>
            <div class="cb-item" class:active={exportModel.box17_outOfScope}>
                <span class="cb-box">{checkbox(exportModel.box17_outOfScope)}</span>
                <span>{translationService.translate('compliance.attestation.item17_outOfScope')}</span>
            </div>
            <div class="cb-item" class:active={exportModel.box18_otherWork}>
                <span class="cb-box">{checkbox(exportModel.box18_otherWork)}</span>
                <span>{translationService.translate('compliance.attestation.item18_otherWork')}</span>
            </div>
            <div class="cb-item" class:active={exportModel.box19_available}>
                <span class="cb-box">{checkbox(exportModel.box19_available)}</span>
                <span>{translationService.translate('compliance.attestation.item19_available')}</span>
            </div>
        </div>

        <div class="sig-row">
            <div class="form-row">
                <span class="row-label">{translationService.translate('compliance.attestation.item20_place')}</span>
                <span class="row-val">{exportModel.companyCity}</span>
                <span class="row-label">{translationService.translate('compliance.attestation.date')}</span>
                <span class="row-val">{exportModel.dateFormatted}</span>
            </div>
            <div class="form-row">
                <span class="row-label">{translationService.translate('compliance.attestation.signature')}</span>
                <span class="sig-line-block" aria-hidden="true"></span>
            </div>
        </div>
    </div>

    <div class="driver-section">
        <div class="driver-confirm-text">
            {translationService.translate('compliance.attestation.item21_driverConfirm')}
        </div>
        <div class="sig-row">
            <div class="form-row">
                <span class="row-label">{translationService.translate('compliance.attestation.item22_place')}</span>
                <span class="row-val">{exportModel.companyCity}</span>
                <span class="row-label">{translationService.translate('compliance.attestation.date')}</span>
                <span class="row-val">{exportModel.dateFormatted}</span>
            </div>
            <div class="form-row">
                <span class="row-label">{translationService.translate('compliance.attestation.driverSignature')}</span>
                <span class="sig-line-block" aria-hidden="true"></span>
            </div>
        </div>
    </div>

    <div class="footnotes-section">
        <div>{translationService.translate('compliance.attestation.footnote1')}</div>
        <div>{translationService.translate('compliance.attestation.footnote2')}</div>
        <div>{translationService.translate('compliance.attestation.footnote3')}</div>
    </div>
</div>

<style>
    .attestation-sheet-preview {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        padding: var(--space-6);
        background: var(--color-surface);
        border: var(--border-panel);
        border-radius: var(--radius-panel);
    }

    .annex-header {
        text-align: center;
        font-weight: var(--font-weight-title);
        text-decoration: underline;
        font-size: var(--font-size-body);
        color: var(--color-text);
    }

    .form-title {
        font-size: var(--font-size-section);
        font-weight: var(--font-weight-title);
        text-align: center;
        color: var(--color-text);
        text-transform: uppercase;
        line-height: var(--line-height-heading);
    }

    .form-subtitle {
        font-size: var(--font-size-metadata);
        text-align: center;
        color: var(--color-text-muted);
    }

    .instruction-notice {
        font-size: var(--font-size-metadata);
        font-style: italic;
        text-align: center;
        color: var(--color-text-muted);
        line-height: var(--line-height-body);
    }

    .warning-notice {
        font-size: var(--font-size-metadata);
        font-weight: var(--font-weight-title);
        text-align: center;
        color: var(--color-text);
        text-transform: uppercase;
        margin-block-end: var(--space-2);
    }

    .undertaking-box {
        border: var(--border-panel);
        border-radius: var(--radius-control);
        padding: var(--space-4);
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        background: var(--color-surface);
    }

    .section-heading {
        font-weight: var(--font-weight-title);
        color: var(--color-text);
        margin-block-start: var(--space-2);
    }

    .section-heading:first-child {
        margin-block-start: var(--space-none);
    }

    .form-row {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: var(--space-2);
        font-size: var(--font-size-body);
    }

    .row-label {
        color: var(--color-text-muted);
    }

    .row-val {
        color: var(--color-text);
        font-weight: var(--font-weight-action);
        text-decoration: underline;
    }

    .checkboxes-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        margin-block: var(--space-2);
    }

    .cb-item {
        color: var(--color-text-muted);
        padding: var(--space-2) var(--space-3);
        border-radius: var(--radius-control);
        background: var(--color-surface-subtle);
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--font-size-body);
    }

    .cb-box {
        font-family: var(--font-family-source);
        font-weight: var(--font-weight-title);
    }

    .cb-item.active {
        color: var(--color-accent);
        font-weight: var(--font-weight-action);
        background: var(--color-accent-soft);
    }

    .sig-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        flex-wrap: wrap;
        gap: var(--space-3);
        margin-block-start: var(--space-3);
    }

    .sig-line-block {
        border-block-end: var(--border-panel);
        inline-size: var(--size-attestation-sig-line);
        block-size: var(--size-attestation-sig-block);
        display: inline-block;
    }

    .driver-section {
        border-radius: var(--radius-control);
        padding: var(--space-4);
        background: var(--color-surface-subtle);
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
    }

    .driver-confirm-text {
        font-weight: var(--font-weight-title);
        color: var(--color-text);
        font-size: var(--font-size-body);
        line-height: var(--line-height-body);
    }

    .footnotes-section {
        border-block-start: var(--border-subtle);
        padding-block-start: var(--space-3);
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        font-size: var(--font-size-metadata);
        color: var(--color-text-muted);
    }
</style>
