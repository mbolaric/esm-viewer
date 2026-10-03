<script lang="ts">
    import type { Snippet } from 'svelte';

    interface IProps {
        filterHeading: string;
        filters: Snippet;
        headingId: string;
        recordCount: string;
        recordsShown: string;
        timeBasis: string;
        timeBasisLabel: string;
    }

    let { filterHeading, filters, headingId, recordCount, recordsShown, timeBasis, timeBasisLabel }: IProps = $props();
</script>

<section class="evidence-panel" aria-labelledby={headingId}>
    <h2 id={headingId}>{filterHeading}</h2>
    <div class="filter-toolbar">
        {@render filters()}
        <dl class="filter-context">
            <div>
                <dt>{timeBasisLabel}</dt>
                <dd>{timeBasis}</dd>
            </div>
            <div aria-live="polite">
                <dt>{recordsShown}</dt>
                <dd>{recordCount}</dd>
            </div>
        </dl>
    </div>
</section>
