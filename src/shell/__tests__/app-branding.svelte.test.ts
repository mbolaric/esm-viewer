import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';

import appIcon from '../assets/app-icon.png';
import AppBrandingHarness from './AppBrandingHarness.svelte';

afterEach(() => {
    cleanup();
});

describe('app branding', () => {
    it('falls back to the packaged application icon when the composition provides no branding', () => {
        render(AppBrandingHarness);

        expect(screen.getByTestId('brand-icon').getAttribute('src')).toBe(appIcon);
    });

    it('uses the icon provided by the application composition', () => {
        render(AppBrandingHarness, { props: { icon: '/desktop-brand.png' } });

        expect(screen.getByTestId('brand-icon').getAttribute('src')).toBe('/desktop-brand.png');
    });
});
