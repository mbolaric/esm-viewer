import type { IDataTableLabels, IDataTablePaginationLabels } from '#ui';

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

export function createViewerDataTablePaginationLabels(translationService: ViewerTranslationService): IDataTablePaginationLabels {
    return {
        navigation: translationService.translate('table.pagination'),
        nextPage: translationService.translate('rawData.search.next'),
        previousPage: translationService.translate('rawData.search.previous'),
        rowsPerPage: translationService.translate('table.rowsPerPage'),
        status: ({ start, end, total }) =>
            translationService.translate('table.filterResultCount', {
                shown: start === end ? String(end) : `${String(start)}–${String(end)}`,
                total: String(total),
            }),
    };
}
