import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeFileMetadata } from '#contracts';
import { createDocumentSource, createOpenedTachographDocument } from '#viewer-application';
import {
    createSourceReference,
    createTachographWarning,
    isJsonPointer,
    isUtcTimestamp,
    type ISourceReference,
    type JsonPointer,
} from '#viewer-domain';
import { createDocumentOverviewViewModel, type IDocumentOverviewViewModel } from '#viewer-presentation';

import OverviewScreen from '../components/screens/OverviewScreen.svelte';
import { ViewerDocumentSession } from '../controllers/viewer-document-session.svelte.js';
import { createViewerDocumentHarness } from './viewer-document-harness.js';
import { createViewerTestContext } from './viewer-test-context.js';
import { createViewerTestRenderOptions } from './viewer-test-render.js';

afterEach(cleanup);

function source(path: string, generation: 'g1' | 'g2' = 'g1'): ISourceReference<'g1' | 'g2', 'driverCard'> {
    if (!isJsonPointer(path)) throw new TypeError('Invalid overview source fixture.');
    return createSourceReference('driverCard', generation, path);
}

function fixture(multiple = false, warningCount = 0): IDocumentOverviewViewModel {
    const harness = createViewerDocumentHarness();
    const parsed = harness.successfulParserResult();
    const metadata = decodeFileMetadata({ byteLength: 3, displayName: 'overview.ddd', sha256: 'a'.repeat(64) });
    const epoch = Date.UTC(2022, 7, 2);
    if (!parsed.ok || parsed.value.documentKind !== 'driverCard' || !metadata.ok || !isUtcTimestamp(epoch)) {
        throw new TypeError('Invalid overview fixture.');
    }
    const application = parsed.value.applications[0];
    if (application === undefined) throw new TypeError('Missing overview application fixture.');
    const warnings = Array.from({ length: warningCount }, (_, index) =>
        createTachographWarning('duplicateEvidence', source(`/warnings/${String(index)}`)),
    );
    if (warningCount > 0)
        warnings.push(
            createTachographWarning('invalidValue', source('/same')),
            createTachographWarning('invalidValue', source('/same')),
        );
    const document = createOpenedTachographDocument(createDocumentSource(metadata.value, epoch), {
        ...parsed.value,
        applications: [{ ...application, warnings }],
    });
    const viewModel = createDocumentOverviewViewModel(document, createViewerTestContext(harness.controller).localisationService);
    const identity = viewModel.identities[0];
    if (identity?.kind !== 'driver') throw new TypeError('Missing driver identity fixture.');
    const first = {
        ...identity,
        cardIssueDate: { display: '2 Aug 2022', value: epoch },
        cardValidityBegin: { display: '2 Aug 2022', value: epoch },
        cardExpiryDate: { display: '2 Aug 2027', value: epoch },
        licenceNumber: 'DEMO-LICENCE',
    };
    const second = {
        ...first,
        identity: { ...identity.identity, source: source('/identity-g2', 'g2') },
        cardExpiryDate: { display: '2 Aug 2028', value: epoch },
    };
    return {
        ...viewModel,
        identities: multiple ? [first, second] : [first],
        cardNotes: [{ generation: 'g1', source: source('/cardNotes'), text: 'Synthetic retained card note.' }],
    };
}

function renderOverview(
    viewModel: IDocumentOverviewViewModel,
    session = new ViewerDocumentSession(),
): {
    readonly container: HTMLElement;
    readonly unmount: () => void;
    readonly onopensource: (path: JsonPointer) => void;
} {
    const onopensource = vi.fn<(path: JsonPointer) => void>();
    const props = {
        viewModel,
        viewState: session.overviewView,
        onopensource,
        onopenintegrity: vi.fn(),
        onverify: vi.fn(),
        verifying: false,
    };
    const rendered = render(OverviewScreen, { props }, createViewerTestRenderOptions());
    return { container: rendered.container, unmount: rendered.unmount, onopensource };
}

describe('OverviewScreen', () => {
    it('keeps a single identity fully visible and retains card notes with their source', async () => {
        const rendered = renderOverview(fixture());
        expect(rendered.container.querySelector('.identity-list details')).toBeNull();
        expect(screen.getByText('DEMO-LICENCE')).toBeTruthy();
        expect(screen.getByText('Synthetic retained card note.')).toBeTruthy();
        await fireEvent.click(screen.getByRole('button', { name: 'Open in Raw Data: /cardNotes' }));
        expect(rendered.onopensource).toHaveBeenCalledWith('/cardNotes');
        expect(screen.queryByRole('button', { name: 'Activities' })).toBeNull();
    });

    it('collapses all identity details for multiple identities and restores expansion after remount', async () => {
        const viewModel = fixture(true);
        const session = new ViewerDocumentSession();
        const rendered = renderOverview(viewModel, session);
        const identities = rendered.container.querySelectorAll('.identity-list details');
        expect(identities).toHaveLength(2);
        expect(screen.queryByText('1234567890123456')).toBeNull();
        expect(screen.queryByText('2 Aug 2027')).toBeNull();
        expect(screen.queryByText('2 Aug 2028')).toBeNull();
        expect(screen.queryByText('DEMO-LICENCE')).toBeNull();
        const summary = identities[0]?.querySelector('summary');
        if (!(summary instanceof HTMLElement)) throw new TypeError('Missing identity summary.');
        await fireEvent.click(summary);
        await screen.findByText('DEMO-LICENCE');
        expect(screen.getByText('1234567890123456')).toBeTruthy();
        expect(screen.getByText('2 Aug 2027')).toBeTruthy();
        expect(screen.queryByText('2 Aug 2028')).toBeNull();
        rendered.unmount();
        const restored = renderOverview(viewModel, session);
        expect(restored.container.querySelector('.identity-list details')?.hasAttribute('open')).toBe(true);
        expect(screen.getByText('DEMO-LICENCE')).toBeTruthy();
    });

    it('groups warnings without dropping equal sources and retains a bounded page after remount', async () => {
        const viewModel = fixture(false, 120);
        expect(viewModel.warningGroups.map((group) => group.count.value)).toEqual([120, 2]);
        const session = new ViewerDocumentSession();
        const rendered = renderOverview(viewModel, session);
        expect(screen.queryByRole('table')).toBeNull();
        const summary = rendered.container.querySelector('.warning-group summary');
        if (!(summary instanceof HTMLElement)) throw new TypeError('Missing warning summary.');
        await fireEvent.click(summary);
        const table = await screen.findByRole('table');
        expect(within(table).getAllByRole('row')).toHaveLength(51);
        await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        expect(within(table).getByText('/warnings/50')).toBeTruthy();
        await fireEvent.click(within(table).getByRole('button', { name: 'Open in Raw Data: /warnings/50' }));
        expect(rendered.onopensource).toHaveBeenCalledWith('/warnings/50');
        rendered.unmount();
        const restored = renderOverview(viewModel, session);
        const restoredTable = screen.getByRole('table');
        expect(within(restoredTable).getByText('/warnings/50')).toBeTruthy();
        expect(within(restoredTable).queryByText('/warnings/0')).toBeNull();
        const secondSummary = restored.container.querySelectorAll('.warning-group summary')[1];
        if (!(secondSummary instanceof HTMLElement)) throw new TypeError('Missing invalid-value summary.');
        await fireEvent.click(secondSummary);
        await waitFor(() => {
            expect(screen.getAllByRole('button', { name: 'Open in Raw Data: /same' })).toHaveLength(2);
        });
    });
});
