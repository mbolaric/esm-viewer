<script lang="ts">
    import { TaskState } from '#ui';

    interface IProps {
        description: string;
        heading: string;
    }

    let { description, heading }: IProps = $props();
</script>

<div class="pending-section">
    <TaskState {description} focusOnMount title={heading} />
</div>

<style>
    .pending-section {
        position: absolute;
        inset: var(--space-none);
        display: grid;
        padding: var(--space-shell);
        place-items: center;
    }
</style>
