<script lang="ts">
    import type { Snippet } from 'svelte';

    import Icon from '../icon/Icon.svelte';
    import type { IconName } from '../icon/icon-registry.js';
    import { dismissDisclosureOnEscape, dismissDisclosureOnOutsidePointer } from './disclosure-dismissal.js';

    interface IProps {
        children: Snippet;
        icon: IconName;
        menuLabel: string;
        ontriggerkeydown?: ((event: KeyboardEvent) => void) | undefined;
        // `viewport` pins the menu with fixed positioning so `overflow: hidden` ancestors such as table shells cannot clip it.
        placement?: 'anchored' | 'viewport';
        triggerLabel: string;
        triggerTitle?: string | undefined;
        variant?: 'separator' | 'toolbar';
    }

    let {
        children,
        icon,
        menuLabel,
        ontriggerkeydown = undefined,
        placement = 'anchored',
        triggerLabel,
        triggerTitle = undefined,
        variant = 'toolbar',
    }: IProps = $props();

    let menuElement = $state<HTMLDetailsElement | undefined>();
    let menuListElement = $state<HTMLDivElement | undefined>();
    let isOpen = $state(false);
    let viewportStyle = $state('');

    function updateViewportPosition(): void {
        if (menuElement === undefined) {
            return;
        }
        const gap = 4;
        const triggerRect = menuElement.getBoundingClientRect();
        const isRtl = globalThis.getComputedStyle(menuElement).direction === 'rtl';
        const declarations = ['position: fixed'];
        const menuHeight = menuListElement?.getBoundingClientRect().height ?? 0;
        const opensUpward =
            triggerRect.bottom + gap + menuHeight > globalThis.innerHeight && triggerRect.top - gap - menuHeight >= 0;
        if (opensUpward) {
            declarations.push(`bottom: ${String(globalThis.innerHeight - triggerRect.top + gap)}px`);
        } else {
            declarations.push(`top: ${String(triggerRect.bottom + gap)}px`);
        }
        if (isRtl) {
            declarations.push(`left: ${String(triggerRect.left)}px`);
        } else {
            declarations.push(`right: ${String(globalThis.innerWidth - triggerRect.right)}px`);
        }
        viewportStyle = declarations.join('; ');
    }

    $effect(() => {
        if (!isOpen || placement !== 'viewport') {
            return;
        }
        updateViewportPosition();
        globalThis.addEventListener('resize', updateViewportPosition);
        globalThis.addEventListener('scroll', updateViewportPosition, true);
        return () => {
            globalThis.removeEventListener('resize', updateViewportPosition);
            globalThis.removeEventListener('scroll', updateViewportPosition, true);
        };
    });
</script>

<svelte:window
    onkeydown={(event: KeyboardEvent) => dismissDisclosureOnEscape(event, menuElement)}
    onpointerdown={(event: PointerEvent) => dismissDisclosureOnOutsidePointer(event, menuElement)}
/>

<details bind:this={menuElement} bind:open={isOpen} class="disclosure-menu" data-variant={variant}>
    <summary aria-label={triggerLabel} title={triggerTitle ?? triggerLabel} onkeydown={ontriggerkeydown}>
        <Icon name={icon} size={variant === 'separator' ? 'small' : 'default'} />
    </summary>
    <div
        bind:this={menuListElement}
        aria-label={menuLabel}
        class="disclosure-menu-list popover-surface"
        role="group"
        style={placement === 'viewport' ? viewportStyle : undefined}
    >
        {@render children()}
    </div>
</details>

<style>
    .disclosure-menu {
        position: relative;
    }

    .disclosure-menu summary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--color-transparent);
        border-radius: var(--radius-control);
        font: inherit;
        cursor: pointer;
        list-style: none;
        transition:
            background-color var(--duration-fast) var(--easing-standard),
            color var(--duration-fast) var(--easing-standard);
    }

    .disclosure-menu summary:focus-visible {
        outline: var(--border-focus);
        outline-offset: var(--space-focus-offset);
    }

    .disclosure-menu summary:hover {
        background: var(--color-surface-hover);
        color: var(--color-text);
    }

    .disclosure-menu summary::-webkit-details-marker {
        display: none;
    }

    .disclosure-menu[data-variant='toolbar'] summary {
        min-block-size: var(--size-control-compact);
        inline-size: var(--size-control-compact);
        padding-block: var(--space-none);
        padding-inline: var(--space-none);
        border-color: var(--color-transparent);
        color: var(--color-accent);
    }

    .disclosure-menu[data-variant='separator'] {
        display: grid;
        place-items: center;
        inline-size: var(--size-inspector-separator);
    }

    .disclosure-menu[data-variant='separator'] summary {
        min-block-size: var(--size-inspector-separator);
        inline-size: var(--size-full);
        border: none;
        color: var(--color-text-muted);
    }

    .disclosure-menu[data-variant='separator'] .disclosure-menu-list {
        padding: var(--space-actions);
        min-inline-size: var(--size-inspector-menu-min-inline);
    }
</style>
