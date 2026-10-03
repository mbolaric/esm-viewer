export class VisibleIntersectionObserver implements IntersectionObserver {
    public readonly root: Document | Element | null = null;
    public readonly rootMargin = '0px';
    public readonly scrollMargin = '0px';
    public readonly thresholds = [0];
    readonly #_callback: IntersectionObserverCallback;
    readonly #_targets = new Set<Element>();

    public constructor(callback: IntersectionObserverCallback) {
        this.#_callback = callback;
    }

    public disconnect(): void {
        this.#_targets.clear();
    }

    public observe(target: Element): void {
        this.#_targets.add(target);
        const bounds = target.getBoundingClientRect();
        const entry: IntersectionObserverEntry = {
            boundingClientRect: bounds,
            intersectionRatio: 1,
            intersectionRect: bounds,
            isIntersecting: true,
            rootBounds: null,
            target,
            time: 0,
        };
        this.#_callback([entry], this);
    }

    public takeRecords(): IntersectionObserverEntry[] {
        return [];
    }

    public unobserve(target: Element): void {
        this.#_targets.delete(target);
    }
}
