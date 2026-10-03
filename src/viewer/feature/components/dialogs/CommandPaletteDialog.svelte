<script lang="ts">
    import { tick } from 'svelte';

    import type { ApplicationCommand } from '#contracts';
    import type { IApplicationCommand } from '#shell';
    import { createSearchMatcher } from '#localization';
    import { Button, Icon, type IconName } from '#ui';
    import type { DocumentWorkspaceSection } from '#viewer-application';
    import type { DocumentKind } from '#viewer-domain';

    import type { ICommandPaletteDestination } from '../../command-palette-destination.js';
    import { sectionIcons, translateDocumentSection } from '../../helpers/viewer-labels.js';
    import { useViewerContext, useViewerTranslationService } from '../../viewer-context.js';

    interface IProps {
        availableSections: readonly DocumentWorkspaceSection[];
        documentKind?: DocumentKind | undefined;
        isOpen: boolean;
        onclose: () => void;
        onselectsection: (section: DocumentWorkspaceSection) => void;
        paletteDestinations?: readonly ICommandPaletteDestination[] | undefined;
        additionalCommands?: readonly IApplicationCommand[];
    }

    let {
        availableSections,
        documentKind = 'driverCard',
        isOpen,
        onclose,
        onselectsection,
        paletteDestinations = [],
        additionalCommands = [],
    }: IProps = $props();

    const viewerContext = useViewerContext();
    const translationService = useViewerTranslationService();
    const commandController = viewerContext.commandController;

    let searchQuery = $state('');
    let activeIndex = $state(0);
    let dialogElement = $state<HTMLDialogElement | undefined>();
    let searchInput = $state<HTMLInputElement | undefined>();

    const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/i.test(navigator.userAgent || navigator.platform);
    const modifierKey = isMac ? '⌘' : 'Ctrl+';

    interface IPaletteItem {
        action?: () => void;
        category: 'command' | 'destination' | 'section';
        command?: ApplicationCommand;
        icon: IconName;
        id: string;
        label: string;
        section?: DocumentWorkspaceSection;
        shortcut?: string;
    }

    const allSections = $derived<readonly IPaletteItem[]>(
        availableSections.map((sec) => ({
            category: 'section',
            icon: sectionIcons[sec] ?? 'columns',
            id: `sec-${sec}`,
            label: translateDocumentSection(sec, documentKind, translationService),
            section: sec,
        })),
    );

    const allDestinations = $derived<readonly IPaletteItem[]>(
        paletteDestinations.map((destination) => ({
            action: destination.onselect,
            category: 'destination',
            icon: destination.icon,
            id: `destination-${destination.id}`,
            label: destination.label,
        })),
    );

    const allCommands = $derived.by<readonly IPaletteItem[]>(() => {
        const list: IPaletteItem[] = [];
        if (commandController.state['file.open']) {
            list.push({
                category: 'command',
                command: 'file.open',
                icon: 'folderOpen',
                id: 'cmd-open',
                label: commandController.label('file.open'),
                shortcut: `${modifierKey}O`,
            });
        }
        if (commandController.state['file.export']) {
            list.push({
                category: 'command',
                command: 'file.export',
                icon: 'download',
                id: 'cmd-export',
                label: commandController.label('file.export'),
                shortcut: `${modifierKey}E`,
            });
        }
        if (commandController.state['application.preferences']) {
            list.push({
                category: 'command',
                command: 'application.preferences',
                icon: 'hammer',
                id: 'cmd-pref',
                label: commandController.label('application.preferences'),
                shortcut: `${modifierKey},`,
            });
        }
        if (commandController.state['application.userGuide']) {
            list.push({
                category: 'command',
                command: 'application.userGuide',
                icon: 'circleHelp',
                id: 'cmd-user-guide',
                label: commandController.label('application.userGuide'),
                shortcut: 'F1',
            });
        }
        if (commandController.state['application.about']) {
            list.push({
                category: 'command',
                command: 'application.about',
                icon: 'circleHelp',
                id: 'cmd-about',
                label: commandController.label('application.about'),
            });
        }
        if (commandController.state['file.close']) {
            list.push({
                category: 'command',
                command: 'file.close',
                icon: 'circleX',
                id: 'cmd-close',
                label: commandController.label('file.close'),
                shortcut: `${modifierKey}W`,
            });
        }
        return list;
    });

    const filteredItems = $derived.by(() => {
        const matchesSearch = createSearchMatcher(searchQuery);
        const contributedCommands: IPaletteItem[] = additionalCommands
            .filter((command) => command.enabled)
            .map((command) => ({
                action: command.onexecute,
                category: 'command',
                icon: command.icon ?? 'columns',
                id: `cmd-module-${command.id}`,
                label: command.label,
            }));
        return [...allSections, ...allDestinations, ...allCommands, ...contributedCommands].filter((item) =>
            matchesSearch([item.label]),
        );
    });

    const activeItem = $derived<IPaletteItem | undefined>(filteredItems[activeIndex]);

    $effect(() => {
        if (!isOpen || dialogElement === undefined) {
            return;
        }

        const activeElement = globalThis.document.activeElement;
        const previouslyFocusedElement = activeElement instanceof HTMLElement ? activeElement : null;
        searchQuery = '';
        activeIndex = 0;
        if (typeof dialogElement.showModal === 'function') {
            dialogElement.showModal();
        } else {
            dialogElement.setAttribute('open', '');
        }
        void tick().then(() => {
            searchInput?.focus();
        });

        return (): void => {
            if (dialogElement?.open) {
                if (typeof dialogElement.close === 'function') {
                    dialogElement.close();
                } else {
                    dialogElement.removeAttribute('open');
                }
            }
            previouslyFocusedElement?.focus();
        };
    });

    $effect(() => {
        if (filteredItems.length > 0 && activeIndex >= filteredItems.length) {
            activeIndex = 0;
        }
    });

    function selectItem(item: IPaletteItem): void {
        onclose();
        if (item.action !== undefined) {
            item.action();
        } else if (item.category === 'section' && item.section !== undefined) {
            onselectsection(item.section);
        } else if (item.category === 'command' && item.command !== undefined) {
            commandController.execute(item.command);
        }
    }

    function handleKeydown(event: KeyboardEvent): void {
        if (event.key === 'Tab') {
            const dialog = event.currentTarget;
            if (!(dialog instanceof HTMLDialogElement)) {
                return;
            }
            const focusableElements = Array.from(
                dialog.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled)'),
            );
            const firstElement = focusableElements[0];
            const lastElement = focusableElements.at(-1);
            if (firstElement === undefined || lastElement === undefined) {
                event.preventDefault();
                dialog.focus();
                return;
            }

            const activeElement = globalThis.document.activeElement;
            if (event.shiftKey && activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
                return;
            }
            if (!event.shiftKey && activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
                return;
            }
        }

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                if (filteredItems.length > 0) {
                    activeIndex = (activeIndex + 1) % filteredItems.length;
                }
                break;
            case 'ArrowUp':
                event.preventDefault();
                if (filteredItems.length > 0) {
                    activeIndex = (activeIndex - 1 + filteredItems.length) % filteredItems.length;
                }
                break;
            case 'Enter':
                event.preventDefault();
                {
                    const item = activeItem;
                    if (item !== undefined) {
                        selectItem(item);
                    }
                }
                break;
            case 'Escape':
                event.preventDefault();
                onclose();
                break;
        }
    }

    function handleCancel(event: Event): void {
        event.preventDefault();
        onclose();
    }

    function handleOverlayClick(event: MouseEvent): void {
        if (event.target === event.currentTarget) {
            onclose();
        }
    }
</script>

{#if isOpen}
    <dialog
        bind:this={dialogElement}
        class="palette-overlay"
        tabindex="-1"
        aria-label={translationService.translate('commandPalette.ariaLabel')}
        oncancel={handleCancel}
        onclick={handleOverlayClick}
        onkeydown={handleKeydown}
    >
        <div class="palette-container" role="document">
            <header class="palette-header">
                <Icon name="search" />
                <input
                    aria-activedescendant={activeItem !== undefined ? activeItem.id : undefined}
                    aria-autocomplete="list"
                    aria-controls="palette-listbox"
                    aria-expanded={isOpen}
                    bind:this={searchInput}
                    bind:value={searchQuery}
                    class="palette-input"
                    placeholder={translationService.translate('commandPalette.placeholder')}
                    role="combobox"
                    type="search"
                />
                <Button
                    ariaLabel={translationService.translate('inspector.close')}
                    icon="x"
                    iconOnly={true}
                    label={translationService.translate('inspector.close')}
                    onclick={onclose}
                    size="compact"
                    variant="ghost"
                />
            </header>

            <div class="palette-body">
                {#if filteredItems.length === 0}
                    <p class="empty-state">
                        {translationService.translate('commandPalette.noMatches')}
                    </p>
                {:else}
                    <ul class="palette-list" id="palette-listbox" role="listbox">
                        {#each filteredItems as item, idx (item.id)}
                            <li id={item.id} role="option" aria-selected={idx === activeIndex}>
                                <button
                                    type="button"
                                    class="palette-item"
                                    class:selected={idx === activeIndex}
                                    onclick={() => selectItem(item)}
                                    onmouseenter={() => (activeIndex = idx)}
                                >
                                    <span class="item-icon">
                                        <Icon name={item.icon} size="small" />
                                    </span>
                                    <span class="item-label">{item.label}</span>
                                    {#if item.shortcut}
                                        <kbd class="item-shortcut">{item.shortcut}</kbd>
                                    {/if}
                                </button>
                            </li>
                        {/each}
                    </ul>
                {/if}
            </div>
        </div>
    </dialog>
{/if}

<style>
    .palette-overlay {
        position: fixed;
        inset: var(--space-none);
        z-index: var(--z-index-popover);
        inline-size: var(--size-full);
        max-inline-size: none;
        block-size: var(--size-full);
        max-block-size: none;
        margin: var(--space-none);
        border: none;
        padding-block-start: var(--space-task);
        background: var(--color-transparent);
        color: var(--color-text);
    }

    .palette-overlay[open] {
        display: grid;
        place-items: start center;
    }

    .palette-overlay::backdrop {
        background: var(--color-dialog-backdrop);
    }

    .palette-container {
        display: flex;
        flex-direction: column;
        inline-size: min(var(--size-dialog), calc(var(--size-full) - var(--space-shell)));
        max-block-size: calc(var(--size-viewport) - var(--space-task));
        background: var(--color-surface);
        border: var(--border-panel);
        border-radius: var(--radius-panel);
        box-shadow: var(--shadow-dialog);
        overflow: hidden;
    }

    .palette-header {
        display: flex;
        align-items: center;
        gap: var(--space-compact);
        padding: var(--space-compact) var(--space-panel);
        border-block-end: var(--border-panel);
        background: var(--color-surface-subtle);
    }

    .palette-input {
        flex: var(--layout-search-input-field-flex);
        border: none;
        outline: none;
        background: var(--color-transparent);
        color: var(--color-text);
        font-size: var(--font-size-body);
        font-family: inherit;
        padding-block: var(--space-compact);
    }

    .palette-body {
        overflow-y: auto;
        padding: var(--space-compact);
    }

    .empty-state {
        padding: var(--space-panel);
        text-align: center;
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
    }

    .palette-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-compact);
        margin: var(--space-none);
        padding: var(--space-none);
        list-style: none;
    }

    .palette-item {
        display: flex;
        align-items: center;
        gap: var(--space-compact);
        inline-size: var(--size-full);
        padding: var(--space-compact) var(--space-actions);
        border: none;
        border-radius: var(--radius-control);
        background: var(--color-transparent);
        color: var(--color-text);
        font: inherit;
        text-align: start;
        cursor: pointer;
    }

    .palette-item:hover,
    .palette-item.selected {
        background: var(--color-surface-hover);
        color: var(--color-accent);
    }

    .item-icon {
        display: flex;
        align-items: center;
        color: var(--color-text-muted);
    }

    .palette-item:hover .item-icon,
    .palette-item.selected .item-icon {
        color: var(--color-accent);
    }

    .item-label {
        flex: var(--layout-search-input-field-flex);
        font-weight: var(--font-weight-body);
    }

    .item-shortcut {
        padding-block: var(--space-none);
        padding-inline: var(--space-compact);
        background: var(--color-surface-subtle);
        border: var(--border-control);
        border-radius: var(--radius-control);
        font-size: var(--font-size-metadata);
        font-family: var(--font-family-source);
        color: var(--color-text-muted);
    }
</style>
