<script lang="ts">
    import { ERROR_CODES } from '#contracts';
    import { ChartFailure } from '#ui';

    import { useViewerTranslationService } from '../../viewer-context.js';

    interface IProps {
        error: unknown;
        description: string;
        heading: string;
        retryLabel: string;
        onretry: () => void;
    }

    let { error, description, heading, retryLabel, onretry }: IProps = $props();

    const translationService = useViewerTranslationService();
</script>

<div data-boundary-state={error === undefined ? 'unknown' : 'caught'}>
    <ChartFailure
        code={ERROR_CODES.chartRenderFailed}
        codeLabel={translationService.translate('failure.errorCode')}
        {description}
        {heading}
        {onretry}
        {retryLabel}
    />
</div>
