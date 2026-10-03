<script lang="ts">
    import type { IChartLegendIconItem, IChartLegendItem } from './chart-contract.js';
    import Icon from '../icon/Icon.svelte';

    interface IProps {
        ariaLabel?: string | undefined;
        items: readonly (IChartLegendIconItem | IChartLegendItem)[];
    }

    let { ariaLabel = undefined, items }: IProps = $props();
</script>

<ul aria-label={ariaLabel} class="chart-legend">
    {#each items as item (item.id)}
        <li>
            {#if 'icon' in item}
                <span aria-hidden="true" class="legend-icon">
                    <Icon name={item.icon} size="small" />
                </span>
            {:else}
                <span
                    aria-hidden="true"
                    class="legend-swatch"
                    data-pattern={item.pattern ?? 'solid'}
                    style:--data-swatch-color={`var(${item.colorToken})`}
                ></span>
            {/if}
            {item.label}
        </li>
    {/each}
</ul>

<style>
    .chart-legend {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-section);
        margin: var(--space-none);
        padding: var(--space-none);
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
        list-style: none;
    }

    .chart-legend li {
        display: flex;
        align-items: center;
        gap: var(--space-compact);
    }

    .legend-icon {
        display: inline-flex;
    }

    .legend-swatch {
        display: inline-block;
        inline-size: var(--size-chart-legend-swatch);
        block-size: var(--size-chart-legend-swatch);
        background: var(--data-swatch-color);
        border: var(--border-region);
        border-radius: var(--radius-control);
    }

    .legend-swatch[data-pattern='diagonal'] {
        background-image: repeating-linear-gradient(
            var(--angle-chart-pattern),
            var(--color-surface) var(--space-none),
            var(--color-surface) var(--size-chart-pattern-dash),
            var(--data-swatch-color) var(--size-chart-pattern-dash),
            var(--data-swatch-color) calc(var(--size-chart-pattern-dash) + var(--size-chart-pattern-gap))
        );
    }
</style>
