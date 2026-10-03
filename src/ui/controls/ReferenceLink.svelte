<script lang="ts">
    import ReferenceLinkButton from './ReferenceLinkButton.svelte';

    interface IProps {
        generation: string;
        onopen: () => void;
        openLabel: string;
        path: string;
    }

    let { generation, onopen, openLabel, path }: IProps = $props();
</script>

<div class="reference-link">
    <span class="generation-label">{generation}</span>
    <ReferenceLinkButton {onopen} {openLabel} {path} />
</div>

<style>
    .reference-link {
        display: inline-flex;
        align-items: center;
        gap: var(--space-compact);
        vertical-align: middle;
    }

    .generation-label {
        line-height: var(--line-height-tight);
    }
</style>
