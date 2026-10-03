import {
    createRawDataExplorer,
    type IRawDataChildPage,
    type IRawDataExplorer,
    type IRawDataNodeProjection,
    type OpenedTachographDocument,
    type RawDataExplorationError,
    type RawDataNodeKind,
} from '#viewer-application';
import { ok, type Result } from '#contracts';
import type { JsonPointer } from '#viewer-domain';

import { formatNumber, type IFormattedValue } from './document-view-model.js';
import type { ViewerLocalisationService } from '../helpers/view-model-formatting.js';

export interface IRawDataNodeViewModel {
    readonly childCount: IFormattedValue<number>;
    readonly clipboardValue: string | null;
    readonly displayValue: string | null;
    readonly key: string | null;
    readonly kind: RawDataNodeKind;
    readonly pageOffset: number;
    readonly parentPath: JsonPointer | null;
    readonly path: JsonPointer;
    readonly positionInSet: number;
    readonly searchValues: readonly string[];
    readonly setSize: number;
}

export interface IRawDataChildPageViewModel {
    readonly items: readonly IRawDataNodeViewModel[];
    readonly nextOffset: number | null;
    readonly offset: number;
    readonly previousOffset: number | null;
    readonly totalCount: IFormattedValue<number>;
}

export interface IRawDataExplorerViewModel {
    readonly root: IRawDataNodeViewModel;
    getChildPage(path: JsonPointer, offset: number): Result<IRawDataChildPageViewModel, RawDataExplorationError>;
    getLineage(path: JsonPointer): Result<readonly IRawDataNodeViewModel[], RawDataExplorationError>;
    nodes(): Iterable<IRawDataNodeViewModel>;
}

function displayValue(node: IRawDataNodeProjection): string | null {
    switch (node.kind) {
        case 'array':
        case 'object':
            return null;
        case 'boolean':
        case 'null':
        case 'number':
        case 'string':
            return JSON.stringify(node.value);
    }
}

function clipboardValue(node: IRawDataNodeProjection): string | null {
    if (node.kind === 'array' || node.kind === 'object') {
        return null;
    }
    return node.kind === 'string' ? String(node.value) : JSON.stringify(node.value);
}

function mapNode(node: IRawDataNodeProjection, localisation: ViewerLocalisationService): IRawDataNodeViewModel {
    const display = displayValue(node);
    return {
        childCount: formatNumber(node.childCount, localisation),
        clipboardValue: clipboardValue(node),
        displayValue: display,
        key: node.key,
        kind: node.kind,
        pageOffset: node.pageOffset,
        parentPath: node.parentPath,
        path: node.path,
        positionInSet: node.positionInSet,
        searchValues: [node.key, node.path, display, node.kind].filter((value): value is string => value !== null),
        setSize: node.setSize,
    };
}

function mapChildPage(page: IRawDataChildPage, localisation: ViewerLocalisationService): IRawDataChildPageViewModel {
    return {
        items: page.items.map((node) => mapNode(node, localisation)),
        nextOffset: page.nextOffset,
        offset: page.offset,
        previousOffset: page.previousOffset,
        totalCount: formatNumber(page.totalCount, localisation),
    };
}

function createViewModel(explorer: IRawDataExplorer, localisation: ViewerLocalisationService): IRawDataExplorerViewModel {
    const viewModel: IRawDataExplorerViewModel = {
        getChildPage(path: JsonPointer, offset: number): Result<IRawDataChildPageViewModel, RawDataExplorationError> {
            const result = explorer.getChildPage(path, offset);
            return result.ok ? ok(mapChildPage(result.value, localisation)) : result;
        },
        getLineage(path: JsonPointer): Result<readonly IRawDataNodeViewModel[], RawDataExplorationError> {
            const result = explorer.getLineage(path);
            return result.ok ? ok(result.value.map((node) => mapNode(node, localisation))) : result;
        },
        nodes: function* () {
            for (const node of explorer.nodes()) {
                yield mapNode(node, localisation);
            }
        },
        root: mapNode(explorer.root, localisation),
    };
    return viewModel;
}

export function createRawDataExplorerViewModel(
    document: OpenedTachographDocument,
    localisation: ViewerLocalisationService,
): IRawDataExplorerViewModel {
    return createViewModel(createRawDataExplorer(document), localisation);
}
