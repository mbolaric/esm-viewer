<script lang="ts">
    import { createViewerDataTableLabels } from '../../helpers/data-table-labels.js';
    import {
        translateGeneration,
        translateTechnicalField,
        translateTechnicalFieldValue,
        translateTechnicalRecordKind,
    } from '../../helpers/viewer-labels.js';
    import { Button, createStandardSortValue, DataTable, ReferenceLink } from '#ui';
    import type { DocumentSectionRecord } from '#viewer-application';
    import RecordSectionLayout from '../records/RecordSectionLayout.svelte';
    import type { DocumentKind, JsonPointer, TachographTechnicalRecord } from '#viewer-domain';
    import type { ITechnicalFieldViewModel, ITechnicalRecordViewModel, ITechnicalSectionViewModel } from '#viewer-presentation';
    import type { TranslationKey } from '#i18n-locales';
    import { TableToolingController } from '../../controllers/table-tooling-controller.svelte.js';
    import type { IDocumentScopedValue } from '../../controllers/document-scoped-value.svelte.js';
    import { useViewerTranslationService } from '../../viewer-context.js';

    type TechnicalDocumentLabel =
        | 'description'
        | 'emptyIdentification'
        | 'emptyOperational'
        | 'heading'
        | 'identificationHeading'
        | 'operationalCaption'
        | 'operationalHeading';

    interface IProps {
        documentKind: DocumentKind;
        filterText: IDocumentScopedValue<string>;
        oncopy: (value: string) => Promise<boolean>;
        onopensource: (path: JsonPointer) => void;
        onselectrecord: (record: TachographTechnicalRecord) => void;
        selectedRecord: DocumentSectionRecord | null;
        viewModel: ITechnicalSectionViewModel | null;
    }

    let { documentKind, filterText, oncopy, onopensource, onselectrecord, selectedRecord, viewModel }: IProps = $props();

    const translationService = useViewerTranslationService();
    const documentTranslationKeys = {
        driverCard: {
            description: 'technical.description',
            emptyIdentification: 'technical.emptyIdentification',
            emptyOperational: 'technical.emptyOperational',
            heading: 'technical.heading',
            identificationHeading: 'technical.identificationHeading',
            operationalCaption: 'technical.operationalCaption',
            operationalHeading: 'technical.operationalHeading',
        },
        vehicleUnit: {
            description: 'technical.vehicleUnit.description',
            emptyIdentification: 'technical.vehicleUnit.emptyIdentification',
            emptyOperational: 'technical.vehicleUnit.emptyOperational',
            heading: 'technical.vehicleUnit.heading',
            identificationHeading: 'technical.vehicleUnit.identificationHeading',
            operationalCaption: 'technical.vehicleUnit.operationalCaption',
            operationalHeading: 'technical.vehicleUnit.operationalHeading',
        },
    } satisfies Readonly<Record<DocumentKind, Readonly<Record<TechnicalDocumentLabel, TranslationKey>>>>;
    let copyStatus = $state<'failed' | 'idle' | 'succeeded'>('idle');
    const columns = $derived([
        {
            cell: typeCell,
            id: 'type',
            label: translationService.translate('eventsFaults.type'),
            sortable: true,
        },
        {
            cell: recordedAtCell,
            cellClass: 'numeric-value',
            id: 'recordedAt',
            label: translationService.translate('places.recordedTime'),
            sortable: true,
        },
        {
            cell: detailsCell,
            id: 'details',
            label: translationService.translate('technical.operationalDetails'),
            sortable: true,
        },
        {
            cell: sourceCell,
            id: 'source',
            label: translationService.translate('eventsFaults.source'),
            sortable: true,
        },
    ]);
    const operationalTooling = new TableToolingController<ITechnicalRecordViewModel>({
        columns: () => columns,
        filterText: () => filterText,
        filterValues: (record) => [
            translateTechnicalRecordKind(record.kind, translationService),
            record.recordedAt ?? '',
            ...record.fields.flatMap((field) => [translateTechnicalField(field.key, translationService), fieldValueText(field)]),
            record.source.path,
        ],
        sortValue: createStandardSortValue({
            type: (record) => record.kind,
            recordedAt: (record) => record.recordedAtTimestamp,
            details: (record) => record.fields.map((field) => fieldValueText(field)).join(' '),
            source: (record) => record.source.path,
        }),
    });

    function documentLabel(label: TechnicalDocumentLabel): string {
        return translationService.translate(documentTranslationKeys[documentKind][label]);
    }

    function fieldValueText(field: ITechnicalFieldViewModel): string {
        return translateTechnicalFieldValue(field, translationService);
    }

    function recordKey(record: ITechnicalRecordViewModel): string {
        return `${record.kind}:${record.source.path}`;
    }

    function recordSelectionLabel(record: ITechnicalRecordViewModel): string {
        return `${translationService.translate('technical.selectRecord')}: ${translateTechnicalRecordKind(
            record.kind,
            translationService,
        )}`;
    }

    async function copyField(value: string): Promise<void> {
        copyStatus = (await oncopy(value)) ? 'succeeded' : 'failed';
    }
    function isRecordSelected(record: ITechnicalRecordViewModel): boolean {
        return record.record === selectedRecord;
    }

    const tableLabels = $derived(createViewerDataTableLabels(translationService));
</script>

{#snippet fieldValue(field: ITechnicalFieldViewModel)}
    {@const text = translateTechnicalFieldValue(field, translationService)}
    <span class="field-value-inline">
        {#if field.value.kind === 'display' && field.value.code}
            <code>{text}</code>
        {:else}
            <span>{text}</span>
        {/if}
        {#if field.value.kind === 'display' && field.value.copyValue !== null}
            <Button
                ariaLabel={`${translationService.translate('technical.copyValue')}: ${translateTechnicalField(field.key, translationService)}`}
                icon="copy"
                iconOnly={true}
                label={translationService.translate('technical.copyValue')}
                onclick={() => {
                    const copyValue = field.value.kind === 'display' ? field.value.copyValue : null;
                    if (copyValue !== null) {
                        void copyField(copyValue);
                    }
                }}
                size="compact"
                tooltip={translationService.translate('technical.copyValue')}
                variant="ghost"
            />
        {/if}
    </span>
{/snippet}

{#snippet sourceEvidence(record: ITechnicalRecordViewModel)}
    <ReferenceLink
        generation={translateGeneration(record.generation, translationService)}
        onopen={() => onopensource(record.source.path)}
        openLabel={translationService.translate('overview.openSource')}
        path={record.source.path}
    />
{/snippet}

{#snippet typeCell(record: ITechnicalRecordViewModel)}
    {@const selected = isRecordSelected(record)}
    <Button
        ariaLabel={recordSelectionLabel(record)}
        label={translateTechnicalRecordKind(record.kind, translationService)}
        onclick={() => onselectrecord(record.record)}
        pressed={selected}
        size="compact"
        variant="ghost"
    />
{/snippet}

{#snippet recordedAtCell(record: ITechnicalRecordViewModel)}
    {record.recordedAt ?? translationService.translate('overview.identity.missing')}
{/snippet}

{#snippet detailsCell(record: ITechnicalRecordViewModel)}
    {#if record.fields.length === 0}
        <span>{translationService.translate('overview.identity.missing')}</span>
    {:else}
        <dl class="evidence-details dense">
            {#each record.fields as field (field.key)}
                <div>
                    <dt>{translateTechnicalField(field.key, translationService)}</dt>
                    <dd>{@render fieldValue(field)}</dd>
                </div>
            {/each}
        </dl>
    {/if}
{/snippet}

{#snippet sourceCell(record: ITechnicalRecordViewModel)}
    {@render sourceEvidence(record)}
{/snippet}

<RecordSectionLayout
    className="technical-screen record-workspace wide-workspace"
    description={documentLabel('description')}
    errorDescription={translationService.translate('technical.error')}
    errorHeading={translationService.translate('technical.errorHeading')}
    errorHeadingId="technical-error-heading"
    heading={documentLabel('heading')}
    {viewModel}
>
    {#snippet content(viewModel: ITechnicalSectionViewModel)}
        <section class="evidence-panel" aria-labelledby="technical-index-heading">
            <h2 id="technical-index-heading">
                {translationService.translate('technical.indexHeading')}
            </h2>
            <nav aria-label={translationService.translate('technical.indexAriaLabel')} class="filter-actions">
                <a href="#technical-identification">
                    {documentLabel('identificationHeading')}
                </a>
                <a href="#technical-operational">{documentLabel('operationalHeading')}</a>
            </nav>
            <p>
                <span>{translationService.translate('activities.timeZone')}</span>
                <strong>{viewModel.timeZone}</strong>
            </p>
        </section>

        <section class="technical-identification" aria-labelledby="technical-identification">
            <h2 id="technical-identification">{documentLabel('identificationHeading')}</h2>
            {#if viewModel.identificationRecords.length === 0}
                <div class="evidence-panel">
                    <p>{documentLabel('emptyIdentification')}</p>
                </div>
            {:else}
                <div class="technical-identification-records">
                    {#each viewModel.identificationRecords as record (recordKey(record))}
                        <article class="evidence-panel">
                            <h3>{translateTechnicalRecordKind(record.kind, translationService)}</h3>
                            <dl class="evidence-details">
                                {#each record.fields as field (field.key)}
                                    <div>
                                        <dt>
                                            {translateTechnicalField(field.key, translationService)}
                                        </dt>
                                        <dd>{@render fieldValue(field)}</dd>
                                    </div>
                                {/each}
                            </dl>
                            {@render sourceEvidence(record)}
                        </article>
                    {/each}
                </div>
            {/if}
        </section>

        <section class="evidence-panel" aria-labelledby="technical-operational" id="technical-operational-panel">
            <h2 id="technical-operational">{documentLabel('operationalHeading')}</h2>
            {#if viewModel.operationalRecords.length === 0}
                <p>{documentLabel('emptyOperational')}</p>
            {:else}
                {@const operationalTableSnapshot = operationalTooling.snapshot(viewModel.operationalRecords)}
                <DataTable
                    labels={tableLabels}
                    caption={documentLabel('operationalCaption')}
                    {columns}
                    filterSummaryLabel={translationService.translate('table.filterResultCount', {
                        shown: String(operationalTableSnapshot.rows.length),
                        total: String(viewModel.operationalRecords.length),
                    })}
                    isRowSelected={isRecordSelected}
                    layout="wide"
                    rowKey={recordKey}
                    rows={operationalTableSnapshot.rows}
                    tooling={operationalTooling}
                />
            {/if}
        </section>

        {#if documentKind === 'vehicleUnit'}
            <section class="evidence-panel" aria-labelledby="technical-additional">
                <h2 id="technical-additional">
                    {translationService.translate('technical.additionalHeading')}
                </h2>
                <p>{translationService.translate('technical.additionalDescription')}</p>
            </section>
        {/if}

        <p aria-live="polite">
            {copyStatus === 'succeeded'
                ? translationService.translate('technical.copied')
                : copyStatus === 'failed'
                  ? translationService.translate('technical.copyFailed')
                  : ''}
        </p>
    {/snippet}
</RecordSectionLayout>

<style>
    .technical-identification {
        display: grid;
        gap: var(--space-stack);
    }

    .technical-identification dd {
        display: inline-flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-compact);
    }

    .field-value-inline {
        display: inline-flex;
        align-items: center;
        gap: var(--space-compact);
        vertical-align: middle;
    }

    .technical-identification-records {
        display: grid;
        gap: var(--space-section);
    }
</style>
