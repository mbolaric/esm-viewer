<script lang="ts">
    interface IProps {
        ariaLabel: string;
        // App-wide display setting shown across workspaces.
        timeZone: string;
        // Shown only while a document is open.
        warningCount?: string;
        warningsLabel?: string;
    }

    let { ariaLabel, timeZone, warningCount, warningsLabel }: IProps = $props();
</script>

<div class="document-status" aria-label={ariaLabel} role="status">
    <span>{timeZone}</span>
    {#if warningCount !== undefined && warningsLabel !== undefined}
        <span>{warningsLabel} {warningCount}</span>
    {/if}
</div>

<style>
    .document-status {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        block-size: var(--size-full);
        gap: var(--space-stack);
        padding-inline: var(--space-shell);
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
        line-height: var(--line-height-tight);
    }

    span {
        display: inline-flex;
        align-items: center;
        block-size: var(--size-full);
    }

    span + span {
        gap: var(--space-stack);
    }

    span + span::before {
        content: '';
        display: block;
        block-size: var(--size-icon-small);
        border-inline-start: var(--border-region);
    }
</style>
