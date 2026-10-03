import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const appShell = readFileSync(new URL('../layout/AppShell.svelte', import.meta.url), 'utf8');
const buttonControl = readFileSync(new URL('../controls/Button.svelte', import.meta.url), 'utf8');
const dataTable = readFileSync(new URL('../data-table/DataTable.svelte', import.meta.url), 'utf8');
const foundation = readFileSync(new URL('../styles/foundation.css', import.meta.url), 'utf8');
const recordSectionLayout = readFileSync(
    new URL('../../viewer/feature/components/records/RecordSectionLayout.svelte', import.meta.url),
    'utf8',
);
const viewerTablePanels = ['AssociationsScreen.svelte', 'ComparisonScreen.svelte', 'EventsFaultsScreen.svelte'].map((fileName) =>
    readFileSync(new URL(`../../viewer/feature/components/screens/${fileName}`, import.meta.url), 'utf8'),
);
const tokens = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');
const commandBar = readFileSync(new URL('../../shell/CommandBar.svelte', import.meta.url), 'utf8');

describe('responsive shell layout', () => {
    it('sizes the side panel from the workspace-local selected width', () => {
        expect(tokens).toMatch(
            /--layout-shell-document-inspector-columns: var\(--size-navigator\)[\s\S]*?minmax\(var\(--space-none\), 1fr\)[\s\S]*?var\(--size-inspector-separator\) auto;/,
        );
        expect(appShell).toMatch(
            /\.inspector \{[\s\S]*?inline-size: var\([\s\S]*?--size-inspector-responsive,[\s\S]*?clamp\([\s\S]*?var\(--size-inspector-min\),[\s\S]*?var\(--size-inspector-current\),[\s\S]*?var\(--size-inspector-max\)/,
        );
        expect(tokens).toMatch(/@media \(max-width: 56rem\) \{[\s\S]*?--size-inspector-responsive: var\(--size-full\);/);
    });

    it('keeps shell rows and the command bar from forcing the shell wider than the window', () => {
        expect(appShell).toMatch(/\.commands,\s*\.document-header \{\s*min-inline-size: var\(--space-none\);/);
        expect(tokens).toMatch(/--display-command-bar-button-label: inline-flex;/);
        expect(tokens).toMatch(/@media \(max-width: 56rem\) \{[\s\S]*?--display-command-bar-button-label: none;/);
        expect(commandBar).toMatch(/--display-button-label: var\(--display-command-bar-button-label\);/);
        expect(buttonControl).toMatch(/\.button \.label \{\s*display: var\(--display-button-label, inline-flex\);/);
    });

    it('protects a usable row viewport when a fill-height table is constrained', () => {
        expect(tokens).toMatch(/--size-table-body-min-block:/);
        expect(tokens).toMatch(/--size-table-fill-min-block:/);
        expect(tokens).toMatch(/--layout-table-fill-flex: 1 0 var\(--size-table-fill-min-block\);/);
        expect(dataTable).toMatch(
            /\.table-shell\.fill-height \{[\s\S]*?flex: var\(--layout-table-fill-flex\);[\s\S]*?min-block-size: var\(--size-table-fill-min-block\);/,
        );
        expect(dataTable).toMatch(
            /\.table-shell\.fill-height \.table-body-scroll \{[\s\S]*?min-block-size: var\(--size-table-body-min-block\);/,
        );
    });

    it('lets table screens scroll while nested panels preserve the table floor', () => {
        expect(foundation).toMatch(/\.table-screen \{[\s\S]*?overflow-x: hidden;[\s\S]*?overflow-y: auto;/);
        expect(tokens).toMatch(/--layout-shell-main-rows: minmax\(var\(--space-none\), 1fr\);/);
        expect(appShell).toMatch(
            /\.document-workspace \.main-content \{[\s\S]*?grid-template-rows: var\(--layout-shell-main-rows\);/,
        );
        expect(recordSectionLayout).toMatch(
            /article\.fill-height \{[\s\S]*?position: relative;[\s\S]*?min-block-size: var\(--size-full\);/,
        );
        expect(recordSectionLayout).not.toMatch(/article\.fill-height \{[^}]*overflow/);
        expect(recordSectionLayout).toMatch(/article\.fill-height :global\(\.table-section\) \{\s*min-block-size: auto;/);
        expect(recordSectionLayout).toMatch(
            /article\.fill-height:global\(\.is-overflowing\) \{\s*padding-block-end: var\(--space-shell\);/,
        );
        expect(tokens).not.toMatch(/--size-workspace-content-block:/);
        expect(foundation).not.toMatch(/\.record-workspace\.fill-height \.table-section/);
        expect(foundation).toMatch(
            /\.table-section \{[\s\S]*?flex: var\(--layout-table-section-flex\);[\s\S]*?min-block-size: var\(--size-table-section-min-block\);/,
        );
        for (const source of viewerTablePanels) {
            expect(source).toMatch(/class="[^"]*table-section[^"]*"/);
        }

        expect(tokens).toMatch(
            /@media \(max-height: 40rem\) \{[\s\S]*?--space-table-screen-block: var\(--space-actions\);[\s\S]*?--space-table-screen-gap: var\(--space-actions\);/,
        );
    });
});
