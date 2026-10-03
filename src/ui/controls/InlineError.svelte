<script lang="ts">
    interface IProps {
        readonly message: string;
    }

    let { message }: IProps = $props();
</script>

<p class="inline-error" role="alert">{message}</p>

<style>
    .inline-error {
        margin: var(--space-none);
        padding: var(--space-control-inline);
        background: var(--color-danger-soft);
        color: var(--color-danger);
        border-radius: var(--radius-control);
    }
</style>
