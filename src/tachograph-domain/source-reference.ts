import type { JsonPointer } from './json-pointer.js';
import type { DocumentKind, TachographGeneration } from './tachograph.js';

export interface ISourceReference<
    TGeneration extends TachographGeneration = TachographGeneration,
    TDocumentKind extends DocumentKind = DocumentKind,
> {
    readonly documentKind: TDocumentKind;
    readonly generation: TGeneration;
    readonly path: JsonPointer;
}

export function createSourceReference<TGeneration extends TachographGeneration, TDocumentKind extends DocumentKind>(
    documentKind: TDocumentKind,
    generation: TGeneration,
    path: JsonPointer,
): ISourceReference<TGeneration, TDocumentKind> {
    return {
        documentKind,
        generation,
        path,
    };
}
