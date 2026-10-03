import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';

import DocumentHeader from '../components/shell/DocumentHeader.svelte';

afterEach(() => {
    cleanup();
});

const baseProps = {
    ariaLabel: 'Open document',
    displayName: 'card-2016.ddd',
    documentKind: 'Driver card',
    documentKindIcon: 'creditCard',
    generation: 'Generation 2',
    generationIcon: 'layers',
    integrity: 'Not checked',
    integrityStatus: 'notChecked',
} as const;

describe('DocumentHeader', () => {
    it('shows the filename, kind, generation, and integrity evidence', () => {
        render(DocumentHeader, { props: baseProps });

        expect(screen.getByText('card-2016.ddd')).toBeTruthy();
        expect(screen.getByText('Driver card')).toBeTruthy();
        expect(screen.getByText('Generation 2')).toBeTruthy();
        expect(screen.getByText('Not checked')).toBeTruthy();
    });

    it('renders an icon in the kind, generation, and integrity badges', () => {
        const { container } = render(DocumentHeader, { props: baseProps });

        expect(container.querySelectorAll('svg')).toHaveLength(3);
    });

    it('keeps the document name as the accessible header label', () => {
        render(DocumentHeader, { props: baseProps });

        const section = screen.getByLabelText('Open document');
        expect(section.textContent).toContain('card-2016.ddd');
    });
});
