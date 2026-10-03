<script lang="ts">
    import type { ICalendarMonthDayViewModel } from '#viewer-presentation';

    import ActivityDaySummaryTable from './ActivityDaySummaryTable.svelte';
    import type { IDocumentScopedValue } from '../../controllers/document-scoped-value.svelte.js';
    import { useViewerContext } from '../../viewer-context.js';

    interface IProps {
        days: readonly ICalendarMonthDayViewModel[];
        filterText: IDocumentScopedValue<string>;
        onshowday: (index: number) => void;
        selectedDayIndex: number;
    }

    let { days, filterText, onshowday, selectedDayIndex }: IProps = $props();

    const viewerContext = useViewerContext();
    const translationService = viewerContext.translationService;
</script>

<section class="evidence-panel" aria-labelledby="activity-days-heading">
    <h2 id="activity-days-heading">
        {translationService.translate('activities.allDays.heading')}
    </h2>
    <ActivityDaySummaryTable
        caption={translationService.translate('activities.allDays.caption')}
        {filterText}
        {onshowday}
        rows={days}
        {selectedDayIndex}
    />
    <p class="note">
        {translationService.translate('activities.viewerCalculationNote')}
    </p>
</section>

<style>
    .note {
        color: var(--color-text-muted);
    }
</style>
