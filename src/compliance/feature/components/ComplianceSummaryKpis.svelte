<script lang="ts">
    import { KpiCard } from '#ui';
    import type { IComplianceSummary, IComplianceTranslationService } from '#compliance';

    interface IProps {
        summary: IComplianceSummary;
        translationService: IComplianceTranslationService;
    }

    let { summary, translationService }: IProps = $props();
</script>

<div class="kpi-hero-bar" aria-label={translationService.translate('compliance.totalInfringements')}>
    <KpiCard
        label={translationService.translate('compliance.totalInfringements')}
        subtext={translationService.translate('compliance.tableCaption')}
        value={summary.totalInfringements}
    />

    <KpiCard
        label={translationService.translate('compliance.severityMostSerious')}
        subtext={translationService.translate('compliance.severityKpiSubtext')}
        tone="danger"
        value={summary.mostSeriousCount}
    />

    <KpiCard
        label={translationService.translate('compliance.severityVerySerious')}
        subtext={translationService.translate('compliance.severityKpiSubtext')}
        tone="danger"
        value={summary.verySeriousCount}
    />

    <KpiCard
        label={translationService.translate('compliance.severitySerious')}
        subtext={translationService.translate('compliance.severityKpiSubtext')}
        tone="warning"
        value={summary.seriousCount}
    />

    <KpiCard
        label={translationService.translate('compliance.severityMinor')}
        subtext={translationService.translate('compliance.severityKpiSubtext')}
        tone="info"
        value={summary.minorCount}
    />

    <KpiCard
        label={translationService.translate('compliance.anomalies')}
        subtext={translationService.translate('compliance.anomalyScopeLabel')}
        tone="anomaly"
        value={summary.anomalyCount}
    />
</div>

<style>
    .kpi-hero-bar {
        grid-template-columns: var(--layout-count-columns);
    }
</style>
