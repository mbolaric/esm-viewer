<script lang="ts">
    import DisclosureMenu from './DisclosureMenu.svelte';
    import { clampInspectorWidth, type IInspectorWidthLabels } from './inspector-width-menu.js';

    interface IProps {
        defaultWidth: number;
        labels: IInspectorWidthLabels;
        maximumWidth: number;
        minimumWidth: number;
        onchange: (width: number) => void;
        step: number;
        width: number;
    }

    let { defaultWidth, labels, maximumWidth, minimumWidth, onchange, step, width }: IProps = $props();

    function changeWidth(value: number): void {
        onchange(clampInspectorWidth(value, minimumWidth, maximumWidth));
    }

    function handleKeydown(event: KeyboardEvent): void {
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            changeWidth(width - step);
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            changeWidth(width + step);
        } else if (event.key === 'Home') {
            event.preventDefault();
            changeWidth(minimumWidth);
        } else if (event.key === 'End') {
            event.preventDefault();
            changeWidth(maximumWidth);
        }
    }
</script>

<DisclosureMenu
    icon="columns"
    menuLabel={labels.menuLabel}
    ontriggerkeydown={handleKeydown}
    triggerLabel={labels.resizeLabel}
    triggerTitle={labels.menuLabel}
    variant="separator"
>
    <button class="inspector-width-option" type="button" onclick={() => changeWidth(minimumWidth)}>
        {labels.narrowLabel}
    </button>
    <button class="inspector-width-option" type="button" onclick={() => changeWidth(defaultWidth)}>
        {labels.defaultLabel}
    </button>
    <button class="inspector-width-option" type="button" onclick={() => changeWidth(maximumWidth)}>
        {labels.wideLabel}
    </button>
</DisclosureMenu>

<style>
    .inspector-width-option {
        min-block-size: var(--size-control-compact);
        padding-block: var(--space-control-block);
        padding-inline: var(--space-control-inline);
        background: var(--color-transparent);
        border: none;
        border-radius: var(--radius-control);
        color: var(--color-text);
        font: inherit;
        text-align: start;
        cursor: pointer;
    }

    .inspector-width-option:hover {
        background: var(--color-surface-hover);
    }
</style>
