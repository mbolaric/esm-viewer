import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRawSnippet } from 'svelte';

import UserGuideDialog from '../components/dialogs/UserGuideDialog.svelte';
import { createViewerTestRenderOptions } from './viewer-test-render.js';

afterEach(() => {
    cleanup();
});

describe('UserGuideDialog', () => {
    it('keeps standalone content separate and renders a host guide contribution without shadowing built-in tabs', async () => {
        render(
            UserGuideDialog,
            {
                props: {
                    onclose: vi.fn(),
                    contributions: [
                        {
                            content: createRawSnippet(() => ({ render: () => '<p>Host handbook content</p>' })),
                            icon: 'layers',
                            id: 'features',
                            label: 'Host guide',
                            beforeTab: 'shortcuts',
                        },
                    ],
                },
            },
            createViewerTestRenderOptions(),
        );
        expect(screen.queryByRole('tab', { name: 'Fleet & Audit' })).toBeNull();
        expect(screen.queryByText(/Fleet Archive/u)).toBeNull();
        expect(
            screen
                .getAllByRole('tab')
                .map((tab) => tab.textContent.trim())
                .slice(-2),
        ).toEqual(['Host guide', 'Shortcuts']);
        await fireEvent.click(screen.getByRole('tab', { name: 'Host guide' }));
        expect(screen.getByText('Host handbook content')).toBeTruthy();
        await fireEvent.click(screen.getByRole('tab', { name: 'Features' }));
        expect(screen.queryByText('Host handbook content')).toBeNull();
        expect(screen.getByRole('heading', { name: 'Application tools & document sections' })).toBeTruthy();
    });

    it('renders the user guide and allows tab navigation across all handbook sections', async () => {
        const close = vi.fn();
        render(
            UserGuideDialog,
            {
                props: {
                    onclose: close,
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByRole('dialog', { name: 'User Guide & Reference Handbook' })).toBeTruthy();

        expect(screen.getByRole('heading', { level: 2, name: 'Getting started' })).toBeTruthy();
        expect(screen.getByRole('heading', { level: 3, name: 'Open file…' })).toBeTruthy();
        expect(screen.getByRole('heading', { level: 3, name: 'Supported files and size limit' })).toBeTruthy();
        expect(screen.getByText(/Each file must be no larger than 50 MB/u)).toBeTruthy();

        await fireEvent.click(screen.getByRole('tab', { name: 'Features' }));
        expect(
            screen.getByRole('heading', {
                level: 2,
                name: 'Application tools & document sections',
            }),
        ).toBeTruthy();
        expect(screen.getByText('Overview & Key Indicators')).toBeTruthy();
        expect(screen.getByText('Activities & Timeline')).toBeTruthy();
        expect(screen.getByText('Vehicle & Card Associations')).toBeTruthy();
        expect(screen.getByText('1 Hz Detailed Speed & Overspeed')).toBeTruthy();
        expect(screen.getByText('Places, GNSS & Border Crossings')).toBeTruthy();
        expect(screen.getByText('Compliance & Infringement Engine')).toBeTruthy();

        // Switch to Generations
        await fireEvent.click(screen.getByRole('tab', { name: 'Generations' }));
        expect(screen.getByRole('heading', { level: 2, name: 'Tachograph generations' })).toBeTruthy();
        expect(screen.getByText('Generation 1 (Gen1 - Annex 1B)')).toBeTruthy();
        expect(screen.getByText('Generation 2 Version 1 (Smart 1 - Annex 1C)')).toBeTruthy();
        expect(screen.getByText('Generation 2 Version 2 (Smart 2 - Regulation EU 2021/1228)')).toBeTruthy();

        // Switch to Time Bases
        await fireEvent.click(screen.getByRole('tab', { name: 'Time Bases' }));
        expect(screen.getByRole('heading', { level: 2, name: 'Time bases and duty shifts' })).toBeTruthy();
        expect(screen.getByText('24-Hour UTC calendar day')).toBeTruthy();
        expect(screen.getByText('Driver duty shifts')).toBeTruthy();

        // Switch to Integrity
        await fireEvent.click(screen.getByRole('tab', { name: 'Integrity' }));
        expect(screen.getByRole('heading', { level: 2, name: 'Cryptographic integrity & signatures' })).toBeTruthy();
        expect(screen.getByText('Combined Gen1 / Gen2 cards')).toBeTruthy();
        expect(screen.getByText('Vehicle Unit verification scope')).toBeTruthy();
        expect(screen.getByText(/checks both the signed records and the equipment certificate chain/u)).toBeTruthy();

        // Switch to EU Rules
        await fireEvent.click(screen.getByRole('tab', { name: 'EU Rules' }));
        expect(
            screen.getByRole('heading', {
                level: 2,
                name: 'EU regulations & compliance reference',
            }),
        ).toBeTruthy();
        expect(screen.getByText('Regulation (EC) No 561/2006 (Driving & Rest Times)')).toBeTruthy();
        expect(screen.getByText('Regulation (EU) No 581/2010 (Download Deadlines)')).toBeTruthy();

        // Switch to Shortcuts
        await fireEvent.click(screen.getByRole('tab', { name: 'Shortcuts' }));
        expect(screen.getByRole('heading', { level: 2, name: 'Keyboard shortcuts & navigation' })).toBeTruthy();
        expect(screen.getByText('F1')).toBeTruthy();
        expect(screen.getByText('User guide…')).toBeTruthy();

        // Close button
        await fireEvent.click(screen.getByRole('button', { name: 'Close guide' }));
        expect(close).toHaveBeenCalledOnce();
    });

    it('lists every rule family the compliance engine applies on the EU Rules tab', async () => {
        render(UserGuideDialog, { props: { onclose: vi.fn() } }, createViewerTestRenderOptions());

        await fireEvent.click(screen.getByRole('tab', { name: 'EU Rules' }));

        const cardTitles = [
            'Regulation (EC) No 561/2006 (Driving & Rest Times)',
            'Regulation (EU) 2020/1054 (Mobility Package)',
            'Multi-manning (Articles 4(o), 7 and 8(5))',
            'Directive 2002/15/EC (Working Time)',
            'Regulation (EU) No 581/2010 (Download Deadlines)',
            'Regulation (EU) No 165/2014 (Tachograph Anomalies)',
            'Severity of findings',
            'Rule profiles',
            'What the viewer does not decide',
        ];
        for (const title of cardTitles) {
            expect(screen.getByRole('heading', { level: 3, name: title })).toBeTruthy();
        }

        expect(screen.getByText(/^Weekly working time: At most 60 hours/u)).toBeTruthy();
        expect(screen.getByText(/^Night work: At most 10 hours/u)).toBeTruthy();
        expect(screen.getByText(/^Daily rest: “By way of derogation from paragraph 2, within 30 hours/u)).toBeTruthy();
        expect(
            screen.getByText(/^Crews \(multi-manning\): A crew is recognised from two driver cards being inserted/u),
        ).toBeTruthy();
        expect(screen.getByText(/Serious, Very Serious or Most Serious/u)).toBeTruthy();
        expect(screen.getByText(/^Two-week weekly rest: Only complete UTC calendar weeks/u)).toBeTruthy();
        expect(screen.getByText(/^Daily-driving severity: On a permitted ten-hour day/u)).toBeTruthy();
    });
});
