<script lang="ts">
    import type { IRuntimeVersions } from '#contracts';
    import { useAppBranding } from '#shell';
    import { Button, Dialog, InlineError } from '#ui';

    import { useViewerTranslationService } from '../../viewer-context.js';

    interface IProps {
        copied: boolean;
        copyFailed: boolean;
        loading: boolean;
        onclose: () => void;
        oncopy: () => void;
        versions: IRuntimeVersions | null;
        versionsFailed: boolean;
    }

    let { copied, copyFailed, loading, onclose, oncopy, versions, versionsFailed }: IProps = $props();
    const appBranding = useAppBranding();

    const translationService = useViewerTranslationService();
</script>

{#snippet actions()}
    <Button label={translationService.translate('about.close')} onclick={onclose} variant="primary" />
{/snippet}

<Dialog {actions} {onclose} title={translationService.translate('command.application.about')} titleId="about-dialog-title">
    <header class="about-header">
        <img alt="" class="app-logo" height="64" src={appBranding.icon} width="64" />
    </header>
    {#if versionsFailed}
        <p class="warning" role="status">
            {translationService.translate('about.versionsFailed')}
        </p>
    {/if}
    {#if loading}
        <p role="status">{translationService.translate('opening.phase')}</p>
    {:else}
        {#if versions !== null}
            <section>
                <h2>{translationService.translate('about.versions')}</h2>
                <dl class="versions">
                    <div>
                        <dt>{translationService.translate('about.version')}</dt>
                        <dd>{versions.application}</dd>
                    </div>
                    <div>
                        <dt>{translationService.translate('about.runtime')}</dt>
                        <dd>{versions.runtime}</dd>
                    </div>
                    <div>
                        <dt>{translationService.translate('about.platform')}</dt>
                        <dd>{versions.platform}</dd>
                    </div>
                    <div>
                        <dt>{translationService.translate('about.architecture')}</dt>
                        <dd>{versions.architecture}</dd>
                    </div>
                    <div>
                        <dt>{translationService.translate('about.parser')}</dt>
                        <dd>{versions.parserVersion}</dd>
                    </div>
                    <div>
                        <dt>{translationService.translate('about.parserCommit')}</dt>
                        <dd>{versions.parserCommit}</dd>
                    </div>
                </dl>
            </section>
        {/if}

        <section>
            <h2>{translationService.translate('about.source')}</h2>
            <p>{translationService.translate('about.sourceGpl')}</p>
            <p>{translationService.translate('about.license')}</p>
            <p>{translationService.translate('about.license.gpl')}</p>
        </section>

        <section>
            {#if copied}
                <p class="notice" role="status">
                    {translationService.translate('about.diagnosticsCopied')}
                </p>
            {:else if copyFailed}
                <InlineError message={translationService.translate('about.diagnosticsCopyFailed')} />
            {/if}
            <Button label={translationService.translate('about.copyDiagnostics')} onclick={oncopy} />
        </section>
    {/if}
</Dialog>

<style>
    .about-header {
        display: flex;
        justify-content: center;
        align-items: center;
        margin-block-end: var(--space-dialog);
    }

    section {
        display: grid;
        gap: var(--space-stack);
        margin-block-end: var(--space-dialog);
    }

    h2 {
        margin-block: var(--space-none);
        font-size: var(--font-size-heading);
        line-height: var(--line-height-heading);
    }

    .versions {
        display: grid;
        gap: var(--space-stack);
        margin-block: var(--space-none);
    }

    .versions div {
        display: grid;
        grid-template-columns: var(--layout-preferences-field-columns);
        align-items: baseline;
        border-block-end: var(--border-region);
        padding-block: var(--space-compact);
    }

    dt {
        min-inline-size: var(--space-none);
        overflow-wrap: break-word;
        font-weight: var(--font-weight-action);
    }

    dd {
        min-inline-size: var(--space-none);
        margin-inline-start: var(--space-none);
        overflow-wrap: anywhere;
    }

    p {
        margin-block: var(--space-none);
    }

    .notice,
    .warning {
        padding: var(--space-control-inline);
        border-radius: var(--radius-control);
    }

    .notice {
        background: var(--color-accent-soft);
        color: var(--color-info);
    }

    .warning {
        margin-block-end: var(--space-dialog);
        background: var(--color-accent-soft);
        color: var(--color-info);
    }
</style>
