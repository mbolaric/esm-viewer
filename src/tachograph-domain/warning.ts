import type { ISourceReference } from './source-reference.js';

export type TachographWarningCode =
    'duplicateEvidence' | 'inconsistentData' | 'invalidValue' | 'missingValue' | 'unsupportedData';

export interface ITachographWarning {
    readonly code: TachographWarningCode;
    readonly source: ISourceReference;
}

export function createTachographWarning(code: TachographWarningCode, source: ISourceReference): ITachographWarning {
    return {
        code,
        source,
    };
}
