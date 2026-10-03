<script lang="ts">
    import Icon from '../icon/Icon.svelte';
    import type { IconName } from '../icon/icon-registry.js';

    interface IProps {
        ariaLabel?: string;
        disabled?: boolean;
        icon?: IconName;
        iconOnly?: boolean;
        label: string;
        onclick: () => void;
        pressed?: boolean;
        size?: 'compact' | 'default';
        tooltip?: string;
        tooltipAlign?: 'center' | 'end' | 'start';
        // Uses fixed positioning relative to viewport to avoid clipping by overflow:hidden ancestors.
        tooltipFloating?: boolean;
        tooltipPosition?: 'above' | 'below';
        truncate?: boolean;
        variant?: 'danger' | 'ghost' | 'primary' | 'secondary' | 'warning';
    }

    let {
        ariaLabel = undefined,
        disabled = false,
        icon = undefined,
        iconOnly = false,
        label,
        onclick,
        pressed = undefined,
        size = 'default',
        tooltip = undefined,
        tooltipAlign = 'center',
        tooltipFloating = false,
        tooltipPosition = 'above',
        truncate = false,
        variant = 'secondary',
    }: IProps = $props();

    let buttonElement = $state<HTMLButtonElement | undefined>();

    // Computes button viewport bounds and sets --tooltip-fixed-* properties on hover/focus to position floating tooltip.
    function updateFloatingTooltipPosition(): void {
        if (!tooltipFloating || tooltip === undefined || buttonElement === undefined) {
            return;
        }
        const gap = 4;
        const rect = buttonElement.getBoundingClientRect();
        const isRtl = globalThis.getComputedStyle(buttonElement).direction === 'rtl';
        if (tooltipPosition === 'below') {
            buttonElement.style.setProperty('--tooltip-fixed-top', `${String(rect.bottom + gap)}px`);
            buttonElement.style.removeProperty('--tooltip-fixed-bottom');
        } else {
            buttonElement.style.setProperty('--tooltip-fixed-bottom', `${String(globalThis.innerHeight - rect.top + gap)}px`);
            buttonElement.style.removeProperty('--tooltip-fixed-top');
        }
        if (tooltipAlign === 'end') {
            const edgeProperty = isRtl ? '--tooltip-fixed-left' : '--tooltip-fixed-right';
            const otherEdgeProperty = isRtl ? '--tooltip-fixed-right' : '--tooltip-fixed-left';
            const edgeValue = isRtl ? rect.left : globalThis.innerWidth - rect.right;
            buttonElement.style.setProperty(edgeProperty, `${String(edgeValue)}px`);
            buttonElement.style.removeProperty(otherEdgeProperty);
            buttonElement.style.removeProperty('--tooltip-fixed-transform');
        } else if (tooltipAlign === 'start') {
            const edgeProperty = isRtl ? '--tooltip-fixed-right' : '--tooltip-fixed-left';
            const otherEdgeProperty = isRtl ? '--tooltip-fixed-left' : '--tooltip-fixed-right';
            const edgeValue = isRtl ? globalThis.innerWidth - rect.right : rect.left;
            buttonElement.style.setProperty(edgeProperty, `${String(edgeValue)}px`);
            buttonElement.style.removeProperty(otherEdgeProperty);
            buttonElement.style.removeProperty('--tooltip-fixed-transform');
        } else {
            buttonElement.style.setProperty('--tooltip-fixed-left', `${String(rect.left + rect.width / 2)}px`);
            buttonElement.style.removeProperty('--tooltip-fixed-right');
            buttonElement.style.setProperty('--tooltip-fixed-transform', 'translateX(-50%)');
        }
    }
</script>

<button
    aria-label={ariaLabel}
    aria-pressed={pressed}
    bind:this={buttonElement}
    class="button has-tooltip {variant}"
    class:compact={size === 'compact'}
    class:truncate
    class:tooltip-end={tooltipAlign === 'end'}
    class:tooltip-start={tooltipAlign === 'start'}
    class:tooltip-below={tooltipPosition === 'below'}
    class:tooltip-floating={tooltipFloating}
    type="button"
    {disabled}
    {onclick}
    onfocus={updateFloatingTooltipPosition}
    onmouseenter={updateFloatingTooltipPosition}
    data-tooltip={tooltip}
    class:icon-only={iconOnly}
>
    {#if icon !== undefined}
        <Icon name={icon} />
    {/if}
    {#if !iconOnly}
        <span class="label">{label}</span>
    {/if}
</button>

<style>
    .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        block-size: var(--size-control);
        gap: var(--space-actions);
        padding-block: var(--space-none);
        padding-inline: var(--space-control-inline);
        border: var(--border-control);
        border-radius: var(--radius-control);
        font: inherit;
        font-weight: var(--font-weight-action);
        line-height: normal;
        letter-spacing: var(--letter-spacing-label);
        white-space: nowrap;
        vertical-align: middle;
        cursor: pointer;
        transition:
            background-color var(--duration-fast) var(--easing-standard),
            border-color var(--duration-fast) var(--easing-standard),
            color var(--duration-fast) var(--easing-standard);
    }

    /* Prevents icon from shrinking when .truncate constrains button width. */
    .button :global(svg) {
        flex: var(--layout-button-icon-flex);
    }

    /*
     * Consumers may hide the visible label - a command bar that switches to
     * icon-only actions at narrow widths does - while the button keeps its
     * accessible name from `ariaLabel` and its tooltip.
     */
    .button .label {
        display: var(--display-button-label, inline-flex);
        align-items: center;
        block-size: var(--size-full);
        overflow: hidden;
        line-height: var(--line-height-tight);
    }

    .button.truncate .label {
        min-inline-size: var(--space-none);
        text-overflow: ellipsis;
    }

    .button.compact {
        block-size: var(--size-control-compact);
        padding-inline: var(--space-compact);
    }

    .primary {
        border-color: var(--color-accent);
        background: var(--color-accent);
        color: var(--color-on-accent);
    }

    .primary:hover:not(:disabled) {
        background: var(--color-accent-hover);
    }

    .secondary {
        background: var(--color-surface);
        color: var(--color-text);
    }

    .secondary:hover:not(:disabled) {
        background: var(--color-surface-hover);
    }

    .ghost {
        border-color: var(--color-transparent);
        background: var(--color-transparent);
        color: var(--color-accent);
    }

    .ghost:hover:not(:disabled) {
        background: var(--color-surface-hover);
    }

    .danger {
        border-color: var(--color-transparent);
        background: var(--color-transparent);
        color: var(--color-danger);
    }

    .danger:hover:not(:disabled) {
        background: var(--color-danger-soft);
    }

    .warning {
        border-color: var(--color-transparent);
        background: var(--color-transparent);
        color: var(--color-warning);
    }

    .warning:hover:not(:disabled) {
        background: var(--color-warning-soft);
    }

    .button[aria-pressed='true']:not(:disabled) {
        border-color: var(--color-accent);
        background: var(--color-surface-selected);
        color: var(--color-text);
    }

    .button.icon-only {
        min-inline-size: var(--size-control);
        padding-inline: var(--space-none);
    }

    .button.compact.icon-only {
        min-inline-size: var(--size-control-compact);
    }

    /* Constrains button to container width and ellipsizes text overflow. */
    .button.truncate {
        min-inline-size: var(--space-none);
        max-inline-size: var(--size-full);
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .button:disabled {
        opacity: var(--opacity-disabled);
        cursor: default;
    }
</style>
