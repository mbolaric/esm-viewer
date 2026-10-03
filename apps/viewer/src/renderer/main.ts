import '#ui/styles/foundation.css';

import { createTauriViewerContext, TauriPlatformService } from '#tauri-platform';
import { mount } from 'svelte';

import App from './App.svelte';

window.addEventListener('contextmenu', (event) => {
    event.preventDefault();
});

const target = document.querySelector<HTMLElement>('#app');

if (target === null) {
    throw new Error('Renderer root element is missing.');
}

const startupScreen = target.querySelector<HTMLElement>('[data-startup-screen]');
const service = new TauriPlatformService();
const viewerContext = await createTauriViewerContext(service);

mount(App, {
    props: {
        title: viewerContext.translationService.translate('application.name'),
        viewerContext,
    },
    target,
});

startupScreen?.remove();
