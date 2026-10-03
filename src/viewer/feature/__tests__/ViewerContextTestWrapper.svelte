<script lang="ts">
    import { onMount, type Snippet } from 'svelte';

    import { provideViewerContext, type IViewerContext } from '../viewer-context.js';

    interface IProps {
        children: Snippet;
        context: IViewerContext;
    }

    let { children, context }: IProps = $props();

    provideViewerContext(() => context);

    onMount(() => {
        return (): void => {
            context.preferencesController.dispose();
            void context.documentController.dispose();
        };
    });
</script>

{@render children()}
