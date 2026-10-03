<script lang="ts">
    import Button from './Button.svelte';
    import Dialog from './Dialog.svelte';

    interface IProps {
        cancelLabel: string;
        confirmLabel: string;
        message: string;
        oncancel: () => void;
        onconfirm: () => void;
        title: string;
        titleId: string;
    }

    let { cancelLabel, confirmLabel, message, oncancel, onconfirm, title, titleId }: IProps = $props();
</script>

{#snippet actions()}
    <Button label={cancelLabel} onclick={oncancel} variant="secondary" />
    <Button label={confirmLabel} onclick={onconfirm} variant="primary" />
{/snippet}

<Dialog {actions} onclose={oncancel} {title} {titleId}>
    <p class="confirm-message">{message}</p>
</Dialog>

<style>
    .confirm-message {
        margin: var(--space-none);
        color: var(--color-text);
    }
</style>
