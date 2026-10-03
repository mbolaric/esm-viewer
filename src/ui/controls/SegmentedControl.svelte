<script lang="ts" generics="TValue extends string">
    import Button from './Button.svelte';

    interface ISegmentedControlOption<TOptionValue extends string> {
        readonly ariaLabel?: string;
        readonly label: string;
        readonly value: TOptionValue;
    }

    interface IProps<TOptionValue extends string> {
        ariaLabel: string;
        onchange: (value: TOptionValue) => void;
        options: readonly ISegmentedControlOption<TOptionValue>[];
        value: TOptionValue;
    }

    let { ariaLabel, onchange, options, value }: IProps<TValue> = $props();
</script>

<!--
    A segmented control switches between views of the *same* data (UTC vs
    shift-relative time, lanes vs band timeline style, month vs year
    calendar) - not a filter narrowing a list, which is what `.filter-actions`
    (every option bordered, counts in the label) is for. The active option
    reads as a solid, filled pill; every other option is borderless until
    hovered, so only the current view draws the eye - the opposite emphasis
    a filter-chip row wants, where every available option should look
    equally selectable.
-->
<div aria-label={ariaLabel} class="segmented-control" role="group">
    {#each options as option (option.value)}
        <Button
            ariaLabel={option.ariaLabel ?? option.label}
            label={option.label}
            onclick={() => onchange(option.value)}
            pressed={value === option.value}
            size="compact"
            variant={value === option.value ? 'primary' : 'ghost'}
        />
    {/each}
</div>

<style>
    .segmented-control {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-compact);
    }
</style>
