<script lang="ts" generics="TWorkspaceId extends string">
    import { onMount } from 'svelte';
    import CommandBar from '../CommandBar.svelte';
    import type { IWorkspaceItem } from '../application-module.js';

    interface IProps {
        activeWorkspace: TWorkspaceId;
        copy: {
            readonly appName: string;
            readonly clicks: string;
            readonly notify: string;
            readonly visibilityLabel: string;
            readonly workspaceLabel: string;
        };
        modules: readonly IWorkspaceItem<TWorkspaceId>[];
        onchangeworkspace: (workspace: TWorkspaceId) => void;
        onnotify: () => void;
        onworkspacemount?: ((workspace: TWorkspaceId) => void) | undefined;
        onworkspaceunmount?: ((workspace: TWorkspaceId) => void) | undefined;
        visible: boolean;
        workspaceId: TWorkspaceId;
    }

    let {
        activeWorkspace,
        copy,
        modules,
        onchangeworkspace,
        onnotify,
        onworkspacemount,
        onworkspaceunmount,
        visible,
        workspaceId,
    }: IProps = $props();
    let clicks = $state(0);

    onMount(() => {
        onworkspacemount?.(workspaceId);
        return () => {
            onworkspaceunmount?.(workspaceId);
        };
    });
</script>

{#snippet actions()}
    <button
        type="button"
        onclick={() => {
            clicks += 1;
        }}>{`${workspaceId} ${copy.clicks}: ${String(clicks)}`}</button
    >
    <button type="button" onclick={onnotify}>{copy.notify}</button>
{/snippet}

<section aria-label={`${workspaceId} workspace`} hidden={!visible}>
    <span>{`${workspaceId} ${copy.visibilityLabel}: ${String(visible)}`}</span>
    <CommandBar
        appName={copy.appName}
        ariaLabel={copy.workspaceLabel}
        {actions}
        {activeWorkspace}
        {modules}
        {onchangeworkspace}
    />
</section>
