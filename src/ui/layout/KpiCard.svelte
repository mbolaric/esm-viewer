<script lang="ts">
    import Icon from '../icon/Icon.svelte';
    import type { IconName } from '../icon/icon-registry.js';
    import type { KpiCardSize, KpiCardTone, KpiCardToneStyle } from './kpi-card.js';

    interface IProps {
        icon?: IconName | undefined;
        label: string;
        size?: KpiCardSize;
        subtext?: string | undefined;
        tone?: KpiCardTone | undefined;
        toneStyle?: KpiCardToneStyle;
        value: number | string;
    }

    let {
        icon = undefined,
        label,
        size = 'default',
        subtext = undefined,
        tone = undefined,
        toneStyle = 'text',
        value,
    }: IProps = $props();
</script>

<div class="kpi-card" data-size={size} data-tone={tone} data-tone-style={toneStyle}>
    {#if icon === undefined}
        <span class="kpi-label">{label}</span>
    {:else}
        <div class="kpi-header">
            <span class="kpi-label">{label}</span>
            <Icon name={icon} size="small" />
        </div>
    {/if}
    <strong class="kpi-value">{value}</strong>
    {#if subtext !== undefined}
        <span class="kpi-subtext">{subtext}</span>
    {/if}
</div>

<style>
    .kpi-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-compact);
    }

    .kpi-card[data-tone-style='border'][data-tone='danger'],
    .kpi-card[data-tone-style='both'][data-tone='danger'] {
        border-inline-start: var(--border-width-thick) solid var(--color-danger);
    }

    .kpi-card[data-tone-style='border'][data-tone='warning'],
    .kpi-card[data-tone-style='both'][data-tone='warning'] {
        border-inline-start: var(--border-width-thick) solid var(--color-warning);
    }

    .kpi-card[data-tone-style='border'][data-tone='success'],
    .kpi-card[data-tone-style='both'][data-tone='success'] {
        border-inline-start: var(--border-width-thick) solid var(--color-success);
    }

    .kpi-card[data-tone-style='border'][data-tone='info'],
    .kpi-card[data-tone-style='both'][data-tone='info'] {
        border-inline-start: var(--border-width-thick) solid var(--color-info);
    }

    .kpi-card[data-tone-style='border'][data-tone='neutral'],
    .kpi-card[data-tone-style='both'][data-tone='neutral'] {
        border-inline-start: var(--border-width-thick) solid var(--color-text-muted);
    }

    .kpi-card[data-tone-style='border'][data-tone='anomaly'],
    .kpi-card[data-tone-style='both'][data-tone='anomaly'] {
        border-inline-start: var(--border-width-thick) solid var(--color-activity-availability);
    }

    .kpi-card[data-tone-style='text'][data-tone='danger'] .kpi-value,
    .kpi-card[data-tone-style='both'][data-tone='danger'] .kpi-value {
        color: var(--color-danger);
    }

    .kpi-card[data-tone-style='text'][data-tone='warning'] .kpi-value,
    .kpi-card[data-tone-style='both'][data-tone='warning'] .kpi-value {
        color: var(--color-warning);
    }

    .kpi-card[data-tone-style='text'][data-tone='success'] .kpi-value,
    .kpi-card[data-tone-style='both'][data-tone='success'] .kpi-value {
        color: var(--color-success);
    }

    .kpi-card[data-tone-style='text'][data-tone='info'] .kpi-value,
    .kpi-card[data-tone-style='both'][data-tone='info'] .kpi-value {
        color: var(--color-info);
    }

    .kpi-card[data-tone-style='text'][data-tone='neutral'] .kpi-value,
    .kpi-card[data-tone-style='both'][data-tone='neutral'] .kpi-value {
        color: var(--color-text-muted);
    }

    .kpi-card[data-tone-style='text'][data-tone='anomaly'] .kpi-value,
    .kpi-card[data-tone-style='both'][data-tone='anomaly'] .kpi-value {
        color: var(--color-activity-availability);
    }
</style>
