import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { observeAvailableOverflow } from '../layout/overflow-observer.js';

const observedTargets = new Set<Element>();

class MockResizeObserver implements ResizeObserver {
    public disconnect(): void {
        observedTargets.clear();
    }
    public observe(target: Element): void {
        observedTargets.add(target);
    }
    public unobserve(target: Element): void {
        observedTargets.delete(target);
    }
}

describe('observeAvailableOverflow', () => {
    let parent: HTMLDivElement;
    let node: HTMLDivElement;

    beforeEach(() => {
        observedTargets.clear();
        vi.stubGlobal('ResizeObserver', MockResizeObserver);

        parent = document.createElement('div');
        node = document.createElement('div');
        parent.appendChild(node);
        document.body.appendChild(parent);
    });

    afterEach(() => {
        parent.remove();
        vi.unstubAllGlobals();
    });

    it('attaches to parent and node and sets overflowing class when content exceeds available space', () => {
        vi.spyOn(parent, 'clientHeight', 'get').mockReturnValue(500);
        vi.spyOn(node, 'offsetHeight', 'get').mockReturnValue(480);
        parent.style.paddingTop = '24px';
        parent.style.paddingBottom = '24px';
        node.style.paddingBottom = '0px';

        const onoverflowchange = vi.fn();
        const action = observeAvailableOverflow(node, {
            enabled: true,
            onoverflowchange,
        });

        expect(observedTargets.has(node)).toBe(true);
        expect(observedTargets.has(parent)).toBe(true);
        expect(node.classList.contains('is-overflowing')).toBe(true);
        expect(onoverflowchange).toHaveBeenCalledWith(true);

        action.destroy();
        expect(observedTargets.size).toBe(0);
    });

    it('does not set overflowing class when content fits in available space', () => {
        vi.spyOn(parent, 'clientHeight', 'get').mockReturnValue(600);
        vi.spyOn(node, 'offsetHeight', 'get').mockReturnValue(400);
        parent.style.paddingTop = '24px';
        parent.style.paddingBottom = '24px';
        node.style.paddingBottom = '0px';

        const onoverflowchange = vi.fn();
        const action = observeAvailableOverflow(node, {
            enabled: true,
            onoverflowchange,
        });

        expect(node.classList.contains('is-overflowing')).toBe(false);
        expect(onoverflowchange).toHaveBeenCalledWith(false);

        action.destroy();
    });

    it('removes overflow class and skips observation when disabled', () => {
        node.classList.add('is-overflowing');
        const onoverflowchange = vi.fn();
        const action = observeAvailableOverflow(node, {
            enabled: false,
            onoverflowchange,
        });

        expect(node.classList.contains('is-overflowing')).toBe(false);
        expect(onoverflowchange).toHaveBeenCalledWith(false);
        expect(observedTargets.size).toBe(0);

        action.destroy();
    });
});
