import { setup } from '@testing-library/svelte';

import type { IViewerContext } from '../viewer-context.js';
import ViewerContextTestWrapper from './ViewerContextTestWrapper.svelte';
import { createViewerDocumentHarness } from './viewer-document-harness.js';
import { createViewerTestContext, type IViewerTestContextOptions } from './viewer-test-context.js';

await setup();

export interface IViewerTestRenderOptions {
    readonly wrapper: typeof ViewerContextTestWrapper;
    readonly wrapperProps: { readonly context: IViewerContext };
}

export function createViewerTestRenderOptions(options: IViewerTestContextOptions = {}): IViewerTestRenderOptions {
    const harness = createViewerDocumentHarness();

    return createViewerTestRenderOptionsWithContext(createViewerTestContext(harness.controller, options));
}

export function createViewerTestRenderOptionsWithContext(context: IViewerContext): IViewerTestRenderOptions {
    return {
        wrapper: ViewerContextTestWrapper,
        wrapperProps: {
            context,
        },
    };
}
