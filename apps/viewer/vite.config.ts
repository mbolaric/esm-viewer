import { fileURLToPath } from 'node:url';

import { createViewerRendererConfig } from '../../renderer.config.js';
import { VIEWER_APP_MODEL } from './src/renderer/app-model.js';
import { renderStartupSplash } from '../../src/shell/startup-splash.js';

export default createViewerRendererConfig({
    root: fileURLToPath(new URL('./src/renderer', import.meta.url)),
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    svelteConfigFile: fileURLToPath(new URL('../../svelte.config.js', import.meta.url)),
    manifestPath: fileURLToPath(new URL('../../package.json', import.meta.url)),
    startupHtml: renderStartupSplash(VIEWER_APP_MODEL),
});
