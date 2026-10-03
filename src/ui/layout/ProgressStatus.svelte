<script lang="ts">
    interface IProps {
        completed: number;
        label: string;
        total: number;
        valueLabel: string;
    }

    let { completed, label, total, valueLabel }: IProps = $props();
</script>

<div class="progress-status">
    <!-- Only the label is a live region so each count change does not re-announce. -->
    <span role="status">{label}</span>
    <progress aria-label={label} max={total} value={completed}></progress>
    <span class="value">{valueLabel}</span>
</div>

<style>
    .progress-status {
        display: flex;
        align-items: center;
        block-size: var(--size-full);
        gap: var(--space-actions);
        padding-inline: var(--space-shell);
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
        line-height: var(--line-height-tight);
    }

    progress {
        inline-size: var(--size-progress);
        block-size: var(--size-icon-small);
        accent-color: var(--color-accent);
    }

    .value {
        font-variant-numeric: tabular-nums;
    }
</style>
