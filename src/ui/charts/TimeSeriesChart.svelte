<script lang="ts">
    import type {
        IChartHostLabels,
        ITimeSeriesActivation,
        ITimeSeriesChartModel,
        ITimeSeriesPoint,
        ITimeSeriesRuntime,
        TimeSeriesRuntimeLoader,
    } from './chart-contract.js';
    import { orderTimeSeriesPoints } from './chart-ordering.js';
    import { ChartSelectionController } from './chart-selection.svelte.js';
    import LazyChartHost from './LazyChartHost.svelte';

    interface IProps {
        id?: string;
        labels: IChartHostLabels;
        model: ITimeSeriesChartModel;
        onfailure: () => void;
        onselect: (pointId: string | null) => void;
        runtimeLoader?: TimeSeriesRuntimeLoader | undefined;
    }

    const defaultRuntimeLoader: TimeSeriesRuntimeLoader = async () => import('./echarts-interval-timeline-runtime.js');

    let { id = 'time-series', labels, model, onfailure, onselect, runtimeLoader = defaultRuntimeLoader }: IProps = $props();

    const chronologicalPoints = $derived(orderTimeSeriesPoints(model.points));
    const selection = new ChartSelectionController<ITimeSeriesPoint, ITimeSeriesActivation>({
        activatedItemId: (activation) => activation.pointId,
        chronologicalItems: () => chronologicalPoints,
        items: () => model.points,
        onselect: (pointId) => {
            onselect(pointId);
        },
        selectedId: () => model.selectedPointId,
    });

    async function createRuntime(element: HTMLElement, currentModel: ITimeSeriesChartModel): Promise<ITimeSeriesRuntime> {
        const module = await runtimeLoader();
        return module.createTimeSeriesRuntime(element, currentModel, {
            onactivate: selection.activate,
            onselect: selection.select,
        });
    }
</script>

<LazyChartHost
    activeDescription={selection.activeItem?.description ?? model.ariaDescription}
    ariaDescription={model.ariaDescription}
    {createRuntime}
    {id}
    {labels}
    {model}
    {onfailure}
    onfocus={selection.handleFocus}
    onkeydown={selection.handleKeyboard}
    pointerTooltip={selection.pointerTooltip}
    roleDescription={labels.roleDescription}
    selectedItemId={selection.selectedItemId}
/>
