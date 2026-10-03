<script lang="ts">
    import type {
        IIntervalTimelineActivation,
        IIntervalTimelineChartModel,
        IIntervalTimelineRuntime,
        IIntervalTimelineSegment,
        IChartHostLabels,
        IntervalTimelineRuntimeLoader,
    } from './chart-contract.js';
    import { orderIntervalSegments } from './chart-ordering.js';
    import { ChartSelectionController } from './chart-selection.svelte.js';
    import ChartLegend from './ChartLegend.svelte';
    import LazyChartHost from './LazyChartHost.svelte';

    interface IProps {
        id?: string;
        labels: IChartHostLabels;
        model: IIntervalTimelineChartModel;
        onfailure: () => void;
        onselect: (segmentId: string | null) => void;
        runtimeLoader?: IntervalTimelineRuntimeLoader | undefined;
    }

    const defaultRuntimeLoader: IntervalTimelineRuntimeLoader = async () => import('./echarts-interval-timeline-runtime.js');

    let { id = 'interval-timeline', labels, model, onfailure, onselect, runtimeLoader = defaultRuntimeLoader }: IProps = $props();

    const chronologicalSegments = $derived(orderIntervalSegments(model.segments));
    const selection = new ChartSelectionController<IIntervalTimelineSegment, IIntervalTimelineActivation>({
        activatedItemId: (activation) => activation.segmentId,
        chronologicalItems: () => chronologicalSegments,
        items: () => model.segments,
        onselect: (segmentId) => {
            onselect(segmentId);
        },
        selectedId: () => model.selectedSegmentId,
    });

    async function createRuntime(
        element: HTMLElement,
        currentModel: IIntervalTimelineChartModel,
    ): Promise<IIntervalTimelineRuntime> {
        const module = await runtimeLoader();
        return module.createIntervalTimelineRuntime(element, currentModel, {
            onactivate: selection.activate,
            onselect: selection.select,
        });
    }
</script>

{#snippet chartDetails()}
    {#if model.variant === 'band'}
        <ChartLegend items={model.lanes} />
    {/if}
{/snippet}

<LazyChartHost
    activeDescription={selection.activeItem?.description ?? model.ariaDescription}
    ariaDescription={model.ariaDescription}
    {createRuntime}
    details={chartDetails}
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
