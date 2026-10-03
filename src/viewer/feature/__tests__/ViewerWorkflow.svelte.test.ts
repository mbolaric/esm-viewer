import { classifyParseError } from '#contracts';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createViewerDocumentHarness } from './viewer-document-harness.js';
import { buildTestViewerPreferences } from './viewer-test-context.js';
import { startOpen, renderWorkflow, type ViewerDocumentHarness } from './viewer-workflow-helpers.js';

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.localStorage.clear();
});

async function startCommandOpen(harness: ViewerDocumentHarness, expectedRequestCount: number): Promise<void> {
    const commandBar = screen.getByRole('navigation', { name: 'Application commands' });
    await fireEvent.click(within(commandBar).getByRole('button', { name: 'Open file…' }));
    await waitFor(() => {
        expect(harness.parserRequestCount()).toBe(expectedRequestCount);
    });
}

function dispatchFileEvent(target: Element, eventType: 'dragenter' | 'drop', files: readonly File[]): void {
    const event = new Event(eventType, {
        bubbles: true,
        cancelable: true,
    });
    Object.defineProperty(event, 'dataTransfer', {
        value: {
            files,
            types: ['Files'],
        },
    });
    target.dispatchEvent(event);
}

function sectionForHeading(name: string): HTMLElement {
    const section = screen.getByRole('heading', { name }).closest('section');
    if (!(section instanceof HTMLElement)) {
        throw new TypeError(`The ${name} heading must belong to a section.`);
    }
    return section;
}

function setInspectorTestTokens(): void {
    const root = document.documentElement;
    root.style.fontSize = '16px';
    root.style.setProperty('--size-inspector-min', '17.5rem');
    root.style.setProperty('--size-inspector-max', '27.5rem');
}

function inspectorWorkspace(): HTMLElement {
    const inspector = screen.getByRole('complementary', { name: 'Record inspector' });
    const workspace = inspector.closest('.workspace');
    if (!(workspace instanceof HTMLElement)) {
        throw new TypeError('The record inspector must live inside a workspace.');
    }
    return workspace;
}

async function openActivityInspector(harness: ViewerDocumentHarness): Promise<void> {
    await startOpen(harness);
    harness.completeLatestParser(harness.successfulParserResult());
    await screen.findByRole('heading', { name: 'Overview' });

    const navigator = screen.getByRole('navigation', { name: 'Document sections' });
    await fireEvent.click(within(navigator).getByRole('button', { name: 'Activities' }));
    await screen.findByRole('heading', { level: 1, name: 'Activities' });
    await fireEvent.click(screen.getByRole('button', { name: /Select activity record: Other work/u }));
}

async function openActivities(harness: ViewerDocumentHarness): Promise<void> {
    await startOpen(harness);
    harness.completeLatestParser(harness.successfulParserResult());
    await screen.findByRole('heading', { name: 'Overview' });

    const navigator = screen.getByRole('navigation', { name: 'Document sections' });
    await fireEvent.click(within(navigator).getByRole('button', { name: 'Activities' }));
    await screen.findByRole('heading', { level: 1, name: 'Activities' });
}

describe('viewer open workflow', () => {
    it('applies preferences without replacing the current application task', async () => {
        const harness = createViewerDocumentHarness();
        const context = renderWorkflow(harness);

        context.preferencesController.open();
        const dialog = await screen.findByRole('dialog', { name: 'Preferences' });
        expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: 'Preferences' }));
        expect(within(dialog).getByText('English')).toBeTruthy();

        await fireEvent.change(within(dialog).getByLabelText('Theme'), {
            target: { value: 'dark' },
        });
        await fireEvent.click(within(dialog).getByRole('tab', { name: 'Date & Time' }));
        await fireEvent.change(within(dialog).getByLabelText('Time display'), {
            target: { value: 'UTC' },
        });
        await fireEvent.click(within(dialog).getByRole('tab', { name: 'Appearance' }));
        await fireEvent.click(
            within(dialog).getByRole('radio', {
                name: 'Comfortable',
            }),
        );
        await fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));

        await waitFor(() => {
            expect(screen.queryByRole('dialog', { name: 'Preferences' })).toBeNull();
        });
        expect(context.preferencesController.snapshot.preferences).toMatchObject({
            density: 'comfortable',
            displayTimeZone: 'UTC',
            theme: 'dark',
        });
        expect(screen.getByRole('heading', { name: 'Open a tachograph file' })).toBeTruthy();
    });

    it('opens a file through the worker-facing controller and shows a factual ready state', async () => {
        const harness = createViewerDocumentHarness();
        const ondocumentstatuschange = vi.fn();
        renderWorkflow(harness, ondocumentstatuschange);

        const welcomeMain = screen.getByRole('main');
        expect(screen.queryByRole('navigation', { name: 'Application commands' })).toBeNull();
        expect(within(welcomeMain).getAllByRole('button', { name: 'Open file…' })).toHaveLength(1);

        await startOpen(harness);
        const openingHeading = screen.getByRole('heading', {
            name: 'Opening tachograph file',
        });
        expect(document.activeElement).toBe(openingHeading);

        harness.completeLatestParser(harness.successfulParserResult());

        const overviewHeading = await screen.findByRole('heading', { name: 'Overview' });
        expect(document.activeElement).toBe(overviewHeading);
        const main = screen.getByRole('main');
        const documentHeader = screen.getByRole('region', { name: 'Open document' });
        expect(within(documentHeader).getByText('synthetic-card.ddd')).toBeTruthy();
        expect(within(documentHeader).getByText('Driver card')).toBeTruthy();
        expect(within(documentHeader).getByText('Generation 1')).toBeTruthy();
        expect(within(documentHeader).getByText('Not checked')).toBeTruthy();
        expect(documentHeader.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
        expect(within(documentHeader).queryByText('UTC')).toBeNull();
        // Status bar warning count is reported upward via callback.
        expect(ondocumentstatuschange).toHaveBeenLastCalledWith({ warningCount: '1' });
        expect(within(main).getAllByText('Not checked').length).toBeGreaterThan(0);
        expect(screen.getAllByRole('button', { name: 'Open file…' })).toHaveLength(1);
        expect(within(main).queryByRole('button', { name: 'Open file…' })).toBeNull();

        const documentSection = sectionForHeading('File evidence');
        expect(within(documentSection).getByText('a'.repeat(64))).toBeTruthy();
        expect(documentSection.textContent).toContain('Period start');
        expect(documentSection.textContent).toContain('Period end');
        expect(documentSection.textContent).not.toContain('Source file');
        expect(documentSection.textContent).not.toContain('Display time zone');

        const identitySection = sectionForHeading('Identity');
        expect(within(identitySection).getByRole('heading', { name: 'Driver card identity' })).toBeTruthy();
        expect(within(identitySection).getByText('Ada')).toBeTruthy();
        expect(within(identitySection).getByText('Lovelace')).toBeTruthy();
        expect(within(identitySection).getByText('1234567890123456')).toBeTruthy();
        expect(within(identitySection).getByText('/identity')).toBeTruthy();

        const contentsSection = sectionForHeading('Contents');
        expect(contentsSection.textContent).toContain('Activity days');
        expect(contentsSection.textContent).toContain('Events');
        expect(contentsSection.textContent).toContain('Normalization warnings');
        expect(contentsSection.textContent).toContain('viewer calculations, not recorded activity or a legal conclusion');

        const navigator = screen.getByRole('navigation', { name: 'Document sections' });
        const integritySection = sectionForHeading('Integrity');
        expect(integritySection.textContent).toContain('Verification has not been requested.');
        expect(integritySection.textContent).toContain('Parsing succeeded independently of this verification state.');

        await fireEvent.click(
            within(integritySection).getByRole('button', {
                name: 'View integrity evidence',
            }),
        );
        const integrityHeading = await screen.findByRole('heading', {
            name: 'Integrity',
            level: 1,
        });
        expect(document.activeElement).toBe(integrityHeading);
        expect(screen.getByText('No checked items reported')).toBeTruthy();
        expect(
            screen.getByText(
                'No verification action is available in this build, so this screen does not claim a signature result.',
            ),
        ).toBeTruthy();
        expect(screen.getByText('No per-item verification evidence is available.')).toBeTruthy();

        await fireEvent.click(within(navigator).getByRole('button', { name: 'Overview' }));
        expect(await screen.findByRole('heading', { name: 'Overview' })).toBeTruthy();

        const warningsSection = sectionForHeading('Warnings and unsupported data');
        expect(warningsSection.textContent).toContain('Some source data is not normalized by this viewer.');
        expect(within(warningsSection).getByText('/unsupported/0')).toBeTruthy();

        expect(within(navigator).getByRole('heading', { name: 'Summary' })).toBeTruthy();
        expect(within(navigator).getByRole('heading', { name: 'Records' })).toBeTruthy();
        expect(within(navigator).getByRole('heading', { name: 'Evidence' })).toBeTruthy();

        await fireEvent.click(
            within(sectionForHeading('Identity')).getByRole('button', {
                name: 'Open in Raw Data: /identity',
            }),
        );
        const rawDataHeading = await screen.findByRole('heading', { name: 'Raw data' });
        expect(document.activeElement).toBe(rawDataHeading);
        const selectedValueSection = sectionForHeading('Selected value');
        expect(within(selectedValueSection).getByText('/identity')).toBeTruthy();
        expect(within(selectedValueSection).getByText('Object')).toBeTruthy();

        const rawTree = screen.getByRole('tree', { name: 'Decoded evidence tree' });
        const identityTreeItem = within(rawTree).getByRole('treeitem', {
            name: /identity\s+Object/u,
        });
        expect(identityTreeItem.getAttribute('aria-expanded')).toBe('false');
        expect(identityTreeItem.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
        expect(identityTreeItem.textContent).not.toContain('Expand branch');
        await fireEvent.keyDown(identityTreeItem, { key: 'ArrowRight' });
        expect(identityTreeItem.getAttribute('aria-expanded')).toBe('true');
        await fireEvent.keyDown(identityTreeItem, { key: 'ArrowRight' });
        expect(document.activeElement?.textContent).toContain('cardNumber');

        const rawSearch = screen.getByLabelText('Search current raw data');
        await fireEvent.input(rawSearch, {
            target: { value: 'Lovelace' },
        });
        expect(screen.getByText(/1\s+of\s+1\s+matching results/u)).toBeTruthy();
        expect(within(selectedValueSection).getByText('"Lovelace"')).toBeTruthy();
        await fireEvent.click(
            within(selectedValueSection).getByRole('button', {
                name: 'Copy exact value',
            }),
        );
        expect(await within(selectedValueSection).findByText('Copied to the clipboard.')).toBeTruthy();
        expect(
            within(selectedValueSection).getByRole('navigation', {
                name: 'Selected path breadcrumb',
            }),
        ).toBeTruthy();
        await fireEvent.keyDown(rawSearch, { key: 'Escape' });
        if (!(rawSearch instanceof HTMLInputElement)) {
            throw new TypeError('The raw-data search control must be an input.');
        }
        expect(rawSearch.value).toBe('');
        expect(within(selectedValueSection).getByText('"Lovelace"')).toBeTruthy();
        expect(screen.getAllByRole('treeitem').some((item) => item.getAttribute('aria-selected') === 'true')).toBe(true);

        await fireEvent.click(within(navigator).getByRole('button', { name: 'Events & faults' }));
        const eventsFaultsHeading = await screen.findByRole('heading', {
            name: 'Events & faults',
            level: 1,
        });
        expect(document.activeElement).toBe(eventsFaultsHeading);
        expect(screen.getByRole('button', { name: 'All (2)', pressed: true })).toBeTruthy();
        const eventFaultTable = screen.getByRole('table', {
            name: 'Chronological event and fault records',
        });
        expect(within(eventFaultTable).getAllByRole('row')).toHaveLength(3);
        expect(within(eventFaultTable).getByText('cardConflict')).toBeTruthy();

        await fireEvent.click(screen.getByRole('button', { name: 'Faults (1)' }));
        expect(screen.getByRole('button', { name: 'Faults (1)', pressed: true })).toBeTruthy();
        expect(within(eventFaultTable).getAllByRole('row')).toHaveLength(2);
        expect(within(eventFaultTable).queryByText('cardConflict')).toBeNull();
        expect(within(eventFaultTable).getByText('Recording equipment printer fault')).toBeTruthy();
        expect(
            within(eventFaultTable).queryByRole('button', {
                name: 'Recording equipment printer fault',
            }),
        ).toBeNull();

        await fireEvent.click(
            within(eventFaultTable).getByRole('button', {
                name: 'Open in Raw Data: /faults/0',
            }),
        );
        expect(await screen.findByRole('heading', { name: 'Raw data', level: 1 })).toBeTruthy();
        expect(within(sectionForHeading('Selected value')).getByText('/faults/0')).toBeTruthy();

        await fireEvent.click(within(navigator).getByRole('button', { name: 'Overview' }));
        expect(await screen.findByRole('heading', { name: 'Overview' })).toBeTruthy();
    });

    it('presents activity days, viewer totals, selectable records, and canonical sources', async () => {
        const harness = createViewerDocumentHarness();
        renderWorkflow(harness);

        await startOpen(harness);
        harness.completeLatestParser(harness.successfulParserResult());
        await screen.findByRole('heading', { name: 'Overview' });

        const navigator = screen.getByRole('navigation', { name: 'Document sections' });
        await fireEvent.click(within(navigator).getByRole('button', { name: 'Activities' }));

        const activityHeading = await screen.findByRole('heading', {
            level: 1,
            name: 'Activities',
        });
        expect(document.activeElement).toBe(activityHeading);
        const dateControl = screen.getByLabelText('Activity date');
        if (!(dateControl instanceof HTMLInputElement)) {
            throw new TypeError('The workflow activity date control must be an input.');
        }
        expect(dateControl.value).toBe('Jul 27, 2026');
        expect(screen.getByRole('heading', { name: 'Viewer-calculated totals' })).toBeTruthy();
        expect(
            screen.getByRole('table', {
                name: 'Chronological activity records for the selected UTC day',
            }),
        ).toBeTruthy();

        const workRecord = screen.getByRole('button', {
            name: /Select activity record: Other work/u,
        });
        await fireEvent.click(workRecord);
        expect(
            screen.getByRole('button', {
                name: /Select activity record: Other work/u,
                pressed: true,
            }),
        ).toBeTruthy();

        const activityTable = screen.getByRole('table', {
            name: 'Chronological activity records for the selected UTC day',
        });
        await fireEvent.click(
            within(activityTable).getByRole('button', {
                name: 'Open in Raw Data: /activities/1',
            }),
        );
        expect(await screen.findByRole('heading', { level: 1, name: 'Raw data' })).toBeTruthy();
        expect(within(sectionForHeading('Selected value')).getByText('/activities/1')).toBeTruthy();

        await fireEvent.click(within(navigator).getByRole('button', { name: 'Activities' }));
        await screen.findByRole('heading', { level: 1, name: 'Activities' });
        await fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
        expect(dateControl.isConnected).toBe(false);
        const earlierDateControl = screen.getByLabelText('Activity date');
        if (!(earlierDateControl instanceof HTMLInputElement)) {
            throw new TypeError('The earlier activity date control must be an input.');
        }
        expect(earlierDateControl.value).toBe('Jul 26, 2026');
        expect(
            within(
                screen.getByRole('table', {
                    name: 'Chronological activity records for the selected UTC day',
                }),
            ).getByRole('button', { name: 'Open in Raw Data: /activities/0' }),
        ).toBeTruthy();
    });

    it('presents normalized vehicle associations and opens their canonical source', async () => {
        const harness = createViewerDocumentHarness();
        renderWorkflow(harness);

        await startOpen(harness);
        harness.completeLatestParser(harness.successfulParserResult());
        await screen.findByRole('heading', { name: 'Overview' });

        const navigator = screen.getByRole('navigation', { name: 'Document sections' });
        await fireEvent.click(within(navigator).getByRole('button', { name: 'Vehicles' }));

        expect(await screen.findByRole('heading', { level: 1, name: 'Vehicles' })).toBeTruthy();
        const table = screen.getByRole('table', {
            name: 'Vehicle-use periods grouped by vehicle identity and ordered by first use',
        });
        expect(within(table).getByText('B-ESM-2026')).toBeTruthy();
        expect(within(table).getByText('280 km')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Generation 1 (1)' })).toBeTruthy();

        await fireEvent.click(
            within(table).getByRole('button', {
                name: 'Open in Raw Data: /vehicles/0',
            }),
        );
        expect(await screen.findByRole('heading', { level: 1, name: 'Raw data' })).toBeTruthy();
        expect(within(sectionForHeading('Selected value')).getByText('/vehicles/0')).toBeTruthy();
    });

    it('links the selected activity day to filtered association and event sections', async () => {
        const harness = createViewerDocumentHarness();
        renderWorkflow(harness);

        await openActivities(harness);
        const navigator = screen.getByRole('navigation', { name: 'Document sections' });

        await fireEvent.click(screen.getByRole('button', { name: 'Show vehicles & drivers' }));
        expect(await screen.findByRole('heading', { level: 1, name: 'Vehicles' })).toBeTruthy();
        expect(screen.getByText('Showing records for Jul 27, 2026')).toBeTruthy();
        const vehiclesTable = screen.getByRole('table', {
            name: 'Vehicle-use periods grouped by vehicle identity and ordered by first use',
        });
        expect(within(vehiclesTable).getAllByRole('row')).toHaveLength(2);
        expect(within(vehiclesTable).getByText('B-ESM-2026')).toBeTruthy();

        await fireEvent.click(screen.getByRole('button', { name: 'Show all records' }));
        expect(screen.queryByText('Showing records for Jul 27, 2026')).toBeNull();
        expect(within(vehiclesTable).getAllByRole('row')).toHaveLength(2);

        await fireEvent.click(within(navigator).getByRole('button', { name: 'Activities' }));
        await screen.findByRole('heading', { level: 1, name: 'Activities' });
        await fireEvent.click(screen.getByRole('button', { name: 'Show events & faults' }));
        expect(await screen.findByRole('heading', { level: 1, name: 'Events & faults' })).toBeTruthy();
        expect(screen.getByText('Showing records for Jul 27, 2026')).toBeTruthy();
        const eventsTable = screen.getByRole('table', {
            name: 'Chronological event and fault records',
        });
        expect(within(eventsTable).getAllByRole('row')).toHaveLength(3);
        expect(within(eventsTable).getByText('cardConflict')).toBeTruthy();
    });

    it('shows Vehicle Unit identity and an explicit not-checked verification scope', async () => {
        const harness = createViewerDocumentHarness({ displayNameCandidate: 'synthetic-vu.ddd' });
        const context = renderWorkflow(harness);

        await startOpen(harness);
        harness.completeLatestParser(harness.successfulVehicleParserResult());
        await screen.findByRole('heading', { name: 'Overview' });

        const documentHeader = screen.getByRole('region', { name: 'Open document' });
        expect(within(documentHeader).getByText('Vehicle Unit (VU)')).toBeTruthy();
        expect(within(documentHeader).getByText('Generation 2')).toBeTruthy();
        const documentSection = sectionForHeading('File evidence');
        expect(documentSection.textContent).toContain('Period start');
        expect(documentSection.textContent).toContain('Period end');

        const identitySection = sectionForHeading('Identity');
        expect(within(identitySection).getByRole('heading', { name: 'Vehicle Unit identity' })).toBeTruthy();
        expect(within(identitySection).getByText('B-ESM-2026')).toBeTruthy();
        expect(within(identitySection).getByText('WVWZZZ1JZXW000001')).toBeTruthy();

        const contentsSection = sectionForHeading('Contents');
        expect(contentsSection.textContent).not.toContain('Activity days');

        const integritySection = sectionForHeading('Integrity');
        expect(integritySection.textContent).toContain('Not checked');
        expect(integritySection.textContent).toContain('Verification has not been requested.');
        expect(integritySection.textContent).toContain('Parsing succeeded independently of this verification state.');
        expect(sectionForHeading('Warnings and unsupported data').textContent).toContain(
            'No normalization warnings were reported.',
        );

        const navigator = screen.getByRole('navigation', { name: 'Document sections' });
        await fireEvent.click(within(navigator).getByRole('button', { name: 'Integrity' }));
        expect(await screen.findByRole('heading', { name: 'Integrity', level: 1 })).toBeTruthy();
        expect(
            screen.getByText(
                'No verification action is available in this build, so this screen does not claim a signature result.',
            ),
        ).toBeTruthy();
        expect(screen.getByText('No per-item verification evidence is available.')).toBeTruthy();

        await fireEvent.click(within(navigator).getByRole('button', { name: 'Drivers & cards' }));
        expect(await screen.findByRole('heading', { level: 1, name: 'Drivers & cards' })).toBeTruthy();
        const cardUseTable = screen.getByRole('table', {
            name: 'Card insertion and withdrawal periods ordered chronologically',
        });
        expect(within(cardUseTable).getByText('1234567890123456')).toBeTruthy();
        expect(within(cardUseTable).getByText('Lovelace Ada')).toBeTruthy();
        expect(within(cardUseTable).getByText('Driver')).toBeTruthy();

        await fireEvent.click(within(navigator).getByRole('button', { name: 'Speed' }));
        expect(await screen.findByRole('heading', { level: 1, name: 'Speed' })).toBeTruthy();
        expect(screen.getByRole('heading', { name: 'Factual selected-range summary' })).toBeTruthy();
        expect(screen.getByRole('button', { name: /detailed-speed time series/u })).toBeTruthy();
        const speedTable = screen.getByRole('table', {
            name: 'Exact chronological detailed-speed samples for the selected UTC range',
        });
        expect(within(speedTable).getAllByRole('row')).toHaveLength(301);

        await fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
        expect(
            within(
                screen.getByRole('table', {
                    name: 'Exact chronological detailed-speed samples for the selected UTC range',
                }),
            ).getAllByRole('row'),
        ).toHaveLength(3);

        await fireEvent.input(screen.getByLabelText('Range start (UTC)'), {
            target: { value: '2026-07-27T08:46:59' },
        });
        await fireEvent.input(screen.getByLabelText('Range end (UTC)'), {
            target: { value: '2026-07-27T08:47:01' },
        });
        await fireEvent.click(screen.getByRole('button', { name: 'Apply range' }));
        const filteredSpeedTable = screen.getByRole('table', {
            name: 'Exact chronological detailed-speed samples for the selected UTC range',
        });
        await waitFor(() => {
            expect(within(filteredSpeedTable).getAllByRole('row')).toHaveLength(4);
        });

        context.preferencesController.open();
        await context.preferencesController.apply(
            buildTestViewerPreferences({ displayDateFormat: 'ddMMyyyy', displayTimeFormat: 'h23' }),
        );
        const speedStart = screen.getByLabelText('Range start (UTC)');
        if (!(speedStart instanceof HTMLInputElement)) {
            throw new TypeError('The speed range start control must be an input.');
        }
        await waitFor(() => {
            expect(speedStart.value).toBe('27.07.2026 08:46:59');
        });

        await fireEvent.click(
            within(filteredSpeedTable).getByRole('button', {
                name: 'Open in Raw Data: /speed/299',
            }),
        );
        expect(await screen.findByRole('heading', { level: 1, name: 'Raw data' })).toBeTruthy();
        expect(within(sectionForHeading('Selected value')).getByText('/speed/299')).toBeTruthy();
    });

    it('cancels parsing immediately and returns to the welcome task', async () => {
        const harness = createViewerDocumentHarness();
        renderWorkflow(harness);

        await startOpen(harness);
        await screen.findByRole('heading', { name: 'Opening tachograph file' });
        await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(await screen.findByRole('heading', { name: 'Open a tachograph file' })).toBeTruthy();
        expect(harness.releaseCount()).toBe(1);
    });

    it('opens one dropped file through the same parser workflow and shows drag feedback', async () => {
        const harness = createViewerDocumentHarness({ displayNameCandidate: 'dropped-card.ddd' });
        renderWorkflow(harness);
        const file = new File([new Uint8Array([0x00, 0x02, 0x01])], 'dropped-card.ddd');
        const main = screen.getByRole('main');

        dispatchFileEvent(main, 'dragenter', [file]);
        const feedback = await screen.findByRole('status');
        expect(within(feedback).getByText('Drop to open')).toBeTruthy();
        expect(within(feedback).getByText('dropped-card.ddd')).toBeTruthy();

        dispatchFileEvent(main, 'drop', [file]);
        await waitFor(() => {
            expect(harness.parserRequestCount()).toBe(1);
        });
        harness.completeLatestParser(harness.successfulParserResult());

        expect(await screen.findByRole('heading', { name: 'Overview' })).toBeTruthy();
        expect(screen.queryByText('Drop to open')).toBeNull();
    });

    it('rejects multiple dropped files without changing the current document', async () => {
        const harness = createViewerDocumentHarness();
        renderWorkflow(harness);

        await startOpen(harness);
        harness.completeLatestParser(harness.successfulParserResult());
        await screen.findByRole('heading', { name: 'Overview' });

        dispatchFileEvent(screen.getByRole('main'), 'drop', [
            new File([new Uint8Array([0x00, 0x02])], 'first.ddd'),
            new File([new Uint8Array([0x00, 0x02])], 'second.ddd'),
        ]);

        expect(await screen.findByText('Open one file at a time. The current document was not changed.')).toBeTruthy();
        expect(screen.getByText('multipleFilesDropped')).toBeTruthy();
        expect(harness.parserRequestCount()).toBe(1);
        expect(screen.getByRole('button', { name: 'Return to current document' })).toBeTruthy();
    });

    it('returns to welcome when the active document is closed and releases its source', async () => {
        const harness = createViewerDocumentHarness();
        renderWorkflow(harness);

        await startOpen(harness);
        harness.completeLatestParser(harness.successfulParserResult());
        await screen.findByRole('heading', { name: 'Overview' });

        await harness.controller.close();

        expect(await screen.findByRole('heading', { name: 'Open a tachograph file' })).toBeTruthy();
        expect(harness.releaseCount()).toBe(1);
    });

    it('shows a stable privacy-safe failure and allows another attempt', async () => {
        const harness = createViewerDocumentHarness();
        renderWorkflow(harness);

        await startOpen(harness);
        harness.completeLatestParser({
            error: classifyParseError('malformedData'),
            ok: false,
        });

        const failureHeading = await screen.findByRole('heading', {
            name: 'This file could not be opened',
        });
        expect(document.activeElement).toBe(failureHeading);
        expect(screen.getByText('malformedData')).toBeTruthy();
        // Reassurance message is omitted when no prior document was open.
        expect(screen.queryByText('The source file was not changed.')).toBeNull();
        expect(screen.getByRole('button', { name: 'Choose another file' })).toBeTruthy();
        expect(harness.releaseCount()).toBe(1);
    });

    it('preserves the active section and document when a replacement fails', async () => {
        const harness = createViewerDocumentHarness();
        renderWorkflow(harness);

        await startOpen(harness);
        harness.completeLatestParser(harness.successfulParserResult());
        await screen.findByRole('heading', { name: 'Overview' });

        const navigator = screen.getByRole('navigation', { name: 'Document sections' });
        await fireEvent.click(within(navigator).getByRole('button', { name: 'Events & faults' }));
        await screen.findByRole('heading', { name: 'Events & faults' });

        await startCommandOpen(harness, 2);
        expect(within(navigator).getByRole('button', { name: 'Overview' }).hasAttribute('disabled')).toBe(true);
        harness.completeLatestParser({
            error: classifyParseError('malformedData'),
            ok: false,
        });

        await screen.findByRole('heading', { name: 'This file could not be opened' });
        expect(harness.releaseCount()).toBe(1);
        await fireEvent.click(screen.getByRole('button', { name: 'Return to current document' }));

        const restoredHeading = await screen.findByRole('heading', {
            name: 'Events & faults',
        });
        expect(document.activeElement).toBe(restoredHeading);
        expect(within(navigator).getByRole('button', { name: 'Events & faults' }).getAttribute('aria-current')).toBe('page');
    });

    it('reformats the Activities All days table when the display date format changes', async () => {
        const harness = createViewerDocumentHarness();
        const context = renderWorkflow(harness);
        await openActivities(harness);

        const allDaysTab = screen.getByRole('tab', { name: 'All days' });
        await fireEvent.click(allDaysTab);
        expect(allDaysTab.getAttribute('aria-selected')).toBe('true');

        const table = screen.getByRole('table', {
            name: 'Viewer-calculated activity totals for every decoded UTC day',
        });
        expect(within(table).getByText('Jul 26, 2026')).toBeTruthy();
        expect(within(table).getByRole('button', { name: 'Show day: Jul 26, 2026' })).toBeTruthy();

        context.preferencesController.open();
        await context.preferencesController.apply(
            buildTestViewerPreferences({ displayDateFormat: 'ddMMyyyy', displayTimeFormat: 'h23' }),
        );

        await waitFor(() => {
            expect(within(table).getByText('26.07.2026')).toBeTruthy();
        });
        expect(within(table).getByRole('button', { name: 'Show day: 26.07.2026' })).toBeTruthy();
    });

    it('clears a selected activity infringement when a different document session opens', async () => {
        const harness = createViewerDocumentHarness({
            openedAtStepMs: 1,
        });
        renderWorkflow(harness);
        await openActivities(harness);

        const dateControl = screen.getByLabelText('Activity date');
        await fireEvent.change(dateControl, { target: { value: '2026-07-26' } });
        const infringementRegion = await screen.findByRole('region', {
            name: 'Timeline infringement markers',
        });
        await fireEvent.click(within(infringementRegion).getByRole('button'));
        expect(screen.getByRole('complementary', { name: 'Record inspector' })).toBeTruthy();

        await startCommandOpen(harness, 2);
        harness.completeLatestParser(harness.successfulParserResult());
        await waitFor(() => {
            expect(screen.queryByRole('complementary', { name: 'Record inspector' })).toBeNull();
        });
    });
});

describe('shared record inspector width', () => {
    it('applies menu presets and pointer-drag resize through the application wiring', async () => {
        setInspectorTestTokens();

        const harness = createViewerDocumentHarness();
        const context = renderWorkflow(harness);
        await openActivityInspector(harness);

        const workspace = inspectorWorkspace();
        expect(workspace.style.getPropertyValue('--size-inspector-current')).toBe('320px');

        await fireEvent.click(screen.getByTitle('Inspector width'));
        await fireEvent.click(screen.getByRole('button', { name: 'Wide' }));
        expect(workspace.style.getPropertyValue('--size-inspector-current')).toBe('440px');
        expect(context.keyValueStore.getItem('esm-viewer.inspectorWidth')).toBe('440');

        await fireEvent.click(screen.getByTitle('Inspector width'));
        await fireEvent.click(screen.getByRole('button', { name: 'Narrow' }));
        expect(workspace.style.getPropertyValue('--size-inspector-current')).toBe('280px');

        const widthSlider = screen.getByRole('slider', { name: 'Resize inspector width' });
        await fireEvent.pointerDown(widthSlider, { clientX: 500 });
        await fireEvent.pointerMove(widthSlider, { clientX: 440 });
        expect(workspace.style.getPropertyValue('--size-inspector-current')).toBe('340px');
        await fireEvent.pointerUp(widthSlider, { clientX: 440 });

        await fireEvent.pointerDown(widthSlider, { clientX: 440 });
        await fireEvent.pointerMove(widthSlider, { clientX: 700 });
        await fireEvent.pointerUp(widthSlider, { clientX: 700 });
        expect(workspace.style.getPropertyValue('--size-inspector-current')).toBe('280px');

        await fireEvent.pointerDown(widthSlider, { clientX: 700 });
        await fireEvent.pointerMove(widthSlider, { clientX: 460 });
        await fireEvent.pointerUp(widthSlider, { clientX: 460 });
        expect(workspace.style.getPropertyValue('--size-inspector-current')).toBe('440px');
    });
});
