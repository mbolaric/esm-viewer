import type { RawDataExplorationError } from '#viewer-application';
import type { JsonPointer } from '#viewer-domain';
import { normalizeSearchText } from '#localization';
import { type IRawDataExplorerViewModel, type IRawDataNodeViewModel } from '#viewer-presentation';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';

const maximumRawDataFindMatches = 500;

export interface IRawDataVisibleNode {
    readonly expanded: boolean | null;
    readonly indentationLevels: readonly number[];
    readonly itemType: 'node';
    readonly level: number;
    readonly node: IRawDataNodeViewModel;
}

// One shell request to show a pointer in the tree. The sequence makes a repeat of the same pointer a new request while
// keeping a re-render of the request that is already shown a no-op.
export interface IRawDataRevealRequest {
    readonly path: JsonPointer;
    readonly sequence: number;
}

export interface IRawDataPaginationItem {
    readonly indentationLevels: readonly number[];
    readonly itemType: 'pagination';
    readonly level: number;
    readonly nextOffset: number | null;
    readonly parentPath: JsonPointer;
    readonly previousOffset: number | null;
}

export type RawDataVisibleItem = IRawDataPaginationItem | IRawDataVisibleNode;

export interface IRawDataFindSnapshot {
    readonly currentMatchNumber: number | null;
    readonly matchCount: number;
    readonly query: string;
    readonly truncated: boolean;
}

export interface IRawDataSnapshot {
    readonly error: RawDataExplorationError | null;
    readonly find: IRawDataFindSnapshot;
    readonly requestedPath: JsonPointer | null;
    readonly selectedLineage: readonly IRawDataNodeViewModel[];
    readonly selectedNode: IRawDataNodeViewModel;
    readonly visibleItems: readonly RawDataVisibleItem[];
}

function indentationLevels(level: number): readonly number[] {
    return Array.from({ length: Math.max(level - 1, 0) }, (_, index) => index);
}

export class RawDataController {
    #_currentMatchIndex = $state<number | null>(null);
    private readonly _expandedPaths = new SvelteSet<JsonPointer>();
    private readonly _explorer: IRawDataExplorerViewModel;
    #_findQuery = $state<string>('');
    #_findTruncated = $state<boolean>(false);
    #_lastRevealError = $state<RawDataExplorationError | null>(null);
    // Last path the shell asked for, so a repeated request does not disturb the tree the user navigated.
    #_lastRevealSequence: number | null = null;
    #_matches = $state<readonly IRawDataNodeViewModel[]>([]);
    private readonly _pageOffsets = new SvelteMap<JsonPointer, number>();
    #_requestedPath = $state<JsonPointer | null>(null);
    #_selectedNode = $state<IRawDataNodeViewModel | null>(null);

    // Recomputed derived tree snapshot reflecting visible items and selection lineage.
    #_snapshot = $derived.by<IRawDataSnapshot>(() => {
        const visibleItems: RawDataVisibleItem[] = [];
        const visibleError = this.appendVisibleNode(this._explorer.root, 1, visibleItems);
        const selectedLineage = this._explorer.getLineage(this.selectedNode.path);
        return {
            error: this.#_lastRevealError ?? visibleError,
            find: {
                currentMatchNumber: this.#_currentMatchIndex === null ? null : this.#_currentMatchIndex + 1,
                matchCount: this.#_matches.length,
                query: this.#_findQuery,
                truncated: this.#_findTruncated,
            },
            requestedPath: this.#_requestedPath,
            selectedLineage: selectedLineage.ok ? selectedLineage.value : [this._explorer.root],
            selectedNode: this.selectedNode,
            visibleItems,
        };
    });

    public constructor(explorer: IRawDataExplorerViewModel, initialPath: JsonPointer | null = null) {
        this._explorer = explorer;
        this.#_selectedNode = explorer.root;
        if (explorer.root.childCount.value > 0) {
            this._expandedPaths.add(explorer.root.path);
            this._pageOffsets.set(explorer.root.path, 0);
        }
        this.#_lastRevealError = initialPath === null ? null : this.revealPath(initialPath);
    }

    // Reveals a source the shell asked for. The request carries its own sequence, so asking for the same pointer
    // twice still returns the tree to it after the reader navigated elsewhere; only a repeated rendering of one
    // request leaves the tree untouched.
    public revealRequest(request: IRawDataRevealRequest | null): IRawDataSnapshot {
        if (request === null || request.sequence === this.#_lastRevealSequence) {
            return this.snapshot;
        }
        this.#_lastRevealSequence = request.sequence;
        return this.select(request.path);
    }

    public get snapshot(): IRawDataSnapshot {
        return this.#_snapshot;
    }

    private get selectedNode(): IRawDataNodeViewModel {
        const node = this.#_selectedNode;
        if (node === null) {
            throw new TypeError('The raw-data controller has no selected node yet.');
        }
        return node;
    }

    public activate(path: JsonPointer): IRawDataSnapshot {
        const lineage = this._explorer.getLineage(path);
        if (!lineage.ok) {
            this.#_requestedPath = path;
            this.#_lastRevealError = lineage.error;
            return this.snapshot;
        }
        const node = lineage.value.at(-1);
        if (node === undefined) {
            this.#_requestedPath = path;
            this.#_lastRevealError = 'missingObjectEntry';
            return this.snapshot;
        }

        this.#_selectedNode = node;
        this.#_requestedPath = null;
        if (node.childCount.value > 0) {
            if (this._expandedPaths.has(path)) {
                this._expandedPaths.delete(path);
            } else {
                this._expandedPaths.add(path);
                this._pageOffsets.set(path, this._pageOffsets.get(path) ?? 0);
            }
        }
        this.#_lastRevealError = null;
        return this.snapshot;
    }

    public closeFind(): IRawDataSnapshot {
        this.#_currentMatchIndex = null;
        this.#_findQuery = '';
        this.#_findTruncated = false;
        this.#_matches = [];
        this.#_lastRevealError = null;
        return this.snapshot;
    }

    public collapseAll(): IRawDataSnapshot {
        this._expandedPaths.clear();
        this.#_lastRevealError = null;
        return this.snapshot;
    }

    public collapse(path: JsonPointer): IRawDataSnapshot {
        this._expandedPaths.delete(path);
        this.#_lastRevealError = null;
        return this.snapshot;
    }

    public expand(path: JsonPointer): IRawDataSnapshot {
        const lineage = this._explorer.getLineage(path);
        const node = lineage.ok ? lineage.value.at(-1) : undefined;
        if (!lineage.ok || node === undefined) {
            this.#_requestedPath = path;
            this.#_lastRevealError = lineage.ok ? 'missingObjectEntry' : lineage.error;
            return this.snapshot;
        }
        this.#_selectedNode = node;
        this.#_requestedPath = null;
        if (node.childCount.value > 0) {
            this._expandedPaths.add(path);
            this._pageOffsets.set(path, this._pageOffsets.get(path) ?? 0);
        }
        this.#_lastRevealError = null;
        return this.snapshot;
    }

    public expandOneLevel(): IRawDataSnapshot {
        for (const item of this.snapshot.visibleItems) {
            if (item.itemType === 'node' && item.node.childCount.value > 0) {
                this._expandedPaths.add(item.node.path);
                this._pageOffsets.set(item.node.path, this._pageOffsets.get(item.node.path) ?? 0);
            }
        }
        this.#_lastRevealError = null;
        return this.snapshot;
    }

    public find(query: string): IRawDataSnapshot {
        if (query.length === 0) {
            return this.closeFind();
        }

        const normalizedQuery = normalizeSearchText(query.trim());
        const matches: IRawDataNodeViewModel[] = [];
        let truncated = false;

        for (const node of this._explorer.nodes()) {
            if (node.searchValues.some((value) => normalizeSearchText(value).includes(normalizedQuery))) {
                if (matches.length === maximumRawDataFindMatches) {
                    truncated = true;
                    break;
                }
                matches.push(node);
            }
        }

        this.#_currentMatchIndex = matches.length === 0 ? null : 0;
        this.#_findQuery = query;
        this.#_findTruncated = truncated;
        this.#_matches = matches;
        const firstMatch = matches[0];
        this.#_lastRevealError = firstMatch === undefined ? null : this.revealPath(firstMatch.path);
        return this.snapshot;
    }

    public nextMatch(): IRawDataSnapshot {
        return this.moveMatch(1);
    }

    public openPage(parentPath: JsonPointer, offset: number): IRawDataSnapshot {
        const page = this._explorer.getChildPage(parentPath, offset);
        if (!page.ok) {
            this.#_requestedPath = parentPath;
            this.#_lastRevealError = page.error;
            return this.snapshot;
        }

        this._expandedPaths.add(parentPath);
        this._pageOffsets.set(parentPath, page.value.offset);
        this.#_requestedPath = null;
        this.#_lastRevealError = null;
        return this.snapshot;
    }

    public previousMatch(): IRawDataSnapshot {
        return this.moveMatch(-1);
    }

    public select(path: JsonPointer): IRawDataSnapshot {
        this.#_lastRevealError = this.revealPath(path);
        return this.snapshot;
    }

    private appendVisibleNode(
        node: IRawDataNodeViewModel,
        level: number,
        items: RawDataVisibleItem[],
    ): RawDataExplorationError | null {
        const isContainer = node.childCount.value > 0;
        const expanded = isContainer ? this._expandedPaths.has(node.path) : null;
        items.push({
            expanded,
            indentationLevels: indentationLevels(level),
            itemType: 'node',
            level,
            node,
        });
        if (expanded !== true) {
            return null;
        }

        const page = this._explorer.getChildPage(node.path, this._pageOffsets.get(node.path) ?? 0);
        if (!page.ok) {
            return page.error;
        }
        for (const child of page.value.items) {
            const error = this.appendVisibleNode(child, level + 1, items);
            if (error !== null) {
                return error;
            }
        }
        if (page.value.previousOffset !== null || page.value.nextOffset !== null) {
            items.push({
                indentationLevels: indentationLevels(level + 1),
                itemType: 'pagination',
                level: level + 1,
                nextOffset: page.value.nextOffset,
                parentPath: node.path,
                previousOffset: page.value.previousOffset,
            });
        }
        return null;
    }

    private moveMatch(offset: -1 | 1): IRawDataSnapshot {
        if (this.#_matches.length === 0 || this.#_currentMatchIndex === null) {
            return this.snapshot;
        }
        this.#_currentMatchIndex = (this.#_currentMatchIndex + offset + this.#_matches.length) % this.#_matches.length;
        const match = this.#_matches[this.#_currentMatchIndex];
        this.#_lastRevealError = match === undefined ? 'missingObjectEntry' : this.revealPath(match.path);
        return this.snapshot;
    }

    private revealPath(path: JsonPointer): RawDataExplorationError | null {
        const lineage = this._explorer.getLineage(path);
        if (!lineage.ok) {
            this.#_requestedPath = path;
            return lineage.error;
        }

        const selectedNode = lineage.value.at(-1);
        if (selectedNode === undefined) {
            this.#_requestedPath = path;
            return 'missingObjectEntry';
        }
        for (const node of lineage.value.slice(1)) {
            const parentPath = node.parentPath;
            if (parentPath !== null) {
                this._expandedPaths.add(parentPath);
                this._pageOffsets.set(parentPath, node.pageOffset);
            }
        }
        this.#_selectedNode = selectedNode;
        this.#_requestedPath = null;
        return null;
    }
}
