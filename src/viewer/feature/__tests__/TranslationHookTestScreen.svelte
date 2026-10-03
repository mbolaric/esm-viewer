<script lang="ts">
    import { useViewerTranslationService } from '../viewer-context.js';

    interface IProps {
        testId: string;
    }

    let { testId }: IProps = $props();

    const translationService = useViewerTranslationService();
</script>

<h1 data-testid={testId}>{translationService.translate('welcome.heading')}</h1>
