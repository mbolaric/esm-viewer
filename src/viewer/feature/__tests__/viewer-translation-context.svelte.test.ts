import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';

import type { IViewerContext } from '../viewer-context.js';
import { ReactiveTestTranslationService } from './reactive-test-translation-service.svelte.js';
import TranslationHookTestScreen from './TranslationHookTestScreen.svelte';
import { createViewerDocumentHarness } from './viewer-document-harness.js';
import { createViewerTestContext } from './viewer-test-context.js';
import { createViewerTestRenderOptionsWithContext } from './viewer-test-render.js';

afterEach(() => {
    cleanup();
});

describe('useViewerTranslationService', () => {
    it('keeps render-time translations reactive without exposing the full viewer context', async () => {
        const harness = createViewerDocumentHarness();
        const baseContext = createViewerTestContext(harness.controller);
        const translationService = new ReactiveTestTranslationService();
        const context: IViewerContext = {
            ...baseContext,
            translationService,
        };

        render(
            TranslationHookTestScreen,
            {
                props: {
                    testId: 'translated-heading',
                },
            },
            createViewerTestRenderOptionsWithContext(context),
        );

        expect(screen.getByRole('heading', { name: 'Open a tachograph file' })).toBeTruthy();

        translationService.setHeading('Tachographdatei öffnen');

        expect(await screen.findByRole('heading', { name: 'Tachographdatei öffnen' })).toBeTruthy();
    });
});
