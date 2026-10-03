<script lang="ts" generics="TWorkspaceId extends string = string">
    import { Button } from '#ui';
    import { CommandBar, type IWorkspaceItem } from '#shell';
    import type { Snippet } from 'svelte';

    interface IProps {
        beforeActions?: Snippet | undefined;
        afterActions?: Snippet | undefined;
        actions?: Snippet | undefined;
        appName: string;
        ariaLabel: string;
        exportDisabled: boolean;
        exportLabel: string;
        onexport: () => void;
        onopen: () => void;
        openLabel: string;
        openDisabled: boolean;
        modules?: readonly IWorkspaceItem<TWorkspaceId>[] | undefined;
        activeWorkspace?: TWorkspaceId | undefined;
        onchangeworkspace?: ((workspace: TWorkspaceId) => void) | undefined;
    }

    let {
        beforeActions,
        afterActions,
        actions,
        appName,
        ariaLabel,
        exportDisabled,
        exportLabel,
        onexport,
        onopen,
        openLabel,
        openDisabled,
        modules = undefined,
        activeWorkspace = undefined,
        onchangeworkspace = undefined,
    }: IProps = $props();
</script>

{#snippet viewerActions()}
    <Button
        ariaLabel={openLabel}
        disabled={openDisabled}
        icon="folderOpen"
        label={openLabel}
        onclick={onopen}
        size="compact"
        tooltip={openLabel}
        tooltipFloating
        tooltipPosition="below"
        variant="ghost"
    />
    <Button
        ariaLabel={exportLabel}
        disabled={exportDisabled}
        icon="download"
        label={exportLabel}
        onclick={onexport}
        size="compact"
        tooltip={exportLabel}
        tooltipFloating
        tooltipPosition="below"
        variant="ghost"
    />
{/snippet}

<CommandBar
    {appName}
    {ariaLabel}
    {beforeActions}
    {afterActions}
    actions={actions ?? viewerActions}
    {modules}
    {activeWorkspace}
    {onchangeworkspace}
/>
