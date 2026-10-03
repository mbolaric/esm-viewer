import appIcon from '../assets/app-icon.png';
import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';

import CommandBarBrandingHarness from './CommandBarBrandingHarness.svelte';

afterEach(() => {
    cleanup();
});

describe('CommandBar branding', () => {
    it('renders the packaged application icon when the composition provides no branding', () => {
        const { container } = render(CommandBarBrandingHarness, { props: { label: 'action' } });

        expect(container.querySelector('.brand-mark img')?.getAttribute('src')).toBe(appIcon);
    });

    it('renders the icon provided by the application composition', () => {
        const { container } = render(CommandBarBrandingHarness, { props: { icon: '/desktop-brand.png', label: 'action' } });

        expect(container.querySelector('.brand-mark img')?.getAttribute('src')).toBe('/desktop-brand.png');
    });
});
