<script lang="ts">
    import ReferenceLink from './ReferenceLink.svelte';

    interface IProps {
        readonly compact?: boolean;
        readonly generation: string;
        readonly hidden?: boolean;
        readonly onopen: () => void;
        readonly openLabel: string;
        readonly path: string;
    }

    let { compact = true, generation, hidden = false, onopen, openLabel, path }: IProps = $props();
</script>

<td class:compact-cell={compact} {hidden}>
    <ReferenceLink {generation} {onopen} {openLabel} {path} />
</td>
