import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AppShell from '../layout/AppShell.svelte';

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

const inspectorLabels = {
    defaultLabel: 'Default',
    menuLabel: 'Inspector width',
    narrowLabel: 'Narrow',
    resizeLabel: 'Resize inspector width',
    wideLabel: 'Wide',
};

function setInspectorTokens(): void {
    const root = document.documentElement;
    root.style.fontSize = '16px';
    root.style.setProperty('--size-inspector-min', '17.5rem');
    root.style.setProperty('--size-inspector-max', '27.5rem');
}

function renderShell(oninspectorwidthchange = vi.fn()): {
    readonly oninspectorwidthchange: ReturnType<typeof vi.fn>;
    readonly rerender: (width: number) => Promise<void>;
} {
    setInspectorTokens();

    const commandContent = createRawSnippet(() => ({
        render: () => '<p>Commands</p>',
    }));
    const header = createRawSnippet(() => ({
        render: () => '<p>Document header</p>',
    }));
    const navigation = createRawSnippet(() => ({
        render: () => '<nav aria-label="Document sections"><p>Navigation</p></nav>',
    }));
    const mainContent = createRawSnippet(() => ({
        render: () => '<p>Main content</p>',
    }));
    const inspectorContent = createRawSnippet(() => ({
        render: () => '<div><h2>Selected record</h2><p>Driving</p></div>',
    }));

    const rendered = render(AppShell, {
        props: {
            children: mainContent,
            commands: commandContent,
            document: { header, navigation },
            inspector: inspectorContent,
            inspectorLabel: 'Record inspector',
            inspectorLabels,
            inspectorOpen: true,
            inspectorWidth: 320,
            oninspectorwidthchange,
        },
    });

    return {
        oninspectorwidthchange,
        rerender: async (width: number): Promise<void> => {
            await rendered.rerender({ inspectorWidth: width });
        },
    };
}

function separator(): HTMLElement {
    const element = screen.getByRole('slider', { name: inspectorLabels.resizeLabel });
    if (!(element instanceof HTMLElement)) {
        throw new TypeError('The inspector resize separator must be an element.');
    }
    return element;
}

describe('AppShell inspector separator', () => {
    it('exposes the separator with vertical value semantics', () => {
        renderShell();

        const rule = separator();
        expect(rule.getAttribute('aria-orientation')).toBe('vertical');
        expect(rule.getAttribute('aria-valuemin')).toBe('280');
        expect(rule.getAttribute('aria-valuemax')).toBe('440');
        expect(rule.getAttribute('aria-valuenow')).toBe('320');
        expect(rule.getAttribute('tabindex')).toBe('0');
    });

    it('resizes the inspector by dragging the separator within bounds', async () => {
        const { oninspectorwidthchange } = renderShell();
        const rule = separator();

        await fireEvent.pointerDown(rule, { clientX: 300 });
        await fireEvent.pointerMove(rule, { clientX: 260 });
        expect(oninspectorwidthchange).toHaveBeenLastCalledWith(360);

        await fireEvent.pointerMove(rule, { clientX: 700 });
        expect(oninspectorwidthchange).toHaveBeenLastCalledWith(280);

        await fireEvent.pointerUp(rule, { clientX: 700 });
        await fireEvent.pointerMove(rule, { clientX: 200 });
        expect(oninspectorwidthchange).toHaveBeenCalledTimes(2);
    });

    it('resizes with the keyboard contract on the width control', async () => {
        const { oninspectorwidthchange } = renderShell();
        const widthControl = screen.getByTitle(inspectorLabels.menuLabel);

        await fireEvent.keyDown(widthControl, { key: 'ArrowRight' });
        expect(oninspectorwidthchange).toHaveBeenLastCalledWith(328);
        await fireEvent.keyDown(widthControl, { key: 'ArrowLeft' });
        expect(oninspectorwidthchange).toHaveBeenLastCalledWith(312);
        await fireEvent.keyDown(widthControl, { key: 'Home' });
        expect(oninspectorwidthchange).toHaveBeenLastCalledWith(280);
        await fireEvent.keyDown(widthControl, { key: 'End' });
        expect(oninspectorwidthchange).toHaveBeenLastCalledWith(440);
    });

    it('resizes directly from the separator keyboard contract', async () => {
        const { oninspectorwidthchange } = renderShell();
        const rule = separator();

        await fireEvent.keyDown(rule, { key: 'ArrowRight' });
        expect(oninspectorwidthchange).toHaveBeenLastCalledWith(328);
        await fireEvent.keyDown(rule, { key: 'ArrowLeft' });
        expect(oninspectorwidthchange).toHaveBeenLastCalledWith(312);
        await fireEvent.keyDown(rule, { key: 'Home' });
        expect(oninspectorwidthchange).toHaveBeenLastCalledWith(280);
        await fireEvent.keyDown(rule, { key: 'End' });
        expect(oninspectorwidthchange).toHaveBeenLastCalledWith(440);
    });

    it('applies the Narrow, Default, and Wide menu widths', async () => {
        const { oninspectorwidthchange, rerender } = renderShell();
        await fireEvent.click(screen.getByTitle(inspectorLabels.menuLabel));
        await fireEvent.click(screen.getByRole('button', { name: inspectorLabels.wideLabel }));
        expect(oninspectorwidthchange).toHaveBeenLastCalledWith(440);

        await rerender(440);
        await fireEvent.click(screen.getByRole('button', { name: inspectorLabels.defaultLabel }));
        expect(oninspectorwidthchange).toHaveBeenLastCalledWith(320);

        await rerender(320);
        await fireEvent.click(screen.getByRole('button', { name: inspectorLabels.narrowLabel }));
        expect(oninspectorwidthchange).toHaveBeenLastCalledWith(280);
    });

    it('keeps the inspector as a shell column without a modal drawer', () => {
        renderShell();

        expect(screen.getByRole('complementary', { name: 'Record inspector' })).toBeTruthy();
        expect(screen.queryByRole('dialog')).toBeNull();
        const separator = screen.getByRole('slider', { name: inspectorLabels.resizeLabel });
        expect(separator.closest('.workspace')).not.toBeNull();
    });

    it('delegates the document navigation landmark to the rendered navigator', () => {
        renderShell();
        const shell = document.querySelector('.app-shell');
        if (!(shell instanceof HTMLElement)) {
            throw new TypeError('The app shell must render its root element.');
        }

        expect(shell.querySelectorAll('nav')).toHaveLength(1);
        expect(shell.querySelector('.navigation')?.tagName).toBe('DIV');
        expect(screen.getByRole('navigation', { name: 'Document sections' })).toBeTruthy();
    });
});
