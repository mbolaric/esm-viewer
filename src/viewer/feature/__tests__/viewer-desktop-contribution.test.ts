import { describe, expect, it } from 'vitest';

import { APPLICATION_COMMANDS } from '#contracts';

import { VIEWER_DESKTOP_CONTRIBUTION } from '../viewer-desktop-contribution.js';

describe('VIEWER_DESKTOP_CONTRIBUTION', () => {
    it('exposes every Viewer command exactly once to a host', () => {
        expect(VIEWER_DESKTOP_CONTRIBUTION.commands).toEqual(APPLICATION_COMMANDS);
        expect(new Set(VIEWER_DESKTOP_CONTRIBUTION.commands)).toHaveLength(APPLICATION_COMMANDS.length);
    });

    it('contains only registered commands in its menus and toolbar', () => {
        const registered = new Set<string>(APPLICATION_COMMANDS);
        const menuCommands = VIEWER_DESKTOP_CONTRIBUTION.menus.flatMap((menu) =>
            menu.items.filter((item) => item !== 'separator'),
        );

        expect(
            [...menuCommands, ...VIEWER_DESKTOP_CONTRIBUTION.toolbarCommands].every((command) => registered.has(command)),
        ).toBe(true);
    });
});
