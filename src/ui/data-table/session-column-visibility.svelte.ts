import { SvelteSet } from 'svelte/reactivity';

// Column visibility that lasts for the screen's lifetime only, for tables without a persisted column preference.
export class SessionColumnVisibility {
    readonly #_hiddenColumnIds = new SvelteSet<string>();

    public get hiddenColumnIds(): ReadonlySet<string> {
        return this.#_hiddenColumnIds;
    }

    public toggle(columnId: string): void {
        if (this.#_hiddenColumnIds.has(columnId)) {
            this.#_hiddenColumnIds.delete(columnId);
        } else {
            this.#_hiddenColumnIds.add(columnId);
        }
    }
}
