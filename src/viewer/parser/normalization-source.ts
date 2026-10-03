import {
    createSourceReference,
    createTachographWarning,
    type DocumentKind,
    type ISourceReference,
    type ITachographWarning,
    type TachographGeneration,
} from '#viewer-domain';

import { createJsonPointer } from './json-pointer.js';

export interface INormalizationSourceContext<TDocumentKind extends DocumentKind> {
    readonly source: (
        generation: TachographGeneration,
        pathTokens: readonly (number | string)[],
    ) => ISourceReference<TachographGeneration, TDocumentKind>;
    readonly warning: (
        code: ITachographWarning['code'],
        generation: TachographGeneration,
        pathTokens: readonly (number | string)[],
    ) => ITachographWarning;
}

export function createNormalizationSourceContext<TDocumentKind extends DocumentKind>(
    documentKind: TDocumentKind,
): INormalizationSourceContext<TDocumentKind> {
    const source = (
        generation: TachographGeneration,
        pathTokens: readonly (number | string)[],
    ): ISourceReference<TachographGeneration, TDocumentKind> =>
        createSourceReference(documentKind, generation, createJsonPointer(pathTokens));

    return {
        source,
        warning: (
            code: ITachographWarning['code'],
            generation: TachographGeneration,
            pathTokens: readonly (number | string)[],
        ): ITachographWarning => createTachographWarning(code, source(generation, pathTokens)),
    };
}
