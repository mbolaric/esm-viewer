<script lang="ts">
    import Button from './Button.svelte';

    interface IProps {
        onopen: () => void;
        openLabel: string;
        path: string;
        // Alignment of tooltip bubble edge; defaults to 'end' to grow leftward from table edge.
        tooltipAlign?: 'center' | 'end' | 'start';
        // Forwarded to Button.tooltipFloating to prevent bubble clipping in overflow ancestors.
        tooltipFloating?: boolean;
        tooltipPosition?: 'above' | 'below';
    }

    let { onopen, openLabel, path, tooltipAlign = 'end', tooltipFloating = false, tooltipPosition = 'above' }: IProps = $props();
</script>

<Button
    ariaLabel={`${openLabel}: ${path}`}
    icon="diff"
    iconOnly
    label={openLabel}
    onclick={onopen}
    size="compact"
    tooltip={`${openLabel}:\n${path}`}
    {tooltipAlign}
    {tooltipFloating}
    {tooltipPosition}
    variant="ghost"
/>
