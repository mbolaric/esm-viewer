<script lang="ts">
    import { InlineNotice } from '#ui';
    import type { Snippet } from 'svelte';
    import { useViewerTranslationService } from '../../viewer-context.js';
    import type { IActivityDayLinkProps } from '../../helpers/activity-day-link-props.js';

    interface IProps extends IActivityDayLinkProps {
        children: Snippet;
        emptyMessage: string;
        recordsEmpty: boolean;
    }

    let {
        activityDayLabel,
        activityDayMidnight,
        children,
        emptyMessage,
        onclearactivityday,
        onreturnactivityday = undefined,
        recordsEmpty,
    }: IProps = $props();

    const translationService = useViewerTranslationService();
</script>

{#if activityDayMidnight !== null}
    <div class="activity-window-notice">
        <InlineNotice
            actions={[
                ...(onreturnactivityday !== undefined
                    ? [
                          {
                              icon: 'chevronLeft' as const,
                              label: translationService.translate('activityWindow.returnToActivities'),
                              onclick: onreturnactivityday,
                          },
                      ]
                    : []),
                {
                    label: translationService.translate('activityWindow.showAll'),
                    onclick: onclearactivityday,
                },
            ]}
            label={translationService.translate('activityWindow.filteredNotice', {
                date: activityDayLabel ?? '',
            })}
        />
    </div>
{/if}
{#if recordsEmpty}
    <p>
        {activityDayMidnight !== null ? translationService.translate('activityWindow.empty') : emptyMessage}
    </p>
{:else}
    {@render children()}
{/if}

<style>
    .activity-window-notice {
        margin-block-end: var(--space-actions);
        flex: var(--layout-fixed-flex);
    }
</style>
