import { createSourceReference, isJsonPointer, type ISourceReference, type VerificationGeneration } from '#viewer-domain';
import type { IIntegrityDetailViewModel } from '#viewer-presentation';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import IntegrityScreen from '../components/screens/IntegrityScreen.svelte';
import { createDocumentScopedValue } from '../controllers/document-scoped-value.svelte.js';
import { createViewerTestRenderOptions } from './viewer-test-render.js';

afterEach(() => {
    cleanup();
});

function source(generation: VerificationGeneration, path: string): ISourceReference<VerificationGeneration, 'driverCard'> {
    if (!isJsonPointer(path)) {
        throw new TypeError('The integrity screen source fixture must be valid.');
    }
    return createSourceReference('driverCard', generation, path);
}

function numberValue(value: number): Readonly<{ readonly display: string; readonly value: number }> {
    return {
        display: String(value),
        value,
    };
}

describe('IntegrityScreen', () => {
    it('renders text-and-icon scope and item evidence with canonical source actions', async () => {
        const validSource = source('g1', '/cardDataResponses/gen1/cardDownload');
        const invalidSource = source('g1', '/cardDataResponses/gen1/identification');
        const items = [
            {
                generation: 'g1' as const,
                recordId: 'CardDownload',
                source: validSource,
                status: 'valid' as const,
            },
            {
                generation: 'g1' as const,
                recordId: 'ApplicationIdentification',
                source: invalidSource,
                status: 'invalid' as const,
            },
        ];
        const viewModel: IIntegrityDetailViewModel = {
            assessment: {
                items,
                status: 'partiallyValid',
            },
            checkedItems: numberValue(2),
            invalidItems: numberValue(1),
            items,
            scopes: [
                {
                    applicationGeneration: 'g1',
                    assessment: {
                        items,
                        status: 'partiallyValid',
                    },
                    checkedItems: numberValue(2),
                    invalidItems: numberValue(1),
                    source: source('g1', '/cardDataResponses/gen1'),
                    validItems: numberValue(1),
                    verificationGeneration: 'g1',
                },
            ],
            validItems: numberValue(1),
        };
        const openSource = vi.fn();

        const rendered = render(
            IntegrityScreen,
            {
                props: {
                    filterText: createDocumentScopedValue(''),
                    onopensource: openSource,
                    onverify: vi.fn(),
                    verifying: false,
                    viewModel,
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByRole('heading', { name: 'Integrity', level: 1 })).toBeTruthy();
        expect(screen.getAllByText('Partially valid')).toHaveLength(2);
        expect(rendered.container.querySelectorAll('svg[aria-hidden="true"]').length).toBeGreaterThan(0);

        const table = screen.getByRole('table');
        const rows = within(table).getAllByRole('row');
        expect(rows).toHaveLength(3);
        expect(rows[1]?.textContent).toContain('CardDownload');
        expect(rows[1]?.textContent).toContain('Valid');
        expect(rows[2]?.textContent).toContain('ApplicationIdentification');
        expect(rows[2]?.textContent).toContain('Invalid');

        await fireEvent.click(
            within(table).getByRole('button', {
                name: `Open in Raw Data: ${invalidSource.path}`,
            }),
        );
        expect(openSource).toHaveBeenCalledWith(invalidSource.path);
    });
});
