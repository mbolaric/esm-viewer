<script lang="ts">
    import {
        translateGeneration,
        translateInspectorHeading,
        translateInspectorLabelKey,
        translateInspectorValue,
    } from '../../helpers/viewer-labels.js';
    import { Button, ReferenceLinkButton } from '#ui';
    import type { JsonPointer } from '#viewer-domain';
    import type { IRecordInspectorViewModel } from '#viewer-presentation';
    import { useViewerTranslationService } from '../../viewer-context.js';

    interface IProps {
        onclear: () => void;
        onopenraw: (path: JsonPointer) => void;
        titleId: string;
        viewModel: IRecordInspectorViewModel | null;
    }

    let { onclear, onopenraw, titleId, viewModel }: IProps = $props();

    const translationService = useViewerTranslationService();
    const closeLabel = translationService.translate('inspector.close');
    const openRawLabel = translationService.translate('overview.openSource');
</script>

<div class="record-inspector">
    <header class="inspector-header">
        <h2 id={titleId}>{translationService.translate('inspector.heading')}</h2>
        {#if viewModel !== null}
            <Button
                ariaLabel={closeLabel}
                icon="x"
                iconOnly={true}
                label={closeLabel}
                onclick={onclear}
                size="compact"
                variant="ghost"
            />
        {/if}
    </header>

    {#if viewModel === null}
        <p class="inspector-empty">{translationService.translate('inspector.empty')}</p>
    {:else}
        <p class="inspector-record-title">
            {translateInspectorHeading(viewModel.heading.emphasis, viewModel.heading.detail, translationService)}
        </p>

        <dl class="inspector-rows">
            {#each viewModel.rows as row (row.labelKey)}
                {@const label = translateInspectorLabelKey(row.labelKey, translationService)}
                <div class="inspector-row">
                    <dt title={label}>{label}</dt>
                    <dd>{translateInspectorValue(row.value, translationService)}</dd>
                </div>
            {/each}
        </dl>

        <section aria-labelledby={`${titleId}-source`} class="inspector-source">
            <h3 id={`${titleId}-source`}>
                {translationService.translate('eventsFaults.source')}
            </h3>
            {#if viewModel.sourcePath === null}
                <p>{translationService.translate('activities.noRecordedSource')}</p>
            {:else}
                {@const sourcePath = viewModel.sourcePath}
                <div class="inspector-source-evidence">
                    <span>
                        {viewModel.generation === null ? '' : translateGeneration(viewModel.generation, translationService)}
                    </span>
                    <code class="inspector-source-path">{sourcePath}</code>
                    <ReferenceLinkButton
                        onopen={() => onopenraw(sourcePath)}
                        openLabel={openRawLabel}
                        path={sourcePath}
                        tooltipFloating
                    />
                </div>
            {/if}
        </section>
    {/if}
</div>

<style>
    .record-inspector {
        display: grid;
        gap: var(--space-stack);
        align-content: start;
        padding: var(--space-panel);
    }

    .inspector-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-actions);
    }

    .inspector-header h2 {
        margin: var(--space-none);
        font-size: var(--font-size-section);
        font-weight: var(--font-weight-title);
        line-height: var(--line-height-heading);
    }

    .inspector-empty {
        color: var(--color-text-muted);
    }

    .inspector-record-title {
        margin: var(--space-none);
        font-size: var(--font-size-section);
        font-weight: var(--font-weight-title);
        line-height: var(--line-height-heading);
    }

    .inspector-rows {
        display: grid;
        gap: var(--space-actions);
        margin: var(--space-none);
    }

    .inspector-row {
        display: grid;
        grid-template-columns: var(--layout-inspector-row-columns);
        gap: var(--space-actions);
        align-items: baseline;
    }

    .inspector-row dt {
        min-inline-size: var(--space-none);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
    }

    .inspector-row dd {
        min-inline-size: var(--space-none);
        margin: var(--space-none);
        overflow-wrap: anywhere;
    }

    .inspector-source {
        display: grid;
        gap: var(--space-actions);
        padding-block-start: var(--space-stack);
        border-block-start: var(--border-region);
    }

    .inspector-source h3 {
        margin: var(--space-none);
        font-size: var(--font-size-metadata);
        font-weight: var(--font-weight-action);
        letter-spacing: var(--letter-spacing-group);
        text-transform: var(--text-transform-group);
        color: var(--color-text-muted);
    }

    .inspector-source-evidence {
        display: grid;
        gap: var(--space-actions);
        justify-items: start;
    }

    .inspector-source-path {
        overflow-wrap: anywhere;
        font-family: var(--font-family-source);
        font-size: var(--font-size-metadata);
    }
</style>
