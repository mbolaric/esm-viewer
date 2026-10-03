import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';

import Icon from '../icon/Icon.svelte';

afterEach(() => {
    cleanup();
});

describe('Icon', () => {
    it('renders a registered decorative Lucide icon without an accessible duplicate', () => {
        const rendered = render(Icon, {
            props: {
                name: 'circleCheck',
            },
        });
        const icon = rendered.container.querySelector('svg');

        expect(icon?.getAttribute('aria-hidden')).toBe('true');
        expect(icon?.getAttribute('width')).toBe('var(--size-icon)');
        expect(icon?.querySelector('path')).toBeTruthy();
    });

    it('uses the requested semantic icon size', () => {
        const rendered = render(Icon, {
            props: {
                name: 'chevronRight',
                size: 'small',
            },
        });

        expect(rendered.container.querySelector('svg')?.getAttribute('width')).toBe('var(--size-icon-small)');
    });

    it('renders the registered factual event and fault icon', () => {
        const rendered = render(Icon, {
            props: {
                name: 'triangleAlert',
            },
        });

        expect(rendered.container.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
    });

    it('renders the registered place and position icon', () => {
        const rendered = render(Icon, {
            props: {
                name: 'mapPin',
            },
        });

        expect(rendered.container.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
    });

    it('renders the registered view details eye icon', () => {
        const rendered = render(Icon, {
            props: {
                name: 'eye',
            },
        });

        expect(rendered.container.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
    });

    it('renders the registered copy icon', () => {
        const rendered = render(Icon, {
            props: {
                name: 'copy',
            },
        });

        expect(rendered.container.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
    });
});
