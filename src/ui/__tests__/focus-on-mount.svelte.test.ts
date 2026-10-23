import { tick } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { focusOnMount } from '../layout/focus-on-mount.js';

afterEach(() => {
    document.body.replaceChildren();
});

describe('focusOnMount', () => {
    it('leaves a newer reading position alone when the mounted heading has already departed', async () => {
        const main = document.createElement('main');
        const heading = document.createElement('h1');
        heading.tabIndex = -1;
        main.append(heading);
        document.body.append(main);
        focusOnMount(heading);
        heading.remove();
        main.scrollTop = 420;
        main.scrollLeft = 120;

        await tick();

        expect(main.scrollTop).toBe(420);
        expect(main.scrollLeft).toBe(120);
    });
});
