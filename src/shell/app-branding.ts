import { getContext, hasContext, setContext } from 'svelte';

import appIcon from './assets/app-icon.png';

export interface IAppBranding {
    readonly icon: string;
}

const appBrandingKey = Symbol('app-branding');
const defaultAppBranding: IAppBranding = { icon: appIcon };

export function provideAppBranding(branding: IAppBranding): void {
    setContext(appBrandingKey, branding);
}

export function useAppBranding(): IAppBranding {
    return hasContext(appBrandingKey) ? getContext<IAppBranding>(appBrandingKey) : defaultAppBranding;
}
