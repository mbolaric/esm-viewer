<script lang="ts" generics="TModel">
    import { onMount, type Snippet } from 'svelte';

    import type { IChartHostLabels, IChartRuntime } from './chart-contract.js';
    import ChartFailure from './ChartFailure.svelte';

    interface IPointerTooltip {
        readonly blockOffset: number;
        readonly description: string;
        readonly inlineOffset: number;
    }

    interface IProps {
        activeDescription: string;
        ariaDescription: string;
        createRuntime: (element: HTMLElement, model: TModel) => Promise<IChartRuntime<TModel>>;
        details?: Snippet | undefined;
        id: string;
        labels: IChartHostLabels;
        model: TModel;
        onfailure: () => void;
        onfocus: () => void;
        onkeydown: (event: KeyboardEvent) => void;
        pointerTooltip: IPointerTooltip | null;
        roleDescription: string;
        selectedItemId: string | null;
    }

    let {
        activeDescription,
        ariaDescription,
        createRuntime,
        details = undefined,
        id,
        labels,
        model,
        onfailure,
        onfocus,
        onkeydown,
        pointerTooltip,
        roleDescription,
        selectedItemId,
    }: IProps = $props();

    let chartElement = $state<HTMLDivElement | undefined>();
    let chartRuntime = $state<IChartRuntime<TModel> | null>(null);
    let loadAttempt = $state(0);
    let status = $state<'failed' | 'loading' | 'ready'>('loading');
    let disposed = false;

    const activeDescriptionId = $derived(`${id}-active-item`);
    const keyboardHelpId = $derived(`${id}-keyboard-help`);

    $effect(() => {
        if (chartRuntime === null || status !== 'ready') {
            return;
        }

        try {
            chartRuntime.update(model);
            chartRuntime.focusItem(selectedItemId);
        } catch {
            showFailure();
        }
    });

    onMount(() => {
        if (chartElement === undefined) {
            showFailure();
            return;
        }

        const element = chartElement;
        if (typeof IntersectionObserver !== 'function') {
            if (element.getBoundingClientRect().width > 0) {
                void loadRuntime(element, loadAttempt);
            }
            return cleanup;
        }

        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                observer.disconnect();
                void loadRuntime(element, loadAttempt);
            }
        });
        observer.observe(element);

        return () => {
            observer.disconnect();
            cleanup();
        };
    });

    function cleanup(): void {
        disposed = true;
        chartRuntime?.dispose();
        chartRuntime = null;
    }

    function showFailure(): void {
        if (status === 'failed') {
            return;
        }
        chartRuntime?.dispose();
        chartRuntime = null;
        status = 'failed';
        onfailure();
    }

    async function loadRuntime(element: HTMLElement, attempt: number): Promise<void> {
        try {
            const runtime = await createRuntime(element, model);
            if (disposed || attempt !== loadAttempt) {
                runtime.dispose();
                return;
            }
            chartRuntime = runtime;
            status = 'ready';
            chartRuntime.focusItem(selectedItemId);
        } catch {
            if (!disposed && attempt === loadAttempt) {
                showFailure();
            }
        }
    }

    function retry(): void {
        if (chartElement === undefined) {
            showFailure();
            return;
        }
        loadAttempt += 1;
        status = 'loading';
        void loadRuntime(chartElement, loadAttempt);
    }
</script>

<div class="lazy-chart-host">
    <p class="keyboard-help" id={keyboardHelpId}>{labels.keyboardHelp}</p>
    <button
        aria-describedby={`${keyboardHelpId} ${activeDescriptionId}`}
        aria-label={ariaDescription}
        aria-roledescription={roleDescription}
        class="chart-interaction"
        {onfocus}
        {onkeydown}
        type="button"
    >
        <div aria-hidden="true" bind:this={chartElement} class="chart-surface" data-status={status}></div>
        {#if pointerTooltip !== null}
            <span
                class="pointer-tooltip"
                role="tooltip"
                style:--data-tooltip-block={`${String(pointerTooltip.blockOffset)}px`}
                style:--data-tooltip-inline={`${String(pointerTooltip.inlineOffset)}px`}
            >
                {pointerTooltip.description}
            </span>
        {/if}
    </button>

    {#if details !== undefined}
        {@render details()}
    {/if}

    {#if status === 'loading'}
        <p aria-live="polite">{labels.loading}</p>
    {:else if status === 'failed'}
        <ChartFailure
            code={labels.failureCode}
            codeLabel={labels.failureCodeLabel}
            description={labels.failureDescription}
            heading={labels.failureHeading}
            onretry={retry}
            retryLabel={labels.retry}
        />
    {/if}

    <p aria-live="polite" class="active-item" id={activeDescriptionId}>
        {activeDescription}
    </p>
</div>

<style>
    .lazy-chart-host {
        display: grid;
        gap: var(--space-stack);
    }

    .chart-interaction {
        position: relative;
        inline-size: var(--size-full);
        min-inline-size: var(--size-chart-min-inline);
        padding: var(--space-none);
        background: var(--color-transparent);
        border: var(--border-chart-interaction);
        color: inherit;
        text-align: start;
        overflow: hidden;
    }

    .chart-surface {
        min-inline-size: var(--size-chart-min-inline);
        block-size: var(--size-chart-height);
    }

    .chart-surface[data-status='failed'] {
        display: none;
    }

    .pointer-tooltip {
        position: absolute;
        inset-block-start: calc(var(--data-tooltip-block) - var(--space-actions));
        inset-inline-start: calc(var(--data-tooltip-inline) + var(--space-actions));
        max-inline-size: var(--size-chart-tooltip);
        padding: var(--space-actions);
        background: var(--color-surface);
        border: var(--border-panel);
        border-radius: var(--radius-control);
        box-shadow: var(--shadow-tooltip);
        color: var(--color-text);
        pointer-events: none;
        transform: var(--transform-tooltip);
    }

    .keyboard-help,
    .active-item {
        color: var(--color-text-muted);
    }

    .active-item {
        min-block-size: var(--size-chart-description);
    }
</style>
