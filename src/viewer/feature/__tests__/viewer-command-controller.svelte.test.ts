import type { ApplicationCommandState } from '#contracts';
import { waitFor } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import { createViewerDocumentHarness } from './viewer-document-harness.js';
import { createViewerTestContext } from './viewer-test-context.js';
import { ViewerCommandController } from '../controllers/viewer-command-controller.svelte.js';

describe('ViewerCommandController', () => {
    it('owns labels, enablement, execution, and deduplicated native state', async () => {
        const harness = createViewerDocumentHarness();
        const updates: ApplicationCommandState[] = [];
        const context = createViewerTestContext(harness.controller, {
            commandStateTarget: {
                update: (state) => {
                    updates.push(state);
                    return true;
                },
            },
        });
        const controller = context.commandController;

        expect(controller.label('file.open')).toBe('Open file…');
        expect(controller.label('application.exportLogs')).toBe('Export error log…');
        expect(controller.state).toEqual({
            'application.about': true,
            'application.exportLogs': true,
            'application.preferences': true,
            'application.userGuide': true,
            'file.close': false,
            'file.export': false,
            'file.open': true,
            'view.commandPalette': true,
        });
        expect(controller.execute('file.close')).toBe(false);
        expect(controller.synchronize()).toBe(true);
        expect(controller.synchronize()).toBe(true);
        expect(updates).toHaveLength(1);

        expect(controller.execute('file.open')).toBe(true);
        await waitFor(() => {
            expect(harness.parserRequestCount()).toBe(1);
        });
        expect(controller.state).toEqual({
            'application.about': false,
            'application.exportLogs': false,
            'application.preferences': false,
            'application.userGuide': false,
            'file.close': false,
            'file.export': false,
            'file.open': false,
            'view.commandPalette': false,
        });
        expect(controller.synchronize()).toBe(true);

        harness.completeLatestParser(harness.successfulParserResult());
        await waitFor(() => {
            expect(harness.controller.snapshot.status).toBe('ready');
        });
        expect(controller.state['file.close']).toBe(true);
        expect(controller.state['file.export']).toBe(true);
        expect(controller.state['application.about']).toBe(true);
        expect(controller.synchronize()).toBe(true);

        expect(controller.execute('file.export')).toBe(true);
        expect(controller.state['file.export']).toBe(false);
        expect(controller.execute('application.about')).toBe(false);
        expect(context.exportController.cancel()).toBe(true);

        expect(controller.execute('application.about')).toBe(true);
        expect(controller.state['application.about']).toBe(false);
        expect(context.aboutController.cancel()).toBe(true);

        expect(controller.execute('file.close')).toBe(true);
        await waitFor(() => {
            expect(harness.controller.snapshot.status).toBe('empty');
        });
        expect(controller.state['file.close']).toBe(false);

        expect(controller.execute('application.preferences')).toBe(true);
        expect(controller.state['file.open']).toBe(false);
        expect(controller.execute('file.open')).toBe(false);

        context.preferencesController.cancel();
        context.preferencesController.dispose();
        await context.documentController.dispose();
    });

    it('delegates application.exportLogs to the configured callback', () => {
        const harness = createViewerDocumentHarness();
        let logsExported = false;
        const context = createViewerTestContext(harness.controller);
        const controller = new ViewerCommandController({
            aboutController: context.aboutController,
            documentController: context.documentController,
            exportController: context.exportController,
            exportLogs: () => {
                logsExported = true;
            },
            preferencesController: context.preferencesController,
            stateTarget: { update: () => true },
            translationService: context.translationService,
        });

        expect(controller.execute('application.exportLogs')).toBe(true);
        expect(logsExported).toBe(true);
    });

    it('delegates application.userGuide to configured callback and handler', () => {
        const harness = createViewerDocumentHarness();
        let userGuideOpened = false;
        const context = createViewerTestContext(harness.controller);
        const controller = new ViewerCommandController({
            aboutController: context.aboutController,
            documentController: context.documentController,
            exportController: context.exportController,
            openUserGuide: () => {
                userGuideOpened = true;
            },
            preferencesController: context.preferencesController,
            stateTarget: { update: () => true },
            translationService: context.translationService,
        });

        expect(controller.execute('application.userGuide')).toBe(true);
        expect(userGuideOpened).toBe(true);
    });

    it('calls registered file-open handler before opening', async () => {
        const harness = createViewerDocumentHarness();
        const context = createViewerTestContext(harness.controller);
        const controller = context.commandController;
        const calls: string[] = [];
        const deregister = controller.registerFileOpenHandler(() => {
            calls.push('handler');
        });

        expect(controller.execute('file.open')).toBe(true);
        expect(calls).toEqual(['handler']);

        deregister();
        context.preferencesController.dispose();
        await context.documentController.dispose();
    });
});
