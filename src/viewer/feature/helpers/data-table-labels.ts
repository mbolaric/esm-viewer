import type { IDataTableLabels } from '#ui';

import type { ViewerTranslationService } from '../viewer-context.js';

// Chrome labels shared by every viewer evidence table (all of them filter, choose, and pin columns).
export function createViewerDataTableLabels(translationService: ViewerTranslationService): IDataTableLabels {
    return {
        columns: translationService.translate('table.columns'),
        filter: {
            clear: translationService.translate('table.clearFilter'),
            label: translationService.translate('table.filter'),
            placeholder: translationService.translate('table.filterPlaceholder'),
        },
        pinColumn: translationService.translate('table.pinColumn'),
    };
}
