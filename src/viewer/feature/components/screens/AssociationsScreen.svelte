<script lang="ts">
    import { createViewerDataTableLabels } from '../../helpers/data-table-labels.js';
    import { translateCardSlot, translateGeneration, translateInsertedCardType } from '../../helpers/viewer-labels.js';
    import { Button, createStandardSortValue, DataTable, FilterChipGroup, ReferenceLink } from '#ui';
    import type { AssociationGenerationFilter, DocumentSectionRecord } from '#viewer-application';
    import RecordSectionLayout from '../records/RecordSectionLayout.svelte';
    import type { DocumentKind, JsonPointer, TachographAssociation } from '#viewer-domain';
    import {
        filterAssociationsByActivityDay,
        type AssociationRecordViewModel,
        type IAssociationSectionViewModel,
        type ICardUseViewModel,
        type IVehicleUnitUseViewModel,
        type IVehicleUseViewModel,
    } from '#viewer-presentation';
    import type { IActivityDayLinkProps } from '../../helpers/activity-day-link-props.js';
    import ActivityWindowRecordsPanel from './ActivityWindowRecordsPanel.svelte';
    import type { TranslationKey } from '#i18n-locales';
    import RecordFilterPanel from '../records/RecordFilterPanel.svelte';
    import { TableToolingController } from '../../controllers/table-tooling-controller.svelte.js';
    import type { IDocumentScopedValue } from '../../controllers/document-scoped-value.svelte.js';
    import { useViewerTranslationService } from '../../viewer-context.js';

    interface IProps extends IActivityDayLinkProps {
        filterText: IDocumentScopedValue<string>;
        onfilter: (filter: AssociationGenerationFilter) => void;
        onopensource: (path: JsonPointer) => void;
        onselectrecord: (record: TachographAssociation) => void;
        selectedRecord: DocumentSectionRecord | null;
        viewModel: IAssociationSectionViewModel | null;
    }

    let {
        activityDayLabel,
        activityDayMidnight,
        filterText,
        onclearactivityday,
        onreturnactivityday,
        onfilter,
        onopensource,
        onselectrecord,
        selectedRecord,
        viewModel,
    }: IProps = $props();

    const translationService = useViewerTranslationService();
    const headingTranslationKeys = {
        driverCard: 'common.vehicles',
        vehicleUnit: 'navigator.section.associations.vehicleUnit',
    } satisfies Readonly<Record<DocumentKind, TranslationKey>>;
    const recordsCaptionTranslationKeys = {
        driverCard: 'associations.recordsCaption.driverCard',
        vehicleUnit: 'associations.recordsCaption.vehicleUnit',
    } satisfies Readonly<Record<DocumentKind, TranslationKey>>;
    const recordsHeadingTranslationKeys = {
        driverCard: 'associations.recordsHeading.driverCard',
        vehicleUnit: 'associations.recordsHeading.vehicleUnit',
    } satisfies Readonly<Record<DocumentKind, TranslationKey>>;
    const screenHeading = $derived(translationService.translate(headingTranslationKeys[viewModel?.documentKind ?? 'driverCard']));
    const columns = $derived(
        viewModel?.documentKind === 'vehicleUnit'
            ? [
                  {
                      cell: identityCell,
                      id: 'identity',
                      label: translationService.translate('associations.identity'),
                      sortable: true,
                  },
                  {
                      cell: slotCell,
                      id: 'slot',
                      label: translationService.translate('associations.slot'),
                      sortable: true,
                  },
                  {
                      cell: insertedCell,
                      id: 'inserted',
                      label: translationService.translate('associations.inserted'),
                      sortable: true,
                  },
                  {
                      cell: withdrawnCell,
                      id: 'withdrawn',
                      label: translationService.translate('associations.withdrawn'),
                      sortable: true,
                  },
                  {
                      compact: true,
                      cell: sourceCell,
                      id: 'source',
                      label: translationService.translate('eventsFaults.source'),
                      sortable: true,
                  },
              ]
            : [
                  {
                      cell: vehicleCell,
                      id: 'vehicle',
                      label: translationService.translate('associations.vehicle'),
                      sortable: true,
                  },
                  {
                      cell: firstUseCell,
                      cellClass: 'numeric-value',
                      id: 'firstUse',
                      label: translationService.translate('associations.firstUse'),
                      sortable: true,
                  },
                  {
                      cell: lastUseCell,
                      id: 'lastUse',
                      label: translationService.translate('associations.lastUse'),
                      sortable: true,
                  },
                  {
                      cell: odometerCell,
                      id: 'odometer',
                      label: translationService.translate('associations.odometer'),
                      sortable: true,
                  },
                  {
                      cell: recordedCell,
                      cellClass: 'numeric-value',
                      id: 'recorded',
                      label: translationService.translate('associations.recorded'),
                      sortable: true,
                  },
                  {
                      cell: deviceCell,
                      id: 'device',
                      label: translationService.translate('associations.device'),
                      sortable: true,
                  },
                  {
                      cell: manufacturerCell,
                      cellClass: 'numeric-value',
                      id: 'manufacturer',
                      label: translationService.translate('associations.manufacturer'),
                      sortable: true,
                  },
                  {
                      compact: true,
                      cell: sourceCell,
                      id: 'source',
                      label: translationService.translate('eventsFaults.source'),
                      sortable: true,
                  },
              ],
    );
    const recordTooling = new TableToolingController<AssociationRecordViewModel>({
        columns: () => columns,
        filterText: () => filterText,
        filterValues: (record) =>
            record.kind === 'vehicleUse'
                ? [
                      record.registrationMemberState ?? '',
                      record.registrationNumber ?? '',
                      record.vehicleIdentificationNumber ?? '',
                      record.firstUse.display,
                      record.lastUse?.display ?? '',
                      record.duration?.display ?? '',
                      record.odometerBegin?.display ?? '',
                      record.odometerEnd?.display ?? '',
                      record.distance?.display ?? '',
                      record.source.path,
                  ]
                : record.kind === 'vehicleUnitUse'
                  ? [
                        record.usedAt.display,
                        String(record.deviceID),
                        record.manufacturerCode.display,
                        record.vuSoftwareVersion,
                        record.source.path,
                    ]
                  : [
                        record.surname ?? '',
                        record.firstNames ?? '',
                        record.cardNumber ?? '',
                        translateInsertedCardType(record.cardType, translationService),
                        record.issuingMemberState ?? '',
                        record.cardExpiryDate?.display ?? '',
                        translateCardSlot(record.slot, translationService),
                        record.insertion.display,
                        record.withdrawal?.display ?? '',
                        record.odometerAtInsertion?.display ?? '',
                        record.odometerAtWithdrawal?.display ?? '',
                        record.duration?.display ?? '',
                        record.source.path,
                    ],
        sortValue: createStandardSortValue({
            identity: (record) =>
                record.kind === 'cardUse'
                    ? (record.cardNumber ?? record.surname ?? '')
                    : record.kind === 'vehicleUse'
                      ? (record.vehicleIdentificationNumber ?? '')
                      : null,
            slot: (record) => (record.kind === 'cardUse' ? record.slot : null),
            inserted: (record) => (record.kind === 'cardUse' ? record.insertion.value : null),
            withdrawn: (record) => (record.kind === 'cardUse' ? (record.withdrawal?.value ?? null) : null),
            vehicle: (record) =>
                record.kind === 'vehicleUse' ? (record.registrationNumber ?? record.vehicleIdentificationNumber ?? '') : null,
            firstUse: (record) => (record.kind === 'vehicleUse' ? record.firstUse.value : null),
            lastUse: (record) => (record.kind === 'vehicleUse' ? (record.lastUse?.value ?? null) : null),
            odometer: (record) => (record.kind === 'vehicleUse' ? (record.odometerBegin?.value ?? null) : null),
            recorded: (record) => (record.kind === 'vehicleUnitUse' ? record.usedAt.value : null),
            device: (record) => (record.kind === 'vehicleUnitUse' ? record.deviceID : null),
            manufacturer: (record) => (record.kind === 'vehicleUnitUse' ? record.manufacturerCode.value : null),
            source: (record) => record.source.path,
        }),
    });
    const windowedRecords = $derived(
        viewModel === null ? [] : filterAssociationsByActivityDay(viewModel.records, activityDayMidnight),
    );

    function formatOdometer(value: string): string {
        return `${value} ${translationService.translate('associations.kilometreUnit')}`;
    }

    function recordKey(record: AssociationRecordViewModel): string {
        return `${record.kind}:${record.source.path}`;
    }

    function vehicleIdentityLabel(record: IVehicleUseViewModel): string {
        return (
            record.registrationNumber ??
            record.registrationMemberState ??
            translationService.translate('overview.identity.missing')
        );
    }

    function vehicleSelectionLabel(record: IVehicleUseViewModel): string {
        return `${translationService.translate('associations.selectRecord')}: ${vehicleIdentityLabel(
            record,
        )}, ${record.firstUse.display}`;
    }

    function cardIdentityLabel(record: ICardUseViewModel): string {
        return record.cardIdentityDisplay ?? translationService.translate('overview.identity.missing');
    }

    function cardSelectionLabel(record: ICardUseViewModel): string {
        return `${translationService.translate('associations.selectRecord')}: ${cardIdentityLabel(
            record,
        )}, ${record.insertion.display}`;
    }

    function vehicleUnitUseIdentityLabel(record: IVehicleUnitUseViewModel): string {
        return `${translationService.translate('associations.device')} ${String(record.deviceID)}`;
    }

    function isRecordSelected(record: AssociationRecordViewModel): boolean {
        return record.record === selectedRecord;
    }

    function vehicleUnitUseSelectionLabel(record: IVehicleUnitUseViewModel): string {
        return `${translationService.translate('associations.selectRecord')}: ${vehicleUnitUseIdentityLabel(
            record,
        )}, ${record.usedAt.display}`;
    }

    const tableLabels = $derived(createViewerDataTableLabels(translationService));
</script>

{#snippet generationFilters()}
    <FilterChipGroup
        ariaLabel={translationService.translate('associations.filterHeading')}
        onchange={onfilter}
        options={[
            {
                count: viewModel?.allCount.display ?? '',
                label: translationService.translate('associations.all'),
                value: 'all',
            },
            ...(viewModel?.availableGenerations ?? []).map((generation) => ({
                count: viewModel?.generationCounts[generation].display ?? '',
                label: translateGeneration(generation, translationService),
                value: generation,
            })),
        ]}
        value={viewModel?.filter}
    />
{/snippet}

{#snippet cardIdentity(record: ICardUseViewModel, selected: boolean)}
    <div class="record-stack">
        <Button
            ariaLabel={cardSelectionLabel(record)}
            label={cardIdentityLabel(record)}
            onclick={() => onselectrecord(record.record)}
            pressed={selected}
            size="compact"
            variant="ghost"
        />
        <span>{translateInsertedCardType(record.cardType, translationService)}</span>
        <span class="metadata">
            <span>{translationService.translate('overview.identity.cardNumber')}</span>
            <code>
                {record.cardNumber ?? translationService.translate('overview.identity.missing')}
            </code>
        </span>
        <span class="metadata">
            <span>{translationService.translate('overview.identity.issuingMemberState')}</span>
            <span>
                {record.issuingMemberState ?? translationService.translate('overview.identity.missing')}
            </span>
        </span>
        <span class="metadata">
            <span>{translationService.translate('overview.identity.cardExpiryDate')}</span>
            <span>
                {record.cardExpiryDate?.display ?? translationService.translate('overview.identity.missing')}
            </span>
        </span>
    </div>
{/snippet}

{#snippet odometerAt(value: ICardUseViewModel['odometerAtInsertion'])}
    <span class="metadata">
        <span>{translationService.translate('associations.odometer')}</span>
        <span>
            {value === null ? translationService.translate('overview.identity.missing') : formatOdometer(value.display)}
        </span>
    </span>
{/snippet}

{#snippet vehicleUnitUseIdentity(record: IVehicleUnitUseViewModel, selected: boolean)}
    <div class="record-stack">
        <Button
            ariaLabel={vehicleUnitUseSelectionLabel(record)}
            label={vehicleUnitUseIdentityLabel(record)}
            onclick={() => onselectrecord(record.record)}
            pressed={selected}
            size="compact"
            variant="ghost"
        />
        <span class="metadata">
            <span>{translationService.translate('associations.softwareVersion')}</span>
            <code>{record.vuSoftwareVersion}</code>
        </span>
    </div>
{/snippet}

{#snippet missingValue()}
    {translationService.translate('overview.identity.missing')}
{/snippet}

{#snippet sourceCell(record: AssociationRecordViewModel)}
    <ReferenceLink
        generation={translateGeneration(record.generation, translationService)}
        onopen={() => onopensource(record.source.path)}
        openLabel={translationService.translate('overview.openSource')}
        path={record.source.path}
    />
{/snippet}

<!-- Vehicle-unit documents list card uses. -->
{#snippet identityCell(record: AssociationRecordViewModel)}
    {#if record.kind === 'cardUse'}
        {@render cardIdentity(record, isRecordSelected(record))}
    {/if}
{/snippet}

{#snippet slotCell(record: AssociationRecordViewModel)}
    {#if record.kind === 'cardUse'}
        {translateCardSlot(record.slot, translationService)}
    {/if}
{/snippet}

{#snippet insertedCell(record: AssociationRecordViewModel)}
    {#if record.kind === 'cardUse'}
        <div class="record-stack numeric-value">
            <span>{record.insertion.display}</span>
            {@render odometerAt(record.odometerAtInsertion)}
        </div>
    {/if}
{/snippet}

{#snippet withdrawnCell(record: AssociationRecordViewModel)}
    {#if record.kind === 'cardUse'}
        <div class="record-stack numeric-value">
            <span>
                {record.withdrawal?.display ?? translationService.translate('overview.identity.missing')}
            </span>
            {@render odometerAt(record.odometerAtWithdrawal)}
            <span class="metadata">
                <span>{translationService.translate('activities.duration')}</span>
                <span>
                    {record.duration?.display ?? translationService.translate('overview.identity.missing')}
                </span>
            </span>
        </div>
    {/if}
{/snippet}

<!-- Card documents list vehicle uses and, for Gen2, vehicle-unit uses. -->
{#snippet vehicleCell(record: AssociationRecordViewModel)}
    {#if record.kind === 'vehicleUse'}
        <div class="record-stack">
            <Button
                ariaLabel={vehicleSelectionLabel(record)}
                label={vehicleIdentityLabel(record)}
                onclick={() => onselectrecord(record.record)}
                pressed={isRecordSelected(record)}
                size="compact"
                variant="ghost"
            />
            <span class="metadata">
                <span>
                    {translationService.translate('associations.vehicleIdentificationNumber')}
                </span>
                <code>
                    {record.vehicleIdentificationNumber ?? translationService.translate('overview.identity.missing')}
                </code>
            </span>
        </div>
    {:else if record.kind === 'vehicleUnitUse'}
        {@render vehicleUnitUseIdentity(record, isRecordSelected(record))}
    {/if}
{/snippet}

{#snippet firstUseCell(record: AssociationRecordViewModel)}
    {#if record.kind === 'vehicleUse'}
        {record.firstUse.display}
    {:else}
        {@render missingValue()}
    {/if}
{/snippet}

{#snippet lastUseCell(record: AssociationRecordViewModel)}
    {#if record.kind === 'vehicleUse'}
        <div class="record-stack">
            <span class="numeric-value">
                {record.lastUse?.display ?? translationService.translate('overview.identity.missing')}
            </span>
            <span class="metadata">
                <span>{translationService.translate('activities.duration')}</span>
                <span>
                    {record.duration?.display ?? translationService.translate('overview.identity.missing')}
                </span>
            </span>
        </div>
    {:else}
        {@render missingValue()}
    {/if}
{/snippet}

{#snippet odometerCell(record: AssociationRecordViewModel)}
    {#if record.kind === 'vehicleUse'}
        <div class="record-stack numeric-value">
            <span>
                {record.odometerBegin === null
                    ? translationService.translate('overview.identity.missing')
                    : formatOdometer(record.odometerBegin.display)}
                {translationService.translate('associations.rangeSeparator')}
                {record.odometerEnd === null
                    ? translationService.translate('overview.identity.missing')
                    : formatOdometer(record.odometerEnd.display)}
            </span>
            <span class="metadata">
                <span>{translationService.translate('associations.distance')}</span>
                <span>
                    {record.distance === null
                        ? translationService.translate('overview.identity.missing')
                        : formatOdometer(record.distance.display)}
                </span>
            </span>
        </div>
    {:else}
        {@render missingValue()}
    {/if}
{/snippet}

{#snippet recordedCell(record: AssociationRecordViewModel)}
    {#if record.kind === 'vehicleUnitUse'}
        {record.usedAt.display}
    {:else}
        {@render missingValue()}
    {/if}
{/snippet}

{#snippet deviceCell(record: AssociationRecordViewModel)}
    {#if record.kind === 'vehicleUnitUse'}
        <div class="record-stack numeric-value">
            <span>{record.deviceID}</span>
            <span class="metadata">
                <span>{translationService.translate('associations.softwareVersion')}</span>
                <span>{record.vuSoftwareVersion}</span>
            </span>
        </div>
    {:else}
        {@render missingValue()}
    {/if}
{/snippet}

{#snippet manufacturerCell(record: AssociationRecordViewModel)}
    {#if record.kind === 'vehicleUnitUse'}
        {record.manufacturerCode.display}
    {:else}
        {@render missingValue()}
    {/if}
{/snippet}

<RecordSectionLayout
    className="associations-screen record-workspace wide-workspace"
    errorDescription={translationService.translate('associations.error')}
    errorHeading={translationService.translate('associations.errorHeading')}
    errorHeadingId="associations-error-heading"
    fillHeight
    heading={screenHeading}
    {viewModel}
>
    {#snippet content(viewModel: IAssociationSectionViewModel)}
        <RecordFilterPanel
            filterHeading={translationService.translate('associations.filterHeading')}
            filters={generationFilters}
            headingId="associations-filter-heading"
            recordCount={viewModel.totalCount.display}
            recordsShown={translationService.translate('eventsFaults.recordsShown')}
            timeBasis={viewModel.timeZone}
            timeBasisLabel={translationService.translate('activities.timeZone')}
        />

        <section class="associations-panel table-section" aria-labelledby="associations-records-heading">
            <h2 id="associations-records-heading">
                {translationService.translate(recordsHeadingTranslationKeys[viewModel.documentKind])}
            </h2>
            <ActivityWindowRecordsPanel
                {activityDayLabel}
                {activityDayMidnight}
                emptyMessage={translationService.translate('associations.empty')}
                {onclearactivityday}
                {onreturnactivityday}
                recordsEmpty={windowedRecords.length === 0}
            >
                {@const associationTableSnapshot = recordTooling.snapshot(windowedRecords)}
                <DataTable
                    labels={tableLabels}
                    tooling={recordTooling}
                    caption={translationService.translate(recordsCaptionTranslationKeys[viewModel.documentKind])}
                    {columns}
                    fillHeight
                    filterSummaryLabel={translationService.translate('table.filterResultCount', {
                        shown: String(associationTableSnapshot.rows.length),
                        total: String(windowedRecords.length),
                    })}
                    layout="wide"
                    isRowSelected={isRecordSelected}
                    rowKey={recordKey}
                    rows={associationTableSnapshot.rows}
                />
            </ActivityWindowRecordsPanel>
        </section>
    {/snippet}
</RecordSectionLayout>

<style>
    .associations-panel h2 {
        margin-block: var(--space-none) var(--space-actions);
    }
</style>
