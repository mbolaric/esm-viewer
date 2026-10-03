<script lang="ts">
    import {
        integrityStatusIcon,
        translateGeneration,
        translateIntegrityDescription,
        translateIntegrityStatus,
    } from '../../helpers/viewer-labels.js';
    import type { JsonPointer, TachographWarningCode } from '#viewer-domain';
    import type { IDocumentOverviewViewModel, IdentityViewModel } from '#viewer-presentation';
    import { Button, focusOnMount, Icon, KpiCard, ReferenceLinkButton } from '#ui';

    import type { TranslationKey } from '#i18n-locales';
    import { useViewerTranslationService } from '../../viewer-context.js';

    interface IProps {
        onopenintegrity: () => void;
        onopensource: (path: JsonPointer) => void;
        onverify: () => void;
        verifying: boolean;
        viewModel: IDocumentOverviewViewModel;
    }

    let { onopenintegrity, onopensource, onverify, verifying, viewModel }: IProps = $props();

    const translationService = useViewerTranslationService();
    const warningTranslationKeys = {
        duplicateEvidence: 'overview.warnings.description.duplicateEvidence',
        inconsistentData: 'overview.warnings.description.inconsistentData',
        invalidValue: 'overview.warnings.description.invalidValue',
        missingValue: 'overview.warnings.description.missingValue',
        unsupportedData: 'overview.warnings.description.unsupportedData',
    } satisfies Readonly<Record<TachographWarningCode, TranslationKey>>;

    function displayValue(value: string | null): string {
        return value ?? translationService.translate('overview.identity.missing');
    }

    function registrationMemberState(identity: IdentityViewModel): string {
        return identity.kind === 'vehicle'
            ? displayValue(identity.registrationMemberState)
            : translationService.translate('overview.identity.missing');
    }

    function registrationNumber(identity: IdentityViewModel): string {
        return identity.kind === 'vehicle'
            ? displayValue(identity.registrationNumber)
            : translationService.translate('overview.identity.missing');
    }

    function vehicleIdentificationNumber(identity: IdentityViewModel): string {
        return identity.kind === 'vehicle'
            ? displayValue(identity.vehicleIdentificationNumber)
            : translationService.translate('overview.identity.missing');
    }
</script>

<article class="overview wide-workspace">
    <h1 tabindex="-1" use:focusOnMount>
        {translationService.translate('overview.heading')}
    </h1>

    <div class="kpi-hero-bar" aria-label={translationService.translate('overview.kpi.label')}>
        <KpiCard
            label={translationService.translate('overview.kpi.activeDays')}
            subtext={viewModel.coverage
                ? `${viewModel.coverage.start.display} – ${viewModel.coverage.end.display}`
                : translationService.translate('overview.kpi.noRange')}
            value={viewModel.counts.activityDays?.display ?? viewModel.counts.events.display}
        />

        <KpiCard
            label={viewModel.documentKind === 'driverCard'
                ? translationService.translate('overview.kpi.activityIntervals')
                : translationService.translate('overview.contents.events')}
            subtext={`${viewModel.byteLength.display} (${viewModel.generationDisplay})`}
            value={viewModel.documentKind === 'driverCard'
                ? viewModel.counts.recordedActivityIntervals.display
                : viewModel.counts.events.display}
        />

        <KpiCard
            label={translationService.translate('overview.kpi.eventsFaults')}
            subtext={translationService.translate('overview.kpi.eventsFaultsSubtext', {
                events: viewModel.counts.events.display,
                faults: viewModel.counts.faults.display,
            })}
            value={viewModel.counts.totalEventsAndFaults.display}
        />

        <KpiCard
            label={translationService.translate('overview.kpi.warnings')}
            subtext={viewModel.warnings.length === 0
                ? translationService.translate('overview.kpi.noWarnings')
                : translationService.translate('overview.kpi.warningsCount', {
                      count: String(viewModel.warnings.length),
                  })}
            tone={viewModel.warnings.length === 0 ? 'success' : 'warning'}
            value={viewModel.warnings.length}
        />

        <KpiCard
            label={translationService.translate('overview.kpi.securityAlerts')}
            subtext={viewModel.securityCriticalCount.value === 0
                ? translationService.translate('overview.kpi.noSecurityAlerts')
                : translationService.translate('overview.kpi.securityAlertsSubtext', {
                      count: viewModel.securityCriticalCount.display,
                  })}
            tone={viewModel.securityCriticalCount.value === 0 ? 'success' : 'warning'}
            value={viewModel.securityCriticalCount.display}
        />
    </div>

    <div class="overview-bento-grid">
        <section class="evidence-panel bento-card bento-hero" aria-labelledby="overview-identity-heading">
            <h2 id="overview-identity-heading">
                {translationService.translate('overview.identity.heading')}
            </h2>
            {#if viewModel.identities.length === 0}
                <p>{translationService.translate('overview.identity.empty')}</p>
            {:else}
                <div class="identity-list">
                    {#each viewModel.identities as identity (identity.identity)}
                        <section class="identity-record">
                            <div class="identity-hero-header">
                                <div class="identity-hero-title-group">
                                    <h3 class="identity-subheading">
                                        {identity.kind === 'driver'
                                            ? translationService.translate('overview.identity.driver')
                                            : translationService.translate('overview.identity.vehicle')}
                                    </h3>
                                    <div class="identity-hero-title">
                                        <Icon name={identity.kind === 'driver' ? 'creditCard' : 'truck'} />
                                        <span class="identity-hero-name">
                                            {#if identity.kind === 'driver'}
                                                <span>{displayValue(identity.identity.firstNames)}</span>
                                                <span>{displayValue(identity.identity.surname)}</span>
                                            {:else}
                                                <span>{registrationNumber(identity)}</span>
                                            {/if}
                                        </span>
                                    </div>
                                </div>
                                <div class="identity-badges">
                                    <span class="badge badge-accent">
                                        {identity.kind === 'driver'
                                            ? displayValue(identity.identity.issuingMemberState)
                                            : registrationMemberState(identity)}
                                    </span>
                                </div>
                            </div>

                            <dl class="evidence-details bento-details">
                                {#if identity.kind === 'driver'}
                                    <div>
                                        <dt>{translationService.translate('overview.identity.cardNumber')}</dt>
                                        <dd><code>{identity.identity.cardNumber}</code></dd>
                                    </div>
                                    <div>
                                        <dt>{translationService.translate('overview.identity.cardHolderBirthDate')}</dt>
                                        <dd>
                                            {identity.cardHolderBirthDate?.display ??
                                                translationService.translate('overview.identity.missing')}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>{translationService.translate('overview.identity.issuingMemberState')}</dt>
                                        <dd>{displayValue(identity.identity.issuingMemberState)}</dd>
                                    </div>
                                    <div>
                                        <dt>{translationService.translate('overview.identity.cardIssueDate')}</dt>
                                        <dd>
                                            {identity.cardIssueDate?.display ??
                                                translationService.translate('overview.identity.missing')}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>{translationService.translate('overview.identity.cardValidityBegin')}</dt>
                                        <dd>
                                            {identity.cardValidityBegin?.display ??
                                                translationService.translate('overview.identity.missing')}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>{translationService.translate('overview.identity.cardExpiryDate')}</dt>
                                        <dd>
                                            {identity.cardExpiryDate?.display ??
                                                translationService.translate('overview.identity.missing')}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>{translationService.translate('overview.identity.cardIssuingAuthorityName')}</dt>
                                        <dd>
                                            {identity.cardIssuingAuthorityName ??
                                                translationService.translate('overview.identity.missing')}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>{translationService.translate('technical.field.licenceNumber')}</dt>
                                        <dd>{displayValue(identity.licenceNumber)}</dd>
                                    </div>
                                    <div>
                                        <dt>{translationService.translate('technical.field.licenceIssuingAuthority')}</dt>
                                        <dd>{displayValue(identity.licenceIssuingAuthority)}</dd>
                                    </div>
                                    <div>
                                        <dt>{translationService.translate('technical.field.licenceIssuingMemberState')}</dt>
                                        <dd>{displayValue(identity.licenceIssuingMemberState)}</dd>
                                    </div>
                                {:else}
                                    <div>
                                        <dt>{translationService.translate('overview.identity.registrationMemberState')}</dt>
                                        <dd>{registrationMemberState(identity)}</dd>
                                    </div>
                                    <div>
                                        <dt>{translationService.translate('overview.identity.vehicleIdentificationNumber')}</dt>
                                        <dd><code>{vehicleIdentificationNumber(identity)}</code></dd>
                                    </div>
                                {/if}
                                <div class="full-width-detail">
                                    <dt>{translationService.translate('overview.identity.sourceReference')}</dt>
                                    <dd class="source-reference">
                                        <code>{identity.identity.source.path}</code>
                                        <ReferenceLinkButton
                                            onopen={() => onopensource(identity.identity.source.path)}
                                            openLabel={translationService.translate('overview.openSource')}
                                            path={identity.identity.source.path}
                                        />
                                    </dd>
                                </div>
                            </dl>
                        </section>
                    {/each}
                </div>
            {/if}
        </section>

        <section class="evidence-panel bento-card bento-side" aria-labelledby="overview-document-heading">
            <h2 id="overview-document-heading">
                {translationService.translate('overview.documentHeading')}
            </h2>
            <dl class="evidence-details bento-details">
                {#if viewModel.applicationGenerations.length > 1}
                    <div class="full-width-detail">
                        <dt>{translationService.translate('overview.applications')}</dt>
                        <dd>
                            {viewModel.applicationGenerations
                                .map((generation) => translateGeneration(generation, translationService))
                                .join(', ')}
                        </dd>
                    </div>
                {/if}
                <div>
                    <dt>{translationService.translate('overview.fileSizeBytes')}</dt>
                    <dd>{viewModel.byteLength.display}</dd>
                </div>
                <div>
                    <dt>{translationService.translate('overview.openedAt')}</dt>
                    <dd>{viewModel.openedAt.display}</dd>
                </div>
                {#if viewModel.coverage === null}
                    <div class="full-width-detail">
                        <dt>{translationService.translate('overview.coverageStart')}</dt>
                        <dd>{translationService.translate('overview.coverageEmpty')}</dd>
                    </div>
                {:else}
                    <div>
                        <dt>{translationService.translate('overview.coverageStart')}</dt>
                        <dd>{viewModel.coverage.start.display}</dd>
                    </div>
                    <div>
                        <dt>{translationService.translate('overview.coverageEnd')}</dt>
                        <dd>{viewModel.coverage.end.display}</dd>
                    </div>
                {/if}
                <div class="full-width-detail">
                    <dt>{translationService.translate('overview.sha256')}</dt>
                    <dd><code>{viewModel.sha256}</code></dd>
                </div>
            </dl>

            <div class="bento-subpanel">
                <h3 class="bento-subheading">{translationService.translate('overview.contents.heading')}</h3>
                <dl class="evidence-details bento-details">
                    {#if viewModel.documentKind === 'driverCard'}
                        <div>
                            <dt>{translationService.translate('overview.contents.activityDays')}</dt>
                            <dd>{viewModel.counts.activityDays.display}</dd>
                        </div>
                        <div>
                            <dt>{translationService.translate('overview.contents.recordedActivityIntervals')}</dt>
                            <dd>{viewModel.counts.recordedActivityIntervals.display}</dd>
                        </div>
                        <div>
                            <dt>{translationService.translate('overview.contents.inferredActivityGaps')}</dt>
                            <dd>{viewModel.counts.inferredActivityGaps.display}</dd>
                        </div>
                    {/if}
                    <div>
                        <dt>{translationService.translate('overview.contents.events')}</dt>
                        <dd>{viewModel.counts.events.display}</dd>
                    </div>
                    <div>
                        <dt>{translationService.translate('overview.contents.faults')}</dt>
                        <dd>{viewModel.counts.faults.display}</dd>
                    </div>
                    <div>
                        <dt>{translationService.translate('overview.contents.warnings')}</dt>
                        <dd>{viewModel.counts.warnings.display}</dd>
                    </div>
                </dl>
                {#if viewModel.documentKind === 'driverCard'}
                    <p class="note">
                        {translationService.translate('overview.contents.viewerCalculationNote')}
                    </p>
                {/if}
            </div>
        </section>

        <section class="evidence-panel bento-card bento-half" aria-labelledby="overview-integrity-heading">
            <div class="bento-header-with-status">
                <h2 id="overview-integrity-heading">
                    {translationService.translate('overview.integrity')}
                </h2>
                <span class="badge badge-integrity" data-status={viewModel.integrity.status}>
                    <Icon name={integrityStatusIcon(viewModel.integrity.status)} size="small" />
                    {translateIntegrityStatus(viewModel.integrity.status, translationService)}
                </span>
            </div>
            <dl class="evidence-details bento-details">
                <div>
                    <dt>{translationService.translate('overview.integrity.status')}</dt>
                    <dd class="integrity-value" data-status={viewModel.integrity.status}>
                        {translateIntegrityStatus(viewModel.integrity.status, translationService)}
                    </dd>
                </div>
                {#if viewModel.integrity.checkedItems.value > 0}
                    <div>
                        <dt>{translationService.translate('overview.integrity.checkedItems')}</dt>
                        <dd>{viewModel.integrity.checkedItems.display}</dd>
                    </div>
                    <div>
                        <dt>{translationService.translate('overview.integrity.validItems')}</dt>
                        <dd>{viewModel.integrity.validItems.display}</dd>
                    </div>
                    <div>
                        <dt>{translationService.translate('overview.integrity.invalidItems')}</dt>
                        <dd>{viewModel.integrity.invalidItems.display}</dd>
                    </div>
                {/if}
            </dl>
            <p class="note">
                {translateIntegrityDescription(viewModel.integrity.assessment, translationService)}
            </p>
            <p class="note">
                {translationService.translate('integrity.parsedIndependently')}
            </p>
            <div class="integrity-actions">
                <Button label={translationService.translate('integrity.viewEvidence')} onclick={onopenintegrity} />
                {#if viewModel.integrity.status === 'notChecked'}
                    <Button
                        disabled={verifying}
                        label={verifying
                            ? translationService.translate('integrity.verifyingSignatures')
                            : translationService.translate('integrity.verifySignatures')}
                        onclick={onverify}
                        variant="primary"
                    />
                {/if}
            </div>
        </section>

        <section class="evidence-panel bento-card bento-half" aria-labelledby="overview-warnings-heading">
            <div class="bento-header-with-status">
                <h2 id="overview-warnings-heading">
                    {translationService.translate('overview.warnings.heading')}
                </h2>
                <span
                    class="badge {viewModel.warnings.length === 0 ? 'badge-integrity' : 'badge-warning'}"
                    data-status={viewModel.warnings.length === 0 ? 'valid' : 'partiallyValid'}
                >
                    {viewModel.warnings.length}
                </span>
            </div>
            {#if viewModel.warnings.length === 0}
                <p>{translationService.translate('overview.warnings.empty')}</p>
            {:else}
                <ul class="warning-list">
                    {#each viewModel.warnings as warning (warning)}
                        <li>
                            <div class="warning-content">
                                <strong>
                                    {translationService.translate(warningTranslationKeys[warning.code])}
                                </strong>
                                <span>
                                    {translationService.translate('overview.warnings.sourceReference')}
                                    <code>{warning.source.path}</code>
                                </span>
                            </div>
                            <span class="warning-action">
                                <ReferenceLinkButton
                                    onopen={() => onopensource(warning.source.path)}
                                    openLabel={translationService.translate('overview.openSource')}
                                    path={warning.source.path}
                                />
                            </span>
                        </li>
                    {/each}
                </ul>
            {/if}
        </section>

        {#if viewModel.cardNotes.length > 0}
            <section class="evidence-panel bento-card bento-full" aria-labelledby="overview-card-notes-heading">
                <h2 id="overview-card-notes-heading">
                    {translationService.translate('overview.cardNotes.heading')}
                </h2>
                <div class="card-notes-list">
                    {#each viewModel.cardNotes as note (note.source.path)}
                        <section class="card-notes-record">
                            <dl class="evidence-details bento-details">
                                <div class="full-width-detail">
                                    <dt>{translationService.translate('overview.generation')}</dt>
                                    <dd>{translateGeneration(note.generation, translationService)}</dd>
                                </div>
                                <div class="full-width-detail">
                                    <dt>{translationService.translate('overview.cardNotes.text')}</dt>
                                    <dd>{note.text}</dd>
                                </div>
                                <div class="full-width-detail">
                                    <dt>{translationService.translate('overview.identity.sourceReference')}</dt>
                                    <dd class="source-reference">
                                        <code>{note.source.path}</code>
                                        <ReferenceLinkButton
                                            onopen={() => onopensource(note.source.path)}
                                            openLabel={translationService.translate('overview.openSource')}
                                            path={note.source.path}
                                        />
                                    </dd>
                                </div>
                            </dl>
                        </section>
                    {/each}
                </div>
            </section>
        {/if}
    </div>
</article>

<style>
    .overview-bento-grid {
        display: grid;
        grid-template-columns: var(--layout-overview-bento-columns);
        gap: var(--space-section);
    }

    .bento-card {
        display: grid;
        align-content: start;
        gap: var(--space-stack);
    }

    .bento-hero {
        grid-column: var(--layout-overview-bento-hero-span);
    }

    .bento-side {
        grid-column: var(--layout-overview-bento-side-span);
    }

    .bento-half {
        grid-column: var(--layout-overview-bento-half-span);
    }

    .bento-full {
        grid-column: var(--layout-overview-bento-full-span);
    }

    .identity-hero-header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-actions);
        padding-block-end: var(--space-actions);
        border-block-end: var(--border-region);
        margin-block-end: var(--space-stack);
    }

    .identity-hero-title-group {
        display: grid;
        gap: var(--space-compact);
    }

    .identity-subheading {
        margin: var(--space-none);
        font-size: var(--font-size-metadata);
        font-weight: var(--font-weight-action);
        color: var(--color-text-muted);
        text-transform: var(--text-transform-group);
        letter-spacing: var(--letter-spacing-group);
    }

    .identity-hero-title {
        display: flex;
        align-items: center;
        gap: var(--space-actions);
        font-size: var(--font-size-section);
        font-weight: var(--font-weight-title);
    }

    .identity-hero-name {
        display: inline-flex;
        flex-wrap: wrap;
        gap: var(--space-compact);
        overflow-wrap: anywhere;
    }

    .identity-badges {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-compact);
    }

    .bento-header-with-status {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-actions);
        padding-block-end: var(--space-actions);
        border-block-end: var(--border-region);
    }

    .bento-header-with-status > h2 {
        padding-block-end: var(--space-none);
        border-block-end: none;
        margin: var(--space-none);
    }

    .bento-details {
        display: grid;
        grid-template-columns: var(--layout-overview-bento-details-columns);
        gap: var(--space-stack);
    }

    .bento-details > div {
        display: grid;
        grid-template-columns: var(--layout-overview-bento-item-columns);
        gap: var(--space-compact);
        min-inline-size: var(--space-none);
        padding-block: var(--space-row-block);
        border-block-end: var(--border-region);
    }

    .bento-details > div:last-child {
        border-block-end: var(--border-region);
    }

    .bento-details > div.full-width-detail {
        grid-column: var(--grid-column-full);
    }

    .bento-subpanel {
        display: grid;
        gap: var(--space-stack);
    }

    .bento-subheading {
        margin: var(--space-none);
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-title);
    }

    .identity-list,
    .identity-record,
    .warning-list {
        display: grid;
        gap: var(--space-stack);
    }

    .card-notes-list,
    .card-notes-record {
        display: grid;
        gap: var(--space-stack);
    }

    .source-reference {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-start;
        gap: var(--space-compact);
        vertical-align: middle;
    }

    .identity-record + .identity-record {
        padding-block-start: var(--space-stack);
        border-block-start: var(--border-region);
    }

    .card-notes-record + .card-notes-record {
        padding-block-start: var(--space-stack);
        border-block-start: var(--border-region);
    }

    dt,
    .note,
    .warning-list span {
        color: var(--color-text-muted);
    }

    dt,
    .warning-list span {
        font-size: var(--font-size-metadata);
    }

    dt {
        min-inline-size: var(--space-none);
        overflow-wrap: break-word;
        font-weight: var(--font-weight-action);
    }

    dd,
    code {
        min-inline-size: var(--space-none);
        overflow-wrap: anywhere;
        word-break: break-all;
    }

    code {
        font-family: var(--font-family-source);
    }

    .warning-list {
        padding: var(--space-none);
        list-style: none;
        inline-size: var(--size-full);
        max-inline-size: var(--size-full);
        min-inline-size: var(--size-zero);
    }

    .warning-list li {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-actions);
        padding-block: var(--space-row-block);
        border-block-end: var(--border-region);
        inline-size: var(--size-full);
        max-inline-size: var(--size-full);
        min-inline-size: var(--size-zero);
    }

    .warning-list li:last-child {
        border-block-end: none;
    }

    .warning-content {
        display: grid;
        flex: var(--layout-overview-warning-flex);
        min-inline-size: var(--space-none);
        max-inline-size: var(--size-full);
        gap: var(--space-compact);
        overflow-wrap: anywhere;
        word-break: break-word;
    }

    .warning-content strong {
        overflow-wrap: anywhere;
        word-break: break-word;
    }

    .warning-action {
        flex: var(--layout-overview-action-flex);
        display: flex;
        align-items: center;
    }

    .integrity-value {
        font-weight: var(--font-weight-action);
    }

    .integrity-value[data-status='valid'] {
        color: var(--color-success);
    }

    .integrity-value[data-status='partiallyValid'] {
        color: var(--color-warning);
    }

    .integrity-value[data-status='failed'],
    .integrity-value[data-status='invalid'] {
        color: var(--color-danger);
    }

    .integrity-value[data-status='notChecked'],
    .integrity-value[data-status='unsupported'] {
        color: var(--color-text-muted);
    }

    .integrity-actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-actions);
    }

    .kpi-hero-bar {
        grid-template-columns: var(--layout-overview-count-columns);
    }
</style>
