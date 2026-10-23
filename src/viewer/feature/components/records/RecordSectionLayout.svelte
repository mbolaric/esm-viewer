<script lang="ts" generics="TViewModel">
    import { observeAvailableOverflow, ScreenHeader, SectionMessage, type IInlineNoticeAction } from '#ui';
    import type { Snippet } from 'svelte';

    interface IProps<TViewModel> {
        readonly backAction?: IInlineNoticeAction | undefined;
        readonly className: string;
        readonly content: Snippet<[TViewModel]>;
        readonly description?: string;
        readonly errorDescription: string;
        readonly errorHeading: string;
        readonly errorHeadingId: string;
        readonly fillHeight?: boolean;
        readonly heading: string;
        readonly viewModel: TViewModel | null;
    }

    let {
        backAction = undefined,
        className,
        content,
        description,
        errorDescription,
        errorHeading,
        errorHeadingId,
        fillHeight = false,
        heading,
        viewModel,
    }: IProps<TViewModel> = $props();
</script>

<article class={className} class:fill-height={fillHeight} use:observeAvailableOverflow={{ enabled: fillHeight }}>
    <ScreenHeader {heading} {backAction} />

    {#if description !== undefined}
        <p>{description}</p>
    {/if}

    {#if viewModel === null}
        <SectionMessage description={errorDescription} heading={errorHeading} headingId={errorHeadingId} />
    {:else}
        {@render content(viewModel)}
    {/if}
</article>

<style>
    article {
        inline-size: var(--size-full);
        max-inline-size: var(--size-full);
        min-inline-size: var(--size-zero);
    }

    /*
     * A definite height lets flex children fill the available space on the first
     * layout. When that height cannot hold the table floor, the article grows to its
     * content and the main area scrolls, keeping the main area's end padding below the
     * table and avoiding a nested scroll region. Positioned so absolutely placed
     * descendants stay within its bounds.
     */
    article.fill-height {
        position: relative;
        block-size: var(--size-full);
        min-block-size: min-content;
        display: flex;
        flex-direction: column;
    }

    /*
     * The section keeps its flex-basis floor but may grow to its heading plus the
     * table floor, so the article's height covers the whole table.
     */
    article.fill-height :global(.table-section) {
        min-block-size: auto;
    }

    /* Overflowing content does not receive the main area's end padding, so restore the gap. */
    article.fill-height:global(.is-overflowing) {
        padding-block-end: var(--space-shell);
    }
</style>
