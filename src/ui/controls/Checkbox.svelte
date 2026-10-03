<script lang="ts">
    interface IProps {
        checked: boolean;
        disabled?: boolean;
        label?: string;
        onchange: (checked: boolean) => void;
    }

    let { checked, disabled = false, label = undefined, onchange }: IProps = $props();

    function handleChange(event: Event): void {
        const target = event.currentTarget;
        if (target instanceof HTMLInputElement) {
            onchange(target.checked);
        }
    }
</script>

{#if label !== undefined}
    <label class="checkbox-label">
        <input type="checkbox" {checked} {disabled} onchange={handleChange} />
        <span>{label}</span>
    </label>
{:else}
    <input class="checkbox-standalone" type="checkbox" {checked} {disabled} onchange={handleChange} />
{/if}

<style>
    .checkbox-label {
        display: flex;
        align-items: center;
        gap: var(--space-compact);
        cursor: pointer;
    }

    .checkbox-label:has(input:disabled) {
        cursor: default;
        opacity: var(--opacity-disabled);
    }

    .checkbox-standalone {
        justify-self: start;
        align-self: center;
    }
</style>
