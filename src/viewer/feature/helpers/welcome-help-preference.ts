import type { IKeyValueStore } from '#contracts';

const welcomeHelpDismissedStorageKey = 'esm-viewer.welcomeHelpDismissed';

export function loadWelcomeHelpDismissed(store: IKeyValueStore): boolean {
    return store.getItem(welcomeHelpDismissedStorageKey) === 'true';
}

export function saveWelcomeHelpDismissed(store: IKeyValueStore): void {
    store.setItem(welcomeHelpDismissedStorageKey, 'true');
}
