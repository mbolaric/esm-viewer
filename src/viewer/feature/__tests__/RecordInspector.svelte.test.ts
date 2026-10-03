import { isJsonPointer, type JsonPointer } from '#viewer-domain';
import type { IRecordInspectorViewModel } from '#viewer-presentation';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import RecordInspector from '../components/records/RecordInspector.svelte';
import { createViewerTestRenderOptions } from './viewer-test-render.js';

afterEach(() => {
    cleanup();
});

function jsonPointer(value: string): JsonPointer {
    if (!isJsonPointer(value)) {
        throw new TypeError('The inspector fixture source path must be valid.');
    }
    return value;
}

function viewModel(): IRecordInspectorViewModel {
    return {
        documentKind: 'driverCard',
        generation: 'g1',
        heading: {
            detail: '08:42–10:16',
            emphasis: { kind: 'activity', value: 'driving' },
        },
        rows: [
            {
                labelKey: 'activity',
                value: { kind: 'activity', value: 'driving' },
            },
            {
                labelKey: 'start',
                value: { display: '08:42', kind: 'display' },
            },
        ],
        section: 'activities',
        sourcePath: jsonPointer('/cardActivities/0'),
    };
}

function renderInspector(
    props: {
        onclear?: () => void;
        onopenraw?: (path: string) => void;
        viewModel?: IRecordInspectorViewModel | null;
    } = {},
): { onclear: () => void; onopenraw: (path: string) => void } {
    const onclear = props.onclear ?? vi.fn();
    const onopenraw = props.onopenraw ?? vi.fn();
    render(
        RecordInspector,
        {
            props: {
                onclear,
                onopenraw,
                titleId: 'record-inspector-heading',
                viewModel: props.viewModel === undefined ? viewModel() : props.viewModel,
            },
        },
        createViewerTestRenderOptions(),
    );
    return { onclear, onopenraw };
}

function rowForLabel(label: string): HTMLElement {
    const row = screen.getByText(label).closest('.inspector-row');
    if (!(row instanceof HTMLElement)) {
        throw new TypeError(`The ${label} inspector row must be rendered.`);
    }
    return row;
}

describe('RecordInspector', () => {
    it('renders the selected record heading, friendly rows, and canonical source', () => {
        renderInspector();

        expect(screen.getByRole('heading', { level: 2, name: 'Selected record' })).toBeTruthy();
        expect(screen.getByText('Driving · 08:42–10:16')).toBeTruthy();
        expect(rowForLabel('Activity').textContent).toContain('Driving');
        expect(rowForLabel('Start (UTC)').textContent).toContain('08:42');
        expect(rowForLabel('Activity').querySelector('dt')?.getAttribute('title')).toBe('Activity');
        expect(rowForLabel('Start (UTC)').querySelector('dt')?.getAttribute('title')).toBe('Start (UTC)');

        expect(screen.getByRole('heading', { level: 3, name: 'Source and generation' })).toBeTruthy();
        expect(screen.getByText('Generation 1')).toBeTruthy();
        expect(screen.getByText('/cardActivities/0')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Open in Raw Data: /cardActivities/0' })).toBeTruthy();
    });

    it('emits clear and raw-open actions', async () => {
        const { onclear, onopenraw } = renderInspector();

        await fireEvent.click(screen.getByRole('button', { name: 'Close inspector' }));
        expect(onclear).toHaveBeenCalledTimes(1);

        await fireEvent.click(screen.getByRole('button', { name: 'Open in Raw Data: /cardActivities/0' }));
        expect(onopenraw).toHaveBeenCalledWith('/cardActivities/0');
    });

    it('renders an explicit empty state without a close action', () => {
        const { onclear } = renderInspector({ viewModel: null });

        expect(screen.getByText('No record selected')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Close inspector' })).toBeNull();
        expect(within(screen.getByRole('heading', { level: 2, name: 'Selected record' }))).toBeTruthy();
        expect(onclear).not.toHaveBeenCalled();
    });
});
