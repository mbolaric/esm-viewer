<script lang="ts" generics="TValue extends string">
    import Button from './Button.svelte';
    import type { IFilterChipOption } from './filter-chip.js';

    interface IProps<TOptionValue extends string> {
        ariaLabel: string;
        onchange: (value: TOptionValue) => void;
        options: readonly IFilterChipOption<TOptionValue>[];
        // Undefined while the filtered data is not available yet; no chip is pressed then.
        value: TOptionValue | undefined;
    }

    let { ariaLabel, onchange, options, value }: IProps<TValue> = $props();

    function chipLabel(option: IFilterChipOption<TValue>): string {
        return option.count === undefined ? option.label : `${option.label} (${String(option.count)})`;
    }
</script>

<!-- A row of equally weighted filter chips narrowing one list; see SegmentedControl for switching views. -->
<div aria-label={ariaLabel} class="filter-actions" role="group">
    {#each options as option (option.value)}
        <Button label={chipLabel(option)} onclick={() => onchange(option.value)} pressed={value === option.value} />
    {/each}
</div>

<style>
    .filter-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-actions);
    }
</style>
