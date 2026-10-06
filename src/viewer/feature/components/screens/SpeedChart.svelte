<script lang="ts">
    import { translateGeneration } from '../../helpers/viewer-labels.js';
    import { ERROR_CODES } from '#contracts';
    import { TimeSeriesChart, type ITimeSeriesChartModel, type TimeSeriesRuntimeLoader } from '#ui';
    import type { IDetailedSpeedSample } from '#viewer-domain';
    import {
        calculateSpeedChartBounds,
        type ISpeedChartSampleViewModel,
        type ISpeedSectionViewModel,
    } from '#viewer-presentation';

    import { useViewerTranslationService } from '../../viewer-context.js';

    interface IProps {
        onclearrecord: () => void;
        onfailure: () => void;
        onselectrecord: (record: IDetailedSpeedSample) => void;
        runtimeLoader?: TimeSeriesRuntimeLoader | undefined;
        selectedRecord: IDetailedSpeedSample | null;
        viewModel: ISpeedSectionViewModel;
    }

    // Generic illustrative reference lines; not vehicle-specific legal limits or noncompliance findings.
    const REFERENCE_HGV_SPEED_KMH = 80;
    const REFERENCE_EU_LIMITER_SPEED_KMH = 90;

    let { onclearrecord, onfailure, onselectrecord, runtimeLoader = undefined, selectedRecord, viewModel }: IProps = $props();

    const translationService = useViewerTranslationService();
    const chartBounds = $derived(calculateSpeedChartBounds(viewModel.range, viewModel.chartRecords));
    const selectedPointId = $derived(viewModel.chartRecords.find((record) => record.record === selectedRecord)?.id ?? null);
    const model = $derived<ITimeSeriesChartModel>({
        ariaDescription: translationService.translate('speed.chart.ariaDescription'),
        colorToken: '--color-speed-series',
        domainEnd: chartBounds.domainEnd,
        domainStart: 0,
        points: viewModel.chartRecords.map((record) => ({
            description: pointDescription(record),
            id: record.id,
            timestamp: record.recordedAt.value - chartBounds.domainStart,
            value: record.speed.value,
        })),
        selectedPointId,
        seriesLabel: translationService.translate('speed.chart.seriesLabel'),
        thresholds: [
            {
                colorToken: '--color-warning',
                label: translationService.translate('speed.chart.limit.hgv'),
                value: REFERENCE_HGV_SPEED_KMH,
            },
            {
                colorToken: '--color-danger',
                label: translationService.translate('speed.chart.limit.limiter'),
                value: REFERENCE_EU_LIMITER_SPEED_KMH,
            },
        ],
        ticks: viewModel.chartTicks.map((tick) => ({
            display: tick.display,
            value: tick.value - chartBounds.domainStart,
        })),
        timeAxisLabel: translationService.translate('speed.chart.timeAxis'),
        valueAxisLabel: translationService.translate('speed.chart.valueAxis'),
        valueDomainEnd: chartBounds.valueDomainEnd,
        valueDomainStart: 0,
    });

    function pointDescription(record: ISpeedChartSampleViewModel): string {
        return `${record.recordedAt.display}, ${record.speed.display} ${translationService.translate('speed.chart.valueAxis')}, ${translateGeneration(record.generation, translationService)}`;
    }

    function selectPoint(pointId: string | null): void {
        if (pointId === null) {
            onclearrecord();
            return;
        }
        const record = viewModel.chartRecords.find((candidate) => candidate.id === pointId);
        if (record !== undefined) {
            onselectrecord(record.record);
        }
    }
</script>

<TimeSeriesChart
    labels={{
        failureCode: ERROR_CODES.chartRenderFailed,
        failureCodeLabel: translationService.translate('failure.errorCode'),
        failureDescription: translationService.translate('speed.chart.failureDescription'),
        failureHeading: translationService.translate('speed.chart.failureHeading'),
        keyboardHelp: translationService.translate('speed.chart.keyboardHelp'),
        loading: translationService.translate('speed.chart.loading'),
        retry: translationService.translate('speed.chart.retry'),
        roleDescription: translationService.translate('speed.chart.roleDescription'),
    }}
    {model}
    {onfailure}
    onselect={selectPoint}
    {runtimeLoader}
/>
