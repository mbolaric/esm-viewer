<script lang="ts">
    interface IProps {
        description: string;
        heading: string;
        headingId: string;
    }

    let { description, heading, headingId }: IProps = $props();
</script>

<section class="evidence-panel" aria-labelledby={headingId}>
    <h2 id={headingId}>{heading}</h2>
    <p>{description}</p>
</section>
