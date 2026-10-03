<script lang="ts">
    import { integrityStatusIcon } from '../../helpers/viewer-labels.js';
    import { Icon } from '#ui';
    import type { IconName } from '#ui';
    import type { IntegrityAssessment } from '#viewer-domain';

    interface IProps {
        ariaLabel: string;
        displayName: string;
        documentKind: string;
        documentKindIcon: IconName;
        generation: string;
        generationIcon: IconName;
        integrity: string;
        integrityStatus: IntegrityAssessment['status'];
    }

    let {
        ariaLabel,
        displayName,
        documentKind,
        documentKindIcon,
        generation,
        generationIcon,
        integrity,
        integrityStatus,
    }: IProps = $props();
</script>

<section class="document-header" aria-label={ariaLabel}>
    <p class="primary">
        <strong class="document-name">{displayName}</strong>
        <span class="badge badge-kind">
            <Icon name={documentKindIcon} size="small" />
            {documentKind}
        </span>
        <span class="badge badge-generation">
            <Icon name={generationIcon} size="small" />
            {generation}
        </span>
        <span class="badge badge-integrity" data-status={integrityStatus}>
            <Icon name={integrityStatusIcon(integrityStatus)} size="small" />
            {integrity}
        </span>
    </p>
</section>

<style>
    .document-header {
        display: flex;
        align-items: center;
        min-block-size: var(--size-document-header);
        padding-block: var(--padding-document-header-block);
        padding-inline: var(--space-shell);
    }

    p {
        margin: var(--space-none);
    }

    .primary {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        inline-size: var(--size-full);
        gap: var(--space-stack);
    }

    .document-name {
        overflow-wrap: anywhere;
        font-size: var(--font-size-section);
        font-weight: var(--font-weight-title);
    }

    .badge-integrity {
        margin-inline-start: var(--margin-document-integrity-inline-start);
    }
</style>
