<script lang="ts">
    import { createViewerDataTableLabels } from '../../helpers/data-table-labels.js';
    import {
        integrityStatusIcon,
        translateGeneration,
        translateIntegrityDescription,
        translateIntegrityLimitation,
        translateIntegrityStatus,
    } from '../../helpers/viewer-labels.js';
    import { Button, createStandardSortValue, DataTable, focusOnMount, Icon, type IconName, ReferenceLinkButton } from '#ui';
    import type { IntegrityItem, IntegrityItemStatus, JsonPointer } from '#viewer-domain';
    import type { IIntegrityDetailViewModel } from '#viewer-presentation';

    import { TableToolingController } from '../../controllers/table-tooling-controller.svelte.js';
    import type { IDocumentScopedValue } from '../../controllers/document-scoped-value.svelte.js';
    import { useViewerTranslationService } from '../../viewer-context.js';

    interface IProps {
        filterText: IDocumentScopedValue<string>;
        onopensource: (path: JsonPointer) => void;
        onverify: () => void;
        verifying: boolean;
        viewModel: IIntegrityDetailViewModel;
    }

    let { filterText, onopensource, onverify, verifying, viewModel }: IProps = $props();

    const translationService = useViewerTranslationService();
    const itemColumns = $derived([
        {
            cell: statusCell,
            id: 'status',
            label: translationService.translate('integrity.scopeStatus'),
            sortable: true,
        },
        {
            cell: generationCell,
            id: 'generation',
            label: translationService.translate('integrity.generation'),
            sortable: true,
        },
        {
            cell: recordCell,
            id: 'record',
            label: translationService.translate('integrity.record'),
            sortable: true,
        },
        {
            cell: evidenceCell,
            id: 'evidence',
            label: translationService.translate('integrity.evidence'),
            sortable: true,
        },
    ]);
    const itemTooling = new TableToolingController<IntegrityItem>({
        columns: () => itemColumns,
        filterText: () => filterText,
        filterValues: (item) => [
            item.recordId,
            item.source.path,
            translateIntegrityStatus(item.status, translationService),
            translateGeneration(item.generation, translationService),
        ],
        sortValue: createStandardSortValue({
            status: (item) => item.status,
            generation: (item) => item.generation,
            record: (item) => item.recordId,
            evidence: (item) => item.source.path,
        }),
    });

    function itemIcon(statusValue: IntegrityItemStatus): IconName {
        switch (statusValue) {
            case 'invalid':
                return 'circleX';
            case 'valid':
                return 'circleCheck';
        }
    }

    function itemKey(item: IntegrityItem): string {
        return `${item.generation}:${item.recordId}:${item.source.path}`;
    }

    const tableLabels = $derived(createViewerDataTableLabels(translationService));
</script>

{#snippet statusCell(item: IntegrityItem)}
    <span class="status-line" data-status={item.status}>
        <Icon name={itemIcon(item.status)} />
        {translateIntegrityStatus(item.status, translationService)}
    </span>
{/snippet}

{#snippet generationCell(item: IntegrityItem)}
    {translateGeneration(item.generation, translationService)}
{/snippet}

{#snippet recordCell(item: IntegrityItem)}
    <code>{item.recordId}</code>
{/snippet}

{#snippet evidenceCell(item: IntegrityItem)}
    <div class="source-evidence">
        <ReferenceLinkButton
            onopen={() => onopensource(item.source.path)}
            openLabel={translationService.translate('overview.openSource')}
            path={item.source.path}
        />
    </div>
{/snippet}

<article class="integrity-detail">
    <header class="evidence-panel">
        <h1 tabindex="-1" use:focusOnMount>
            {translationService.translate('overview.integrity')}
        </h1>
        <p class="status-line" data-status={viewModel.assessment.status}>
            <Icon name={integrityStatusIcon(viewModel.assessment.status)} />
            <strong>
                {translateIntegrityStatus(viewModel.assessment.status, translationService)}
            </strong>
            {#if viewModel.assessment.status === 'notChecked'}
                <span class="verify-action">
                    <Button
                        disabled={verifying}
                        label={verifying
                            ? translationService.translate('integrity.verifyingSignatures')
                            : translationService.translate('integrity.verifySignatures')}
                        onclick={onverify}
                        variant="primary"
                    />
                </span>
            {/if}
        </p>
        <p>{translateIntegrityDescription(viewModel.assessment, translationService)}</p>
        <p class="note">{translationService.translate('integrity.parsedIndependently')}</p>
    </header>

    <section class="evidence-panel" aria-labelledby="integrity-summary-heading">
        <h2 id="integrity-summary-heading">
            {translationService.translate('overview.integrity.status')}
        </h2>
        <dl class="count-details">
            <div>
                <dt>{translationService.translate('overview.integrity.checkedItems')}</dt>
                <dd>{viewModel.checkedItems.display}</dd>
            </div>
            <div>
                <dt>{translationService.translate('overview.integrity.validItems')}</dt>
                <dd>{viewModel.validItems.display}</dd>
            </div>
            <div>
                <dt>{translationService.translate('overview.integrity.invalidItems')}</dt>
                <dd>{viewModel.invalidItems.display}</dd>
            </div>
        </dl>
    </section>

    <div class="evidence-grid">
        <section class="evidence-panel" aria-labelledby="integrity-scope-heading">
            <h2 id="integrity-scope-heading">
                {translationService.translate('integrity.scopeHeading')}
            </h2>
            <ul class="scope-list">
                {#each viewModel.scopes as scope (scope.source.path)}
                    {@const assessment = scope.assessment}
                    <li>
                        <div class="scope-heading">
                            <strong>
                                {translateGeneration(scope.applicationGeneration, translationService)}
                            </strong>
                            <span class="status-line" data-status={assessment === null ? 'notChecked' : assessment.status}>
                                <Icon name={assessment === null ? 'circleHelp' : integrityStatusIcon(assessment.status)} />
                                {assessment === null
                                    ? translationService.translate('integrity.noCheckedItems')
                                    : translateIntegrityStatus(assessment.status, translationService)}
                            </span>
                        </div>
                        <dl class="evidence-details">
                            {#if scope.verificationGeneration !== null}
                                <div>
                                    <dt>
                                        {translationService.translate('integrity.verificationGeneration')}
                                    </dt>
                                    <dd>
                                        {translateGeneration(scope.verificationGeneration, translationService)}
                                    </dd>
                                </div>
                            {/if}
                            <div>
                                <dt>
                                    {translationService.translate('overview.integrity.checkedItems')}
                                </dt>
                                <dd>{scope.checkedItems.display}</dd>
                            </div>
                            <div>
                                <dt>{translationService.translate('integrity.scopeSource')}</dt>
                                <dd class="source-evidence">
                                    <code>{scope.source.path}</code>
                                    <ReferenceLinkButton
                                        onopen={() => onopensource(scope.source.path)}
                                        openLabel={translationService.translate('overview.openSource')}
                                        path={scope.source.path}
                                    />
                                </dd>
                            </div>
                        </dl>
                    </li>
                {/each}
            </ul>
        </section>

        <section class="evidence-panel" aria-labelledby="integrity-limitations-heading">
            <h2 id="integrity-limitations-heading">
                {translationService.translate('integrity.limitationsHeading')}
            </h2>
            <p>
                {translateIntegrityLimitation(viewModel.assessment, translationService) ??
                    translationService.translate('integrity.noLimitations')}
            </p>
        </section>
    </div>

    <section class="evidence-panel" aria-labelledby="integrity-items-heading">
        <h2 id="integrity-items-heading">
            {translationService.translate('integrity.verificationItemsHeading')}
        </h2>
        {#if viewModel.items.length === 0}
            <p>{translationService.translate('integrity.verificationItemsEmpty')}</p>
        {:else}
            {@const integrityTableSnapshot = itemTooling.snapshot(viewModel.items)}
            <DataTable
                labels={tableLabels}
                tooling={itemTooling}
                caption={translationService.translate('integrity.verificationItemsHeading')}
                columns={itemColumns}
                filterSummaryLabel={translationService.translate('table.filterResultCount', {
                    shown: String(integrityTableSnapshot.rows.length),
                    total: String(viewModel.items.length),
                })}
                rowKey={itemKey}
                rows={integrityTableSnapshot.rows}
            />
        {/if}
    </section>
</article>

<style>
    .integrity-detail,
    .scope-list,
    .scope-list li,
    .source-evidence {
        display: grid;
        gap: var(--space-stack);
    }

    .integrity-detail {
        inline-size: var(--size-full);
        max-inline-size: var(--size-content-wide);
        margin-inline: auto;
        gap: var(--space-section);
    }

    .scope-heading {
        display: flex;
        align-items: center;
        gap: var(--space-actions);
    }

    .verify-action {
        margin-inline-start: auto;
    }

    /* Reserves control height on status line to prevent header height jump when verify button unmounts. */
    header .status-line {
        min-block-size: var(--size-control);
    }

    .scope-heading {
        flex-wrap: wrap;
        justify-content: space-between;
    }

    .count-details {
        display: grid;
        grid-template-columns: var(--layout-integrity-counts);
        gap: var(--space-actions);
    }

    .count-details > div {
        display: grid;
        gap: var(--space-compact);
        padding: var(--space-actions);
        background: var(--color-surface-subtle);
        border-radius: var(--radius-control);
    }

    .evidence-grid {
        display: grid;
        grid-template-columns: var(--layout-integrity-columns);
        align-items: start;
        gap: var(--space-shell);
    }

    .scope-list {
        padding: var(--space-none);
        list-style: none;
    }

    .scope-list li {
        padding: var(--space-panel);
        background: var(--color-surface-subtle);
        border: var(--border-panel);
        border-radius: var(--radius-panel);
    }

    .note,
    dt {
        color: var(--color-text-muted);
    }

    dt {
        font-size: var(--font-size-metadata);
        font-weight: var(--font-weight-action);
    }

    .source-evidence {
        justify-items: start;
    }

    dd.source-evidence {
        display: inline-flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-compact);
        vertical-align: middle;
    }

    code {
        overflow-wrap: anywhere;
        font-family: var(--font-family-source);
    }
</style>
