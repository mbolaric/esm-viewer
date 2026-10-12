<script lang="ts">
    interface IProps {
        availableTimeZones: readonly string[];
        disabled?: boolean;
        id?: string | undefined;
        label: string;
        onchange: (timeZone: string) => void;
        value: string;
    }

    let { availableTimeZones, disabled = false, id = undefined, label, onchange, value }: IProps = $props();
</script>

<select
    {id}
    aria-label={label}
    class="viewer-input"
    {disabled}
    {value}
    onchange={(event) => {
        const timeZone = event.currentTarget.value;
        if (!disabled && availableTimeZones.includes(timeZone)) {
            onchange(timeZone);
        }
    }}
>
    {#each availableTimeZones as timeZone (timeZone)}
        <option value={timeZone}>{timeZone}</option>
    {/each}
</select>

<style>
    select:hover:not(:disabled) {
        border-color: var(--color-accent);
    }
</style>
