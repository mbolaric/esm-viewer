<script lang="ts">
    import { Icon } from '#ui';
    import type { IComplianceAssessmentViewModel, IComplianceTranslationService } from '#compliance';

    interface IProps {
        // Requirements the document cannot prove or disprove on its own; they need outside evidence.
        assessments: readonly IComplianceAssessmentViewModel[];
        translationService: IComplianceTranslationService;
    }

    let { assessments, translationService }: IProps = $props();
</script>

<section class="evidence-panel assessment-panel" aria-labelledby="compliance-assessments-heading">
    <div class="assessment-header">
        <h2 id="compliance-assessments-heading">
            <Icon name="circleHelp" />
            <span>{translationService.translate('compliance.assessments.heading')}</span>
        </h2>
        <p>{translationService.translate('compliance.assessments.description')}</p>
    </div>
    <ul class="assessment-list">
        {#each assessments as assessment (assessment.id)}
            <li>
                <div class="assessment-title-row">
                    <h3>{assessment.title}</h3>
                    {#if assessment.occurrenceCount > 1}
                        <span class="assessment-occurrence-count">
                            {translationService.translate('compliance.assessment.occurrenceCount', {
                                count: assessment.occurrenceCount,
                            })}
                        </span>
                    {/if}
                </div>
                <p>{assessment.description}</p>
                <p class="assessment-legal">{assessment.legalDisplay}</p>
            </li>
        {/each}
    </ul>
</section>

<style>
    .assessment-panel,
    .assessment-header,
    .assessment-list,
    .assessment-list li {
        display: grid;
    }
    .assessment-panel {
        gap: var(--space-panel);
        padding: var(--space-panel);
    }
    .assessment-header,
    .assessment-list,
    .assessment-list li {
        gap: var(--space-compact);
    }
    .assessment-header h2,
    .assessment-list li h3,
    .assessment-header p,
    .assessment-list,
    .assessment-list p {
        margin: var(--space-none);
    }
    .assessment-header h2 {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-actions);
        font-size: var(--font-size-section-heading);
    }
    .assessment-header p,
    .assessment-list p {
        color: var(--color-text-muted);
    }
    .assessment-list {
        padding: var(--space-none);
        list-style: none;
    }
    .assessment-list li {
        padding-block: var(--space-control-block);
        border-block-start: var(--border-region);
    }
    .assessment-title-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-actions);
    }
    .assessment-list li h3 {
        min-inline-size: var(--space-none);
        font-size: var(--font-size-body);
        overflow-wrap: anywhere;
    }
    .assessment-occurrence-count {
        padding-block: var(--space-compact);
        padding-inline: var(--space-control-block);
        border: var(--border-region);
        border-radius: var(--radius-chip);
        color: var(--color-text-muted);
        font-size: var(--font-size-badge);
        font-weight: var(--font-weight-action);
        line-height: var(--line-height-tight);
    }
    .assessment-legal {
        font-size: var(--font-size-metadata);
    }
</style>
