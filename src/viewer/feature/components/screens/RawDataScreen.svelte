<script lang="ts">
    import type { RawDataNodeKind } from '#viewer-application';
    import type { JsonPointer } from '#viewer-domain';
    import type { IRawDataExplorerViewModel } from '#viewer-presentation';
    import { Button, focusOnMount, Icon } from '#ui';
    import { untrack } from 'svelte';

    import {
        RawDataController,
        type IRawDataPaginationItem,
        type IRawDataRevealRequest,
        type IRawDataVisibleNode,
    } from '../../controllers/raw-data-controller.svelte.js';
    import type { TranslationKey } from '#i18n-locales';
    import { useViewerTranslationService } from '../../viewer-context.js';

    interface IProps {
        explorer: IRawDataExplorerViewModel;
        initialPath: JsonPointer | null;
        oncopy: (value: string) => Promise<boolean>;
        revealRequest: IRawDataRevealRequest | null;
    }

    let { explorer, initialPath, oncopy, revealRequest }: IProps = $props();

    const translationService = useViewerTranslationService();
    const nodeKindTranslationKeys = {
        array: 'rawData.type.array',
        boolean: 'rawData.type.boolean',
        null: 'rawData.type.null',
        number: 'rawData.type.number',
        object: 'rawData.type.object',
        string: 'rawData.type.string',
    } satisfies Readonly<Record<RawDataNodeKind, TranslationKey>>;
    const controller = untrack(() => new RawDataController(explorer, initialPath));
    const snapshot = $derived(controller.snapshot);
    let copyStatus = $state<'failed' | 'idle' | 'succeeded'>('idle');

    // A new reveal request reaches an already mounted tree, so the shell can re-point it without remounting the screen
    // and asking for the same pointer twice returns to it.
    $effect(() => {
        controller.revealRequest(revealRequest);
    });

    function handleSearch(event: Event): void {
        const target = event.currentTarget;
        if (target instanceof HTMLInputElement) {
            controller.find(target.value);
        }
    }

    function handleSearchKeydown(event: KeyboardEvent): void {
        switch (event.key) {
            case 'Enter':
                event.preventDefault();
                if (event.shiftKey) {
                    controller.previousMatch();
                } else {
                    controller.nextMatch();
                }
                return;
            case 'Escape':
                event.preventDefault();
                controller.closeFind();
                return;
        }
    }

    function focusTreeItem(current: HTMLButtonElement, targetIndex: number): void {
        const tree = current.closest('[role="tree"]');
        if (tree === null) {
            return;
        }
        const items = tree.querySelectorAll<HTMLButtonElement>('[role="treeitem"]');
        items.item(targetIndex)?.focus();
    }

    function handleTreeKeydown(event: KeyboardEvent, item: IRawDataVisibleNode): void {
        const current = event.currentTarget;
        if (!(current instanceof HTMLButtonElement)) {
            return;
        }
        const tree = current.closest('[role="tree"]');
        if (tree === null) {
            return;
        }
        const items = Array.from(tree.querySelectorAll<HTMLButtonElement>('[role="treeitem"]'));
        const currentIndex = items.indexOf(current);
        if (currentIndex < 0) {
            return;
        }

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                focusTreeItem(current, Math.min(currentIndex + 1, items.length - 1));
                return;
            case 'ArrowLeft':
                event.preventDefault();
                if (item.expanded === true) {
                    controller.collapse(item.node.path);
                    return;
                }
                if (item.node.parentPath !== null) {
                    const parentIndex = snapshot.visibleItems.findIndex(
                        (candidate) => candidate.itemType === 'node' && candidate.node.path === item.node.parentPath,
                    );
                    if (parentIndex >= 0) {
                        const precedingNodes = snapshot.visibleItems
                            .slice(0, parentIndex + 1)
                            .filter((candidate) => candidate.itemType === 'node');
                        focusTreeItem(current, precedingNodes.length - 1);
                    }
                }
                return;
            case 'ArrowRight':
                event.preventDefault();
                if (item.expanded === false) {
                    controller.expand(item.node.path);
                    return;
                }
                if (item.expanded === true) {
                    focusTreeItem(current, Math.min(currentIndex + 1, items.length - 1));
                }
                return;
            case 'ArrowUp':
                event.preventDefault();
                focusTreeItem(current, Math.max(currentIndex - 1, 0));
                return;
            case 'End':
                event.preventDefault();
                focusTreeItem(current, items.length - 1);
                return;
            case 'Home':
                event.preventDefault();
                focusTreeItem(current, 0);
                return;
        }
    }

    function nodeLabel(item: IRawDataVisibleNode): string {
        return item.node.key ?? translationService.translate('rawData.tree.root');
    }

    async function copyEvidence(value: string): Promise<void> {
        copyStatus = 'idle';
        copyStatus = (await oncopy(value)) ? 'succeeded' : 'failed';
    }

    function openNextPage(item: IRawDataPaginationItem): void {
        if (item.nextOffset !== null) {
            controller.openPage(item.parentPath, item.nextOffset);
        }
    }

    function openPreviousPage(item: IRawDataPaginationItem): void {
        if (item.previousOffset !== null) {
            controller.openPage(item.parentPath, item.previousOffset);
        }
    }

    function typeLabel(kind: RawDataNodeKind): string {
        return translationService.translate(nodeKindTranslationKeys[kind]);
    }
</script>

<article class="raw-data">
    <header class="screen-header">
        <h1 tabindex="-1" use:focusOnMount>
            {translationService.translate('navigator.section.rawData')}
        </h1>
        <div class="evidence-panel search">
            <label for="raw-data-search">
                {translationService.translate('rawData.search.label')}
            </label>
            <input
                id="raw-data-search"
                oninput={handleSearch}
                onkeydown={handleSearchKeydown}
                type="search"
                value={snapshot.find.query}
            />
            <div class="search-actions">
                <Button
                    disabled={snapshot.find.matchCount === 0}
                    label={translationService.translate('rawData.search.previous')}
                    onclick={() => controller.previousMatch()}
                />
                <Button
                    disabled={snapshot.find.matchCount === 0}
                    label={translationService.translate('rawData.search.next')}
                    onclick={() => controller.nextMatch()}
                />
                <Button
                    disabled={snapshot.find.query.length === 0}
                    label={translationService.translate('rawData.search.clear')}
                    onclick={() => controller.closeFind()}
                />
            </div>
            <p class="search-status" aria-live="polite">
                {#if snapshot.find.query.length > 0 && snapshot.find.matchCount === 0}
                    {translationService.translate('rawData.search.noMatches')}
                {:else if snapshot.find.currentMatchNumber !== null}
                    {snapshot.find.currentMatchNumber}
                    {translationService.translate('rawData.search.of')}
                    {snapshot.find.matchCount}
                    {translationService.translate('rawData.search.results')}
                {/if}
            </p>
            {#if snapshot.find.truncated}
                <p class="search-status">
                    {translationService.translate('rawData.search.truncated')}
                </p>
            {/if}
        </div>
    </header>

    {#if snapshot.error !== null}
        <p class="evidence-error" role="status">
            {translationService.translate('rawData.value.sourceUnavailable')}
            {#if snapshot.requestedPath !== null}
                <code>
                    {snapshot.requestedPath === ''
                        ? translationService.translate('rawData.value.rootPath')
                        : snapshot.requestedPath}
                </code>
            {/if}
        </p>
    {/if}

    <div class="raw-layout">
        <section class="evidence-panel tree-panel" aria-labelledby="raw-tree-heading">
            <div class="section-heading">
                <h2 id="raw-tree-heading">
                    {translationService.translate('rawData.tree.decodedStructure')}
                </h2>
                <div class="tree-actions">
                    <Button
                        icon="chevronDown"
                        label={translationService.translate('rawData.tree.expandOneLevel')}
                        onclick={() => controller.expandOneLevel()}
                        variant="ghost"
                    />
                    <Button
                        icon="chevronRight"
                        label={translationService.translate('rawData.tree.collapseAll')}
                        onclick={() => controller.collapseAll()}
                        variant="ghost"
                    />
                </div>
            </div>
            <ul class="tree" role="tree" aria-label={translationService.translate('rawData.tree.ariaLabel')}>
                {#each snapshot.visibleItems as item (item.itemType === 'node' ? item.node.path : `${item.parentPath}:pagination`)}
                    {#if item.itemType === 'node'}
                        <li role="none">
                            <button
                                aria-expanded={item.expanded ?? undefined}
                                aria-level={item.level}
                                aria-posinset={item.node.positionInSet}
                                aria-selected={item.node.path === snapshot.selectedNode.path}
                                aria-setsize={item.node.setSize}
                                class:selected={item.node.path === snapshot.selectedNode.path}
                                onclick={() => controller.activate(item.node.path)}
                                onkeydown={(event) => handleTreeKeydown(event, item)}
                                role="treeitem"
                                type="button"
                            >
                                <span class="indentation" aria-hidden="true">
                                    {#each item.indentationLevels as level (level)}
                                        <span></span>
                                    {/each}
                                </span>
                                {#if item.expanded !== null}
                                    <span class="disclosure" aria-hidden="true">
                                        <Icon name={item.expanded ? 'chevronDown' : 'chevronRight'} size="small" />
                                    </span>
                                {:else}
                                    <span class="disclosure" aria-hidden="true"></span>
                                {/if}
                                <span class="node-key">{nodeLabel(item)}</span>
                                <span class="node-type">{typeLabel(item.node.kind)}</span>
                                {#if item.node.displayValue !== null}
                                    <code class="node-preview">{item.node.displayValue}</code>
                                {/if}
                            </button>
                        </li>
                    {:else}
                        <li class="page-actions" role="none">
                            <span class="indentation" aria-hidden="true">
                                {#each item.indentationLevels as level (level)}
                                    <span></span>
                                {/each}
                            </span>
                            <Button
                                disabled={item.previousOffset === null}
                                label={translationService.translate('rawData.tree.previousChildren')}
                                onclick={() => openPreviousPage(item)}
                            />
                            <Button
                                disabled={item.nextOffset === null}
                                label={translationService.translate('rawData.tree.nextChildren')}
                                onclick={() => openNextPage(item)}
                            />
                        </li>
                    {/if}
                {/each}
            </ul>
        </section>

        <section class="evidence-panel selected-value" aria-labelledby="raw-value-heading">
            <h2 id="raw-value-heading">
                {translationService.translate('rawData.value.selectedValue')}
            </h2>
            <nav aria-label={translationService.translate('rawData.tree.breadcrumb')}>
                <ol class="breadcrumb">
                    {#each snapshot.selectedLineage as node, index (node.path)}
                        {#if index > 0}
                            <li class="breadcrumb-separator" aria-hidden="true">
                                <Icon name="chevronRight" size="small" />
                            </li>
                        {/if}
                        <li>
                            <button
                                aria-current={node.path === snapshot.selectedNode.path ? 'location' : undefined}
                                onclick={() => controller.select(node.path)}
                                type="button"
                            >
                                {node.key ?? translationService.translate('rawData.tree.root')}
                            </button>
                        </li>
                    {/each}
                </ol>
            </nav>
            <dl class="evidence-details">
                <div>
                    <dt>{translationService.translate('rawData.value.path')}</dt>
                    <dd class="pointer-path-cell">
                        <code>
                            {snapshot.selectedNode.path === ''
                                ? translationService.translate('rawData.value.rootPath')
                                : snapshot.selectedNode.path}
                        </code>
                        <Button
                            ariaLabel={`${translationService.translate('rawData.value.copyPath')}: ${snapshot.selectedNode.path}`}
                            icon="copy"
                            iconOnly={true}
                            label={translationService.translate('rawData.value.copyPath')}
                            onclick={() => {
                                const path = snapshot.selectedNode.path === '' ? '/' : snapshot.selectedNode.path;
                                void copyEvidence(path);
                            }}
                            size="compact"
                            tooltip={translationService.translate('rawData.value.copyPath')}
                            variant="ghost"
                        />
                    </dd>
                </div>
                <div>
                    <dt>{translationService.translate('rawData.value.key')}</dt>
                    <dd>
                        {snapshot.selectedNode.key ?? translationService.translate('rawData.tree.root')}
                    </dd>
                </div>
                <div>
                    <dt>{translationService.translate('rawData.value.type')}</dt>
                    <dd>{typeLabel(snapshot.selectedNode.kind)}</dd>
                </div>
                {#if snapshot.selectedNode.displayValue === null}
                    <div>
                        <dt>{translationService.translate('rawData.value.value')}</dt>
                        <dd>
                            {translationService.translate('rawData.value.structuredValue')}
                        </dd>
                    </div>
                    <div>
                        <dt>
                            {snapshot.selectedNode.childCount.value === 1
                                ? translationService.translate('rawData.value.childEntry')
                                : translationService.translate('rawData.value.childEntries')}
                        </dt>
                        <dd>{snapshot.selectedNode.childCount.display}</dd>
                    </div>
                {:else}
                    <div>
                        <dt>{translationService.translate('rawData.value.value')}</dt>
                        <dd>
                            <pre><code>{snapshot.selectedNode.displayValue}</code></pre>
                        </dd>
                    </div>
                {/if}
            </dl>
            <div class="copy-actions">
                <Button
                    label={translationService.translate('rawData.value.copyPath')}
                    onclick={() => {
                        void copyEvidence(snapshot.selectedNode.path);
                    }}
                />
                {#if snapshot.selectedNode.clipboardValue !== null}
                    <Button
                        label={translationService.translate('rawData.value.copyValue')}
                        onclick={() => {
                            const value = snapshot.selectedNode.clipboardValue;
                            if (value !== null) {
                                void copyEvidence(value);
                            }
                        }}
                    />
                {/if}
            </div>
            <p class="copy-status" aria-live="polite">
                {#if copyStatus === 'succeeded'}
                    {translationService.translate('rawData.value.copySucceeded')}
                {:else if copyStatus === 'failed'}
                    {translationService.translate('rawData.value.copyFailed')}
                {/if}
            </p>
        </section>
    </div>
</article>

<style>
    .raw-data {
        display: grid;
        gap: var(--space-stack);
    }

    .raw-data {
        inline-size: var(--size-full);
        gap: var(--space-section);
    }

    .screen-header {
        display: grid;
        grid-template-columns: var(--layout-raw-data-header-columns);
        align-items: stretch;
        gap: var(--space-section);
    }

    .search {
        display: grid;
        inline-size: var(--size-full);
        grid-template-columns: var(--layout-raw-data-search-columns);
        align-items: center;
        gap: var(--space-actions);
    }

    .search label {
        grid-column: var(--grid-column-full);
    }

    input {
        min-block-size: var(--size-control);
        min-inline-size: var(--space-none);
        padding-block: var(--space-control-block);
        padding-inline: var(--space-control-inline);
        border: var(--border-control);
        border-radius: var(--radius-control);
        background: var(--color-surface);
        color: var(--color-text);
        font: inherit;
    }

    input:hover {
        border-color: var(--color-accent);
    }

    .search-actions,
    .page-actions,
    .copy-actions,
    .tree-actions,
    .breadcrumb {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-actions);
    }

    .section-heading {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-actions);
    }

    .search-status {
        grid-column: var(--grid-column-full);
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
    }

    .copy-status {
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
    }

    .evidence-error {
        padding: var(--space-control-inline);
        background: var(--color-danger-soft);
        border: var(--border-panel);
        border-radius: var(--radius-panel);
        color: var(--color-danger);
    }

    .raw-layout {
        display: grid;
        grid-template-columns: var(--layout-raw-data-columns);
        align-items: start;
        gap: var(--space-section);
        min-inline-size: var(--space-none);
    }

    .tree {
        display: grid;
        max-inline-size: var(--size-full);
        padding: var(--space-none);
        overflow: hidden;
        border: var(--border-panel);
        border-radius: var(--radius-panel);
        list-style: none;
    }

    .tree li {
        min-inline-size: var(--space-none);
    }

    .tree [role='treeitem'] {
        display: flex;
        align-items: center;
        inline-size: var(--size-full);
        min-block-size: var(--size-control);
        min-inline-size: var(--space-none);
        gap: var(--space-actions);
        padding-block: var(--space-control-block);
        padding-inline: var(--space-control-inline);
        border: none;
        border-inline-start: var(--size-selection-marker) solid var(--color-transparent);
        background: var(--color-transparent);
        color: var(--color-text);
        font: inherit;
        text-align: start;
        cursor: pointer;
    }

    .tree [role='treeitem']:hover {
        background: var(--color-surface-hover);
    }

    .tree [role='treeitem'].selected {
        border-inline-start-color: var(--color-accent);
        background: var(--color-surface-selected);
    }

    .indentation {
        display: flex;
        flex: none;
    }

    .indentation > span {
        inline-size: var(--size-tree-indent);
    }

    .node-type,
    .node-preview {
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
    }

    .disclosure {
        display: grid;
        inline-size: var(--size-icon);
        block-size: var(--size-icon);
        flex: none;
        color: var(--color-text-muted);
        place-items: center;
    }

    .node-key {
        font-weight: var(--font-weight-action);
    }

    .node-preview {
        padding-inline: var(--space-compact);
        min-inline-size: var(--space-none);
        overflow: hidden;
        background: var(--color-surface-subtle);
        border-radius: var(--radius-control);
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .page-actions {
        align-items: center;
        padding: var(--space-control-inline);
    }

    .breadcrumb {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-compact);
        padding: var(--space-none);
        list-style: none;
    }

    .breadcrumb-separator {
        display: inline-flex;
        align-items: center;
        color: var(--color-text-muted);
    }

    .pointer-path-cell {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-compact);
    }

    .breadcrumb button {
        min-block-size: var(--size-control);
        padding-block: var(--space-control-block);
        padding-inline: var(--space-control-inline);
        border: none;
        border-radius: var(--radius-control);
        background: var(--color-transparent);
        color: var(--color-accent);
        font: inherit;
        cursor: pointer;
    }

    .breadcrumb button:hover {
        background: var(--color-surface-hover);
    }

    .breadcrumb button[aria-current='location'] {
        background: var(--color-surface-selected);
        font-weight: var(--font-weight-action);
    }

    dt {
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
        font-weight: var(--font-weight-action);
    }

    dd,
    code {
        overflow-wrap: anywhere;
    }

    code {
        font-family: var(--font-family-source);
    }

    pre {
        max-inline-size: var(--size-full);
        padding: var(--space-actions);
        overflow: auto;
        background: var(--color-code-background);
        border-radius: var(--radius-control);
        white-space: pre-wrap;
    }
</style>
