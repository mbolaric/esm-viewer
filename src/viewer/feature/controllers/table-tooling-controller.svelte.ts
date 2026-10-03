import { normalizeSearchText } from '#localization';
import { TableToolingController as GenericTableToolingController, type ITableToolingOptions } from '#ui';

// Viewer tables all filter with the application's single search normalisation.
export class TableToolingController<TRow> extends GenericTableToolingController<TRow> {
    public constructor(options: Omit<ITableToolingOptions<TRow>, 'normalizeText'>) {
        super({ ...options, normalizeText: normalizeSearchText });
    }
}
