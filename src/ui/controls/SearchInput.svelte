<script lang="ts">
    import Icon from '../icon/Icon.svelte';
    import type { IconName } from '../icon/icon-registry.js';

    interface IProps {
        clearLabel?: string | undefined;
        icon?: Extract<IconName, 'filter' | 'search'>;
        label: string;
        oninput: (value: string) => void;
        placeholder?: string | undefined;
        value: string;
    }

    let { clearLabel = undefined, icon = 'search', label, oninput, placeholder = undefined, value }: IProps = $props();

    let inputElement: HTMLInputElement | undefined = $state();

    function clear(): void {
        oninput('');
        inputElement?.focus();
    }

    function onKeydown(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            event.preventDefault();
            clear();
        }
    }
</script>

<label class="search-input">
    <span class="search-input-label">{label}</span>
    <span class="search-input-field">
        <Icon name={icon} size="small" />
        <input
            bind:this={inputElement}
            class="viewer-input"
            type="search"
            {placeholder}
            {value}
            oninput={(event) => oninput(event.currentTarget.value)}
            onkeydown={onKeydown}
        />
        {#if clearLabel !== undefined && value.length > 0}
            <button aria-label={clearLabel} class="search-input-clear" type="button" onclick={clear}>
                <Icon name="x" size="small" />
            </button>
        {/if}
    </span>
</label>

<style>
    .search-input {
        display: grid;
        gap: var(--space-compact);
    }

    .search-input-label {
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
        font-weight: var(--font-weight-action);
    }

    .search-input-field {
        display: inline-flex;
        align-items: center;
        gap: var(--space-actions);
        inline-size: var(--size-search-input-inline);
        padding-inline-start: var(--space-control-inline);
        padding-inline-end: var(--space-compact);
        background: var(--color-surface);
        border: var(--border-control);
        border-radius: var(--radius-control);
    }

    .search-input-field:focus-within {
        border-color: var(--color-focus);
    }

    .search-input-field :global(.viewer-input::-webkit-search-cancel-button) {
        display: none;
    }

    .search-input-field :global(.viewer-input) {
        flex: var(--layout-search-input-field-flex);
        padding-inline: var(--space-none);
        background: var(--color-transparent);
        border: none;
        min-inline-size: var(--space-none);
    }

    .search-input-field :global(.viewer-input:focus-visible) {
        outline: none;
    }

    .search-input-field :global(svg) {
        color: var(--color-text-muted);
        flex: none;
    }

    .search-input-clear {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: none;
        padding: var(--space-compact);
        border: none;
        border-radius: var(--radius-control);
        background: var(--color-transparent);
        color: var(--color-text-muted);
        cursor: pointer;
    }

    .search-input-clear:hover {
        background: var(--color-surface-hover);
        color: var(--color-text);
    }
</style>
