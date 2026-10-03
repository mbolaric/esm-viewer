<script lang="ts">
    import type { Snippet } from 'svelte';

    import DropFeedback from './DropFeedback.svelte';

    interface IProps {
        ariaLabel: string;
        children: Snippet;
        disabled: boolean;
        dropLabel: string;
        ondropfiles: (files: readonly File[]) => void;
    }

    let { ariaLabel, children, disabled, dropLabel, ondropfiles }: IProps = $props();

    let dragDepth = $state(0);
    let displayName = $state<string | null>(null);

    function isFileTransfer(dataTransfer: DataTransfer | null): dataTransfer is DataTransfer {
        return (
            dataTransfer !== null &&
            (dataTransfer.files.length > 0 || Array.from(dataTransfer.types).some((type) => type === 'Files'))
        );
    }

    function readDisplayName(dataTransfer: DataTransfer): string | null {
        return dataTransfer.files[0]?.name ?? null;
    }

    function preventFileNavigation(event: DragEvent): DataTransfer | null {
        if (!isFileTransfer(event.dataTransfer)) {
            return null;
        }

        event.preventDefault();
        event.stopPropagation();
        return event.dataTransfer;
    }

    function handleDragEnter(event: DragEvent): void {
        const dataTransfer = preventFileNavigation(event);
        if (dataTransfer === null || disabled) {
            return;
        }

        dragDepth += 1;
        displayName = readDisplayName(dataTransfer);
    }

    function handleDragLeave(event: DragEvent): void {
        const dataTransfer = preventFileNavigation(event);
        if (dataTransfer === null || disabled) {
            return;
        }

        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) {
            displayName = null;
        }
    }

    function handleDragOver(event: DragEvent): void {
        const dataTransfer = preventFileNavigation(event);
        if (dataTransfer === null || disabled) {
            return;
        }

        dataTransfer.dropEffect = 'copy';
        displayName = readDisplayName(dataTransfer);
    }

    function handleDrop(event: DragEvent): void {
        const dataTransfer = preventFileNavigation(event);
        if (dataTransfer === null) {
            return;
        }

        const files = disabled ? [] : Array.from(dataTransfer.files);
        dragDepth = 0;
        displayName = null;
        if (files.length > 0) {
            ondropfiles(files);
        }
    }
</script>

<div
    class="drop-surface"
    role="region"
    aria-label={ariaLabel}
    ondragenter={handleDragEnter}
    ondragleave={handleDragLeave}
    ondragover={handleDragOver}
    ondrop={handleDrop}
>
    {@render children()}
    {#if dragDepth > 0 && !disabled}
        <DropFeedback>
            <strong>{dropLabel}</strong>
            {#if displayName !== null}
                <span>{displayName}</span>
            {/if}
        </DropFeedback>
    {/if}
</div>

<style>
    .drop-surface {
        position: relative;
        block-size: var(--size-full);
        min-block-size: var(--space-none);
    }
</style>
