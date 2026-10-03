<script lang="ts">
    import Button from '../controls/Button.svelte';
    import Icon from '../icon/Icon.svelte';

    interface IProps {
        code: string;
        codeLabel: string;
        description: string;
        heading: string;
        onretry: () => void;
        retryLabel: string;
    }

    let { code, codeLabel, description, heading, onretry, retryLabel }: IProps = $props();
</script>

<div class="chart-failure" role="alert">
    <Icon name="circleAlert" size="large" />
    <div class="failure-copy">
        <h3>{heading}</h3>
        <p>{description}</p>
        <p class="failure-code">
            <span>{codeLabel}</span>
            <code>{code}</code>
        </p>
        <Button label={retryLabel} onclick={onretry} />
    </div>
</div>

<style>
    .chart-failure {
        display: grid;
        grid-template-columns: var(--layout-chart-failure-columns);
        align-items: start;
        gap: var(--space-stack);
        padding: var(--space-stack);
        background: var(--color-danger-soft);
        border: var(--border-panel);
        border-radius: var(--radius-panel);
        color: var(--color-text);
    }

    .failure-copy {
        display: grid;
        justify-items: start;
        gap: var(--space-actions);
    }

    .failure-code {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-actions);
    }

    .failure-code code {
        font-family: var(--font-family-source);
    }
</style>
