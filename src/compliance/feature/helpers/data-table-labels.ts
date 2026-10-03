import type { IComplianceTranslationService } from '#compliance';
import type { IDataTableLabels } from '#ui';

// Findings are searched and filtered by the screen's own controls, so the table carries column-menu labels only.
export function createComplianceDataTableLabels(translationService: IComplianceTranslationService): IDataTableLabels {
    return {
        columns: translationService.translate('table.columns'),
        pinColumn: translationService.translate('table.pinColumn'),
    };
}
