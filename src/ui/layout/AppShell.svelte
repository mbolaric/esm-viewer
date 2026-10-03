<script lang="ts">
    import { onMount, type Snippet } from 'svelte';

    import InspectorWidthMenu from '../controls/InspectorWidthMenu.svelte';
    import {
        clampInspectorWidth,
        DEFAULT_INSPECTOR_MAXIMUM_WIDTH,
        DEFAULT_INSPECTOR_MINIMUM_WIDTH,
        DEFAULT_INSPECTOR_WIDTH,
        type IInspectorWidthLabels,
    } from '../controls/inspector-width-menu.js';

    interface IDocumentRegions {
        readonly header: Snippet;
        readonly navigation: Snippet;
    }

    interface ISeparatorDrag {
        readonly startClientX: number;
        readonly startWidth: number;
    }

    interface IProps {
        children: Snippet;
        commands: Snippet;
        document: IDocumentRegions | null;
        inspector?: Snippet;
        inspectorLabel?: string;
        inspectorLabels?: IInspectorWidthLabels | undefined;
        inspectorOpen?: boolean;
        inspectorWidth?: number;
        oninspectorwidthchange?: (width: number) => void;
    }

    let {
        children,
        commands,
        document,
        inspector = undefined,
        inspectorLabel = undefined,
        inspectorLabels = undefined,
        inspectorOpen = false,
        inspectorWidth = DEFAULT_INSPECTOR_WIDTH,
        oninspectorwidthchange = undefined,
    }: IProps = $props();

    const inspectorWidthStep = 8;
    let inspectorMaximum = $state(DEFAULT_INSPECTOR_MAXIMUM_WIDTH);
    let inspectorMinimum = $state(DEFAULT_INSPECTOR_MINIMUM_WIDTH);
    let separatorDrag = $state<ISeparatorDrag | null>(null);
    let separatorElement = $state<HTMLButtonElement | undefined>();

    function readCssLength(property: string): number {
        const rootStyle = globalThis.getComputedStyle(globalThis.document.documentElement);
        const value = rootStyle.getPropertyValue(property).trim();
        const parsed = Number.parseFloat(value);
        if (!Number.isFinite(parsed)) {
            return Number.POSITIVE_INFINITY;
        }

        const unit = value.slice(String(parsed).length).trim();
        if (unit === 'rem') {
            return parsed * Number.parseFloat(rootStyle.fontSize);
        }

        return parsed;
    }

    onMount(() => {
        inspectorMinimum = readCssLength('--size-inspector-min');
        inspectorMaximum = readCssLength('--size-inspector-max');
    });

    function changeInspectorWidth(width: number): void {
        const next = clampInspectorWidth(width, inspectorMinimum, inspectorMaximum);
        if (next !== inspectorWidth) {
            oninspectorwidthchange?.(next);
        }
    }

    function beginSeparatorDrag(event: PointerEvent): void {
        const element = separatorElement;
        if (element === undefined || element === null) {
            return;
        }
        event.preventDefault();
        if (typeof element.setPointerCapture === 'function') {
            element.setPointerCapture(event.pointerId);
        }
        separatorDrag = { startClientX: event.clientX, startWidth: inspectorWidth };
    }

    function moveSeparatorDrag(event: PointerEvent): void {
        const drag = separatorDrag;
        if (drag === null) {
            return;
        }
        changeInspectorWidth(drag.startWidth + drag.startClientX - event.clientX);
    }

    function endSeparatorDrag(event: PointerEvent): void {
        separatorDrag = null;
        const element = separatorElement;
        if (element === undefined || element === null || typeof element.hasPointerCapture !== 'function') {
            return;
        }
        if (element.hasPointerCapture(event.pointerId)) {
            element.releasePointerCapture(event.pointerId);
        }
    }

    function handleSeparatorKeydown(event: KeyboardEvent): void {
        switch (event.key) {
            case 'ArrowDown':
            case 'ArrowLeft':
                event.preventDefault();
                changeInspectorWidth(inspectorWidth - inspectorWidthStep);
                break;
            case 'ArrowRight':
            case 'ArrowUp':
                event.preventDefault();
                changeInspectorWidth(inspectorWidth + inspectorWidthStep);
                break;
            case 'Home':
                event.preventDefault();
                changeInspectorWidth(inspectorMinimum);
                break;
            case 'End':
                event.preventDefault();
                changeInspectorWidth(inspectorMaximum);
                break;
        }
    }
</script>

<div class:document-workspace={document !== null} class="app-shell">
    {#if document !== null}
        <header class="commands">
            {@render commands()}
        </header>
        <div class="document-header">
            {@render document.header()}
        </div>
    {/if}
    <div
        class:has-inspector={inspector !== undefined && inspectorOpen}
        class="workspace"
        style:--size-inspector-current={`${inspectorWidth}px`}
    >
        {#if document !== null}
            <div class="navigation">
                {@render document.navigation()}
            </div>
        {/if}
        <main class="main-content">
            {@render children()}
        </main>
        {#if inspector !== undefined && document !== null && inspectorOpen}
            <div class="inspector-separator">
                {#if inspectorLabels !== undefined}
                    <InspectorWidthMenu
                        defaultWidth={DEFAULT_INSPECTOR_WIDTH}
                        labels={inspectorLabels}
                        maximumWidth={inspectorMaximum}
                        minimumWidth={inspectorMinimum}
                        onchange={changeInspectorWidth}
                        step={inspectorWidthStep}
                        width={inspectorWidth}
                    />
                {/if}
                <button
                    aria-label={inspectorLabels?.resizeLabel}
                    aria-orientation="vertical"
                    aria-valuemax={inspectorMaximum}
                    aria-valuemin={inspectorMinimum}
                    aria-valuenow={inspectorWidth}
                    bind:this={separatorElement}
                    class="inspector-separator-rule"
                    onkeydown={handleSeparatorKeydown}
                    onpointercancel={endSeparatorDrag}
                    onpointerdown={beginSeparatorDrag}
                    onpointermove={moveSeparatorDrag}
                    onpointerup={endSeparatorDrag}
                    role="slider"
                    tabindex="0"
                    type="button"
                >
                    <span aria-hidden="true" class="inspector-separator-grip"></span>
                </button>
            </div>
            <aside aria-label={inspectorLabel} class="inspector">
                {@render inspector()}
            </aside>
        {/if}
    </div>
</div>

<style>
    .app-shell {
        display: grid;
        grid-template-rows: var(--layout-shell-task-rows);
        min-block-size: var(--space-none);
        block-size: var(--size-full);
        overflow: hidden;
    }

    .document-workspace {
        grid-template-rows: var(--layout-shell-document-rows);
    }

    .document-header {
        background: var(--color-surface);
    }

    .commands,
    .navigation {
        background: var(--color-surface-subtle);
    }

    .commands,
    .document-header {
        border-block-end: var(--border-region);
    }

    /*
     * The shell is a single-column grid, so each row's automatic minimum size
     * would otherwise be its content's min-content width - a command bar that
     * cannot wrap can push the whole shell wider than the window at the 640px
     * minimum width. Clamping the rows keeps the shell at window width; the
     * command bar already scrolls itself at narrow widths.
     */
    .commands,
    .document-header {
        min-inline-size: var(--space-none);
    }

    .workspace {
        display: grid;
        grid-template-areas: 'main';
        min-block-size: var(--space-none);
    }

    .document-workspace .workspace {
        grid-template-columns: var(--layout-shell-document-columns);
        grid-template-rows: var(--layout-shell-document-workspace-rows);
        grid-template-areas: var(--layout-shell-document-areas);
    }

    .document-workspace .workspace.has-inspector {
        grid-template-columns: var(--layout-shell-document-inspector-columns);
        grid-template-rows: var(--layout-shell-document-inspector-rows);
        grid-template-areas: var(--layout-shell-document-inspector-areas);
    }

    .navigation {
        grid-area: navigation;
        min-block-size: var(--space-none);
        min-inline-size: var(--space-none);
        overflow-x: var(--overflow-shell-navigation-inline);
        overflow-y: var(--overflow-shell-navigation-block);
        border-inline-end: var(--border-shell-navigation-inline);
        border-block-end: var(--border-shell-navigation-block);
    }

    .main-content {
        grid-area: main;
        position: relative;
        display: grid;
        inline-size: var(--size-full);
        max-inline-size: var(--size-full);
        min-inline-size: var(--space-none);
        min-block-size: var(--space-none);
        padding: var(--space-shell);
        background: var(--color-canvas);
        overflow-x: hidden;
        overflow-y: auto;
        place-items: center;
    }

    /*
     * Anchors overflowing content to top so scrolling downward reveals entire article.
     * The explicit row gives a screen a definite height to fill; content taller than
     * the row still overflows it and scrolls the main area.
     */
    .document-workspace .main-content {
        grid-template-rows: var(--layout-shell-main-rows);
        align-content: start;
        align-items: start;
        justify-items: stretch;
    }

    .inspector-separator {
        grid-area: separator;
        display: var(--display-inspector-separator);
        grid-template-rows: var(--layout-inspector-separator-rows);
        justify-items: center;
        background: var(--color-surface-subtle);
    }

    .inspector-separator-rule {
        position: relative;
        display: grid;
        place-items: center;
        inline-size: var(--size-full);
        min-block-size: var(--space-none);
        padding: var(--space-none);
        border: none;
        background: var(--color-transparent);
        cursor: col-resize;
        touch-action: none;
        user-select: none;
    }

    .inspector-separator-grip {
        inline-size: var(--size-inspector-grip-inline);
        block-size: var(--size-inspector-grip-block);
        background: var(--color-border-strong);
        border-radius: var(--radius-chip);
    }

    .inspector-separator-rule:hover .inspector-separator-grip,
    .inspector-separator-rule:focus-visible .inspector-separator-grip,
    .inspector-separator-rule:active .inspector-separator-grip {
        background: var(--color-focus);
    }

    .inspector-separator-rule:focus-visible {
        outline: var(--border-focus);
        outline-offset: var(--space-focus-offset);
    }

    .inspector {
        grid-area: inspector;
        inline-size: var(
            --size-inspector-responsive,
            clamp(var(--size-inspector-min), var(--size-inspector-current), var(--size-inspector-max))
        );
        max-inline-size: var(--size-full);
        min-inline-size: var(--space-none);
        min-block-size: var(--space-none);
        overflow: auto;
        background: var(--color-surface);
        border-inline-start: var(--border-inspector-inline);
        border-block-start: var(--border-inspector-block);
    }
</style>
