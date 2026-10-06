<script lang="ts">
    import { createViewerDataTableLabels } from '../../helpers/data-table-labels.js';
    import {
        translateDailyWorkPeriodEntryType,
        translateGeneration,
        translateInsertedCardType,
        translateLoadType,
        translateOperationType,
    } from '../../helpers/viewer-labels.js';
    import { Button, createStandardSortValue, DataTable, FilterChipGroup, type IMapWaypoint, ReferenceLink } from '#ui';
    import type { DocumentSectionRecord, LocationRecordTypeFilter } from '#viewer-application';
    import RecordSectionLayout from '../records/RecordSectionLayout.svelte';
    import PlacesJourneyPanel from './PlacesJourneyPanel.svelte';
    import {
        type DocumentKind,
        type IRecordedCardReference,
        type JsonPointer,
        type TachographLocationRecord,
        type UtcTimestamp,
    } from '#viewer-domain';
    import {
        filterLocationsByActivityDay,
        journeyShiftBelongsToUtcDay,
        type IGnssPositionEvidenceViewModel,
        type IJourneyShiftSummary,
        type ILocationSectionViewModel,
        type LocationRecordViewModel,
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
        oncopycoordinates: (value: string) => Promise<boolean>;
        onfilter: (filter: LocationRecordTypeFilter) => void;
        onopensource: (path: JsonPointer) => void;
        onselectrecord: (record: TachographLocationRecord) => void;
        selectedRecord: DocumentSectionRecord | null;
        viewModel: ILocationSectionViewModel | null;
    }

    let {
        activityDayLabel,
        activityDayMidnight,
        filterText,
        onclearactivityday,
        onreturnactivityday,
        oncopycoordinates,
        onfilter,
        onopensource,
        onselectrecord,
        selectedRecord,
        viewModel,
    }: IProps = $props();

    const translationService = useViewerTranslationService();
    const headingTranslationKeys = {
        driverCard: 'navigator.section.places.driverCard',
        vehicleUnit: 'navigator.section.places.vehicleUnit',
    } satisfies Readonly<Record<DocumentKind, TranslationKey>>;
    let copyStatus = $state<'failed' | 'idle' | 'succeeded'>('idle');
    const screenHeading = $derived(translationService.translate(headingTranslationKeys[viewModel?.documentKind ?? 'driverCard']));
    const columns = $derived([
        {
            cell: typeCell,
            id: 'type',
            label: translationService.translate('eventsFaults.type'),
            sortable: true,
        },
        {
            cell: recordedTimeCell,
            id: 'recordedTime',
            label: translationService.translate('places.recordedTime'),
            sortable: true,
        },
        {
            cell: placePositionCell,
            id: 'placePosition',
            label: translationService.translate('places.placePosition'),
            sortable: true,
        },
        {
            cell: cardContextCell,
            id: 'cardContext',
            label: translationService.translate('places.cardContext'),
            priority: 'low' as const,
            sortable: true,
        },
        {
            cell: odometerAccuracyCell,
            id: 'odometerAccuracy',
            label: translationService.translate('places.odometerAccuracy'),
            priority: 'low' as const,
            sortable: true,
        },
        {
            compact: true,
            cell: sourceCell,
            id: 'source',
            label: translationService.translate('eventsFaults.source'),
            priority: 'low' as const,
            sortable: true,
        },
    ]);

    function getRecordLabel(record: LocationRecordViewModel): string {
        if (record.kind === 'dailyWorkPeriodPlace') {
            return translateDailyWorkPeriodEntryType(record.entryType, translationService);
        }
        if (record.kind === 'accumulatedDrivingPosition') {
            return translationService.translate('places.positionType');
        }
        if (record.kind === 'borderCrossing') {
            return translationService.translate('places.borderCrossings');
        }
        if (record.kind === 'loadUnloadOperation') {
            return translateOperationType(record.operationType, translationService);
        }
        return translateLoadType(record.loadType, translationService);
    }
    const recordTooling = new TableToolingController<LocationRecordViewModel>({
        columns: () => columns,
        filterText: () => filterText,
        filterValues: (record) => [
            getRecordLabel(record),
            record.timestamp.display,
            record.kind === 'dailyWorkPeriodPlace' ||
            record.kind === 'borderCrossing' ||
            record.kind === 'loadUnloadOperation' ||
            record.kind === 'accumulatedDrivingPosition'
                ? (record.position?.determinedAt.display ?? '')
                : '',
            record.kind === 'dailyWorkPeriodPlace' ||
            record.kind === 'borderCrossing' ||
            record.kind === 'loadUnloadOperation' ||
            record.kind === 'accumulatedDrivingPosition'
                ? (record.position?.coordinateDisplayValue ?? '')
                : '',
            record.kind === 'dailyWorkPeriodPlace' || record.kind === 'loadUnloadOperation'
                ? (record.country ?? '')
                : record.kind === 'borderCrossing'
                  ? `${record.countryLeft ?? ''} -> ${record.countryEntered ?? ''}`
                  : '',
            record.kind === 'dailyWorkPeriodPlace' || record.kind === 'loadUnloadOperation' ? (record.region ?? '') : '',
            record.kind === 'dailyWorkPeriodPlace'
                ? (record.card?.cardNumber ?? '')
                : record.kind === 'accumulatedDrivingPosition'
                  ? `${record.driverCard?.cardNumber ?? ''} ${record.coDriverCard?.cardNumber ?? ''}`
                  : '',
            record.kind !== 'loadTypeEntry' ? (record.odometer?.display ?? '') : '',
            record.source.path,
        ],
        sortValue: createStandardSortValue({
            type: (record) => getRecordLabel(record),
            recordedTime: (record) => record.timestamp.value,
            placePosition: (record) => (record.kind !== 'loadTypeEntry' ? (record.position?.coordinateDisplayValue ?? '') : ''),
            cardContext: (record) =>
                record.kind === 'dailyWorkPeriodPlace'
                    ? (record.card?.cardNumber ?? '')
                    : record.kind === 'accumulatedDrivingPosition'
                      ? `${record.driverCard?.cardNumber ?? ''} ${record.coDriverCard?.cardNumber ?? ''}`
                      : '',
            odometerAccuracy: (record) => (record.kind !== 'loadTypeEntry' ? (record.odometer?.value ?? null) : null),
            source: (record) => record.source.path,
        }),
    });

    const shifts = $derived(viewModel?.shifts ?? []);

    let selectedShiftId = $state<string | null>(null);
    let selectedShiftDayUtc = $state<UtcTimestamp | null>(null);

    const activeShift = $derived.by<IJourneyShiftSummary | null>(() => {
        if (shifts.length === 0) {
            return null;
        }
        const explicitSelection =
            selectedShiftId === null ? null : (shifts.find((shift) => shift.id === selectedShiftId) ?? null);
        if (activityDayMidnight !== null) {
            // Explicit navigation takes precedence while linked day is unchanged.
            if (explicitSelection !== null && selectedShiftDayUtc !== null && selectedShiftDayUtc === activityDayMidnight) {
                return explicitSelection;
            }
            const matchingByDay = shifts.find((shift) => journeyShiftBelongsToUtcDay(shift, activityDayMidnight));
            if (matchingByDay !== undefined) {
                return matchingByDay;
            }
        } else if (explicitSelection !== null) {
            return explicitSelection;
        }
        return shifts.at(-1) ?? null;
    });

    const windowedRecords = $derived(
        viewModel === null ? [] : filterLocationsByActivityDay(viewModel.records, activityDayMidnight),
    );

    function isTachographLocationRecord(record: DocumentSectionRecord | null): record is TachographLocationRecord {
        if (record === null) {
            return false;
        }
        return (
            'kind' in record &&
            (record.kind === 'dailyWorkPeriodPlace' ||
                record.kind === 'accumulatedDrivingPosition' ||
                record.kind === 'borderCrossing' ||
                record.kind === 'loadUnloadOperation' ||
                record.kind === 'loadTypeEntry')
        );
    }

    const selectedWaypointId = $derived.by<string | null>(() => {
        if (!isTachographLocationRecord(selectedRecord)) {
            return null;
        }
        return `${selectedRecord.kind}-${selectedRecord.source.path}`;
    });

    function handleSelectMapWaypoint(waypoint: IMapWaypoint): void {
        if (viewModel === null) {
            return;
        }
        const found = viewModel.records.find((rec) => `${rec.kind}-${rec.source.path}` === waypoint.id);
        if (found !== undefined) {
            onselectrecord(found.record);
        }
    }

    // Explicit shift choice holds while the linked activity day stays the same.
    function selectShift(shiftId: string): void {
        selectedShiftId = shiftId;
        selectedShiftDayUtc = activityDayMidnight;
    }

    function formatOdometer(value: string): string {
        return `${value} ${translationService.translate('associations.kilometreUnit')}`;
    }

    function recordSelectionLabel(record: LocationRecordViewModel): string {
        return `${translationService.translate('places.selectRecord')}: ${getRecordLabel(record)}, ${record.timestamp.display}`;
    }

    function isRecordSelected(record: LocationRecordViewModel): boolean {
        return record.record === selectedRecord;
    }

    function recordKey(record: LocationRecordViewModel): string {
        return `${record.kind}:${record.source.path}`;
    }

    async function copyCoordinates(value: string): Promise<void> {
        copyStatus = (await oncopycoordinates(value)) ? 'succeeded' : 'failed';
    }

    const tableLabels = $derived(createViewerDataTableLabels(translationService));
</script>

{#snippet typeFilters()}
    <FilterChipGroup
        ariaLabel={translationService.translate('eventsFaults.filterHeading')}
        onchange={onfilter}
        options={[
            {
                count: viewModel?.allCount.display ?? '',
                label: translationService.translate('associations.all'),
                value: 'all',
            },
            {
                count: viewModel?.gen2v2OperationCount?.display ?? '',
                label: translationService.translate('places.gen2v2Operations'),
                value: 'gen2v2Operations',
            },
            {
                count: viewModel?.placeCount.display ?? '',
                label: translationService.translate('navigator.section.places.driverCard'),
                value: 'place',
            },
            {
                count: viewModel?.positionCount.display ?? '',
                label: translationService.translate('places.positions'),
                value: 'position',
            },
            {
                count: viewModel?.borderCrossingCount.display ?? '',
                label: translationService.translate('places.borderCrossings'),
                value: 'borderCrossing',
            },
            {
                count: viewModel?.loadUnloadOperationCount.display ?? '',
                label: translationService.translate('places.loadUnloadOperations'),
                value: 'loadUnloadOperation',
            },
            {
                count: viewModel?.loadTypeEntryCount.display ?? '',
                label: translationService.translate('places.loadTypeEntries'),
                value: 'loadTypeEntry',
            },
        ]}
        value={viewModel?.filter}
    />
{/snippet}

{#snippet cardReference(card: IRecordedCardReference)}
    <div class="record-stack">
        <span class="metadata">
            <span>{translationService.translate('overview.identity.cardNumber')}</span>
            <strong>
                {card.cardNumber ?? translationService.translate('overview.identity.missing')}
            </strong>
        </span>
        <span>{translateInsertedCardType(card.cardType, translationService)}</span>
        <span class="metadata">
            <span>{translationService.translate('overview.identity.issuingMemberState')}</span>
            <span>
                {card.issuingMemberState ?? translationService.translate('overview.identity.missing')}
            </span>
        </span>
    </div>
{/snippet}

{#snippet positionEvidence(position: IGnssPositionEvidenceViewModel)}
    <div class="coordinate-evidence">
        <div class="coordinate-row">
            <code>{position.coordinateDisplayValue}</code>
            <Button
                ariaLabel={`${translationService.translate('places.copyCoordinates')}: ${position.coordinateCopyValue}`}
                icon="copy"
                iconOnly
                label={translationService.translate('places.copyCoordinates')}
                onclick={() => {
                    void copyCoordinates(position.coordinateCopyValue);
                }}
                size="compact"
                tooltip={translationService.translate('places.copyCoordinates')}
                variant="ghost"
            />
        </div>
        <span class="metadata">
            {translationService.translate('places.coordinatePrecision')}
        </span>
    </div>
{/snippet}

{#snippet positionMeasurements(position: IGnssPositionEvidenceViewModel)}
    <span class="metadata">
        <span>{translationService.translate('places.accuracy')}</span>
        <span>{position.accuracy.display}</span>
    </span>
    {#if position.authenticationStatus !== null}
        <span class="metadata">
            <span>{translationService.translate('places.authenticationStatus')}</span>
            <span>{position.authenticationStatus.display}</span>
        </span>
    {/if}
{/snippet}

{#snippet typeCell(record: LocationRecordViewModel)}
    <Button
        ariaLabel={recordSelectionLabel(record)}
        icon="mapPin"
        label={getRecordLabel(record)}
        onclick={() => onselectrecord(record.record)}
        pressed={isRecordSelected(record)}
        size="compact"
        variant="ghost"
    />
{/snippet}

{#snippet recordedTimeCell(record: LocationRecordViewModel)}
    <div class="record-stack numeric-value">
        <span>{record.timestamp.display}</span>
        {#if record.kind !== 'loadTypeEntry' && record.position !== null}
            <span class="metadata">
                <span>{translationService.translate('places.determinedAt')}</span>
                <span>{record.position.determinedAt.display}</span>
            </span>
        {/if}
    </div>
{/snippet}

{#snippet countryRegion(country: string | null, region: string | null)}
    <span class="metadata">
        <span>{translationService.translate('places.country')}</span>
        <strong>{country ?? translationService.translate('overview.identity.missing')}</strong>
    </span>
    <span class="metadata">
        <span>{translationService.translate('places.region')}</span>
        <span>{region ?? translationService.translate('overview.identity.missing')}</span>
    </span>
{/snippet}

{#snippet positionOrMissing(position: IGnssPositionEvidenceViewModel | null)}
    {#if position !== null}
        {@render positionEvidence(position)}
    {:else}
        <span class="metadata">
            <span>{translationService.translate('places.coordinates')}</span>
            <span>{translationService.translate('overview.identity.missing')}</span>
        </span>
    {/if}
{/snippet}

{#snippet placePositionCell(record: LocationRecordViewModel)}
    {#if record.kind === 'loadTypeEntry'}
        <span>{translateLoadType(record.loadType, translationService)}</span>
    {:else if record.kind === 'accumulatedDrivingPosition'}
        {@render positionOrMissing(record.position)}
    {:else if record.kind === 'borderCrossing'}
        <div class="record-stack">
            <span class="metadata">
                <span>{translationService.translate('places.countryLeft')}</span>
                <strong>{record.countryLeft ?? translationService.translate('overview.identity.missing')}</strong>
            </span>
            <span class="metadata">
                <span>{translationService.translate('places.countryEntered')}</span>
                <strong>{record.countryEntered ?? translationService.translate('overview.identity.missing')}</strong>
            </span>
            {@render positionOrMissing(record.position)}
        </div>
    {:else if record.kind === 'dailyWorkPeriodPlace' || record.kind === 'loadUnloadOperation'}
        <div class="record-stack">
            {@render countryRegion(record.country, record.region)}
            {@render positionOrMissing(record.position)}
        </div>
    {/if}
{/snippet}

{#snippet cardContextCell(record: LocationRecordViewModel)}
    {#if record.kind === 'dailyWorkPeriodPlace' && record.card !== null}
        {@render cardReference(record.card)}
    {:else if record.kind === 'accumulatedDrivingPosition'}
        <div class="record-stack">
            <span class="metadata">
                <span>{translationService.translate('document.kind.driverCard')}</span>
            </span>
            {#if record.driverCard === null}
                <span>{translationService.translate('overview.identity.missing')}</span>
            {:else}
                {@render cardReference(record.driverCard)}
            {/if}
            <span class="metadata">
                <span>{translationService.translate('places.coDriver')}</span>
            </span>
            {#if record.coDriverCard === null}
                <span>{translationService.translate('overview.identity.missing')}</span>
            {:else}
                {@render cardReference(record.coDriverCard)}
            {/if}
        </div>
    {:else}
        <span>{translationService.translate('overview.identity.missing')}</span>
    {/if}
{/snippet}

{#snippet odometerAccuracyCell(record: LocationRecordViewModel)}
    {#if record.kind !== 'loadTypeEntry'}
        <div class="record-stack numeric-value">
            <span class="metadata">
                <span>{translationService.translate('associations.odometer')}</span>
                <span>
                    {record.odometer === null
                        ? translationService.translate('overview.identity.missing')
                        : formatOdometer(record.odometer.display)}
                </span>
            </span>
            {#if record.position !== null}
                {@render positionMeasurements(record.position)}
            {/if}
        </div>
    {:else}
        <span>{translationService.translate('overview.identity.missing')}</span>
    {/if}
{/snippet}

{#snippet sourceCell(record: LocationRecordViewModel)}
    <ReferenceLink
        generation={translateGeneration(record.generation, translationService)}
        onopen={() => onopensource(record.source.path)}
        openLabel={translationService.translate('overview.openSource')}
        path={record.source.path}
    />
{/snippet}

<RecordSectionLayout
    className="places-screen record-workspace wide-workspace"
    errorDescription={translationService.translate('places.error')}
    errorHeading={translationService.translate('places.errorHeading')}
    errorHeadingId="places-error-heading"
    heading={screenHeading}
    {viewModel}
>
    {#snippet content(viewModel: ILocationSectionViewModel)}
        <RecordFilterPanel
            filterHeading={translationService.translate('eventsFaults.filterHeading')}
            filters={typeFilters}
            headingId="places-filter-heading"
            recordCount={viewModel.totalCount.display}
            recordsShown={translationService.translate('eventsFaults.recordsShown')}
            timeBasis={viewModel.timeZone}
            timeBasisLabel={translationService.translate('activities.timeZone')}
        />

        {#if activeShift !== null && activeShift.summary.legs.length > 0}
            <PlacesJourneyPanel
                {activeShift}
                onselectshift={selectShift}
                onselectwaypoint={handleSelectMapWaypoint}
                {selectedWaypointId}
                {shifts}
            />
        {/if}

        <section class="evidence-panel" aria-labelledby="places-records-heading">
            <h2 id="places-records-heading">
                {translationService.translate('places.recordsHeading')}
            </h2>
            <p>{translationService.translate('places.recordedEvidence')}</p>
            <ActivityWindowRecordsPanel
                {activityDayLabel}
                {activityDayMidnight}
                emptyMessage={translationService.translate('places.empty')}
                {onclearactivityday}
                {onreturnactivityday}
                recordsEmpty={windowedRecords.length === 0}
            >
                {@const placeTableSnapshot = recordTooling.snapshot(windowedRecords)}
                <DataTable
                    labels={tableLabels}
                    tooling={recordTooling}
                    caption={translationService.translate('places.recordsCaption')}
                    {columns}
                    filterSummaryLabel={translationService.translate('table.filterResultCount', {
                        shown: String(placeTableSnapshot.rows.length),
                        total: String(windowedRecords.length),
                    })}
                    isRowSelected={isRecordSelected}
                    rowKey={recordKey}
                    rows={placeTableSnapshot.rows}
                />
            </ActivityWindowRecordsPanel>
            <p aria-live="polite">
                {copyStatus === 'succeeded'
                    ? translationService.translate('places.copied')
                    : copyStatus === 'failed'
                      ? translationService.translate('places.copyFailed')
                      : ''}
            </p>
        </section>

        {#if viewModel.hasGen2v2ParserLimitation}
            <section class="evidence-panel" aria-labelledby="places-limitation-heading">
                <h2 id="places-limitation-heading">
                    {translationService.translate('places.limitationHeading')}
                </h2>
                <p>{translationService.translate('places.limitation')}</p>
            </section>
        {/if}
    {/snippet}
</RecordSectionLayout>

<style>
    .coordinate-evidence {
        display: grid;
        justify-items: start;
        gap: var(--space-compact);
    }

    .coordinate-row {
        display: inline-flex;
        align-items: center;
        gap: var(--space-compact);
        vertical-align: middle;
    }
</style>
