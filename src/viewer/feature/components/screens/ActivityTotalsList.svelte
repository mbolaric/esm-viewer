<script lang="ts">
    import { Icon } from '#ui';
    import { ACTIVITY_KINDS } from '#viewer-domain';
    import type { IActivityTotalsViewModel, IContinuousDrivingProgressViewModel } from '#viewer-presentation';

    import { activityIcon } from '../../helpers/activity-visual.js';
    import { translateActivityKind } from '../../helpers/viewer-labels.js';
    import { useViewerContext } from '../../viewer-context.js';

    interface IProps {
        continuousDriving?: IContinuousDrivingProgressViewModel | undefined;
        totals: IActivityTotalsViewModel;
    }

    let { continuousDriving = undefined, totals }: IProps = $props();

    const viewerContext = useViewerContext();
    const translationService = viewerContext.translationService;
</script>

<div class="totals-container">
    <ul class="activity-totals">
        {#each ACTIVITY_KINDS as activity (activity)}
            {@const label = translateActivityKind(activity, translationService)}
            <li>
                <Icon name={activityIcon(activity)} />
                <span title={label}>{label}</span>
                <strong>{totals[activity].display}</strong>
            </li>
        {/each}
    </ul>

    {#if continuousDriving && (continuousDriving.percentage > 0 || continuousDriving.peakContinuousDriving !== null)}
        <div
            class="continuous-driving-banner"
            class:status-danger={continuousDriving.status === 'danger'}
            class:status-warning={continuousDriving.status === 'warning'}
        >
            <div class="driving-header">
                <span class="label">
                    <Icon name="circleGauge" />
                    {translationService.translate('activities.continuousDriving.label')}
                </span>
                <span class="values">
                    {translationService.translate('activities.continuousDriving.ratio', {
                        current: continuousDriving.currentContinuousDriving.display,
                        max: continuousDriving.maxContinuousDrivingLimit.display,
                    })}
                </span>
            </div>
            <div
                class="progress-bar-track"
                role="progressbar"
                aria-label={translationService.translate('activities.continuousDriving.label')}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={continuousDriving.percentage}
            >
                <div class="progress-bar-fill" style:inline-size="{continuousDriving.percentage}%"></div>
            </div>
            {#if continuousDriving.status === 'warning' || continuousDriving.status === 'danger'}
                <div class="driving-note">
                    <Icon name={continuousDriving.status === 'danger' ? 'circleAlert' : 'circleHelp'} />
                    <span>{translationService.translate('activities.continuousDriving.breakRequired')}</span>
                </div>
            {/if}
            {#if continuousDriving.peakContinuousDriving}
                <div class="driving-peak-note">
                    <Icon name="hourglass" />
                    <span
                        >{translationService.translate('activities.continuousDriving.peakNotice', {
                            peak: continuousDriving.peakContinuousDriving.display,
                        })}</span
                    >
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .totals-container {
        display: flex;
        flex-direction: column;
        gap: var(--space-actions);
    }

    .activity-totals {
        display: grid;
        grid-template-columns: var(--layout-activity-totals);
        padding: var(--space-none);
        list-style: none;
    }

    .activity-totals li {
        display: grid;
        grid-template-columns: var(--layout-activity-total-row-columns);
        align-items: center;
        gap: var(--space-actions);
        padding-block: var(--space-row-block);
        padding-inline: var(--space-actions);
        border-block-end: var(--border-region);
    }

    .activity-totals li span {
        min-inline-size: var(--space-none);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .activity-totals strong {
        font-variant-numeric: tabular-nums;
    }

    .continuous-driving-banner {
        display: flex;
        flex-direction: column;
        gap: var(--space-compact);
        padding: var(--space-compact) var(--space-actions);
        background: var(--color-surface-subtle);
        border: var(--border-region);
        border-radius: var(--radius-card);
        font-size: var(--font-size-metadata);
    }

    .continuous-driving-banner.status-warning {
        border-color: var(--color-warning);
    }

    .continuous-driving-banner.status-danger {
        border-color: var(--color-danger);
    }

    .driving-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .driving-header .label {
        display: flex;
        align-items: center;
        gap: var(--space-compact);
        font-weight: var(--font-weight-action);
    }

    .driving-header .values {
        font-variant-numeric: tabular-nums;
    }

    .progress-bar-track {
        inline-size: var(--size-full);
        block-size: var(--size-progress-bar-track);
        background: var(--color-surface);
        border-radius: var(--radius-pill);
        overflow: hidden;
    }

    .progress-bar-fill {
        block-size: var(--size-full);
        background: var(--color-accent);
        border-radius: var(--radius-pill);
        transition: var(--transition-progress);
    }

    .status-warning .progress-bar-fill {
        background: var(--color-warning);
    }

    .status-danger .progress-bar-fill {
        background: var(--color-danger);
    }

    .driving-note {
        display: flex;
        align-items: center;
        gap: var(--space-compact);
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
    }

    .status-warning .driving-note {
        color: var(--color-warning);
    }

    .status-danger .driving-note {
        color: var(--color-danger);
        font-weight: var(--font-weight-action);
    }

    .driving-peak-note {
        display: flex;
        align-items: center;
        gap: var(--space-compact);
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
    }
</style>
